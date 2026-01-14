# 📋 Status da Migração: Batch 4 - Mensagens, Notificações e Checklists

## ✅ MIGRAÇÃO COMPLETA: 8/8 rotas migradas + 1 migration!

### 🎉 Todas as Rotas Migradas

#### **Mensagens (2 routes)**

1. **`/api/mensagens` (GET, POST)**
   - ✅ Lista conversas com filtro por userId
   - ✅ Cria conversas e envia mensagens
   - ✅ Usa `participants` array com `.contains()` query
   - ✅ JSONB para `participant_names` e `unread_count`
   - ✅ Manual increment para contadores não lidos

2. **`/api/mensagens/[id]` (GET, PATCH)**
   - ✅ Busca conversa específica com mensagens
   - ✅ Marca mensagens como lidas
   - ✅ Filtra mensagens deletadas por usuário
   - ✅ Suporte a `deletedForEveryone` e `deletedBy` array

#### **Notificações (2 routes)**

3. **`/api/notificacoes` (GET, POST)**
   - ✅ Lista notificações com limit 100
   - ✅ Query param `count=true` para contagem de não lidas
   - ✅ POST desabilitado (notificações vêm de triggers)
   - ✅ Ordenação por `sent_at DESC`

4. **`/api/notificacoes/[id]` (GET, PATCH, DELETE)**
   - ✅ Busca notificação específica
   - ✅ Atualiza status de leitura
   - ✅ Deleta notificação

#### **Checklists (4 routes + 1 migration)**

5. **Migration 003: Checklist Tables**
   - ✅ Tabela `checklist_templates` com JSONB questions
   - ✅ Tabela `checklist_executions` com JSONB answers/score/conformity
   - ✅ Triggers automáticos para `updated_at`
   - ✅ Índices otimizados para queries

6. **`/api/checklist-templates` (GET, POST)**
   - ✅ Lista templates com filtros (companyId, type, active, storeId)
   - ✅ Cria templates com questions array
   - ✅ Validação de empresa existente
   - ✅ Sanitização de campos undefined

7. **`/api/checklist-templates/[id]` (GET, PATCH, DELETE)**
   - ✅ Busca template específico
   - ✅ Atualiza template (incrementa version ao mudar questions)
   - ✅ Soft delete (marca active=false)

8. **`/api/checklist-executions` (GET, POST)**
   - ✅ Lista execuções com filtros (companyId, storeId, userId, status)
   - ✅ Verificação automática de atraso (overdue)
   - ✅ Recálculo de score para backward compatibility
   - ✅ Cria execuções a partir de templates

9. **`/api/checklist-executions/[id]` (GET, PATCH, DELETE)**
   - ✅ Busca execução específica com overdue check
   - ✅ Atualiza execução com cálculo automático de score/conformity
   - ✅ Calcula progresso baseado em respostas
   - ✅ Gerencia timestamps (started_at, completed_at)
   - ✅ Deleta execução

## 🔄 Padrões de Migração Aplicados

### 1. Array Contains (Conversations)
```typescript
// ANTES (Firebase):
const snapshot = await db.collection('conversations')
  .where('participants', 'array-contains', userId)
  .get();

// DEPOIS (Supabase):
const { data } = await supabaseAdmin
  .from('conversations')
  .select('*')
  .contains('participants', [userId]);
```

### 2. JSONB Increment
```typescript
// ANTES (Firebase):
await db.collection('conversations').doc(id).update({
  [`unreadCount.${userId}`]: FieldValue.increment(1)
});

// DEPOIS (Supabase):
const currentUnreadCount = currentConv?.unread_count || {};
const newUnreadCount = { ...currentUnreadCount };
newUnreadCount[receiverId] = (newUnreadCount[receiverId] || 0) + 1;

await supabaseAdmin.from('conversations').update({
  unread_count: newUnreadCount
}).eq('id', id);
```

### 3. Count with head=true
```typescript
// ANTES (Firebase):
const snapshot = await db.collection('notifications')
  .where('read', '==', false)
  .get();
const count = snapshot.size;

// DEPOIS (Supabase):
const { count } = await supabaseAdmin
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('read', false);
```

### 4. JSONB Complex Structures
```typescript
// Templates: questions array
questions: [
  { id, order, question, type, required, options, ... }
]

// Executions: answers, score, conformity
answers: [
  { questionId, value, answeredAt, photos, ... }
],
score: { total, earned, percentage },
conformity: { total, passed, percentage }
```

### 5. Automatic Overdue Checking
```typescript
// Supabase: verificação on-the-fly
async function checkAndUpdateOverdue(execution: any) {
  if (execution.status !== 'in_progress') return execution;

  const elapsedMinutes = (Date.now() - new Date(execution.startedAt).getTime()) / (1000 * 60);

  if (elapsedMinutes > execution.estimatedDuration) {
    await supabaseAdmin.from('checklist_executions')
      .update({ status: 'overdue' })
      .eq('id', execution.id);

    execution.status = 'overdue';
  }

  return execution;
}
```

## 📊 Field Naming Conversions

| Firebase (camelCase) | Supabase (snake_case) |
|---------------------|----------------------|
| `participantNames` | `participant_names` |
| `unreadCount` | `unread_count` |
| `lastMessage` | `last_message` |
| `lastMessageAt` | `last_message_at` |
| `lastMessageBy` | `last_message_by` |
| `sentAt` | `sent_at` |
| `fcmResponse` | `fcm_response` |
| `motivoRejeicao` | `motivo_rejeicao` |
| `templateId` | `template_id` |
| `templateName` | `template_name` |
| `storeIds` | `store_ids` |
| `allowedUserIds` | `allowed_user_ids` |
| `estimatedDuration` | `estimated_duration` |
| `requiresGPS` | `requires_gps` |
| `requiresSignature` | `requires_signature` |
| `allowOfflineExecution` | `allow_offline_execution` |
| `scheduledDate` | `scheduled_date` |
| `startedAt` | `started_at` |
| `completedAt` | `completed_at` |
| `gpsLocation` | `gps_location` |
| `finalSignature` | `final_signature` |
| `syncedAt` | `synced_at` |

## 🎯 Key Features

### Mensagens
- **Conversas P2P** com array de participantes
- **Contador de não lidas** por usuário (JSONB)
- **Mensagens deletadas** com soft delete e suporte a "deletar para todos"
- **Status de presença** (online/offline) baseado em last_seen

### Notificações
- **Criação via triggers** (não via API)
- **Contagem eficiente** de não lidas com `head: true`
- **Múltiplos tipos** (solicitação, item, mensagem)
- **Histórico de envio** (adminCount, successCount, failCount)

### Checklists
- **Templates configuráveis** com perguntas JSONB
- **Versionamento** automático ao modificar perguntas
- **Execuções com score** calculado automaticamente
- **Detecção de atraso** (overdue) em tempo real
- **Progresso calculado** baseado em respostas
- **Suporte a GPS** e assinatura digital
- **Modo offline** configurável

## 🔥 Melhorias sobre Firebase

1. **Sem limite de IN queries** - Firebase limitava a 10 itens
2. **Queries mais rápidas** - PostgreSQL otimizado
3. **JSONB flexível** - Estruturas complexas sem subcollections
4. **Triggers automáticos** - updated_at sempre correto
5. **Array operations** - contains() mais eficiente
6. **Count otimizado** - head=true não retorna dados

## 📁 Arquivos Criados/Modificados

**Migration:**
- `supabase/migrations/003_checklist_tables.sql`

**Mensagens:**
- `app/api/mensagens/route.ts`
- `app/api/mensagens/[id]/route.ts`

**Notificações:**
- `app/api/notificacoes/route.ts`
- `app/api/notificacoes/[id]/route.ts`

**Checklists:**
- `app/api/checklist-templates/route.ts`
- `app/api/checklist-templates/[id]/route.ts`
- `app/api/checklist-executions/route.ts`
- `app/api/checklist-executions/[id]/route.ts`

## 🚀 Próximos Passos

**Batch 5** - Demais rotas (31 routes restantes):
- Planograms (6+ routes)
- Compliance (4+ routes)
- Products/Produtos (4+ routes)
- Analytics (8+ routes)
- Category Planning (2 routes)
- Outros (7+ routes)

**Serviços:**
- databaseService.ts
- featureFlags.ts
- planogram.service.ts
- measurementService.ts

**MOBILE:**
- Expandir Auth Service (Phone, Google, Apple)
- Criar Storage Service
- Criar Adapters Supabase
- Atualizar Factory
