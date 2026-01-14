/**
 * Script para adicionar política RLS que permite usuários verem seus próprios perfis
 * Solução para o problema de autenticação no app mobile
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erro: Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não encontradas');
  process.exit(1);
}

async function fixUsersRLS() {
  console.log('🔧 Corrigindo políticas RLS da tabela users...\n');
  console.log(`📡 Conectando ao Supabase: ${SUPABASE_URL}\n`);

  const { Client } = await import('pg');

  // Parse connection string from DATABASE_URL
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL ou DIRECT_URL não encontrado no .env.local');
    process.exit(1);
  }

  // Parse connection URL manually to handle special characters
  const url = new URL(databaseUrl);

  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // Remove leading /
    user: url.username,
    password: decodeURIComponent(url.password),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Drop policy if exists
    console.log('⏳ Removendo política antiga (se existir)...');
    await client.query('DROP POLICY IF EXISTS "Users can view own profile" ON users;');
    console.log('✅ Política antiga removida\n');

    // Create new policy
    console.log('⏳ Criando nova política RLS...');
    await client.query(`
      CREATE POLICY "Users can view own profile" ON users
        FOR SELECT USING (
          auth.role() = 'authenticated' AND
          id = auth.uid()
        );
    `);
    console.log('✅ Nova política criada com sucesso!\n');

    // Add comment
    console.log('⏳ Adicionando comentário explicativo...');
    await client.query(`
      COMMENT ON POLICY "Users can view own profile" ON users IS
        'Allows authenticated users to view their own profile data using auth.uid()';
    `);
    console.log('✅ Comentário adicionado\n');

    console.log('🎉 Políticas RLS corrigidas com sucesso!');
    console.log('📱 O app mobile agora conseguirá buscar o perfil do usuário após login\n');

  } catch (error: any) {
    console.error('❌ Erro ao executar migração:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

fixUsersRLS()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
