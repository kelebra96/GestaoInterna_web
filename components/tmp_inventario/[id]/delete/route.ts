import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

/**
 * DELETE - Excluir inventário e todos os dados relacionados
 */
export async function DELETE(
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

    console.log(`[Delete Inventory] Iniciando exclusão do inventário ${inventoryId}`);

    // Excluir itens do inventário
    const itemsSnapshot = await db
      .collection('inventory_items')
      .where('inventoryId', '==', inventoryId)
      .get();

    console.log(`[Delete Inventory] Excluindo ${itemsSnapshot.size} itens`);

    // Deletar em lotes de 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < itemsSnapshot.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = itemsSnapshot.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Excluir endereços do inventário
    const addressesSnapshot = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .get();

    console.log(`[Delete Inventory] Excluindo ${addressesSnapshot.size} endereços`);

    for (let i = 0; i < addressesSnapshot.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = addressesSnapshot.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Excluir contagens do inventário
    const countsSnapshot = await db
      .collection('inventory_counts')
      .where('inventoryId', '==', inventoryId)
      .get();

    console.log(`[Delete Inventory] Excluindo ${countsSnapshot.size} contagens`);

    for (let i = 0; i < countsSnapshot.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = countsSnapshot.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Excluir o inventário
    await inventoryRef.delete();

    console.log(`[Delete Inventory] Inventário ${inventoryId} excluído com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Inventário excluído com sucesso',
      stats: {
        itemsDeleted: itemsSnapshot.size,
        addressesDeleted: addressesSnapshot.size,
        countsDeleted: countsSnapshot.size,
      },
    });
  } catch (error: any) {
    console.error('[Delete Inventory] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir inventário: ' + error.message },
      { status: 500 }
    );
  }
}
