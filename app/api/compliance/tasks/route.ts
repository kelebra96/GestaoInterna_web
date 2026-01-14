// web/app/api/compliance/tasks/route.ts
import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

const createTaskSchema = z.object({
  storeId: z.string(),
  planogramStoreId: z.string(),
  dueDate: z.string().datetime(),
  assignedTo: z.string().optional(),
});

// GET /api/compliance/tasks - List compliance tasks for the authenticated user
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('compliance_tasks')
      .select('*')
      .order('due_date', { ascending: true });

    switch (auth.role) {
      case 'super_admin':
        const orgId = searchParams.get('orgId');
        if (orgId) {
          query = query.eq('org_id', orgId);
        }
        break;
      case 'admin_rede':
        query = query.eq('org_id', auth.orgId);
        break;
      case 'gestor_loja':
        if (auth.storeIds && auth.storeIds.length > 0) {
          query = query.in('store_id', auth.storeIds.slice(0, 10));
        }
        break;
      case 'repositor':
      case 'merchandiser':
        query = query.eq('assigned_to', auth.userId);
        break;
      default:
        return NextResponse.json({ tasks: [] });
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasksData, error: tasksError } = await query;

    if (tasksError) {
      console.error('[ComplianceTasks] Error fetching tasks:', tasksError);
      throw tasksError;
    }

    const tasks = (tasksData || []).map((task: any) => ({
      id: task.id,
      orgId: task.org_id,
      storeId: task.store_id,
      planogramStoreId: task.planogram_store_id,
      dueDate: task.due_date,
      status: task.status,
      assignedTo: task.assigned_to,
      completedAt: task.completed_at,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }));

    // Update overdue tasks
    const now = new Date();
    const overdueUpdates: Promise<any>[] = [];
    tasks.forEach((task: any) => {
      if (task.status === 'pending' && task.dueDate && new Date(task.dueDate) < now) {
        overdueUpdates.push(
          supabaseAdmin
            .from('compliance_tasks')
            .update({
              status: 'overdue',
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id)
        );
        task.status = 'overdue';
      }
    });

    if (overdueUpdates.length > 0) {
      await Promise.all(overdueUpdates);
    }

    return NextResponse.json({ tasks });

  } catch (error) {
    console.error("Error fetching compliance tasks:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// POST /api/compliance/tasks - Create a compliance task
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede', 'gestor_loja'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = createTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, planogramStoreId, dueDate, assignedTo } = validation.data;

    if (auth.role === 'gestor_loja' && !auth.storeIds?.includes(storeId)) {
      return NextResponse.json({ error: 'Store not accessible to this manager' }, { status: 403 });
    }

    // Check store exists
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Check planogram store exists
    const { data: planogramStore, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .select('org_id')
      .eq('id', planogramStoreId)
      .single();

    if (planogramError || !planogramStore) {
      return NextResponse.json({ error: 'Planogram store not found' }, { status: 404 });
    }

    const orgIdForTask =
      auth.role === 'super_admin'
        ? planogramStore.org_id || auth.orgId
        : auth.orgId;

    const now = new Date().toISOString();
    const payload = {
      org_id: orgIdForTask,
      store_id: storeId,
      planogram_store_id: planogramStoreId,
      due_date: new Date(dueDate).toISOString(),
      status: 'pending',
      assigned_to: assignedTo || auth.userId,
      created_at: now,
      updated_at: now,
    };

    const { data: createdTask, error: insertError } = await supabaseAdmin
      .from('compliance_tasks')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error('[ComplianceTasks] Error creating task:', insertError);
      throw insertError;
    }

    const task = {
      id: createdTask.id,
      orgId: createdTask.org_id,
      storeId: createdTask.store_id,
      planogramStoreId: createdTask.planogram_store_id,
      dueDate: createdTask.due_date,
      status: createdTask.status,
      assignedTo: createdTask.assigned_to,
      createdAt: createdTask.created_at,
      updatedAt: createdTask.updated_at,
    };

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Error creating compliance task:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
