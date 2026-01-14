import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

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
    const { prefix = '', startNumber, endNumber } = body;

    if (!startNumber || !endNumber) {
      return NextResponse.json({ error: 'Início e fim são obrigatórios' }, { status: 400 });
    }

    const startNum = parseInt(startNumber, 10);
    const endNum = parseInt(endNumber, 10);

    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
      return NextResponse.json({ error: 'Números inválidos' }, { status: 400 });
    }

    if (startNum > endNum) {
      return NextResponse.json({ error: 'Início deve ser menor ou igual ao fim' }, { status: 400 });
    }

    // Verificar inventário e permissão
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (inventoryError || !inventoryData) {
      return NextResponse.json({ error: 'Inventário não encontrado' }, { status: 404 });
    }

    // Verificar autorização usando helper
    if (!isAuthorizedToAccessInventory(auth, {
      storeId: inventoryData.store_id,
      companyId: inventoryData.company_id
    })) {
      return NextResponse.json({ error: 'Acesso negado a este inventário' }, { status: 403 });
    }

    const total = endNum - startNum + 1;
    if (total > 10000) {
      return NextResponse.json({ error: `Limite excedido: ${total} endereços. Máximo 10.000` }, { status: 400 });
    }

    const maxLen = Math.max(startNumber.length, endNumber.length);
    const prefixNormalized = prefix.trim().toUpperCase();

    // Buscar endereços existentes para evitar duplicados
    const { data: existingAddresses, error: existingError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('address_code')
      .eq('inventory_id', inventoryId);

    if (existingError) {
      console.error('[Generate Range] Erro ao buscar endereços existentes:', existingError);
    }

    const existing = new Set(
      (existingAddresses || []).map((doc) => doc.address_code?.toUpperCase())
    );

    const toCreate: string[] = [];
    for (let n = startNum; n <= endNum; n++) {
      const code = `${prefixNormalized}${n.toString().padStart(maxLen, '0')}`;
      if (!existing.has(code)) {
        toCreate.push(code);
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os endereços já existem',
        stats: {
          total,
          created: 0,
          duplicates: total,
        },
      });
    }

    const BATCH_SIZE = 1000;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const slice = toCreate.slice(i, i + BATCH_SIZE);
      const addressesToInsert = slice.map((addressCode) => ({
        inventory_id: inventoryId,
        address_code: addressCode,
        status: 'pending',
        created_at: new Date().toISOString(),
        created_by: auth.userId,
        company_id: auth.orgId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('inventory_addresses')
        .insert(addressesToInsert);

      if (insertError) {
        console.error('[Generate Range] Erro ao inserir lote:', insertError);
        throw insertError;
      }

      created += slice.length;
    }

    return NextResponse.json({
      success: true,
      message: `${created} endereços criados com sucesso`,
      stats: {
        total,
        created,
        duplicates: total - created,
      },
    });
  } catch (error: any) {
    console.error('[Generate Range Addresses] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar endereços: ' + error.message },
      { status: 500 }
    );
  }
}
