/**
 * Script para migrar custom claims dos usuários existentes
 *
 * Este script lê todos os usuários do Firestore e atualiza suas custom claims
 * no Firebase Authentication para incluir role, companyId e storeId.
 *
 * Uso: npx tsx scripts/migrate-custom-claims.ts
 */

import { db, admin } from '../lib/firebase-admin';

async function migrateCustomClaims() {
  console.log('Iniciando migração de custom claims...');

  try {
    // Buscar todos os usuários do Firestore
    const usersSnapshot = await db.collection('users').get();
    console.log(`Encontrados ${usersSnapshot.size} usuários no Firestore`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        // Verificar se o usuário existe no Firebase Auth
        const userRecord = await admin.auth().getUser(userId);

        // Preparar custom claims
        const customClaims: any = {
          role: userData.role || 'agent',
        };

        if (userData.companyId) {
          customClaims.companyId = userData.companyId;
        }

        if (userData.storeId) {
          customClaims.storeId = userData.storeId;
        }

        // Support for multiple stores
        if (userData.storeIds && Array.isArray(userData.storeIds)) {
          customClaims.storeIds = userData.storeIds;
        } else if (userData.storeId) {
          // If user has storeId but no storeIds, create storeIds array
          customClaims.storeIds = [userData.storeId];
        }

        // Verificar se as claims já estão corretas
        const currentClaims = userRecord.customClaims || {};
        const storeIdsChanged = JSON.stringify(currentClaims.storeIds || []) !== JSON.stringify(customClaims.storeIds || []);
        const needsUpdate =
          currentClaims.role !== customClaims.role ||
          currentClaims.companyId !== customClaims.companyId ||
          currentClaims.storeId !== customClaims.storeId ||
          storeIdsChanged;

        if (needsUpdate) {
          // Atualizar custom claims
          await admin.auth().setCustomUserClaims(userId, customClaims);
          console.log(`✅ Atualizado: ${userData.email || userId} - Role: ${customClaims.role}`);
          updated++;
        } else {
          console.log(`⏭️  Pulado (já atualizado): ${userData.email || userId}`);
          skipped++;
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.error(`❌ Usuário não encontrado no Auth: ${userId} (${userData.email})`);
        } else {
          console.error(`❌ Erro ao processar ${userId}:`, error);
        }
        errors++;
      }
    }

    console.log('\n=== Resumo da Migração ===');
    console.log(`Total de usuários: ${usersSnapshot.size}`);
    console.log(`Atualizados: ${updated}`);
    console.log(`Pulados: ${skipped}`);
    console.log(`Erros: ${errors}`);

  } catch (error) {
    console.error('Erro fatal durante a migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrateCustomClaims()
  .then(() => {
    console.log('\nMigração concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro na migração:', error);
    process.exit(1);
  });
