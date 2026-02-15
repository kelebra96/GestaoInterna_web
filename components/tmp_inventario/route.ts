import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { InventoryCreateSchema, INVENTORY_ERROR_MESSAGES } from '@/lib/types/inventory';

/**
 * GET /api/inventario
 * Lista inventários com filtros opcionais
 * Query params: status, storeId
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const storeIdFilter = searchParams.get('storeId');

    let query = db.collection('inventories');

    // Filtrar por companyId (exceto super_admin)
    if (auth.role !== 'super_admin' && auth.orgId) {
      query = query.where('companyId', '==', auth.orgId) as any;
    }

    // Filtrar por loja se especificado
    if (storeIdFilter) {
      query = query.where('storeId', '==', storeIdFilter) as any;
    }

    // Filtrar por status se especificado
    if (statusFilter) {
      query = query.where('status', '==', statusFilter) as any;
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.orderBy('createdAt', 'desc') as any;

    const snapshot = await query.get();
    const inventarios = snapshot.docs.map((doc: any) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        startedAt: data.startedAt?.toDate?.() || null,
        completedAt: data.completedAt?.toDate?.() || null,
        importedAt: data.importedAt?.toDate?.() || null,
      };
    });

    return NextResponse.json({ inventarios });
  } catch (error) {
    console.error('Erro ao listar inventários:', error);
    return NextResponse.json({ error: 'Falha ao listar inventários' }, { status: 500 });
  }
}

/**
 * POST /api/inventario
 * Cria um novo inventário
 * Body: { name: string, storeId: string }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validar com Zod
    const validation = InventoryCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error.issues[0].message
      }, { status: 400 });
    }

    const { name, storeId } = validation.data;

    // Validar se a loja existe
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      return NextResponse.json({
        error: 'Loja não encontrada'
      }, { status: 404 });
    }

    const storeData = storeDoc.data();
    const companyId = storeData?.companyId;

    if (!companyId) {
      return NextResponse.json({
        error: 'Loja sem empresa associada'
      }, { status: 400 });
    }

    // Validar se usuário tem acesso à loja (exceto super_admin)
    if (auth.role !== 'super_admin' && auth.orgId !== companyId) {
      return NextResponse.json({
        error: 'Você não tem permissão para criar inventário nesta loja'
      }, { status: 403 });
    }

    // REGRA DE NEGÓCIO: Verificar se já existe inventário ativo na loja
    const activeInventory = await db.collection('inventories')
      .where('storeId', '==', storeId)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get();

    if (!activeInventory.empty) {
      const activeDoc = activeInventory.docs[0];
      const activeData = activeDoc.data();
      return NextResponse.json({
        error: INVENTORY_ERROR_MESSAGES.INVENTORY_ALREADY_ACTIVE,
        activeInventory: {
          id: activeDoc.id,
          name: activeData.name,
        }
      }, { status: 400 });
    }

    // Criar inventário
    const newInventory = {
      name,
      storeId,
      companyId,
      status: 'preparation',
      createdBy: auth.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),

      // Métricas iniciais
      totalAddresses: 0,
      addressesCompleted: 0,
      totalItemsExpected: 0,
      totalItemsCounted: 0,
      totalDiscrepancies: 0,
    };

    const docRef = await db.collection('inventories').add(newInventory);
    const created = await docRef.get();
    const data = created.data() || {};

    return NextResponse.json({
      inventario: {
        id: created.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar inventário:', error);
    return NextResponse.json({
      error: 'Falha ao criar inventário'
    }, { status: 500 });
  }
}
