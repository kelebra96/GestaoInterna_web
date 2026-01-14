/**
 * Script para executar migrations no Supabase Cloud
 * Usage: npx tsx scripts/run-migrations.ts
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local explicitly
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL ou DIRECT_URL não configurado no .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  console.log('🚀 Iniciando execução das migrations...\n');
  console.log(`📡 Conectando ao Supabase...\n`);

  const client = await pool.connect();

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
        await client.query(sql);
        console.log(`   ✅ Sucesso!\n`);
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
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
