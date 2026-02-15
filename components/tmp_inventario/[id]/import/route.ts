import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { parseTxtFile } from '@/lib/utils/txtParser';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// Aumentar timeout para 5 minutos (300 segundos)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const inventoryRef = db.collection('inventories').doc(inventoryId);
    const inventorySnap = await inventoryRef.get();

    if (!inventorySnap.exists) {
      return NextResponse.json(
        { error: 'Inventário não encontrado' },
        { status: 404 }
      );
    }

    const inventoryData = inventorySnap.data();

    // Verificar se o inventário pertence à mesma empresa
    if (auth.role !== "super_admin" && inventoryData?.companyId !== auth.orgId) {
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
      return NextResponse.json(
        {
          error: 'Erro ao processar arquivo',
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    const lines = parseResult.lines;

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

    // Buscar todos os produtos existentes em lotes (Firestore tem limite de 10 no IN)
    const productsCollection = db.collection('products');
    const itemsCollection = db.collection('inventory_items');
    const existingProductsMap = new Map<string, string>(); // ean -> productId

    // Buscar produtos em lotes de 10 EANs por vez (limite do Firestore)
    console.log('[IMPORT] Buscando produtos existentes...');
    const EAN_BATCH_SIZE = 10;
    for (let i = 0; i < uniqueEans.length; i += EAN_BATCH_SIZE) {
      const eanBatch = uniqueEans.slice(i, i + EAN_BATCH_SIZE);
      const productsQuery = await productsCollection
        .where('ean', 'in', eanBatch)
        .where('companyId', '==', auth.orgId)
        .get();

      productsQuery.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.ean) {
          existingProductsMap.set(data.ean, doc.id);
        }
      });
    }
    console.log(`[IMPORT] ${existingProductsMap.size} produtos existentes encontrados`);

    // Processar em lotes de 500
    const BATCH_SIZE = 500;
    console.log(`[IMPORT] Processando ${lines.length} linhas em lotes de ${BATCH_SIZE}...`);

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
      console.log(`[IMPORT] Processando lote ${batchNumber}/${totalBatches}...`);

      const batch = db.batch();
      const batchLines = lines.slice(i, i + BATCH_SIZE);

      for (const line of batchLines) {
        try {
          let productId = existingProductsMap.get(line.ean);
          let autoCreated = false;

          if (!productId) {
            // Auto-criar produto
            const newProductRef = productsCollection.doc();
            batch.set(newProductRef, {
              ean: line.ean,
              sku: line.internalCode,
              name: line.description,
              companyId: auth.orgId,
              active: true,
              autoCreatedByInventory: inventoryId,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            productId = newProductRef.id;
            if (productId) {
              existingProductsMap.set(line.ean, productId); // Adicionar ao mapa
            }
            stats.productsCreated++;
            autoCreated = true;
          }

          // Criar inventory_item apenas se temos productId
          if (productId) {
            const itemRef = itemsCollection.doc();
            batch.set(itemRef, {
              inventoryId,
              storeId: inventoryData.storeId,
              companyId: auth.orgId,
              ean: line.ean,
              internalCode: line.internalCode,
              description: line.description,
              price: line.price,
              expectedQuantity: line.expectedQuantity,
              productId,
              autoCreated,
              countedQuantity: 0,
              countStatus: 'pending',
              diffQuantity: 0,
              diffValue: 0,
              diffType: 'ok',
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });

            stats.processedItems++;
          }
        } catch (error: any) {
          stats.errors.push({
            line: i + batchLines.indexOf(line) + 1,
            ean: line.ean,
            error: error.message,
          });
        }
      }

      // Commit do batch
      await batch.commit();
      console.log(`[IMPORT] Lote ${batchNumber}/${totalBatches} concluído`);
    }

    console.log('[IMPORT] Todos os lotes processados com sucesso');

    // Atualizar inventário com informações da importação
    await inventoryRef.update({
      importedFileName: fileName || 'arquivo.txt',
      importedAt: FieldValue.serverTimestamp(),
      importedBy: auth.userId,
      totalItemsExpected: stats.processedItems,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('[IMPORT] Importação finalizada com sucesso!', stats);

    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso',
      stats,
    });
  } catch (error: any) {
    console.error('Erro ao importar arquivo:', error);
    return NextResponse.json(
      { error: 'Erro ao importar arquivo: ' + error.message },
      { status: 500 }
    );
  }
}
