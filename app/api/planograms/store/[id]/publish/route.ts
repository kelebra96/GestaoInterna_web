// web/app/api/planograms/store/[id]/publish/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Zod schema for publishing a PlanogramStore
const publishSchema = z.object({
  createComplianceTasks: z.boolean().optional().default(false),
  assignTo: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check access
async function checkAccess(auth: any, planogramStoreId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;

  const { data, error } = await supabaseAdmin
    .from('planogram_store')
    .select('org_id')
    .eq('id', planogramStoreId)
    .single();

  if (error || !data) return false;

  return data.org_id === auth.orgId;
}

// POST /api/planograms/store/[id]/publish - Publish a store-specific planogram and create compliance tasks
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = publishSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { createComplianceTasks, assignTo, scheduledDate, dueDate } = validation.data;

    const { data: planogram, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .select('*')
      .eq('id', id)
      .single();

    if (planogramError || !planogram) {
      return NextResponse.json({ error: 'Store planogram not found' }, { status: 404 });
    }

    if (planogram.status === 'published') {
      return NextResponse.json({ error: 'Store planogram is already published' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const finalDueDate = dueDate
      ? new Date(dueDate).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default 7 days

    // Atualizar planograma para published
    const { error: updateError } = await supabaseAdmin
      .from('planogram_store')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[PlanogramPublish] Error updating planogram:', updateError);
      throw updateError;
    }

    let createdTasksCount = 0;
    if (createComplianceTasks) {
      // Criar tarefa de compliance
      const { error: taskError } = await supabaseAdmin
        .from('compliance_tasks')
        .insert({
          org_id: auth.orgId,
          store_id: planogram.store_id,
          planogram_store_id: id,
          due_date: finalDueDate,
          status: 'pending',
          assigned_to: assignTo || null,
          created_at: now,
          updated_at: now,
        });

      if (taskError) {
        console.error('[PlanogramPublish] Error creating compliance task:', taskError);
      } else {
        createdTasksCount = 1;
      }
    }

    // Buscar planograma atualizado
    const { data: updated } = await supabaseAdmin
      .from('planogram_store')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      planogram: {
        id: updated!.id,
        orgId: updated!.org_id,
        storeId: updated!.store_id,
        basePlanogramId: updated!.base_planogram_id,
        name: updated!.name,
        status: updated!.status,
        adjustments: updated!.adjustments || [],
        createdAt: updated!.created_at,
        updatedAt: updated!.updated_at,
        publishedAt: updated!.published_at,
      },
      tasksCreated: createdTasksCount,
    });

  } catch (error) {
    console.error('Error publishing store planogram:', error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
