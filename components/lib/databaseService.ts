
import { db as firestoreDb, admin } from './firebase-admin';
import { connectToDatabase } from './mongodb';
import { getConfig } from './config';
import { CollectionReference, DocumentData } from 'firebase-admin/firestore';
import { ObjectId } from 'mongodb';

async function getDb() {
  const config = await getConfig();
  if (config.useFirebase) {
    return { db: firestoreDb, type: 'firestore' };
  } else {
    const { db: mongoDb } = await connectToDatabase();
    return { db: mongoDb, type: 'mongodb' };
  }
}

export async function getDocuments(collectionName: string): Promise<any[]> {
  const { db, type } = await getDb();

  if (type === 'firestore') {
    const snapshot = await (db as any).collection(collectionName).get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } else {
    return (db as any).collection(collectionName).find().toArray();
  }
}

export async function createDocument(collectionName: string, data: DocumentData) {
    const { db, type } = await getDb();

    const dataWithTimestamp = {
      ...data,
      createdAt: type === 'firestore' ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
    };

    if (type === 'firestore') {
        const docRef = await (db as any).collection(collectionName).add(dataWithTimestamp);
        return { id: docRef.id, ...dataWithTimestamp };
    } else {
        const result = await (db as any).collection(collectionName).insertOne(dataWithTimestamp);
        return { id: result.insertedId.toString(), ...dataWithTimestamp };
    }
}

export async function getDocumentById(collectionName: string, id: string): Promise<any | null> {
  const { db, type } = await getDb();

  if (type === 'firestore') {
    const doc = await (db as any).collection(collectionName).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    if (!ObjectId.isValid(id)) return null;
    const doc = await (db as any).collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }
}

export async function updateDocument(collectionName: string, id: string, data: DocumentData): Promise<any> {
  const { db, type } = await getDb();

  const dataWithTimestamp = {
    ...data,
    updatedAt: type === 'firestore' ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
  };

  if (type === 'firestore') {
    await (db as any).collection(collectionName).doc(id).update(dataWithTimestamp);
    const updatedDoc = await getDocumentById(collectionName, id);
    return updatedDoc;
  } else {
    if (!ObjectId.isValid(id)) throw new Error('Invalid MongoDB ObjectId');
    await (db as any).collection(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: dataWithTimestamp });
    const updatedDoc = await getDocumentById(collectionName, id);
    return updatedDoc;
  }
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  const { db, type } = await getDb();

  if (type === 'firestore') {
    await (db as any).collection(collectionName).doc(id).delete();
  } else {
    if (!ObjectId.isValid(id)) throw new Error('Invalid MongoDB ObjectId');
    await (db as any).collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  }
}
