import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ComplianceExecution, AIAnalysisResult, ComplianceIssue } from '@/lib/types/planogram';

/**
 * Mock de análise de IA
 * Em produção, seria substituído por chamada a AWS Rekognition, Google Vision, etc.
 */
function mockAIAnalysis(photoUrls: string[], planogramData: any): AIAnalysisResult {
  const now = new Date();
  const totalProducts = planogramData?.slots?.length || 0;

  // Simular detecção com variação aleatória
  const detectionRate = 0.75 + Math.random() * 0.20; // 75-95%
  const productsDetected = Math.floor(totalProducts * detectionRate);
  const productsMissing = totalProducts - productsDetected;

  // Simular problemas
  const productsWrongPosition = Math.floor(Math.random() * 3);
  const gaps = Math.floor(Math.random() * 5);

  const issues: ComplianceIssue[] = [];

  // Adicionar produtos faltantes
  for (let i = 0; i < productsMissing; i++) {
    issues.push({
      type: 'missing_product',
      severity: 'high',
      productName: `Produto ${i + 1}`,
      description: 'Produto não detectado na posição esperada',
      confidence: 85 + Math.random() * 10,
    });
  }

  // Adicionar produtos fora de posição
  for (let i = 0; i < productsWrongPosition; i++) {
    issues.push({
      type: 'wrong_position',
      severity: 'medium',
      productName: `Produto ${i + 1}`,
      description: 'Produto detectado em posição incorreta',
      confidence: 80 + Math.random() * 15,
    });
  }

  // Adicionar gaps
  for (let i = 0; i < gaps; i++) {
    issues.push({
      type: 'gap',
      severity: 'low',
      description: `Gap detectado na prateleira ${i + 1}`,
      confidence: 75 + Math.random() * 15,
    });
  }

  // Calcular score de conformidade
  const maxPenalty = totalProducts * 10; // Cada produto vale 10 pontos
  const penalty = (productsMissing * 10) + (productsWrongPosition * 5) + (gaps * 2);
  const complianceScore = Math.max(0, Math.min(100, 100 - (penalty / maxPenalty) * 100));

  return {
    analysisId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: now.toISOString(),
    complianceScore: Math.round(complianceScore),
    issues,
    totalProducts,
    productsDetected,
    productsMissing,
    productsWrongPosition,
    gaps,
    provider: 'mock',
    processingTime: 500 + Math.random() * 1500, // 0.5-2 segundos
    confidence: 80 + Math.random() * 15,
  };
}

/**
 * GET /api/compliance/executions
 * Lista execuções de compliance
 * Query params: storeId, taskId, status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');
    const planogramStoreId = searchParams.get('planogramStoreId');

    let query = supabaseAdmin
      .from('compliance_executions')
      .select('*')
      .order('executed_at', { ascending: false });

    // Filtros
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (planogramStoreId) {
      query = query.eq('planogram_store_id', planogramStoreId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ComplianceExecutions] Error fetching executions:', error);
      throw error;
    }

    const executions = (data || []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      planogramStoreId: row.planogram_store_id,
      orgId: row.org_id,
      storeId: row.store_id,
      storeName: row.store_name,
      executedBy: row.executed_by,
      executedByName: row.executed_by_name,
      photos: row.photos || [],
      aiAnalysis: row.ai_analysis || undefined,
      aiScore: row.ai_score || 0,
      manualReview: row.manual_review || undefined,
      status: row.status,
      notes: row.notes,
      signature: row.signature,
      executedAt: row.executed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ executions });
  } catch (error) {
    console.error('Erro ao listar execuções:', error);
    return NextResponse.json(
      { error: 'Falha ao listar execuções' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/executions
 * Cria uma nova execução de compliance
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      taskId,
      planogramStoreId,
      storeId,
      executedBy,
      photos,
      notes,
      signature,
      runAIAnalysis,
    } = body;

    // Validações
    if (!taskId || !planogramStoreId || !storeId || !executedBy) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: taskId, planogramStoreId, storeId, executedBy' },
        { status: 400 }
      );
    }

    // Buscar tarefa
    const { data: task, error: taskError } = await supabaseAdmin
      .from('compliance_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    // Buscar planograma
    const { data: planogramStore, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .select('*, org_id')
      .eq('id', planogramStoreId)
      .single();

    if (planogramError || !planogramStore) {
      return NextResponse.json(
        { error: 'Planograma não encontrado' },
        { status: 404 }
      );
    }

    // Buscar slots do planograma para análise de IA
    const { data: slots } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_store_id', planogramStoreId);

    const planogramData = {
      ...planogramStore,
      slots: slots || [],
    };

    // Buscar loja
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single();

    const storeName = store?.name || storeId;

    // Buscar usuário
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('display_name')
      .eq('id', executedBy)
      .single();

    const executedByName = user?.display_name || executedBy;

    const now = new Date().toISOString();

    // Processar fotos
    const photosData = (photos || []).map((photo: any, index: number) => ({
      id: photo.id || `photo_${Date.now()}_${index}`,
      url: photo.url,
      moduleId: photo.moduleId || null,
      timestamp: photo.timestamp || now,
      gpsLocation: photo.gpsLocation || null,
    }));

    // Executar análise de IA se solicitado
    let aiAnalysis: AIAnalysisResult | undefined;
    let complianceScore = 0;
    let executionStatus: any = 'concluido';

    if (runAIAnalysis && photosData.length > 0) {
      aiAnalysis = mockAIAnalysis(
        photosData.map((p: any) => p.url),
        planogramData
      );

      complianceScore = aiAnalysis.complianceScore;

      // Definir status baseado no score
      if (complianceScore >= 80) {
        executionStatus = 'concluido';
      } else if (complianceScore >= 60) {
        executionStatus = 'nao_conforme';
      } else {
        executionStatus = 'nao_conforme';
      }
    }

    // Inserir execução no Supabase
    const { data: createdExecution, error: insertError } = await supabaseAdmin
      .from('compliance_executions')
      .insert({
        task_id: taskId,
        planogram_store_id: planogramStoreId,
        org_id: planogramStore.org_id,
        store_id: storeId,
        store_name: storeName,
        executed_by: executedBy,
        executed_by_name: executedByName,
        photos: photosData,
        ai_analysis: aiAnalysis || null,
        ai_score: complianceScore,
        status: executionStatus,
        notes: notes || '',
        signature: signature || '',
        executed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ComplianceExecutions] Error creating execution:', insertError);
      throw insertError;
    }

    // Atualizar tarefa para concluída
    const { error: updateError } = await supabaseAdmin
      .from('compliance_tasks')
      .update({
        status: 'concluido',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('[ComplianceExecutions] Error updating task:', updateError);
    }

    const execution = {
      id: createdExecution.id,
      taskId,
      planogramStoreId,
      orgId: planogramStore.org_id,
      storeId,
      storeName,
      executedBy,
      executedByName,
      photos: photosData,
      aiAnalysis,
      complianceScore,
      status: executionStatus,
      executedAt: now,
      createdAt: now,
      updatedAt: now,
      notes: notes || '',
      signature: signature || '',
    };

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar execução:', error);
    return NextResponse.json(
      { error: 'Falha ao criar execução' },
      { status: 500 }
    );
  }
}
