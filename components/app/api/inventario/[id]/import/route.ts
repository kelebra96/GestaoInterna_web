import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseTxtFile } from '@/lib/utils/txtParser';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';

// Aumentar timeout para 5 minutos (300 segundos)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const errorIdBase = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `err_${Date.now()}`;
  try {
    // Verificar autenticação
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;
    const body = await request.json();
    const { textContent, fileName } = body;

    if (!textContent || typeof textContent !== 'string') {
      return NextResponse.json(
        { error: 'Conteúdo do arquivo não fornecido' },
        { status: 400 }
      );
    }

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

    // Fazer parse do arquivo TXT
    console.log('[IMPORT] Iniciando parse do arquivo...');
    const parseResult = parseTxtFile(textContent);
    console.log(`[IMPORT] Parse concluído: ${parseResult.lines.length} linhas válidas, ${parseResult.errors.length} erros`);

    if (!parseResult.success) {
      const errorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${errorIdBase}_parse`;
      console.warn('[IMPORT] Parse inválido', {
        errorId,
        inventoryId,
        totalLines: parseResult.totalLines,
        validLines: parseResult.validLines,
        errors: parseResult.errors?.slice(0, 5),
      });
      return NextResponse.json(
        {
          error: 'Erro ao processar arquivo',
          errorId,
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    const lines = parseResult.lines;

    // Marcar início da importação para acompanhamento
    await supabaseAdmin
      .from('inventories')
      .update({
        import_status: 'running',
        import_total: lines.length,
        import_processed: 0,
        import_started_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);

    // Estatísticas
    const stats = {
      totalLines: lines.length,
      processedItems: 0,
      productsCreated: 0,
      errors: [] as any[],
    };

    // Buscar todos os EANs únicos do arquivo
    const uniqueEans = [...new Set(lines.map(l => l.ean))];
    console.log(`[IMPORT] ${uniqueEans.length} EANs únicos encontrados`);

    // Buscar todos os produtos existentes (Supabase não tem limite de 10!)
    console.log('[IMPORT] Buscando produtos existentes...');
    const existingProductsMap = new Map<string, string>(); // ean -> productId

    if (uniqueEans.length > 0) {
      const { data: existingProducts, error: productsError } = await supabaseAdmin
        .from('products')
        .select('id, ean')
        .in('ean', uniqueEans)
        .eq('company_id', auth.orgId);

      if (!productsError && existingProducts) {
        existingProducts.forEach((product: any) => {
          if (product.ean) {
            existingProductsMap.set(product.ean, product.id);
          }
        });
      }
    }
    console.log(`[IMPORT] ${existingProductsMap.size} produtos existentes encontrados`);

    // Preparar produtos novos para criar
    const newProducts: any[] = [];
    const productsToCreate = new Map<string, any>(); // ean -> product data

    lines.forEach((line, idx) => {
      const ean = line.ean;
      if (!ean) {
        stats.errors.push({ line: idx, error: 'EAN ausente' });
        return;
      }
      const eanValue = ean as string;

      // Se produto não existe e ainda não foi marcado para criação
      if (!existingProductsMap.has(eanValue) && !productsToCreate.has(eanValue)) {
        productsToCreate.set(eanValue, {
          ean: eanValue,
          sku: line.internalCode,
          name: line.description,
          company_id: auth.orgId,
          active: true,
          auto_created_by_inventory: inventoryId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    // Criar produtos novos em batch
    if (productsToCreate.size > 0) {
      console.log(`[IMPORT] Criando ${productsToCreate.size} produtos novos...`);
      newProducts.push(...productsToCreate.values());

      const { data: createdProducts, error: createError } = await supabaseAdmin
        .from('products')
        .insert(newProducts)
        .select('id, ean');

      if (createError) {
        console.error('[IMPORT] Erro ao criar produtos:', createError);
        throw createError;
      }

      if (createdProducts) {
        createdProducts.forEach((product: any) => {
          existingProductsMap.set(product.ean, product.id);
        });
        stats.productsCreated = createdProducts.length;
      }
    }

    // Preparar itens do inventário para inserir
    console.log('[IMPORT] Preparando itens do inventário...');
    const inventoryItems: any[] = [];

    lines.forEach((line, idx) => {
      const ean = line.ean;
      if (!ean) {
        return; // Já registrado no erro acima
      }
      const eanValue = ean as string;

      const productId = existingProductsMap.get(eanValue);
      if (!productId) {
        stats.errors.push({ line: idx, error: 'Produto não encontrado após criação' });
        return;
      }

      const autoCreated = productsToCreate.has(eanValue);

      inventoryItems.push({
        inventory_id: inventoryId,
        store_id: inventoryData.store_id,
        company_id: auth.orgId,
        ean: eanValue,
        internal_code: line.internalCode,
        description: line.description,
        price: line.price,
        expected_quantity: line.expectedQuantity,
        product_id: productId,
        auto_created: autoCreated,
        counted_quantity: 0,
        count_status: 'pending',
        diff_quantity: 0,
        diff_value: 0,
        diff_type: 'ok',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      stats.processedItems++;

      if ((idx + 1) % 2000 === 0) {
        console.log(`[IMPORT] ${idx + 1}/${lines.length} itens preparados`);
      }
    });

    // Inserir todos os itens em batch (Supabase suporta grandes batches)
    console.log(`[IMPORT] Inserindo ${inventoryItems.length} itens do inventário...`);

    // Dividir em lotes de 1000 para não sobrecarregar
    const BATCH_SIZE = 1000;
    for (let i = 0; i < inventoryItems.length; i += BATCH_SIZE) {
      const batch = inventoryItems.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabaseAdmin
        .from('inventory_items')
        .insert(batch);

      if (insertError) {
        console.error(`[IMPORT] Erro ao inserir lote ${i / BATCH_SIZE + 1}:`, insertError);
        throw insertError;
      }

      console.log(`[IMPORT] Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(inventoryItems.length / BATCH_SIZE)} inserido`);
    }

    console.log('[IMPORT] Todos os itens inseridos com sucesso');

    // Atualizar inventário com informações da importação
    await supabaseAdmin
      .from('inventories')
      .update({
        imported_file_name: fileName || 'arquivo.txt',
        imported_at: new Date().toISOString(),
        imported_by: auth.userId,
        total_items_expected: stats.processedItems,
        import_status: 'completed',
        import_processed: stats.processedItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);

    console.log('[IMPORT] Importação finalizada com sucesso!', stats);

    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso',
      stats,
    });
  } catch (error: any) {
    const errorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${errorIdBase}_fatal`;
    console.error('Erro ao importar arquivo:', {
      errorId,
      message: error?.message,
      stack: error?.stack,
    });
    try {
      await supabaseAdmin
        .from('inventories')
        .update({
          import_status: 'failed',
          import_message: `${error.message || 'Erro desconhecido'} (ref: ${errorId})`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (await params).id);
    } catch (updateError) {
      console.error('Erro ao atualizar status de falha:', updateError);
    }
    return NextResponse.json(
      { error: 'Erro ao importar arquivo: ' + error.message, errorId },
      { status: 500 }
    );
  }
}
