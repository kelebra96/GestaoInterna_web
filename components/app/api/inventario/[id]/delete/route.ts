import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

/**
 * DELETE - Excluir inventário e todos os dados relacionados
 */
export async function DELETE(
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

    console.log(`[Delete Inventory] Iniciando exclusão do inventário ${inventoryId}`);

    // Excluir dados relacionados em paralelo (Supabase tem foreign keys com CASCADE)
    const [
      { error: itemsError, count: itemsCount },
      { error: addressesError, count: addressesCount },
      { error: countsError, count: countsCount },
    ] = await Promise.all([
      supabaseAdmin
        .from('inventory_items')
        .delete({ count: 'exact' })
        .eq('inventory_id', inventoryId),
      supabaseAdmin
        .from('inventory_addresses')
        .delete({ count: 'exact' })
        .eq('inventory_id', inventoryId),
      supabaseAdmin
        .from('inventory_counts')
        .delete({ count: 'exact' })
        .eq('inventory_id', inventoryId),
    ]);

    if (itemsError) console.error('[Delete Inventory] Erro ao excluir itens:', itemsError);
    if (addressesError) console.error('[Delete Inventory] Erro ao excluir endereços:', addressesError);
    if (countsError) console.error('[Delete Inventory] Erro ao excluir contagens:', countsError);

    console.log(`[Delete Inventory] Excluindo ${itemsCount || 0} itens, ${addressesCount || 0} endereços, ${countsCount || 0} contagens`);

    // Excluir o inventário
    const { error: deleteInventoryError } = await supabaseAdmin
      .from('inventories')
      .delete()
      .eq('id', inventoryId);

    if (deleteInventoryError) throw deleteInventoryError;

    console.log(`[Delete Inventory] Inventário ${inventoryId} excluído com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Inventário excluído com sucesso',
      stats: {
        itemsDeleted: itemsCount || 0,
        addressesDeleted: addressesCount || 0,
        countsDeleted: countsCount || 0,
      },
    });
  } catch (error: any) {
    console.error('[Delete Inventory] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir inventário: ' + error.message },
      { status: 500 }
    );
  }
}
