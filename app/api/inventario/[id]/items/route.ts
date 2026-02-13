import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

// GET - Buscar item do inventário por EAN
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
    const { searchParams } = new URL(request.url);
    const ean = searchParams.get('ean');

    if (!ean) {
      return NextResponse.json(
        { error: 'EAN é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar inventário para validar acesso
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('store_id, company_id')
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

    // Buscar item por EAN ou por código interno (busca exata)
    let { data: items, error: itemError } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('inventory_id', inventoryId)
      .or(`ean.eq.${ean},internal_code.eq.${ean}`)
      .limit(1);

    // Se não encontrou, tentar buscar por EAN que termina com o código digitado (zeros à esquerda)
    if ((!items || items.length === 0) && !itemError) {
      const result = await supabaseAdmin
        .from('inventory_items')
        .select('*')
        .eq('inventory_id', inventoryId)
        .or(`ean.ilike.%${ean},internal_code.ilike.%${ean}`)
        .limit(1);
      
      items = result.data;
      itemError = result.error;
    }

    if (itemError) {
      console.error('[Items API] Erro na busca:', itemError);
      return NextResponse.json({ item: null });
    }

    if (!items || items.length === 0) {
      console.log(`[Items API] Produto não encontrado: EAN=${ean}`);
      return NextResponse.json({ item: null });
    }

    const itemData = items[0];

    return NextResponse.json({
      item: {
        id: itemData.id,
        ean: itemData.ean,
        internalCode: itemData.internal_code,
        description: itemData.description,
        price: itemData.price,
        expectedQuantity: itemData.expected_quantity,
        countedQuantity: itemData.counted_quantity,
        diffType: itemData.diff_type,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar item:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar item: ' + error.message },
      { status: 500 }
    );
  }
}
