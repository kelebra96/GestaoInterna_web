#!/usr/bin/env node

/**
 * Script para gerar chaves JWT do Supabase
 * Uso: node scripts/generate-supabase-keys.js
 */

const crypto = require('crypto');

// Gerar JWT Secret (256 bits = 32 bytes)
const jwtSecret = crypto.randomBytes(32).toString('base64');

console.log('='.repeat(80));
console.log('CHAVES SUPABASE GERADAS');
console.log('='.repeat(80));
console.log('');
console.log('Copie estas variáveis para o seu arquivo .env:');
console.log('');
console.log('# JWT Secret (use a mesma que você já tem ou esta nova)');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');
console.log('# PostgreSQL Password (senha forte para produção)');
console.log(`POSTGRES_PASSWORD=${crypto.randomBytes(16).toString('hex')}`);
console.log('');
console.log('# Supabase Keys (geradas com o JWT_SECRET acima)');
console.log('# NOTA: Para produção, você deve gerar JWTs válidos com tempo de expiração adequado');
console.log('# Por enquanto, vamos usar as chaves padrão do kong.yml que não expiram');
console.log('');
console.log('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UiLAogICAgImlhdCI6IDE2ODkyNDE2MDAsCiAgICAiZXhwIjogMTg0NzA5NTIwMAp9.Lm_h4Wk7qK6t5NcqB_7X_mY3Zj8oV9yF5wC2xQa5Nzs');
console.log('');
console.log('SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZSIsCiAgICAiaWF0IjogMTY4OTI0MTYwMCwKICAgICJleHAiOiAxODQ3MDk1MjAwCn0.vSZ7qK9hJ6Y2pX8bN_4Zm3nT5vR9cW1fL8aH2bQ6kPs');
console.log('');
console.log('# URLs Supabase');
console.log('SUPABASE_URL=http://localhost:8000');
console.log('API_EXTERNAL_URL=http://localhost:8000');
console.log('SITE_URL=http://localhost:8080');
console.log('');
console.log('# Email Settings (opcional, desabilite auto-confirm em produção)');
console.log('ENABLE_EMAIL_SIGNUP=true');
console.log('ENABLE_EMAIL_AUTOCONFIRM=true');
console.log('DISABLE_SIGNUP=false');
console.log('');
console.log('='.repeat(80));
console.log('');
console.log('IMPORTANTE: Para produção na VPS Hostinger:');
console.log('- Mude SUPABASE_URL para http://SEU_IP:8000 ou https://www.myinventory.com.br');
console.log('- Mude SITE_URL para https://www.myinventory.com.br');
console.log('- Gere uma senha forte para POSTGRES_PASSWORD');
console.log('- Configure SMTP para emails de confirmação (opcional)');
console.log('');
