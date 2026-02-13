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

    // Buscar todos os endereços para contagem precisa
    let totalAddresses = inventoryData.total_addresses || 0;
    let addressesCompleted = inventoryData.addresses_completed || 0;

    try {
      const { data: addressesData, error: addressesError } = await supabaseAdmin
        .from('inventory_addresses')
        .select('id, status')
        .eq('inventory_id', inventoryId);

      if (!addressesError && addressesData) {
        totalAddresses = addressesData.length;
        addressesCompleted = addressesData.filter(addr => addr.status === 'completed').length;
      }
    } catch (err) {
      // fallback silencioso se query falhar
      console.error('[Inventory GET] Aggregate count fallback:', err);
    }

    const inventory = {
      id: inventoryData.id,
      name: inventoryData.name,
      storeId: inventoryData.store_id,
      status: inventoryData.status,
      totalAddresses,
      addressesCompleted,
      totalItemsExpected: inventoryData.total_items_expected || 0,
      totalItemsCounted: inventoryData.total_items_counted || 0,
      importedFileName: inventoryData.imported_file_name,
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
