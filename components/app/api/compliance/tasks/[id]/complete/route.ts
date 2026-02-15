import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/compliance/tasks/[id]/complete
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { data: task, error: taskError } = await supabaseAdmin
      .from('compliance_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const canManage =
      auth.role === 'super_admin' ||
      (auth.role === 'admin_rede' && task.org_id === auth.orgId) ||
      (auth.role === 'gestor_loja' && auth.storeIds.includes(task.store_id)) ||
      task.assigned_to === auth.userId;

    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('compliance_tasks')
      .update({
        status: 'concluido',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[ComplianceTasks] Error completing task:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      task: {
        id: updatedTask.id,
        orgId: updatedTask.org_id,
        storeId: updatedTask.store_id,
        planogramStoreId: updatedTask.planogram_store_id,
        dueDate: updatedTask.due_date,
        status: updatedTask.status,
        assignedTo: updatedTask.assigned_to,
        completedAt: updatedTask.completed_at,
        createdAt: updatedTask.created_at,
        updatedAt: updatedTask.updated_at,
      },
    });
  } catch (error) {
    console.error(`Error completing compliance task ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
