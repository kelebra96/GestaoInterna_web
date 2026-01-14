# 📦 Status da Migração: Batch 5 - Products/Produtos

## ✅ MIGRAÇÃO COMPLETA: 4 routes + 2 migrations!

### 🎉 Todas as Rotas Migradas

#### **Produtos (português - sistema legado) - 4 routes**

1. **`/api/produtos` (GET, POST)**
   - ✅ Lista produtos do sistema legado
   - ✅ Cria novos produtos
   - ✅ Tabela `produtos` com campos em português
   - ✅ Migrado de `databaseService` para Supabase direto

2. **`/api/produtos/[id]` (GET, PATCH, DELETE)**
   - ✅ Busca produto específico
   - ✅ Atualiza produto
   - ✅ Soft delete (marca ativo=false)
   - ✅ Aceita campos em português ou inglês

3. **`/api/produtos/import` (POST)**
   - ✅ Importação em lote de produtos
   - ✅ Batch inserts de 1000 itens
   - ✅ Migrado do Firebase batch para Supabase insert

4. **`/api/produtos/import-csv` (POST)**
   - ✅ Importação via CSV com validação Zod
   - ✅ Upsert (cria ou atualiza por SKU + orgId)
   - ✅ Processa batches de 500 produtos
   - ✅ Retorna estatísticas detalhadas
   - ✅ Salva na tabela `products` (inglês)

#### **Products (inglês - Prisma) - Não migradas**

5. **`/api/products`** - ✅ Já usa Prisma (PostgreSQL)
6. **`/api/products/[id]`** - ✅ Já usa Prisma
7. **`/api/products/import`** - ✅ Já usa Prisma

**Nota:** As rotas `/api/products` já usam Prisma que está conectado ao PostgreSQL/Supabase, então não precisaram de migração!

---

## 📊 Duas Tabelas de Produtos

O sistema mantém 2 tabelas diferentes para produtos:

### **Tabela `produtos` (português - sistema legado)**
```sql
CREATE TABLE produtos (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  ean VARCHAR(50),
  sku VARCHAR(50),
  descricao TEXT,
  comprador VARCHAR(255),    -- Buyer
  fornecedor VARCHAR(255),   -- Supplier
  preco DECIMAL(10, 2),
  unidade VARCHAR(50),       -- Unit
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Uso:**
- Sistema legado
- Rotas `/api/produtos`
- Campos em português
- Foco em comprador/fornecedor

---

### **Tabela `products` (inglês - planogramas)**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES companies(id),
  ean VARCHAR(50),
  sku VARCHAR(50),
  name TEXT NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  width DECIMAL(10, 2),      -- cm
  height DECIMAL(10, 2),     -- cm
  depth DECIMAL(10, 2),      -- cm
  price DECIMAL(10, 2),
  margin DECIMAL(5, 2),      -- %
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Uso:**
- Planogramas
- Rotas `/api/products` (Prisma)
- Import CSV avançado
- Dimensões físicas (width, height, depth)
- Multi-organização (org_id)

---

## 🆕 Migrations Criadas

### **Migration 004: Tabela Produtos (português)**
- Cria tabela `produtos` para sistema legado
- Campos em português (nome, comprador, fornecedor, etc.)
- Trigger automático para updated_at

### **Migration 005: Estender Products (inglês)**
- Adiciona `org_id` (multi-organização)
- Adiciona dimensões físicas: `width`, `height`, `depth`
- Adiciona `margin` (margem de lucro %)
- Adiciona `subcategory`
- Torna `ean` opcional (nem todos produtos têm EAN)
- Índices para `org_id` e `org_id + sku`

---

## 🔄 Padrões de Migração Aplicados

### 1. DatabaseService → Supabase Direto
```typescript
// ANTES (databaseService abstração):
import { getDocuments, createDocument } from '@/lib/databaseService';
const produtosFromDb = await getDocuments('produtos');

// DEPOIS (Supabase direto):
import { supabaseAdmin } from '@/lib/supabase-admin';
const { data: produtosFromDb } = await supabaseAdmin
  .from('produtos')
  .select('*');
```

### 2. Firebase Batch → Supabase Batch Inserts
```typescript
// ANTES (Firebase):
const batch = db.batch();
products.forEach(product => {
  const docRef = productsCollection.doc();
  batch.set(docRef, newProduct);
});
await batch.commit();

// DEPOIS (Supabase):
const BATCH_SIZE = 1000;
for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);
  await supabaseAdmin.from('produtos').insert(batch);
}
```

### 3. Upsert Pattern (Import CSV)
```typescript
// Verificar se produto existe
const { data: existingProducts } = await supabaseAdmin
  .from('products')
  .select('id')
  .eq('org_id', orgId)
  .eq('sku', product.sku)
  .limit(1);

if (existingProducts && existingProducts.length > 0) {
  // Atualizar
  await supabaseAdmin.from('products')
    .update({ ...product, updated_at: now })
    .eq('id', existingProducts[0].id);
  updatedCount++;
} else {
  // Criar
  await supabaseAdmin.from('products')
    .insert({ ...product, created_at: now });
  importedCount++;
}
```

### 4. Soft Delete
```typescript
// Não deleta, apenas desativa
const { error } = await supabaseAdmin
  .from('produtos')
  .update({ ativo: false, updated_at: now })
  .eq('id', id);
```

---

## 📁 Field Naming

### Produtos (português)
| Firebase/API (camelCase) | Supabase (snake_case) |
|-------------------------|----------------------|
| `nome` | `nome` |
| `comprador` | `comprador` |
| `fornecedor` | `fornecedor` |
| `descricao` | `descricao` |
| `ativo` | `ativo` |
| `createdAt` | `created_at` |

### Products (inglês)
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `orgId` | `org_id` |
| `imageUrl` | `image_url` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

---

## 🎯 Key Features

### Produtos (legado)
- **CRUD completo** com soft delete
- **Import em massa** (JSON)
- **Campos bilíngues** (aceita PT ou EN)
- **Sistema simples** (comprador/fornecedor)

### Products (planogramas)
- **Multi-organização** (org_id)
- **Dimensões físicas** para planogramas
- **Import CSV avançado** com validação Zod
- **Upsert inteligente** (cria ou atualiza)
- **Estatísticas de import** (imported, updated, errors)
- **Validação robusta** com Zod schema

---

## 🔥 Melhorias sobre Firebase

1. **Batch size maior** - 1000 itens vs 500 do Firebase
2. **Upsert nativo** - Verifica existência e atualiza
3. **Multi-org nativo** - org_id com foreign key
4. **Validações no DB** - Constraints e checks
5. **Full-text search** - GIN index em nome (português)
6. **Queries mais rápidas** - PostgreSQL otimizado

---

## 📁 Arquivos Migrados

**Migrations:**
- `supabase/migrations/004_produtos_table.sql`
- `supabase/migrations/005_products_extend_fields.sql`

**Routes migradas:**
- `app/api/produtos/route.ts` ✅
- `app/api/produtos/[id]/route.ts` ✅
- `app/api/produtos/import/route.ts` ✅
- `app/api/produtos/import-csv/route.ts` ✅

**Routes já usando Prisma (não migradas):**
- `app/api/products/route.ts` (Prisma)
- `app/api/products/[id]/route.ts` (Prisma)
- `app/api/products/import/route.ts` (Prisma)

---

## 📊 Progresso Geral

**Total migrado até agora:**
- ✅ Batch 1: Usuários (4 routes)
- ✅ Batch 2: Dashboard e Solicitações (7 routes)
- ✅ Batch 3: Inventário (16 routes)
- ✅ Batch 4: Mensagens, Notificações, Checklists (8 routes)
- ✅ Batch 5: Products/Produtos (4 routes)

**Total:** 39 routes migradas + 5 migrations

**Restante:** ~23 routes (Planograms, Compliance, Analytics, etc.)

---

## 🚀 Próximos Passos

**Opção 1:** Migrar Planograms (9 routes)
- Planogramas base
- Planogramas por loja
- Execuções
- Analytics
- Slots

**Opção 2:** Migrar Compliance (5 routes)
- Tasks de conformidade
- Execuções
- Upload de evidências

**Opção 3:** Focar no MOBILE
- Expandir Auth Service
- Criar Storage Service
- Criar Adapters Supabase
