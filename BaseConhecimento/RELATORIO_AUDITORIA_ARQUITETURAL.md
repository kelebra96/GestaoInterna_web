# RELATÓRIO DE AUDITORIA ARQUITETURAL - MyInventory

**Data:** 2026-02-14
**Versão:** 1.0
**Stack:** Next.js 15 + React 19 + Supabase + Prisma + Firebase

---

## SUMÁRIO EXECUTIVO

| Aspecto | Status | Score |
|---------|--------|-------|
| Acoplamento Temporal | Alto | 4/10 |
| Resiliência | Médio | 6/10 |
| Escalabilidade | Médio | 5/10 |
| Event-Driven | Parcial | 4/10 |
| DDD/Bounded Contexts | Baixo | 3/10 |
| Observabilidade | Médio | 5/10 |

**Recomendação Geral:** O sistema é um **monólito Next.js bem estruturado** com elementos event-driven parciais. Para a escala atual, **EDA completa (Kafka/RabbitMQ) seria over-engineering**. Foco deve ser em **desacoplamento gradual** e **melhorias de resiliência**.

---

## FASE 1 - DIAGNÓSTICO ARQUITETURAL

### 1.1 ACOPLAMENTO TEMPORAL

#### Cadeias Síncronas Identificadas

| Fluxo | Chamadas Síncronas | Impacto |
|-------|-------------------|---------|
| Login | 1. Supabase Auth → 2. Prisma User → 3. JWT Sign | Baixo |
| Finalizar Inventário | 1. Busca Inventory → 2. Busca Counts → 3. Busca Items → 4. Update | **ALTO** |
| Compliance Complete | 1. Busca Task → 2. Valida Permissões → 3. Update | Médio |
| Image Pipeline | 1. OFF API → 2. Download → 3. OpenAI → 4. Storage | **CRÍTICO** |

#### Pontos de Bloqueio Críticos

```
1. POST /api/inventario/[id]/finalize (linhas 69-113)
   └─ 3 queries sequenciais ao Supabase
   └─ Processamento em memória (Map)
   └─ Tempo estimado: 500ms-3s (depende do tamanho)

2. processProductImage() em lib/images/pipeline.ts
   └─ fetch Open Food Facts (~200-500ms)
   └─ downloadAndValidateImage (~100-300ms)
   └─ scoreImageWithOpenAI (~1-3s) ← GARGALO
   └─ persistImageToSupabaseStorage (~200-500ms)
   └─ Total: 1.5s-4.5s POR IMAGEM

3. POST /api/compliance/executions (não analisado)
   └─ Google Cloud Vision API call (~1-2s)
   └─ Processamento de resultados
```

#### Impacto na Latência

| Endpoint | P50 Estimado | P99 Estimado | Risco |
|----------|--------------|--------------|-------|
| /api/auth/login | 100ms | 500ms | Baixo |
| /api/inventario/[id]/finalize | 800ms | 3s | Alto |
| /api/images/pipeline | 2s | 5s | Crítico |
| /api/compliance/upload | 1.5s | 4s | Alto |

---

### 1.2 FRAGILIDADE / EFEITO DOMINÓ

#### Mapa de Dependências Externas

```
                    ┌─────────────────┐
                    │   MyInventory   │
                    │   (Next.js)     │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Supabase │      │  OpenAI  │      │  Google  │
    │ (Primary)│      │  Vision  │      │  Vision  │
    └──────────┘      └──────────┘      └──────────┘
           │                 │
           ▼                 │
    ┌──────────┐             │
    │ Firebase │◄────────────┘
    │   FCM    │
    └──────────┘
           │
           ▼
    ┌──────────────┐
    │ Open Food    │
    │ Facts API    │
    └──────────────┘
```

#### Análise de Pontos de Falha

| Serviço | Se Cair... | Impacto | Mitigação Atual |
|---------|------------|---------|-----------------|
| **Supabase** | Sistema inteiro falha | **CRÍTICO** | Nenhuma |
| **OpenAI** | Pipeline de imagens falha | Alto | Fallback parcial |
| **Google Vision** | Compliance scoring falha | Médio | Nenhuma |
| **Firebase FCM** | Push notifications falham | Baixo | Queue com retry |
| **Open Food Facts** | Busca de imagens falha | Baixo | Continua sem imagem |

#### Mecanismos de Resiliência Existentes

| Mecanismo | Implementado? | Onde |
|-----------|---------------|------|
| Circuit Breaker | **NÃO** | - |
| Retry com Backoff | **PARCIAL** | FCM Worker (3 tentativas, sem backoff exponencial) |
| Timeout Configurável | **NÃO** | - |
| Dead Letter Queue | **NÃO** | - |
| Health Checks | **PARCIAL** | /api/monitoring/health, /api/signaling/health |
| Graceful Degradation | **PARCIAL** | Image pipeline continua sem OFF |

#### Riscos de Falha em Cascata

```
CENÁRIO 1: Supabase Lento (latência alta)
├─ AuthContext.tsx não carrega
├─ useEffect fica em loading infinito (BUG CORRIGIDO HOJE)
├─ Todas as páginas mostram spinner
└─ RESULTADO: UX completamente degradada

CENÁRIO 2: OpenAI Rate Limited
├─ scoreImageWithOpenAI() falha
├─ Sem retry, job marcado como failed
├─ Imagens não são processadas
└─ RESULTADO: Backlog crescente de imagens

CENÁRIO 3: Firebase FCM Indisponível
├─ sendFCMNotification() falha
├─ FCM Worker marca como failed após 3 tentativas
├─ Notificações perdidas permanentemente
└─ RESULTADO: Usuários não recebem alertas
```

---

### 1.3 ESCALABILIDADE

#### Modelo Atual: Monólito Vertical

```
┌─────────────────────────────────────────────────┐
│              NEXT.JS MONOLITH                   │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │   Auth   │Inventário│Compliance│ Analytics│ │
│  ├──────────┼──────────┼──────────┼──────────┤ │
│  │Planogram │ Produtos │  Images  │  Chat    │ │
│  └──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│           POSTGRESQL (SUPABASE)                 │
│      30+ tabelas compartilhando schema          │
└─────────────────────────────────────────────────┘
```

#### Gargalos Estruturais Identificados

| Componente | Gargalo | Causa |
|------------|---------|-------|
| Image Pipeline | CPU-bound | sharp + OpenAI em série |
| Finalizar Inventário | Memory-bound | Map em memória com todos os counts |
| Compliance Upload | I/O-bound | Upload + Vision API síncrono |
| FCM Worker | Network-bound | Envio individual (batch disabled) |

#### Análise de Carga (Cenário 10x)

| Métrica | Atual | 10x Tráfego | Risco |
|---------|-------|-------------|-------|
| API Requests/min | ~100 | 1000 | Next.js serverless aguenta |
| Image Jobs/min | ~10 | 100 | **CRÍTICO** - Worker não escala |
| FCM Queue/min | ~50 | 500 | Batch mode necessário |
| Supabase Connections | 10 | 100 | Pode atingir limite |

#### Custo Operacional Estimado

```
CUSTO ATUAL (estimativa):
├─ Vercel Pro: ~$20/mês
├─ Supabase Pro: ~$25/mês
├─ OpenAI (gpt-4o-mini): ~$50/mês (10k images)
├─ Google Vision: ~$15/mês
├─ Firebase: Gratuito (< 1M notificações)
└─ TOTAL: ~$110/mês

COM 10x TRÁFEGO:
├─ Vercel: ~$100/mês (serverless scaling)
├─ Supabase: ~$100/mês (mais conexões)
├─ OpenAI: ~$500/mês (100k images)
├─ Google Vision: ~$150/mês
├─ Firebase: ~$50/mês
└─ TOTAL: ~$900/mês
```

---

## FASE 2 - VERIFICAÇÃO DE ARQUITETURA ORIENTADA A EVENTOS

### 2.1 Event Broker

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Event Broker Dedicado | **NÃO** | Não há Kafka, RabbitMQ ou similar |
| Fila de Mensagens | **PARCIAL** | `fcm_queue` e `image_jobs` via PostgreSQL |
| Pub/Sub | **NÃO** | Não implementado |

### 2.2 Padrões Event-Driven Existentes

#### Implementado (Nível Básico)

```typescript
// FCM Queue Pattern (workers/fcm-worker.ts)
PRODUTOR: API insere em fcm_queue
FILA: PostgreSQL table com status (pending/sent/failed)
CONSUMIDOR: FCM Worker (polling 5s)

// Image Jobs Pattern (lib/images/pipeline.ts)
PRODUTOR: API insere em image_jobs
FILA: PostgreSQL table com lock atômico
CONSUMIDOR: Image Worker (polling)
```

#### Não Implementado

- Eventos de domínio (`PedidoCriado`, `InventarioFinalizado`, etc.)
- Comunicação desacoplada entre módulos
- Eventual consistency
- Idempotência nos consumidores (parcial)

### 2.3 Avaliação de Maturidade EDA

| Critério | Score | Justificativa |
|----------|-------|---------------|
| Desacoplamento | 2/10 | Módulos chamam diretamente uns aos outros |
| Eventos de Domínio | 1/10 | Não existem |
| Idempotência | 4/10 | Parcial no image pipeline (unique index) |
| Dead Letter Queue | 0/10 | Não existe |
| Observabilidade | 3/10 | Console.log apenas |
| Backpressure | 2/10 | Não há controle de fluxo |

### 2.4 Recomendação

**NÃO MIGRAR PARA EDA COMPLETA** neste momento.

Razões:
1. Volume atual não justifica complexidade
2. Equipe provavelmente pequena
3. Custo operacional de Kafka/RabbitMQ
4. Supabase Realtime pode atender necessidades básicas

**ALTERNATIVA RECOMENDADA:**
- Usar Supabase Realtime para eventos em tempo real
- Manter filas PostgreSQL para workers
- Implementar Dead Letter Queue
- Adicionar observabilidade

---

## FASE 3 - MODELAGEM DE EVENTOS (PROPOSTA)

### 3.1 Eventos de Domínio Sugeridos

```typescript
// INVENTÁRIO
InventarioCriado       { inventoryId, storeId, createdBy, timestamp }
InventarioIniciado     { inventoryId, startedBy, timestamp }
ContagemRegistrada     { inventoryId, addressId, ean, quantity, countedBy }
InventarioFinalizado   { inventoryId, totalItems, discrepancies, completedBy }

// COMPLIANCE
TarefaCriada           { taskId, storeId, planogramId, dueDate }
TarefaIniciada         { taskId, startedBy, timestamp }
TarefaConcluida        { taskId, score, findings[], completedBy }
TarefaAtrasada         { taskId, dueDate, currentDate }

// PRODUTOS
ProdutoCriado          { productId, ean, name, companyId }
ProdutoAtualizado      { productId, changes[], updatedBy }
ImagemProcessada       { productId, status, source, confidence }
ImagemFalhou           { productId, reason, attempts }

// NOTIFICAÇÕES
NotificacaoEnfileirada { notificationId, userId, type, priority }
NotificacaoEnviada     { notificationId, deliveredAt }
NotificacaoFalhou      { notificationId, reason, attempts }
```

### 3.2 Fluxo Event-Driven Proposto (Futuro)

```
ANTES (Atual - Síncrono):
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Request │───▶│ Process │───▶│  Save   │───▶│Response │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │
                   ▼ (bloqueante)
              ┌─────────┐
              │ Notify  │
              └─────────┘

DEPOIS (Proposto - Assíncrono):
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Request │───▶│ Process │───▶│  Save   │───▶│Response │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │
                   ▼ (evento)
              ┌─────────┐
              │  Event  │───▶ Notify Service (async)
              │  Bus    │───▶ Analytics Service (async)
              └─────────┘───▶ Audit Service (async)
```

---

## FASE 4 - PERFORMANCE E RESILIÊNCIA

### 4.1 Melhorias Prioritárias

#### PRIORIDADE ALTA

| Melhoria | Esforço | Impacto | Como Implementar |
|----------|---------|---------|------------------|
| Circuit Breaker para OpenAI | Médio | Alto | Lib `opossum` ou implementar manualmente |
| Retry Exponencial no FCM Worker | Baixo | Médio | Substituir delay fixo por backoff |
| Dead Letter Queue | Médio | Alto | Tabela `dlq` + lógica de movimentação |
| Timeout em chamadas externas | Baixo | Alto | AbortController com timeout |
| Batch Mode no FCM Worker | Baixo | Médio | Já implementado, apenas habilitar |

#### PRIORIDADE MÉDIA

| Melhoria | Esforço | Impacto | Como Implementar |
|----------|---------|---------|------------------|
| Cache de produtos | Médio | Médio | Redis ou Supabase Edge Functions |
| Rate Limiting na API | Médio | Médio | Middleware Next.js ou Vercel |
| Compressão de respostas | Baixo | Baixo | Next.js config |
| Connection Pooling | Médio | Alto | PgBouncer ou Supabase connection pooler |

### 4.2 Implementação de Circuit Breaker

```typescript
// lib/resilience/circuit-breaker.ts (PROPOSTA)
import CircuitBreaker from 'opossum';

const openAIBreaker = new CircuitBreaker(scoreImageWithOpenAI, {
  timeout: 10000,           // 10s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,      // 30s antes de tentar novamente
  volumeThreshold: 5,       // mínimo 5 requests antes de abrir
});

openAIBreaker.on('open', () => {
  console.warn('[CircuitBreaker] OpenAI circuit OPEN - usando fallback');
});

openAIBreaker.on('halfOpen', () => {
  console.info('[CircuitBreaker] OpenAI circuit HALF-OPEN - testando');
});

openAIBreaker.fallback(() => ({
  match: false,
  confidence: 0,
  reason: 'circuit_breaker_open',
  cached: false,
}));
```

### 4.3 Implementação de Dead Letter Queue

```sql
-- Supabase Migration
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ
);

CREATE INDEX idx_dlq_source ON dead_letter_queue(source_table, created_at);
```

### 4.4 Observabilidade (Proposta)

```typescript
// lib/observability/logger.ts (PROPOSTA)
import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  module: string;
  operation: string;
  userId?: string;
  duration?: number;
  [key: string]: any;
}

export function log(level: LogLevel, message: string, context: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // Console (dev)
  console[level](JSON.stringify(payload));

  // Sentry (prod errors)
  if (level === 'error') {
    Sentry.captureMessage(message, {
      level: 'error',
      extra: context,
    });
  }

  // TODO: Enviar para Datadog/Grafana/etc
}
```

---

## FASE 5 - DDD E BOUNDED CONTEXTS

### 5.1 Análise de Bounded Contexts Atuais

```
ESTADO ATUAL: Sem separação clara
┌─────────────────────────────────────────────────────────────────┐
│                     MONOLITH ÚNICO                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Auth │ Users │ Companies │ Stores │ Products │ Inventory │  │
│  │ Compliance │ Planograms │ Analytics │ Images │ Chat     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▲                                     │
│                           │                                     │
│                    SHARED DATABASE                              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Bounded Contexts Propostos

```
PROPOSTA DE SEPARAÇÃO:

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   IDENTITY &     │  │    INVENTORY     │  │   COMPLIANCE     │
│   ACCESS (IAM)   │  │    MANAGEMENT    │  │    & AUDIT       │
│                  │  │                  │  │                  │
│ • Users          │  │ • Inventories    │  │ • Tasks          │
│ • Companies      │  │ • Counts         │  │ • Executions     │
│ • Stores         │  │ • Addresses      │  │ • Planograms     │
│ • Roles          │  │ • Snapshots      │  │ • Scores         │
│ • Permissions    │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │
                              ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    PRODUCT       │  │   COMMUNICATION  │  │   ANALYTICS &    │
│    CATALOG       │  │    & MESSAGING   │  │   REPORTING      │
│                  │  │                  │  │                  │
│ • Products       │  │ • Conversations  │  │ • Dashboards     │
│ • Categories     │  │ • Messages       │  │ • KPIs           │
│ • Images         │  │ • Notifications  │  │ • Reports        │
│ • Pricing        │  │ • FCM Queue      │  │ • Heatmaps       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 5.3 Problemas de Invasão de Responsabilidades

| Problema | Onde Ocorre | Solução |
|----------|-------------|---------|
| Auth verifica permissões em rotas | Cada API route | Middleware centralizado |
| Produtos conhecem lógica de imagens | lib/images/pipeline.ts | Separar Image Service |
| Inventory conhece formato de export | finalize/route.ts | Export Service |
| Compliance depende de Planograms | compliance/tasks | Usar eventos |

### 5.4 Banco de Dados Compartilhado

**PROBLEMA:** Todas as 30+ tabelas estão no mesmo schema Supabase.

**RISCOS:**
- Queries cruzam domínios sem controle
- Migrations afetam todo o sistema
- Não é possível escalar módulos independentemente

**SOLUÇÃO GRADUAL:**
1. Criar schemas separados no PostgreSQL (`iam`, `inventory`, `compliance`, etc.)
2. Usar views para compatibilidade
3. Migrar gradualmente as tabelas
4. Implementar APIs internas entre módulos

---

## CHECKLIST FINAL DE VALIDAÇÃO

### Perguntas Críticas

| Pergunta | Resposta | Status |
|----------|----------|--------|
| Se o serviço de Imagens cair, inventários funcionam? | **SIM** | OK |
| Se o FCM Worker cair, o sistema principal funciona? | **SIM** | OK |
| Se OpenAI estiver fora, compliance funciona? | **NÃO** - Vision API também falha | RISCO |
| Se Supabase estiver lento, login funciona? | **NÃO** - Spinner infinito | RISCO |
| É possível adicionar consumidor sem alterar produtor? | **NÃO** - Acoplamento direto | RISCO |
| O banco absorve picos de carga? | **PARCIAL** - Sem connection pooling | RISCO |
| Existe desacoplamento real? | **NÃO** - Monólito | RISCO |

---

## PLANO DE AÇÃO PRIORIZADO

### Sprint 1: Resiliência Básica (1-2 semanas)

- [ ] Implementar timeout em todas as chamadas externas
- [ ] Habilitar ENABLE_BATCH_MODE no FCM Worker
- [ ] Implementar retry exponencial no FCM Worker
- [ ] Criar Dead Letter Queue
- [ ] Adicionar health checks completos

### Sprint 2: Observabilidade (1-2 semanas)

- [ ] Estruturar logs em JSON
- [ ] Configurar Sentry corretamente
- [ ] Adicionar métricas de latência
- [ ] Dashboard de monitoramento

### Sprint 3: Desacoplamento Inicial (2-3 semanas)

- [ ] Separar Image Service em módulo
- [ ] Criar middleware de autenticação centralizado
- [ ] Implementar eventos básicos com Supabase Realtime
- [ ] Documentar APIs internas

### Sprint 4: Performance (2-3 semanas)

- [ ] Implementar Circuit Breaker
- [ ] Configurar connection pooling
- [ ] Cache de produtos frequentes
- [ ] Otimizar queries N+1

### Futuro (3-6 meses)

- [ ] Avaliar separação em microserviços
- [ ] Implementar Event Sourcing para audit
- [ ] Migrar para Kafka/RabbitMQ SE volume justificar
- [ ] Implementar CQRS para analytics

---

## CONCLUSÃO

O MyInventory é um **monólito bem estruturado** com boas práticas em várias áreas (Zod validation, workers com retry, pipeline de imagens sofisticado). No entanto, apresenta riscos de resiliência e escalabilidade que devem ser endereçados gradualmente.

**NÃO RECOMENDO** migração imediata para Event Driven Architecture completa. O foco deve ser:

1. **Resiliência** - Circuit breakers, timeouts, DLQ
2. **Observabilidade** - Logs estruturados, métricas
3. **Desacoplamento gradual** - Separar responsabilidades
4. **Performance** - Cache, connection pooling

O Supabase Realtime pode atender necessidades de eventos em tempo real sem a complexidade de um broker dedicado.

---

*Relatório gerado automaticamente por análise arquitetural.*
