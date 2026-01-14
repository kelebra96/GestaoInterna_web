import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET - Buscar detalhes do inventário
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

    const inventory = {
      id: inventorySnap.id,
      ...inventoryData,
      createdAt: inventoryData?.createdAt?.toDate(),
      updatedAt: inventoryData?.updatedAt?.toDate(),
      importedAt: inventoryData?.importedAt?.toDate(),
    };

    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Erro ao buscar inventário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar inventário: ' + error.message },
      { status: 500 }
    );
  }
}
