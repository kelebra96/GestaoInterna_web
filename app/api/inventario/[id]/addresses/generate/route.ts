import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

/**
 * API para gerar endereços automaticamente por intervalo
 */
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

    const {
      rua,
      predioInicio,
      predioFim,
      andarInicio,
      andarFim,
      apartamentoInicio,
      apartamentoFim,
    } = body;

    // Validações
    if (!rua || !predioInicio || !predioFim || !andarInicio || !andarFim || !apartamentoInicio || !apartamentoFim) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    const predioInicioNum = parseInt(predioInicio);
    const predioFimNum = parseInt(predioFim);
    const andarInicioNum = parseInt(andarInicio);
    const andarFimNum = parseInt(andarFim);
    const apartamentoInicioNum = parseInt(apartamentoInicio);
    const apartamentoFimNum = parseInt(apartamentoFim);

    if (
      isNaN(predioInicioNum) ||
      isNaN(predioFimNum) ||
      isNaN(andarInicioNum) ||
      isNaN(andarFimNum) ||
      isNaN(apartamentoInicioNum) ||
      isNaN(apartamentoFimNum)
    ) {
      return NextResponse.json(
        { error: 'Todos os valores numéricos devem ser válidos' },
        { status: 400 }
      );
    }

    if (predioInicioNum > predioFimNum || andarInicioNum > andarFimNum || apartamentoInicioNum > apartamentoFimNum) {
      return NextResponse.json(
        { error: 'Os valores de início devem ser menores ou iguais aos valores de fim' },
        { status: 400 }
      );
    }

    // Verificar inventário e permissões
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

    // Calcular total de endereços
    const totalPredios = predioFimNum - predioInicioNum + 1;
    const totalAndares = andarFimNum - andarInicioNum + 1;
    const totalApartamentos = apartamentoFimNum - apartamentoInicioNum + 1;
    const totalEnderecos = totalPredios * totalAndares * totalApartamentos;

    if (totalEnderecos > 10000) {
      return NextResponse.json(
        { error: `Limite excedido: isso geraria ${totalEnderecos} endereços. Máximo: 10.000` },
        { status: 400 }
      );
    }

    console.log(`[Generate Addresses] Gerando ${totalEnderecos} endereços para inventário ${inventoryId}`);

    // Gerar endereços
    const enderecosParaCriar: string[] = [];
    const ruaNormalizada = rua.trim().toUpperCase();

    for (let predio = predioInicioNum; predio <= predioFimNum; predio++) {
      for (let andar = andarInicioNum; andar <= andarFimNum; andar++) {
        for (let apto = apartamentoInicioNum; apto <= apartamentoFimNum; apto++) {
          // Formato: RUA.PRÉDIO.ANDAR.APARTAMENTO
          // Exemplo: 002.22.10.1
          const predioStr = predio.toString().padStart(2, '0');
          const andarStr = andar.toString().padStart(2, '0');
          const aptoStr = apto.toString();

          const endereco = `${ruaNormalizada}.${predioStr}.${andarStr}.${aptoStr}`;
          enderecosParaCriar.push(endereco);
        }
      }
    }

    // Buscar endereços existentes
    const { data: existingAddresses, error: existingError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('address_code')
      .eq('inventory_id', inventoryId);

    if (existingError) {
      console.error('[Generate Addresses] Erro ao buscar endereços existentes:', existingError);
    }

    const existingAddressCodes = new Set(
      (existingAddresses || []).map((doc) => doc.address_code?.toUpperCase())
    );

    // Filtrar endereços que já existem
    const enderecosNovos = enderecosParaCriar.filter(
      (endereco) => !existingAddressCodes.has(endereco)
    );

    if (enderecosNovos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os endereços já existem',
        stats: {
          total: totalEnderecos,
          created: 0,
          duplicates: totalEnderecos,
        },
      });
    }

    // Criar endereços em lotes (Supabase permite batches maiores que Firebase)
    const BATCH_SIZE = 1000;
    let created = 0;

    for (let i = 0; i < enderecosNovos.length; i += BATCH_SIZE) {
      const lote = enderecosNovos.slice(i, i + BATCH_SIZE);
      const addressesToInsert = lote.map((addressCode) => ({
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
        console.error('[Generate Addresses] Erro ao inserir lote:', insertError);
        throw insertError;
      }

      created += lote.length;

      console.log(`[Generate Addresses] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} endereços criados`);
    }

    console.log(`[Generate Addresses] Finalizado: ${created} endereços criados, ${totalEnderecos - created} duplicados`);

    return NextResponse.json({
      success: true,
      message: `${created} endereços criados com sucesso`,
      stats: {
        total: totalEnderecos,
        created,
        duplicates: totalEnderecos - created,
      },
    });
  } catch (error: any) {
    console.error('[Generate Addresses] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar endereços: ' + error.message },
      { status: 500 }
    );
  }
}
