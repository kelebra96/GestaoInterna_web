/**
 * Script para criar um usuário de teste no Firebase
 *
 * Uso:
 * node scripts/createTestUser.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const auth = admin.auth();
const db = admin.firestore();

async function createTestUser() {
  const testUser = {
    email: 'admin@test.com',
    password: 'Test123456',
    displayName: 'Admin Teste',
    role: 'developer', // ou 'admin', 'manager', 'agent', 'buyer'
  };

  try {
    console.log('🔄 Criando usuário no Firebase Authentication...');

    // Criar usuário no Authentication
    const userRecord = await auth.createUser({
      email: testUser.email,
      password: testUser.password,
      displayName: testUser.displayName,
      emailVerified: true,
    });

    console.log('✅ Usuário criado no Authentication:', userRecord.uid);

    // Criar documento no Firestore
    console.log('🔄 Criando documento no Firestore...');

    await db.collection('users').doc(userRecord.uid).set({
      displayName: testUser.displayName,
      email: testUser.email,
      role: testUser.role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Documento criado no Firestore');
    console.log('\n📧 Credenciais de teste:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Senha: ${testUser.password}`);
    console.log(`   Perfil: ${testUser.role}`);
    console.log('\n✅ Usuário de teste criado com sucesso!');

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.error('❌ Erro: Email já existe no Firebase Authentication');
      console.log('\n💡 Tente usar o usuário existente ou escolha outro email');
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
    }
  } finally {
    process.exit();
  }
}

createTestUser();
