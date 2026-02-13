import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';
import { CountSubmitSchema } from '@/lib/types/inventory';

// POST - Registrar contagem de produto
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;
    const body = await request.json();

    // Validar body
    const validation = CountSubmitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { ean, quantity, expirationDate, addressCode } = validation.data;

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

    // Buscar o endereço
    const { data: addresses, error: addressError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('address_code', addressCode)
      .limit(1);

    if (addressError || !addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Endereço não encontrado' },
        { status: 404 }
      );
    }

    const addressData = addresses[0];

    // Validar se o usuário tem check-in ativo neste endereço
    if (addressData.status !== 'in_progress' || addressData.assigned_user_id !== auth.userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para coletar neste endereço. Faça check-in primeiro.' },
        { status: 403 }
      );
    }

    // Buscar ou criar inventory_item
    const { data: items, error: itemError } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('ean', ean)
      .limit(1);

    let itemId: string;
    let itemData: any;

    if (!items || items.length === 0) {
      // Item não existe, criar um novo (produto não estava no TXT importado)
      const newItem = {
        inventory_id: inventoryId,
        store_id: inventoryData.store_id,
        company_id: auth.orgId,
        ean,
        internal_code: '',
        description: `Produto ${ean}`,
        price: 0,
        expected_quantity: 0,
        product_id: null,
        auto_created: false,
        counted_quantity: 0,
        count_status: 'pending',
        expiration_dates: [],
        diff_quantity: 0,
        diff_value: 0,
        diff_type: 'ok',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdItem, error: createError } = await supabaseAdmin
        .from('inventory_items')
        .insert(newItem)
        .select()
        .single();

      if (createError) throw createError;

      itemId = createdItem.id;
      itemData = createdItem;
    } else {
      itemId = items[0].id;
      itemData = items[0];
    }

    // Criar registro de contagem
    const newCount = {
      inventory_id: inventoryId,
      inventory_item_id: itemId,
      address_id: addressData.id,
      store_id: inventoryData.store_id,
      company_id: auth.orgId,
      ean,
      product_description: itemData.description || `Produto ${ean}`,
      quantity,
      expiration_date: expirationDate || null,
      counted_by: auth.userId,
      counted_by_name: (auth as any).name || (auth as any).email || auth.userId,
      counted_at: new Date().toISOString(),
      address_code: addressCode,
      created_at: new Date().toISOString(),
    };

    const { data: createdCount, error: countError } = await supabaseAdmin
      .from('inventory_counts')
      .insert(newCount)
      .select()
      .single();

    if (countError) throw countError;

    // Atualizar inventory_item
    const newCountedQuantity = (itemData.counted_quantity || 0) + quantity;

    // Atualizar array de datas de validade
    let expirationDates = itemData.expiration_dates || [];
    if (expirationDate) {
      // Verificar se já existe entrada para essa data
      const existingIndex = expirationDates.findIndex((ed: any) => ed.date === expirationDate);
      if (existingIndex >= 0) {
        // Atualizar quantidade existente
        expirationDates[existingIndex].quantity += quantity;
      } else {
        // Adicionar nova data
        expirationDates.push({ date: expirationDate, quantity });
      }
    }

    // Calcular divergência
    const diffQuantity = newCountedQuantity - (itemData.expected_quantity || 0);
    const diffValue = diffQuantity * (itemData.price || 0);
    const diffType = diffQuantity === 0 ? 'ok' : (diffQuantity > 0 ? 'excess' : 'shortage');

    const { error: updateItemError } = await supabaseAdmin
      .from('inventory_items')
      .update({
        counted_quantity: newCountedQuantity,
        count_status: 'counted',
        expiration_dates: expirationDates,
        diff_quantity: diffQuantity,
        diff_value: diffValue,
        diff_type: diffType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateItemError) throw updateItemError;

    // Incrementar contador no endereço
    const { error: updateAddressError } = await supabaseAdmin
      .from('inventory_addresses')
      .update({
        items_counted: (addressData.items_counted || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressData.id);

    if (updateAddressError) throw updateAddressError;

    // Incrementar contador no inventário
    const { error: updateInventoryError } = await supabaseAdmin
      .from('inventories')
      .update({
        total_items_counted: (inventoryData.total_items_counted || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);

    if (updateInventoryError) throw updateInventoryError;

    return NextResponse.json({
      success: true,
      message: 'Contagem registrada com sucesso',
      count: {
        id: createdCount.id,
        ean,
        quantity,
        expirationDate,
        addressCode,
      },
      item: {
        description: itemData.description || `Produto ${ean}`,
        internalCode: itemData.internal_code || '',
        countedQuantity: newCountedQuantity,
        expectedQuantity: itemData.expected_quantity || 0,
        diffQuantity,
        diffType,
      },
    });
  } catch (error: any) {
    console.error('Erro ao registrar contagem:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar contagem: ' + error.message },
      { status: 500 }
    );
  }
}

// GET - Listar contagens do inventário
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
    const addressCode = searchParams.get('addressCode');
    const limit = parseInt(searchParams.get('limit') || '20');

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

    // Verificar autorização
    if (!isAuthorizedToAccessInventory(auth, {
      storeId: inventoryData.store_id,
      companyId: inventoryData.company_id
    })) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Construir query de contagens
    let query = supabaseAdmin
      .from('inventory_counts')
      .select('id, ean, product_description, quantity, expiration_date, address_code, counted_at, counted_by_name')
      .eq('inventory_id', inventoryId)
      .order('counted_at', { ascending: false })
      .limit(limit);

    if (addressCode) {
      query = query.eq('address_code', addressCode);
    }

    const { data: counts, error: countsError } = await query;

    if (countsError) throw countsError;

    // Mapear para camelCase
    const mappedCounts = (counts || []).map(c => ({
      id: c.id,
      ean: c.ean,
      description: c.product_description,
      quantity: c.quantity,
      expirationDate: c.expiration_date,
      addressCode: c.address_code,
      countedAt: c.counted_at,
      countedBy: c.counted_by_name,
    }));

    return NextResponse.json({
      counts: mappedCounts,
      total: mappedCounts.length,
    });
  } catch (error: any) {
    console.error('Erro ao listar contagens:', error);
    return NextResponse.json(
      { error: 'Erro ao listar contagens: ' + error.message },
      { status: 500 }
    );
  }
}
