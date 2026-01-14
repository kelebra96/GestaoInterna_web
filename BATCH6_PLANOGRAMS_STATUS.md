# 📦 Status da Migração: Batch 6 - Planograms

## ✅ MIGRAÇÃO COMPLETA: 8 routes + 1 service + 1 migration!

### 🎉 Todas as Rotas Migradas

#### **Planograms Base - 3 endpoints (2 routes)**
1. **`/api/planograms/base` (GET, POST)**
   - ✅ Lista planogramas base (templates)
   - ✅ Cria novo planograma base
   - ✅ Usa `planogramService` migrado
   - ✅ Filtros: orgId, status

2. **`/api/planograms/base/[id]` (GET, PUT, DELETE)**
   - ✅ Busca planogram específico
   - ✅ Atualiza planograma (incrementa versão se mudar módulos)
   - ✅ Soft delete (arquivar)
   - ✅ Usa `planogramService` migrado

3. **`/api/planograms/base/[id]/slots` (GET, PUT)**
   - ✅ Lista slots do planograma
   - ✅ Atualiza slots (delete + batch insert)
   - ✅ Atualiza totalSKUs automaticamente
   - ✅ Migrado de Firebase batch para Supabase batch

#### **Planograms Store - 3 endpoints (3 routes)**

4. **`/api/planograms/store` (GET, POST)**
   - ✅ Lista planogramas de lojas
   - ✅ Cria planograma de loja baseado em template
   - ✅ Auto-generate: remove produtos sem estoque
   - ✅ Batch insert de slots (Supabase)

5. **`/api/planograms/store/[id]` (GET, PUT, DELETE)**
   - ✅ Busca planograma de loja
   - ✅ Atualiza planograma e slots
   - ✅ Delete cascade (planograma + slots)

6. **`/api/planograms/store/[id]/publish` (POST)**
   - ✅ Publica planograma de loja
   - ✅ Cria tarefa de compliance (opcional)
   - ✅ Define due_date (7 dias padrão)

#### **Analytics e Features - 3 routes**

7. **`/api/planograms/analytics` (GET)**
   - ✅ KPIs de planogramas e compliance
   - ✅ Best/worst stores
   - ✅ Top categories
   - ✅ Queries em `compliance_executions` e `compliance_tasks` (Supabase)
   - ⚠️ Requer tabelas de compliance (Batch 7)

8. **`/api/planograms/features` (GET)**
   - ✅ Já usava Prisma
   - ✅ Nenhuma mudança necessária

#### **Execution (Mock) - 1 route**

9. **`/api/planograms/executions/[id]` (GET)**
   - ⚠️ Retorna dados mockados
   - 📝 TODO comment sugere migrar para Firestore/Prisma
   - ⏭️ Deixado como está (será migrado em Batch 7 com Compliance)

---

## 📊 Tabelas Criadas

### **Migration 006: Planograms Tables**

```sql
-- Planogram Base (templates mestres)
CREATE TABLE planogram_base (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) CHECK (type IN ('normal', 'promocional', 'sazonal', 'evento')),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicado', 'em_revisao', 'arquivado')),
  total_skus INTEGER DEFAULT 0,
  modules JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Planogram Store (por loja)
CREATE TABLE planogram_store (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES companies(id),
  store_id UUID REFERENCES stores(id),
  base_planogram_id UUID REFERENCES planogram_base(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'expired', 'archived')),
  adjustments JSONB DEFAULT '[]',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Planogram Slots (posições de produtos)
CREATE TABLE planogram_slots (
  id UUID PRIMARY KEY,
  planogram_base_id UUID REFERENCES planogram_base(id),
  planogram_store_id UUID REFERENCES planogram_store(id),
  product_id UUID REFERENCES products(id),
  shelf_id VARCHAR(100) NOT NULL,
  position_x DECIMAL(10, 2) DEFAULT 0,
  width DECIMAL(10, 2) DEFAULT 1,
  facings INTEGER DEFAULT 1,
  capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Slot pertence a base OU store, não ambos
  CHECK (
    (planogram_base_id IS NOT NULL AND planogram_store_id IS NULL) OR
    (planogram_base_id IS NULL AND planogram_store_id IS NOT NULL)
  )
);
```

**Índices criados:**
- `planogram_base`: org_id, status, category, type, created_by
- `planogram_store`: org_id, store_id, base_planogram_id, status
- `planogram_slots`: planogram_base_id, planogram_store_id, product_id, shelf_id

---

## 🔄 Padrões de Migração Aplicados

### 1. PlanogramService → Supabase

**Antes (Firebase):**
```typescript
async listPlanograms(orgId?: string, status?: string) {
  let query = this.collection.orderBy('updatedAt', 'desc');
  if (orgId) query = query.where('orgId', '==', orgId);
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

**Depois (Supabase):**
```typescript
async listPlanograms(orgId?: string, status?: string) {
  let query = supabaseAdmin
    .from('planogram_base')
    .select('*')
    .order('updated_at', { ascending: false });

  if (orgId) query = query.eq('org_id', orgId);
  if (status) query = query.eq('status', status);

  const { data } = await query;
  return (data || []).map(row => ({
    id: row.id,
    orgId: row.org_id,
    // ... map snake_case → camelCase
  }));
}
```

### 2. Firebase Batch Delete + Insert → Supabase

**Antes:**
```typescript
const batch = db.batch();
oldSlots.forEach(doc => batch.delete(doc.ref));
slots.forEach(slot => {
  const ref = db.collection('planogram_slots').doc();
  batch.set(ref, { ...slot, createdAt: Timestamp.now() });
});
await batch.commit();
```

**Depois:**
```typescript
// Delete
await supabaseAdmin
  .from('planogram_slots')
  .delete()
  .eq('planogram_base_id', id);

// Insert batch
const slotsToInsert = slots.map(slot => ({
  planogram_base_id: id,
  product_id: slot.productId,
  created_at: now,
  // ...
}));

await supabaseAdmin
  .from('planogram_slots')
  .insert(slotsToInsert);
```

### 3. Auto-Generate com Filtro de Estoque

**Antes (Firebase):**
```typescript
const inventorySnapshot = await db
  .collection('inventory_snapshots')
  .where('storeId', '==', storeId)
  .where('orgId', '==', orgId)
  .get();

const outOfStock = new Set(
  inventorySnapshot.docs
    .map(doc => doc.data())
    .filter(data => data.quantity <= 0)
    .map(data => data.productId)
);
```

**Depois (Supabase):**
```typescript
const { data: inventoryData } = await supabaseAdmin
  .from('inventory_snapshots')
  .select('product_id, quantity')
  .eq('store_id', storeId)
  .eq('org_id', orgId);

const outOfStock = new Set(
  (inventoryData || [])
    .filter(inv => (inv.quantity || 0) <= 0)
    .map(inv => inv.product_id)
);
```

### 4. Publish + Create Compliance Task

**Antes:**
```typescript
await db.collection('planogram_store').doc(id).update({
  status: 'published',
  publishedAt: Timestamp.now()
});

await db.collection('compliance_tasks').add({
  orgId, storeId,
  dueDate: Timestamp.fromDate(new Date(...))
});
```

**Depois:**
```typescript
await supabaseAdmin
  .from('planogram_store')
  .update({
    status: 'published',
    published_at: now
  })
  .eq('id', id);

await supabaseAdmin
  .from('compliance_tasks')
  .insert({
    org_id: orgId,
    store_id: storeId,
    due_date: dueDate
  });
```

### 5. Analytics Complexo (Join de Múltiplas Tabelas)

**Antes (Firebase):**
```typescript
const execQuery = db.collection('compliance_executions')
  .where('createdAt', '>=', start)
  .where('orgId', '==', orgId);

const planogramStores = await Promise.all(
  uniqueIds.map(id => db.collection('planogram_store').doc(id).get())
);
```

**Depois (Supabase):**
```typescript
const { data: executions } = await supabaseAdmin
  .from('compliance_executions')
  .select('*')
  .gte('created_at', start)
  .eq('org_id', orgId);

const { data: planogramStores } = await supabaseAdmin
  .from('planogram_store')
  .select('id, base_planogram_id')
  .in('id', uniqueIds);
```

---

## 📁 Field Naming

### Planogram Base
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `orgId` | `org_id` |
| `totalSKUs` | `total_skus` |
| `createdBy` | `created_by` |
| `createdByName` | `created_by_name` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

### Planogram Store
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `orgId` | `org_id` |
| `storeId` | `store_id` |
| `basePlanogramId` | `base_planogram_id` |
| `publishedAt` | `published_at` |

### Planogram Slots
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `planogramBaseId` | `planogram_base_id` |
| `planogramStoreId` | `planogram_store_id` |
| `productId` | `product_id` |
| `shelfId` | `shelf_id` |
| `positionX` | `position_x` |

---

## 🎯 Key Features

### Planogram Base (Templates)
- **CRUD completo** com soft delete (arquivar)
- **Versionamento** - incrementa ao mudar módulos
- **Status workflow**: rascunho → publicado → em_revisao → arquivado
- **Tipos**: normal, promocional, sazonal, evento
- **Categorização** - category + subcategory

### Planogram Store (Por Loja)
- **Auto-generation** - remove produtos sem estoque
- **Adjustments tracking** - registra mudanças do template
- **Publish workflow** - draft → published → expired → archived
- **Compliance integration** - cria tarefas ao publicar

### Planogram Slots
- **Posicionamento** - shelfId, positionX, width
- **Capacidade** - facings, capacity
- **Constraint** - slot pertence a base OU store, não ambos
- **Batch updates** - delete + insert otimizado

### Analytics
- **KPIs de compliance** - avg score, overdue tasks
- **Ranking de lojas** - best/worst stores
- **Top categories** - por score médio
- **Issue tracking** - total, critical, resolved
- **Product metrics** - detected, missing, gaps

---

## 🔥 Melhorias sobre Firebase

1. **Batch operations** - Supabase permite arrays diretos (.insert([]))
2. **Constraints nativos** - CHECK constraints no schema
3. **Cascade deletes** - Foreign keys com ON DELETE CASCADE
4. **JSONB nativo** - modules e adjustments com queries eficientes
5. **Índices compostos** - org_id + store_id, org_id + status
6. **Queries otimizadas** - .in() para batch fetches
7. **Triggers automáticos** - updated_at via PostgreSQL

---

## 📁 Arquivos Migrados

**Migration:**
- `supabase/migrations/006_planograms_tables.sql` ✅

**Service:**
- `lib/services/planogram.service.ts` ✅ (Firestore → Supabase)

**Routes migradas:**
- `app/api/planograms/base/route.ts` ✅
- `app/api/planograms/base/[id]/route.ts` ✅
- `app/api/planograms/base/[id]/slots/route.ts` ✅
- `app/api/planograms/store/route.ts` ✅
- `app/api/planograms/store/[id]/route.ts` ✅
- `app/api/planograms/store/[id]/publish/route.ts` ✅
- `app/api/planograms/analytics/route.ts` ✅ (requer compliance tables)
- `app/api/planograms/features/route.ts` ✅ (já usava Prisma)

**Routes não migradas (mock data):**
- `app/api/planograms/executions/[id]/route.ts` ⏭️ (será migrado com Compliance)

---

## ⚠️ Notas Importantes

1. **Analytics route** depende de `compliance_executions` e `compliance_tasks` que serão criadas no Batch 7
2. **Features route** já usa Prisma e queries nas tabelas planogram via Prisma models
3. **Executions route** retorna mock data - TODO comment sugere migração futura
4. **Version increments** - ao atualizar modules, a versão é incrementada automaticamente
5. **Slots constraint** - garantido por CHECK: slot pertence a planogram_base OU planogram_store

---

## 📊 Progresso Geral

**Total migrado até agora:**
- ✅ Batch 1: Usuários (4 routes)
- ✅ Batch 2: Dashboard e Solicitações (7 routes)
- ✅ Batch 3: Inventário (16 routes)
- ✅ Batch 4: Mensagens, Notificações, Checklists (8 routes)
- ✅ Batch 5: Products/Produtos (4 routes)
- ✅ Batch 6: Planograms (8 routes + 1 service)

**Total:** 47 routes + 1 service + 6 migrations

**Restante:** ~15 routes (Compliance, Analytics, Utilities)

---

## 🚀 Próximos Passos

**Batch 7: Compliance, Analytics e Restantes**
- Compliance Tasks & Executions (5+ routes)
- Analytics/Volumetria (3+ routes)
- Utilities/Chamados/AI (restantes)
- Criar tabelas: `compliance_tasks`, `compliance_executions`, `rupture_events`

**Depois:**
- Migrar MOBILE (Auth, Storage, Adapters)
- Deletar Firebase do WEB
- Deletar Firebase do MOBILE (exceto messaging)
