import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

/**
 * POST - Finalizar inventário
 * Bloqueia novas coletas e gera arquivo output.txt com EAN + quantidade contada
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

    // Verificar permissão
    if (auth.role !== "super_admin" && inventoryData?.companyId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Verificar se já está finalizado
    if (inventoryData?.status === 'completed') {
      return NextResponse.json(
        { error: 'Inventário já está finalizado' },
        { status: 400 }
      );
    }

    console.log(`[Finalize Inventory] Finalizando inventário ${inventoryId}`);

    // Buscar todas as contagens
    const countsSnapshot = await db
      .collection('inventory_counts')
      .where('inventoryId', '==', inventoryId)
      .get();

    console.log(`[Finalize Inventory] ${countsSnapshot.size} contagens encontradas`);

    // Agrupar contagens por EAN e somar quantidades
    const eanTotals = new Map<string, number>();

    countsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const ean = data.ean;
      const quantity = data.quantity || 0;

      if (ean) {
        const currentTotal = eanTotals.get(ean) || 0;
        eanTotals.set(ean, currentTotal + quantity);
      }
    });

    // Buscar informações dos produtos
    const itemsSnapshot = await db
      .collection('inventory_items')
      .where('inventoryId', '==', inventoryId)
      .get();

    const itemsMap = new Map<string, { internalCode: string; price: number }>();
    itemsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.ean) {
        itemsMap.set(data.ean, {
          internalCode: data.internalCode || '',
          price: data.price || 0,
        });
      }
    });

    // Extrair loja do storeId (primeiros 6 dígitos ou preencher com zeros)
    const storeId = inventoryData.storeId || '0';
    const loja = storeId.toString().padStart(6, '0').slice(0, 6);

    // Data no formato MMDDAA
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const aa = String(now.getFullYear()).slice(-2);
    const data = mm + dd + aa;

    // Gerar conteúdo do arquivo output.txt
    // Formato posicional: LOJA(6) + DATA(6) + BARRAS(13) + INTERNO(9) + PRECO(9) + QTDE(8)
    const outputLines: string[] = [];

    // Ordenar por EAN para facilitar leitura
    const sortedEans = Array.from(eanTotals.keys()).sort();

    sortedEans.forEach((ean) => {
      const quantity = eanTotals.get(ean) || 0;
      const itemInfo = itemsMap.get(ean);

      // COD. BARRAS - 13 caracteres, alfanumérico, alinhado à direita
      const codBarras = ean.padStart(13, '0').slice(0, 13);

      // COD. INTERNO - 9 caracteres, numérico, alinhado à direita
      const codInterno = (itemInfo?.internalCode || '0').padStart(9, '0').slice(0, 9);

      // PRECO - 9 caracteres (7 inteiros + 2 decimais), numérico, alinhado à direita
      // Converter para centavos (ex: 3.29 -> 329)
      const precoEmCentavos = Math.round((itemInfo?.price || 0) * 100);
      const preco = String(precoEmCentavos).padStart(9, '0').slice(0, 9);

      // QTDE - 8 caracteres (5 inteiros + 3 decimais), numérico, alinhado à direita
      // Multiplicar por 1000 (ex: 2.000 -> 2000)
      const qtdeMultiplicada = Math.round(quantity * 1000);
      const qtde = String(qtdeMultiplicada).padStart(8, '0').slice(0, 8);

      // Linha completa: 6 + 6 + 13 + 9 + 9 + 8 = 51 caracteres
      const linha = loja + data + codBarras + codInterno + preco + qtde;
      outputLines.push(linha);
    });

    const outputContent = outputLines.join('\n');

    console.log(`[Finalize Inventory] ${eanTotals.size} EANs únicos processados`);

    // Atualizar status do inventário
    await inventoryRef.update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      completedBy: auth.userId,
      outputFileGenerated: true,
      totalUniqueEans: eanTotals.size,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Retornar o arquivo como download
    return new NextResponse(outputContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="output_${inventoryId}_${Date.now()}.txt"`,
      },
    });
  } catch (error: any) {
    console.error('[Finalize Inventory] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao finalizar inventário: ' + error.message },
      { status: 500 }
    );
  }
}
