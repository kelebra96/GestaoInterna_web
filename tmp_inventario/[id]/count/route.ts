import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
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

    // Buscar o endereço
    const addressQuery = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .where('addressCode', '==', addressCode)
      .limit(1)
      .get();

    if (addressQuery.empty) {
      return NextResponse.json(
        { error: 'Endereço não encontrado' },
        { status: 404 }
      );
    }

    const addressDoc = addressQuery.docs[0];
    const addressData = addressDoc.data();

    // Validar se o usuário tem check-in ativo neste endereço
    if (addressData.status !== 'in_progress' || addressData.assignedUserId !== auth.userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para coletar neste endereço. Faça check-in primeiro.' },
        { status: 403 }
      );
    }

    // Buscar ou criar inventory_item
    const itemQuery = await db
      .collection('inventory_items')
      .where('inventoryId', '==', inventoryId)
      .where('ean', '==', ean)
      .limit(1)
      .get();

    let itemDoc: any;
    let itemData: any;

    if (itemQuery.empty) {
      // Item não existe, criar um novo (produto não estava no TXT importado)
      itemDoc = db.collection('inventory_items').doc();
      itemData = {
        inventoryId,
        storeId: inventoryData.storeId,
        companyId: auth.orgId,
        ean,
        internalCode: '',
        description: `Produto ${ean}`,
        price: 0,
        expectedQuantity: 0,
        productId: null,
        autoCreated: false,
        countedQuantity: 0,
        countStatus: 'pending',
        expirationDates: [],
        diffQuantity: 0,
        diffValue: 0,
        diffType: 'ok',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await itemDoc.set(itemData);
    } else {
      itemDoc = itemQuery.docs[0].ref;
      itemData = itemQuery.docs[0].data();
    }

    // Criar registro de contagem
    const countRef = db.collection('inventory_counts').doc();
    await countRef.set({
      inventoryId,
      inventoryItemId: itemDoc.id,
      addressId: addressDoc.id,
      storeId: inventoryData.storeId,
      companyId: auth.orgId,
      ean,
      productDescription: itemData.description || `Produto ${ean}`,
      quantity,
      expirationDate: expirationDate || null,
      countedBy: auth.userId,
      countedByName: (auth as any).name || (auth as any).email || auth.userId,
      countedAt: FieldValue.serverTimestamp(),
      addressCode,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Atualizar inventory_item
    const newCountedQuantity = (itemData.countedQuantity || 0) + quantity;

    // Atualizar array de datas de validade
    let expirationDates = itemData.expirationDates || [];
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
    const diffQuantity = newCountedQuantity - (itemData.expectedQuantity || 0);
    const diffValue = diffQuantity * (itemData.price || 0);
    const diffType = diffQuantity === 0 ? 'ok' : (diffQuantity > 0 ? 'excess' : 'shortage');

    await itemDoc.update({
      countedQuantity: newCountedQuantity,
      countStatus: 'counted',
      expirationDates,
      diffQuantity,
      diffValue,
      diffType,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Incrementar contador no endereço
    await addressDoc.ref.update({
      itemsCounted: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Incrementar contador no inventário
    await inventoryRef.update({
      totalItemsCounted: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Contagem registrada com sucesso',
      count: {
        id: countRef.id,
        ean,
        quantity,
        expirationDate,
        addressCode,
      },
      item: {
        description: itemData.description || `Produto ${ean}`,
        internalCode: itemData.internalCode || '',
        countedQuantity: newCountedQuantity,
        expectedQuantity: itemData.expectedQuantity || 0,
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
