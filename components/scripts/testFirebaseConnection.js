/**
 * Script para testar conexão com Firebase
 *
 * Uso:
 * node scripts/testFirebaseConnection.js
 */

const admin = require('firebase-admin');

try {
  const serviceAccount = require('../serviceAccountKey.json');

  console.log('🔄 Testando conexão com Firebase...\n');
  console.log('📋 Informações do projeto:');
  console.log(`   Project ID: ${serviceAccount.project_id}`);
  console.log(`   Client Email: ${serviceAccount.client_email}`);

  // Inicializar Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  console.log('\n✅ Firebase Admin inicializado com sucesso!');

  // Testar listagem de usuários
  admin.auth().listUsers(1)
    .then((listUsersResult) => {
      console.log('\n✅ Conexão com Firebase Authentication OK!');
      console.log(`\n📊 Total de usuários: ${listUsersResult.users.length > 0 ? 'Pelo menos 1' : '0'}`);

      if (listUsersResult.users.length > 0) {
        console.log('\n👤 Primeiro usuário encontrado:');
        const user = listUsersResult.users[0];
        console.log(`   UID: ${user.uid}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Nome: ${user.displayName || 'Não definido'}`);
        console.log(`   Email verificado: ${user.emailVerified ? 'Sim' : 'Não'}`);
      } else {
        console.log('\n⚠️ Nenhum usuário encontrado no Firebase Authentication');
        console.log('💡 Execute: node scripts/createTestUser.js para criar um usuário de teste');
      }

      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro ao listar usuários:', error.message);
      process.exit(1);
    });

} catch (error) {
  console.error('❌ Erro ao carregar serviceAccountKey.json:', error.message);
  console.log('\n💡 Verifique se o arquivo serviceAccountKey.json existe e está correto');
  process.exit(1);
}
