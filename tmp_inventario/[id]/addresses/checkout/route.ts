import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { AddressCheckinSchema } from '@/lib/types/inventory';

// POST - Check-out de endereço (finalizar coleta)
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
    const validation = AddressCheckinSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { addressCode } = validation.data;

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
        { error: 'Você não tem permissão para finalizar este endereço' },
        { status: 403 }
      );
    }

    // Fazer check-out (finalizar endereço)
    await addressDoc.ref.update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      completedBy: auth.userId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Incrementar contador de endereços completados no inventário
    await inventoryRef.update({
      addressesCompleted: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Check-out realizado com sucesso',
      address: {
        id: addressDoc.id,
        addressCode: addressData.addressCode,
        status: 'completed',
        itemsCounted: addressData.itemsCounted || 0,
      },
    });
  } catch (error: any) {
    console.error('Erro ao fazer check-out:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer check-out: ' + error.message },
      { status: 500 }
    );
  }
}
