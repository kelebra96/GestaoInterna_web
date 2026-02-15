// web/app/api/planograms/store/cleanup/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const cleanupSchema = z.object({
  ids: z.array(z.string()).min(1).optional(),
  basePlanogramId: z.string().optional(),
  storeIds: z.array(z.string()).min(1).optional(),
});

type CleanupPayload = z.infer<typeof cleanupSchema>;

function isInvalidPayload(payload: CleanupPayload): boolean {
  if (payload.ids && payload.ids.length > 0) return false;
  return !(payload.basePlanogramId && payload.storeIds && payload.storeIds.length > 0);
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = cleanupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const payload = validation.data;
    if (isInvalidPayload(payload)) {
      return NextResponse.json({
        error: 'Provide either ids[] or basePlanogramId with storeIds[].',
      }, { status: 400 });
    }

    const execDelete = async (orgColumn: string, baseColumn: string) => {
      let query = supabaseAdmin
        .from('planogram_store')
        .delete()
        .select('id');

      if (payload.ids && payload.ids.length > 0) {
        query = query.in('id', payload.ids);
      } else {
        query = query
          .eq(baseColumn, payload.basePlanogramId as string)
          .in('store_id', payload.storeIds as string[]);
      }

      if (auth.role !== 'super_admin') {
        query = query.eq(orgColumn, auth.orgId);
      }

      return query;
    };

    let result = await execDelete('org_id', 'base_planogram_id');
    if (result.error?.code === 'PGRST204') {
      result = await execDelete('company_id', 'base_id');
    }

    if (result.error) {
      console.error('[PlanogramStore] Error cleaning planograms:', result.error);
      return NextResponse.json({ error: 'Failed to cleanup planograms', details: result.error }, { status: 500 });
    }

    return NextResponse.json({
      deletedIds: (result.data || []).map((row: any) => row.id),
      count: (result.data || []).length,
    });
  } catch (error) {
    console.error('[PlanogramStore] Cleanup failed:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
