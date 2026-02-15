import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

// GET - Buscar detalhes do inventário
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

    // Buscar inventário
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (inventoryError || !inventoryData) {
      return NextResponse.json(
        { error: 'Inventário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar autorização usando helper
    if (!isAuthorizedToAccessInventory(auth, {
      storeId: inventoryData.store_id,
      companyId: inventoryData.company_id
    })) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Agregações para endereços (totais e concluídos)
    let totalAddresses = inventoryData.total_addresses || 0;
    let addressesCompleted = inventoryData.addresses_completed || 0;

    try {
      // Contar endereços totais
      const { count: totalCount, error: totalError } = await supabaseAdmin
        .from('inventory_addresses')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', inventoryId);

      if (!totalError && totalCount !== null) {
        totalAddresses = totalCount;
      }

      // Contar endereços completados
      const { count: completedCount, error: completedError } = await supabaseAdmin
        .from('inventory_addresses')
        .select('*', { count: 'exact', head: true })
        .eq('inventory_id', inventoryId)
        .eq('status', 'completed');

      if (!completedError && completedCount !== null) {
        addressesCompleted = completedCount;
      }
    } catch (err) {
      // fallback silencioso se count falhar
      console.error('[Inventory GET] Aggregate count fallback:', err);
    }

    const inventory = {
      id: inventoryData.id,
      ...inventoryData,
      totalAddresses,
      addressesCompleted,
      createdAt: new Date(inventoryData.created_at),
      updatedAt: new Date(inventoryData.updated_at),
      importedAt: inventoryData.imported_at ? new Date(inventoryData.imported_at) : null,
      startedAt: inventoryData.started_at ? new Date(inventoryData.started_at) : null,
      completedAt: inventoryData.completed_at ? new Date(inventoryData.completed_at) : null,
    };

    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Erro ao buscar inventário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar inventário: ' + error.message },
      { status: 500 }
    );
  }
}
