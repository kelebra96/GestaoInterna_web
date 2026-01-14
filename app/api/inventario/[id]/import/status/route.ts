import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;

    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (inventoryError || !inventoryData) {
      return NextResponse.json({ error: 'Inventário não encontrado' }, { status: 404 });
    }

    const isAuthorizedCompany =
      auth.role === 'super_admin' || inventoryData?.company_id === auth.orgId;

    if (!isAuthorizedCompany) {
      return NextResponse.json({ error: 'Acesso negado a este inventário' }, { status: 403 });
    }

    // Obter total esperado da importação
    const total = inventoryData?.import_total || 0;
    const status = inventoryData?.import_status || 'idle';

    // Contar itens já gravados para este inventário
    const { count, error: countError } = await supabaseAdmin
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('inventory_id', inventoryId);

    if (countError) {
      console.error('[IMPORT][STATUS] Error counting items:', countError);
    }

    const processed = count || 0;
    const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    return NextResponse.json({
      status,
      total,
      processed,
      progress,
      importStartedAt: inventoryData?.import_started_at || null,
      importedAt: inventoryData?.imported_at || null,
    });
  } catch (error: any) {
    console.error('[IMPORT][STATUS] Error:', error);
    return NextResponse.json(
      { error: 'Falha ao obter status de importação', details: error.message },
      { status: 500 }
    );
  }
}
