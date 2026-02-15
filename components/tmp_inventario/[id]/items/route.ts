import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

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
    const inventoryRef = db.collection('inventories').doc(inventoryId);
    const inventorySnap = await inventoryRef.get();

    if (!inventorySnap.exists) {
      return NextResponse.json(
        { error: 'Inventário não encontrado' },
        { status: 404 }
      );
    }

    const inventoryData = inventorySnap.data();

    if (auth.role !== "super_admin" && inventoryData?.companyId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Buscar item
    const itemQuery = await db
      .collection('inventory_items')
      .where('inventoryId', '==', inventoryId)
      .where('ean', '==', ean)
      .limit(1)
      .get();

    if (itemQuery.empty) {
      return NextResponse.json({ item: null });
    }

    const itemDoc = itemQuery.docs[0];
    const itemData = itemDoc.data();

    return NextResponse.json({
      item: {
        id: itemDoc.id,
        ean: itemData.ean,
        internalCode: itemData.internalCode,
        description: itemData.description,
        price: itemData.price,
        expectedQuantity: itemData.expectedQuantity,
        countedQuantity: itemData.countedQuantity,
        diffType: itemData.diffType,
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
