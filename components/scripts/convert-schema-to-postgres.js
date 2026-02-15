// Script para converter schema.prisma de MongoDB para PostgreSQL
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
console.log('📋 Convertendo schema.prisma de MongoDB para PostgreSQL...\n');

// Ler arquivo
let schema = fs.readFileSync(schemaPath, 'utf8');

// Backup do arquivo original
const backupPath = schemaPath + '.mongodb.backup';
fs.writeFileSync(backupPath, schema);
console.log(`✅ Backup criado: ${backupPath}\n`);

let changesCount = 0;

// 1. Mudar provider de mongodb para postgresql
schema = schema.replace(
  /provider = "mongodb"/g,
  'provider = "postgresql"'
);
changesCount++;
console.log('✅ Provider alterado: mongodb → postgresql');

// 2. Remover @map("_id") e @db.ObjectId dos IDs principais
schema = schema.replace(
  /id\s+String\s+@id\s+@default\(auto\(\)\)\s+@map\("_id"\)\s+@db\.ObjectId/g,
  'id String @id @default(uuid())'
);
console.log('✅ IDs convertidos: ObjectId → UUID');

// 3. Remover @db.ObjectId de outros campos
schema = schema.replace(
  /@db\.ObjectId/g,
  ''
);
console.log('✅ Removidas anotações @db.ObjectId');

// 4. Remover @map("_id") restantes
schema = schema.replace(
  /@map\("_id"\)\s+/g,
  ''
);
console.log('✅ Removidos @map("_id")');

// 5. Converter campos Decimal para PostgreSQL
schema = schema.replace(
  /Decimal\s+@db\.Decimal\((\d+),\s*(\d+)\)/g,
  'Decimal @db.Decimal($1, $2)'
);

// 6. Adicionar @@index onde necessário (PostgreSQL performa melhor com índices)
// Já existem no schema, não precisa adicionar

// Salvar arquivo modificado
fs.writeFileSync(schemaPath, schema);

console.log('\n✅ Schema convertido com sucesso!');
console.log(`📁 Arquivo salvo: ${schemaPath}`);
console.log(`📁 Backup original: ${backupPath}`);
console.log('\n🎯 Próximos passos:');
console.log('   1. Verifique o schema.prisma');
console.log('   2. Configure .env.local com a senha do banco Supabase');
console.log('   3. Execute: npx prisma migrate dev --name init');
console.log('   4. Execute: npx prisma generate');
