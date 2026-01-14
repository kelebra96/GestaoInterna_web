import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

async function deleteCollection(collectionPath: string, batchSize: number) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: (value: unknown) => void) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    return resolve(0);
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas desenvolvedores podem executar esta a‡Æo.' }, { status: 403 });
    }

    const collections = await db.listCollections();
    for (const collection of collections) {
      await deleteCollection(collection.id, 50);
    }

    return NextResponse.json({ message: 'Banco de dados limpo com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao limpar o banco de dados:', error);
    return NextResponse.json({ error: error.message || 'Ocorreu um erro no servidor.' }, { status: 500 });
  }
}
