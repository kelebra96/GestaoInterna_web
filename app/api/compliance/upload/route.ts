// web/app/api/compliance/upload/route.ts
/**
 * Endpoint de upload de fotos de compliance
 * Usa Supabase Storage
 */
import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import { ImageComplianceService } from '@/lib/ImageComplianceService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

// Helper to parse the form data
async function parseFormData(request: Request): Promise<{ fields: any, files: any }> {
    const formidableRequest = request as any;
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            multiples: true, // Allow multiple files
        });
        form.parse(formidableRequest, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            resolve({ fields, files: files as any });
        });
    });
}

// POST /api/compliance/upload - Uploads photos to Firebase Storage and creates a compliance execution record
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { fields, files } = await parseFormData(request);

    const taskId = Array.isArray(fields.taskId) ? fields.taskId[0] : fields.taskId;
    const planogramStoreId = Array.isArray(fields.planogramStoreId) ? fields.planogramStoreId[0] : fields.planogramStoreId;
    const storeId = Array.isArray(fields.storeId) ? fields.storeId[0] : fields.storeId;
    const moduleId = (Array.isArray(fields.moduleId) ? fields.moduleId[0] : fields.moduleId) || 'general';
    const photos = files.photos;

    if (!taskId || !planogramStoreId || !storeId || !photos) {
        return NextResponse.json({ error: 'Missing required fields: taskId, planogramStoreId, storeId, photos' }, { status: 400 });
    }

    const photoArray = Array.isArray(photos) ? photos : [photos];
    const savedExecutions: string[] = [];

    // Fetch the planogram for AI analysis
    const { data: planogramStore, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .select('*, org_id')
      .eq('id', planogramStoreId)
      .single();

    if (planogramError || !planogramStore) {
        return NextResponse.json({ error: 'Planogram not found for AI analysis' }, { status: 404 });
    }

    // Fetch planogram slots
    const { data: slots } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_store_id', planogramStoreId);

    const planogram = {
        id: planogramStore.id,
        ...planogramStore,
        slots: slots || [],
    };

    // Supabase Storage bucket
    const storageBucket = supabaseAdmin.storage.from('planograms');

    for (const photo of photoArray) {
        try {
            const tempPath = photo.filepath;
            const fileExtension = photo.originalFilename?.split('.').pop() || 'jpg';
            const uniqueFileName = `${uuidv4()}.${fileExtension}`;

            // Define storage path: {storeId}/{planogramStoreId}/{timestamp}_{uuid}.jpg
            const storagePath = `${storeId}/${planogramStoreId}/${Date.now()}_${uniqueFileName}`;

            // Read the file from temp location
            const imageBuffer = await fs.readFile(tempPath);

            // Upload to Supabase Storage
            const { error: uploadError } = await storageBucket.upload(storagePath, imageBuffer, {
                contentType: photo.mimetype || 'image/jpeg',
                cacheControl: '3600',
                upsert: false,
            });

            if (uploadError) {
                console.error('[ComplianceUpload] Error uploading to Supabase Storage:', uploadError);
                throw uploadError;
            }

            // Get the public URL
            const { data: { publicUrl } } = storageBucket.getPublicUrl(storagePath);
            const imageUrl = publicUrl;

            // Perform AI analysis with Google Cloud Vision
            const analysisResult = await ImageComplianceService.analyzeShelfImage(imageBuffer, planogram, moduleId);

            const now = new Date().toISOString();

            // Create compliance execution record
            const { data: createdExecution, error: insertError } = await supabaseAdmin
              .from('compliance_executions')
              .insert({
                org_id: planogramStore.org_id,
                store_id: storeId,
                store_name: fields.storeName || undefined,
                planogram_store_id: planogramStoreId,
                task_id: taskId,
                executed_by: auth.userId,
                executed_by_name: auth.userId || auth.userId,
                photos: [
                    {
                        id: uuidv4(),
                        url: imageUrl,
                        moduleId: moduleId,
                        timestamp: now,
                        gpsLocation: fields.gpsLocation ? JSON.parse(fields.gpsLocation) : undefined,
                    },
                ],
                ai_analysis: {
                    analysisId: uuidv4(),
                    timestamp: now,
                    complianceScore: analysisResult.score,
                    issues: analysisResult.findings
                        .filter((f) => f.type !== 'correct')
                        .map((f) => ({
                            type: f.type === 'missing' ? 'missing_product' :
                                  f.type === 'extra' ? 'foreign_product' :
                                  f.type === 'misplaced' ? 'wrong_position' : 'gap',
                            severity: f.type === 'missing' ? 'high' : 'medium',
                            productId: f.expectedProductSku || f.detectedProductSku,
                            productName: f.reason,
                            description: f.reason || '',
                            confidence: f.confidence || 80,
                        })),
                    totalProducts: planogram.slots?.length || 0,
                    productsDetected: analysisResult.findings.filter((f) => f.type === 'correct').length,
                    productsMissing: analysisResult.findings.filter((f) => f.type === 'missing').length,
                    productsWrongPosition: analysisResult.findings.filter((f) => f.type === 'misplaced').length,
                    gaps: analysisResult.findings.filter((f) => f.type === 'extra').length,
                    provider: 'vision',
                    confidence: analysisResult.score,
                },
                ai_score: analysisResult.score,
                status: analysisResult.score >= 80 ? 'concluido' : 'nao_conforme',
                executed_at: now,
                created_at: now,
                updated_at: now,
                notes: fields.notes || '',
                signature: fields.signature || '',
              })
              .select()
              .single();

            if (insertError) {
                console.error('[ComplianceUpload] Error creating execution:', insertError);
                throw insertError;
            }

            savedExecutions.push(createdExecution.id);

            // Clean up temp file
            await fs.unlink(tempPath).catch(() => {
                // Ignore errors cleaning up temp files
            });
        } catch (photoError) {
            console.error('Error processing photo:', photoError);
            // Continue processing other photos even if one fails
        }
    }

    if (savedExecutions.length === 0) {
        return NextResponse.json({ error: 'Failed to process any photos' }, { status: 500 });
    }

    // Update task status to completed
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('compliance_tasks')
      .update({
        status: 'concluido',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', taskId);

    return NextResponse.json({
        success: true,
        executionIds: savedExecutions,
        message: `${savedExecutions.length} photo(s) uploaded and analyzed successfully`,
    });

  } catch (error) {
    console.error("Error uploading compliance photo:", error);
    return NextResponse.json({
        error: "An internal server error occurred during upload",
        details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
