// /web/lib/firebase-client.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDU2dKI9DC0rrsQ7E41WbbYMrkzUwAHVwg",
  authDomain: "myinventoy.firebaseapp.com",
  projectId: "myinventoy",
  storageBucket: "myinventoy.firebasestorage.app",
  messagingSenderId: "220214662897",
  // appId is optional for web
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Habilitar persistência offline do Firestore
// Usar multi-tab para suportar múltiplas abas abertas
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('[Firebase] Persistência offline habilitada com sucesso');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Persistência offline não pode ser habilitada (múltiplas abas abertas)');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Persistência offline não suportada neste navegador');
      } else {
        console.error('[Firebase] Erro ao habilitar persistência:', err);
      }
    });
}

export { app, auth, db, storage };
