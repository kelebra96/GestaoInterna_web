# 📦 Status da Migração: Batch 7 - Compliance & Analytics

## ✅ MIGRAÇÃO PARCIAL: 5/10 routes migradas

### 🎉 Compliance Routes - 5 endpoints (5 routes) - COMPLETO!

#### **Compliance Tasks**
1. **`/api/compliance/tasks` (GET, POST)** ✅
   - Lista tarefas de compliance com filtros role-based
   - Cria novas tarefas de compliance
   - Auto-atualiza status overdue (pending → overdue)
   - Suporta roles: super_admin, admin_rede, gestor_loja, repositor, merchandiser

2. **`/api/compliance/tasks/[id]/start` (POST)** ✅
   - Inicia tarefa (status → in_progress)
   - Validação de permissões por role

3. **`/api/compliance/tasks/[id]/complete` (POST)** ✅
   - Completa tarefa (status → concluido)
   - Define completed_at timestamp
   - Validação de permissões por role

#### **Compliance Executions**
4. **`/api/compliance/executions` (GET, POST)** ✅
   - **GET:** Lista execuções com filtros (storeId, taskId, status, planogramStoreId)
   - **POST:** Cria execução com:
     - Processamento de fotos (JSONB array)
     - Análise de IA mock (mockAIAnalysis function)
     - Cálculo de compliance score (0-100)
     - JSONB fields: photos, ai_analysis
     - Atualiza task para 'concluido' automaticamente

#### **Compliance Upload**
5. **`/api/compliance/upload` (POST)** ✅
   - Upload de fotos com formidable (multipart/form-data)
   - **Migrado para Supabase Storage** (bucket: 'planograms')
   - Análise de IA com Google Cloud Vision (ImageComplianceService)
   - Cria execution por foto
   - Atualiza task para 'concluido'
   - JSONB: photos array, ai_analysis object

---

## 📊 Tabelas Criadas

### **Migration 007: Compliance Tables**

```sql
-- Compliance Tasks (tarefas de conformidade)
CREATE TABLE compliance_tasks (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'concluido', 'overdue', 'cancelled')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance Executions (execuções com fotos e análise AI)
CREATE TABLE compliance_executions (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES compliance_tasks(id) ON DELETE SET NULL,
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  org_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  store_name VARCHAR(255),
  executed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  executed_by_name VARCHAR(255),

  -- JSONB fields
  photos JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB,
  ai_score INTEGER DEFAULT 0 CHECK (ai_score >= 0 AND ai_score <= 100),
  manual_review JSONB,

  status VARCHAR(50) NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido', 'nao_conforme', 'em_revisao', 'aprovado', 'rejeitado')),
  notes TEXT,
  signature TEXT,

  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_compliance_tasks_org_id ON compliance_tasks(org_id);
CREATE INDEX idx_compliance_tasks_store_id ON compliance_tasks(store_id);
CREATE INDEX idx_compliance_tasks_assigned_to ON compliance_tasks(assigned_to);
CREATE INDEX idx_compliance_tasks_status ON compliance_tasks(status);

CREATE INDEX idx_compliance_executions_org_id ON compliance_executions(org_id);
CREATE INDEX idx_compliance_executions_task_id ON compliance_executions(task_id);
CREATE INDEX idx_compliance_executions_ai_score ON compliance_executions(ai_score);

-- GIN indexes para JSONB
CREATE INDEX idx_compliance_executions_photos_gin ON compliance_executions USING GIN (photos);
CREATE INDEX idx_compliance_executions_ai_analysis_gin ON compliance_executions USING GIN (ai_analysis);
```

---

## 🔄 Padrões de Migração Aplicados

### 1. Role-Based Query Filtering

```typescript
// Role-based access control
switch (auth.role) {
  case 'super_admin':
    const orgId = searchParams.get('orgId');
    if (orgId) query = query.eq('org_id', orgId);
    break;
  case 'admin_rede':
    query = query.eq('org_id', auth.orgId);
    break;
  case 'gestor_loja':
    if (auth.storeIds?.length > 0) {
      query = query.in('store_id', auth.storeIds.slice(0, 10)); // Supabase limit
    }
    break;
  case 'repositor':
  case 'merchandiser':
    query = query.eq('assigned_to', auth.userId);
    break;
}
```

### 2. Auto-Update Overdue Tasks

```typescript
// Auto-detect and update overdue tasks
const now = new Date();
const overdueUpdates: Promise<any>[] = [];
tasks.forEach(task => {
  if (task.status === 'pending' && new Date(task.dueDate) < now) {
    overdueUpdates.push(
      supabaseAdmin.from('compliance_tasks')
        .update({ status: 'overdue' })
        .eq('id', task.id)
    );
    task.status = 'overdue';
  }
});
```

### 3. JSONB Fields (photos, ai_analysis)

```typescript
// Store photos as JSONB array
const photosData = (photos || []).map((photo, index) => ({
  id: photo.id || `photo_${Date.now()}_${index}`,
  url: photo.url,
  moduleId: photo.moduleId || null,
  timestamp: photo.timestamp || now,
  gpsLocation: photo.gpsLocation || null,
}));

// Store AI analysis as JSONB object
ai_analysis: {
  analysisId: uuidv4(),
  timestamp: now,
  complianceScore: analysisResult.score,
  issues: [...],
  totalProducts: planogram.slots?.length || 0,
  productsDetected: 10,
  productsMissing: 2,
  gaps: 1,
  provider: 'vision',
}
```

### 4. Supabase Storage (Upload Route)

**Antes (Firebase Storage):**
```typescript
const bucket = adminStorage().bucket();
const file = bucket.file(storagePath);
await file.save(imageBuffer, { metadata: {...} });
await file.makePublic();
const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
```

**Depois (Supabase Storage):**
```typescript
const storageBucket = supabaseAdmin.storage.from('planograms');
const { error: uploadError } = await storageBucket.upload(storagePath, imageBuffer, {
  contentType: 'image/jpeg',
  cacheControl: '3600',
  upsert: false,
});
const { data: { publicUrl } } = storageBucket.getPublicUrl(storagePath);
const imageUrl = publicUrl;
```

### 5. Mock AI Analysis

```typescript
function mockAIAnalysis(photoUrls: string[], planogramData: any): AIAnalysisResult {
  const totalProducts = planogramData?.slots?.length || 0;
  const detectionRate = 0.75 + Math.random() * 0.20; // 75-95%
  const productsDetected = Math.floor(totalProducts * detectionRate);

  return {
    analysisId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    complianceScore: Math.round(complianceScore),
    issues: [...],
    totalProducts,
    productsDetected,
    productsMissing,
    productsWrongPosition,
    gaps,
    provider: 'mock',
  };
}
```

---

## 📁 Field Naming

### Compliance Tasks
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `orgId` | `org_id` |
| `storeId` | `store_id` |
| `planogramStoreId` | `planogram_store_id` |
| `dueDate` | `due_date` |
| `assignedTo` | `assigned_to` |
| `completedAt` | `completed_at` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

### Compliance Executions
| API (camelCase) | Supabase (snake_case) |
|----------------|----------------------|
| `taskId` | `task_id` |
| `planogramStoreId` | `planogram_store_id` |
| `orgId` | `org_id` |
| `storeId` | `store_id` |
| `storeName` | `store_name` |
| `executedBy` | `executed_by` |
| `executedByName` | `executed_by_name` |
| `aiAnalysis` | `ai_analysis` |
| `aiScore` | `ai_score` |
| `manualReview` | `manual_review` |
| `executedAt` | `executed_at` |

---

## 🎯 Key Features

### Compliance Tasks
- **Role-based filtering** - Cada role vê apenas suas tarefas
- **Auto-overdue detection** - Atualiza automaticamente tarefas vencidas
- **Permission validation** - Valida se usuário pode start/complete a tarefa
- **Status workflow**: pending → in_progress → concluido (ou overdue)

### Compliance Executions
- **JSONB photos array** - Múltiplas fotos por execução
- **AI analysis** - Mock ou real (Google Cloud Vision)
- **Compliance score** - 0-100 calculado pela IA
- **Status derivado** - score >= 80 = concluido, < 80 = nao_conforme
- **Auto-complete task** - Ao criar execution, task vira 'concluido'

### Compliance Upload
- **Supabase Storage** - Migrado de Firebase Storage
- **Multi-photo upload** - Processa array de fotos
- **Real AI analysis** - ImageComplianceService (Google Cloud Vision)
- **Per-photo execution** - Cria 1 execution por foto
- **GPS metadata** - Armazena localização GPS nas fotos

---

## 🔥 Melhorias sobre Firebase

1. **JSONB nativo** - Armazenamento eficiente de photos e ai_analysis
2. **GIN indexes** - Queries rápidas em campos JSONB
3. **CHECK constraints** - ai_score entre 0-100, status validados
4. **Supabase Storage** - Mais simples que Firebase Storage, URLs diretas
5. **Role-based indexes** - Otimizados para queries por role
6. **Cascade deletes** - Foreign keys com ON DELETE CASCADE/SET NULL

---

## ⏳ Próximos Passos: Volumetria Routes (5 routes)

**Routes a migrar:**
1. `/api/volumetria/perda-receita` - Lista SKUs por perda de receita
2. `/api/volumetria/ruptura-horario` - Análise de ruptura por horário
3. `/api/volumetria/slots-criticos` - Slots críticos (baixa ocupação)
4. `/api/volumetria/status-abastecimento` - Status de abastecimento
5. `/api/volumetria/products` - Lista produtos volumetria

**Tabelas necessárias:**
- `eventos_ruptura` (rupture events)
- `produtos_volumetria` (volumetria products)
- Possivelmente outras tabelas volumetria

---

## 📊 Progresso Geral

**Total migrado até agora:**
- ✅ Batch 1: Usuários (4 routes)
- ✅ Batch 2: Dashboard e Solicitações (7 routes)
- ✅ Batch 3: Inventário (16 routes)
- ✅ Batch 4: Mensagens, Notificações, Checklists (8 routes)
- ✅ Batch 5: Products/Produtos (4 routes)
- ✅ Batch 6: Planograms (8 routes + 1 service)
- ⏳ Batch 7 (parcial): Compliance (5 routes) - COMPLETO!
- ❌ Batch 7 (restante): Volumetria (5 routes) - PENDENTE

**Total:** 52 routes + 1 service + 7 migrations

**Restante:** 5 volumetria routes
