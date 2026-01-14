import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

type InventoryItemDoc = {
  ean?: string;
  description?: string;
  internal_code?: string;
  expected_quantity?: number;
  price?: number;
  product_id?: string;
  address_code?: string;
};

type InventoryAddressDoc = {
  address_code?: string;
};

/**
 * API para baixar todos os dados do inventário para uso offline
 */
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

    console.log('[Download Offline] Iniciando download para:', inventoryId);

    // Buscar TODOS os itens do inventário
    const { data: itemsData, error: itemsError } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('inventory_id', inventoryId);

    if (itemsError) {
      console.error('[Download Offline] Erro ao buscar itens:', itemsError);
      throw itemsError;
    }

    const items = (itemsData || []).map((data: InventoryItemDoc) => ({
      ean: data.ean,
      description: data.description,
      internalCode: data.internal_code,
      expectedQuantity: data.expected_quantity || 0,
      price: data.price || 0,
      productId: data.product_id,
    }));

    console.log(`[Download Offline] ${items.length} itens encontrados`);

    // Buscar TODOS os endereços únicos do inventário
    const addressesSet = new Set<string>();

    // Buscar endereços dos itens importados
    (itemsData || []).forEach((data: InventoryItemDoc) => {
      if (data.address_code) {
        addressesSet.add(data.address_code.toUpperCase());
      }
    });

    // Buscar endereços já com check-in/checkout
    const { data: addressesData, error: addressesError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId);

    if (!addressesError && addressesData) {
      addressesData.forEach((data: InventoryAddressDoc) => {
        if (data.address_code) {
          addressesSet.add(data.address_code.toUpperCase());
        }
      });
    }

    const addresses = Array.from(addressesSet).sort();

    console.log(`[Download Offline] ${addresses.length} endereços únicos encontrados`);

    return NextResponse.json({
      success: true,
      inventory: {
        id: inventoryId,
        name: inventoryData.name || 'Inventário',
        storeId: inventoryData.store_id,
        storeName: inventoryData.store_name,
      },
      items,
      addresses,
      stats: {
        itemsCount: items.length,
        addressesCount: addresses.length,
        downloadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Download Offline] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao baixar dados: ' + error.message },
      { status: 500 }
    );
  }
}
