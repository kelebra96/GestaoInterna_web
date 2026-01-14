import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { AddressCreateSchema } from '@/lib/types/inventory';

// GET - Listar endereços do inventário
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

    if (auth.role !== "super_admin" && inventoryData?.companyId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Buscar endereços
    const addressesSnapshot = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .get();

    // Mapear endereços e enriquecer com nome do usuário se necessário
    const addresses = await Promise.all(
      addressesSnapshot.docs.map(async (doc: any) => {
        const data = doc.data();
        let assignedUserName = data.assignedUserName;

        // Se assignedUserName parece ser um ID (tem mais de 20 caracteres e sem espaços), buscar nome real
        if (
          data.assignedUserId &&
          (!assignedUserName ||
            (assignedUserName.length > 20 && !assignedUserName.includes(' ')))
        ) {
          try {
            const userDoc = await db.collection('users').doc(data.assignedUserId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              assignedUserName = userData?.name || userData?.email || data.assignedUserId;
            }
          } catch (error) {
            console.warn('Erro ao buscar nome do usuário:', error);
          }
        }

        return {
          id: doc.id,
          ...data,
          assignedUserName,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          assignedAt: data.assignedAt?.toDate(),
        };
      })
    );

    // Ordenar por addressCode
    addresses.sort((a: any, b: any) => a.addressCode.localeCompare(b.addressCode));

    // Calcular estatísticas de produtividade por usuário
    const userStats = new Map<string, {
      userId: string;
      userName: string;
      addressesCompleted: number;
      totalItemsCounted: number;
    }>();

    addresses.forEach((address: any) => {
      if (address.assignedUserId && address.status === 'completed') {
        const existing = userStats.get(address.assignedUserId);
        if (existing) {
          existing.addressesCompleted += 1;
          existing.totalItemsCounted += address.itemsCounted || 0;
        } else {
          userStats.set(address.assignedUserId, {
            userId: address.assignedUserId,
            userName: address.assignedUserName || address.assignedUserId,
            addressesCompleted: 1,
            totalItemsCounted: address.itemsCounted || 0,
          });
        }
      }
    });

    // Converter para array e ordenar por produtividade
    const topUsers = Array.from(userStats.values())
      .sort((a, b) => {
        // Ordenar primeiro por endereços completos, depois por itens contados
        if (b.addressesCompleted !== a.addressesCompleted) {
          return b.addressesCompleted - a.addressesCompleted;
        }
        return b.totalItemsCounted - a.totalItemsCounted;
      })
      .slice(0, 10); // Top 10

    return NextResponse.json({ addresses, topUsers });
  } catch (error: any) {
    console.error('Erro ao buscar endereços:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar endereços: ' + error.message },
      { status: 500 }
    );
  }
}

// POST - Cadastrar novos endereços
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
    const validation = AddressCreateSchema.safeParse(body);
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

    // Verificar se endereço já existe
    const existingAddress = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .where('addressCode', '==', addressCode)
      .limit(1)
      .get();

    if (!existingAddress.empty) {
      return NextResponse.json(
        { error: 'Endereço já cadastrado neste inventário' },
        { status: 409 }
      );
    }

    // Criar endereço
    const addressRef = db.collection('inventory_addresses').doc();
    await addressRef.set({
      inventoryId,
      storeId: inventoryData.storeId,
      companyId: auth.orgId,
      addressCode,
      status: 'pending',
      itemsCounted: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Atualizar contador no inventário
    await inventoryRef.update({
      totalAddresses: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Endereço cadastrado com sucesso',
      addressId: addressRef.id,
    });
  } catch (error: any) {
    console.error('Erro ao cadastrar endereço:', error);
    return NextResponse.json(
      { error: 'Erro ao cadastrar endereço: ' + error.message },
      { status: 500 }
    );
  }
}
