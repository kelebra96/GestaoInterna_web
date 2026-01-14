/**
 * Script para executar migrations no Supabase Cloud usando Supabase Client
 * Usage: npx tsx scripts/run-migrations-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local explicitly
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigrations() {
  console.log('🚀 Iniciando execução das migrations...\n');
  console.log(`📡 Conectando ao Supabase (${SUPABASE_URL})...\n`);

  try {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ordenar por nome (001, 002, etc.)

    console.log(`📁 Encontradas ${sqlFiles.length} migrations:\n`);
    sqlFiles.forEach(f => console.log(`   - ${f}`));
    console.log('');

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      console.log(`⏳ Executando: ${file}...`);

      try {
        // Execute SQL using Supabase RPC
        const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

        if (error) {
          // Check if it's an "already exists" error
          if (
            error.message.includes('already exists') ||
            error.message.includes('duplicate')
          ) {
            console.log(`   ⚠️  Já existe (ignorado)\n`);
          } else {
            console.error(`   ❌ Erro: ${error.message}\n`);
          }
        } else {
          console.log(`   ✅ Sucesso!\n`);
        }
      } catch (err: any) {
        // Ignorar erros de "already exists"
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate')
        ) {
          console.log(`   ⚠️  Já existe (ignorado)\n`);
        } else {
          console.error(`   ❌ Erro: ${err.message}\n`);
        }
      }
    }

    console.log('✅ Todas as migrations foram processadas!');
    console.log('\n📝 Nota: Alguns avisos "já existe" são normais.\n');
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    throw error;
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
