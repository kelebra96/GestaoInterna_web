import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { AddressCheckinSchema } from '@/lib/types/inventory';

// POST - Check-in em endereço (iniciar coleta)
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

    // Buscar o endereço pelo código
    const addressQuery = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .where('addressCode', '==', addressCode)
      .limit(1)
      .get();

    if (addressQuery.empty) {
      return NextResponse.json(
        { error: 'Endereço não cadastrado neste inventário' },
        { status: 404 }
      );
    }

    const addressDoc = addressQuery.docs[0];
    const addressData = addressDoc.data();

    // Se o endereço já está atribuído ao usuário atual, permitir re-checkin
    if (addressData.assignedUserId === auth.userId) {
      // Apenas garantir que está em in_progress
      if (addressData.status !== 'in_progress') {
        await addressDoc.ref.update({
          status: 'in_progress',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Check-in realizado com sucesso',
        address: {
          id: addressDoc.id,
          addressCode: addressData.addressCode,
          status: 'in_progress',
        },
      });
    }

    // Verificar se usuário já tem OUTRO endereço ativo
    const userActiveAddresses = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .where('assignedUserId', '==', auth.userId)
      .where('status', 'in', ['assigned', 'in_progress'])
      .limit(1)
      .get();

    if (!userActiveAddresses.empty) {
      const activeAddress = userActiveAddresses.docs[0].data();
      return NextResponse.json(
        {
          error: 'Você já tem um endereço ativo',
          details: {
            addressCode: activeAddress.addressCode,
            status: activeAddress.status,
          },
        },
        { status: 409 }
      );
    }

    // Verificar se o endereço está sendo usado por outro usuário
    if (addressData.status === 'in_progress' || addressData.status === 'assigned') {
      return NextResponse.json(
        {
          error: 'Endereço está sendo usado por outro usuário',
          details: {
            assignedTo: addressData.assignedUserName,
            since: addressData.assignedAt,
          },
        },
        { status: 409 }
      );
    }

    if (addressData.status === 'completed') {
      return NextResponse.json(
        { error: 'Endereço já foi finalizado' },
        { status: 409 }
      );
    }

    // Buscar nome do usuário no Firestore
    let userName = auth.userId; // fallback
    try {
      const userDoc = await db.collection('users').doc(auth.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userName = userData?.name || userData?.email || auth.userId;
      }
    } catch (error) {
      console.warn('Erro ao buscar nome do usuário:', error);
    }

    // Fazer check-in (atribuir ao usuário e iniciar)
    await addressDoc.ref.update({
      status: 'in_progress',
      assignedUserId: auth.userId,
      assignedUserName: userName,
      assignedAt: FieldValue.serverTimestamp(),
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Check-in realizado com sucesso',
      address: {
        id: addressDoc.id,
        addressCode: addressData.addressCode,
        status: 'in_progress',
      },
    });
  } catch (error: any) {
    console.error('Erro ao fazer check-in:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer check-in: ' + error.message },
      { status: 500 }
    );
  }
}
