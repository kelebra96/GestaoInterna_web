import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

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

    console.log('[Download Offline] Iniciando download para:', inventoryId);

    // Buscar TODOS os itens do inventário
    const itemsSnapshot = await db
      .collection('inventory_items')
      .where('inventoryId', '==', inventoryId)
      .get();

    const items = itemsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ean: data.ean,
        description: data.description,
        internalCode: data.internalCode,
        expectedQuantity: data.expectedQuantity || 0,
        price: data.price || 0,
        productId: data.productId,
      };
    });

    console.log(`[Download Offline] ${items.length} itens encontrados`);

    // Buscar TODOS os endereços únicos do inventário
    const addressesSet = new Set<string>();

    // Buscar endereços dos itens importados
    itemsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.addressCode) {
        addressesSet.add(data.addressCode.toUpperCase());
      }
    });

    // Buscar endereços já com check-in/checkout
    const addressesSnapshot = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .get();

    addressesSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.addressCode) {
        addressesSet.add(data.addressCode.toUpperCase());
      }
    });

    const addresses = Array.from(addressesSet).sort();

    console.log(`[Download Offline] ${addresses.length} endereços únicos encontrados`);

    return NextResponse.json({
      success: true,
      inventory: {
        id: inventoryId,
        name: inventoryData.name || 'Inventário',
        storeId: inventoryData.storeId,
        storeName: inventoryData.storeName,
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
