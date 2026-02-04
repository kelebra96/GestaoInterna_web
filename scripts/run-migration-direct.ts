#!/usr/bin/env tsx
/**
 * Executa uma migration específica diretamente no Postgres via pg client
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx scripts/run-migration-direct.ts 019_image_pipeline_production.sql
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Parse DATABASE_URL ou usa variáveis separadas
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

let clientConfig: any;

if (DATABASE_URL) {
  // Parse manual da connection string para evitar problemas no Windows
  // Remove aspas se existirem
  const cleanUrl = DATABASE_URL.replace(/^["']|["']$/g, '');
  const match = cleanUrl.match(/postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/([^?]+)/);
  if (match) {
    clientConfig = {
      user: match[1],
      password: decodeURIComponent(match[2]), // Decode URL-encoded password
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
      ssl: { rejectUnauthorized: false },
    };
    console.log(`📋 Config parseada: user=${match[1]}, host=${match[3]}, db=${match[5]}`);
  } else {
    clientConfig = {
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
    };
  }
} else if (SUPABASE_URL) {
  // Extrai host do SUPABASE_URL
  const supabaseHost = new URL(SUPABASE_URL).hostname;
  const dbHost = supabaseHost.replace('.supabase.co', '');

  clientConfig = {
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || '',
    host: `db.${dbHost}.supabase.co`,
    port: 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
} else {
  console.error('❌ DATABASE_URL ou SUPABASE_URL não configurada');
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.log('Uso: tsx scripts/run-migration-direct.ts <nome_do_arquivo.sql>');
  console.log('');
  console.log('Migrations disponíveis:');
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  files.forEach(f => console.log(`  - ${f}`));
  process.exit(0);
}

async function runMigration() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const filePath = path.join(migrationsDir, migrationFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`🚀 Executando migration: ${migrationFile}`);
  console.log(`📡 Conectando ao banco de dados...`);
  console.log(`   Host: ${clientConfig.host || 'via connection string'}`);

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Conectado!');

    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`⏳ Executando SQL (${sql.length} caracteres)...`);

    await client.query(sql);

    console.log(`✅ Migration ${migrationFile} executada com sucesso!`);
  } catch (error: any) {
    console.error(`❌ Erro na migration:`, error.message);

    // Mostra detalhes do erro Postgres
    if (error.position) {
      const sql = fs.readFileSync(filePath, 'utf8');
      const pos = parseInt(error.position);
      const context = sql.substring(Math.max(0, pos - 100), pos + 100);
      console.error(`\n📍 Contexto do erro (posição ${pos}):`);
      console.error(context);
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
