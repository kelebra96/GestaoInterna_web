import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let isFirebaseInitialized = false;

// Verifica se o Firebase Admin já foi inicializado
if (!admin.apps.length) {
  try {
    // Opção 1: Usar variáveis de ambiente (recomendado para produção)
    if (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY) {

      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ||
                          `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
        storageBucket: storageBucket
      });

      console.log('Firebase Admin initialized successfully from environment variables');
      console.log('Storage bucket:', storageBucket);
      isFirebaseInitialized = true;
    }
    // Opção 2: Usar arquivo de credenciais (desenvolvimento local)
    else {
      // Tenta primeiro na raiz do projeto (um nível acima de web/)
      let serviceAccountPath = path.join(process.cwd(), '..', 'serviceAccountKey.json');

      // Se não encontrar, tenta na pasta web/
      if (!fs.existsSync(serviceAccountPath)) {
        serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      }

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        const storageBucket = `${serviceAccount.project_id}.firebasestorage.app`;

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
          storageBucket: storageBucket
        });

        console.log('Firebase Admin initialized successfully from service account file');
        console.log('Project ID:', serviceAccount.project_id);
        console.log('Client Email:', serviceAccount.client_email);
        console.log('Storage bucket:', storageBucket);
        isFirebaseInitialized = true;
      } else {
        console.warn('⚠️  Firebase Admin not initialized: Service account file not found');
        console.warn('   Expected location: ' + serviceAccountPath);
        console.warn('   Alternative: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables');
      }
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    isFirebaseInitialized = false;
  }
} else {
  isFirebaseInitialized = true;
}

// Exporta serviços do Firebase de forma segura
// Se o Firebase não foi inicializado, os métodos lançarão erros descritivos quando usados
let firestoreInstance: admin.firestore.Firestore | null = null;
let isFirestoreConfigured = false;

if (isFirebaseInitialized) {
  firestoreInstance = admin.firestore();

  // Configurar Firestore apenas se ainda não foi configurado
  if (!isFirestoreConfigured) {
    try {
      firestoreInstance.settings({
        ignoreUndefinedProperties: true,
      });
      isFirestoreConfigured = true;
      console.log('Firestore instance created and configured');
    } catch (error: any) {
      // Se já foi configurado, apenas ignora o erro
      if (!error.message?.includes('already been initialized')) {
        console.error('Error configuring Firestore:', error);
      }
    }
  }
}

export const db = firestoreInstance as any;
export const auth = isFirebaseInitialized ? admin.auth() : null as any;
export const messaging = isFirebaseInitialized ? admin.messaging() : null as any;
export const storage = isFirebaseInitialized ? admin.storage() : null as any;
export const adminStorage = isFirebaseInitialized ? admin.storage : null as any;
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export { admin, isFirebaseInitialized };
