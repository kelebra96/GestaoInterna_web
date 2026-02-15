# PLANO DE MELHORIA ARQUITETURAL - MyInventory

**Data:** 2026-02-14
**Versão:** 2.0
**Público-alvo:** 500 usuários simultâneos
**Stack Atual:** Next.js 15 + React 19 + Supabase + Prisma + Firebase

---

## SUMÁRIO EXECUTIVO

### Diagnóstico Geral

| Dimensão | Score Atual | Score Alvo | Prioridade |
|----------|-------------|------------|------------|
| Performance/Escalabilidade | 3/10 | 8/10 | **CRÍTICA** |
| Resiliência | 4/10 | 8/10 | **ALTA** |
| Arquitetura Event-Driven | 2/10 | 6/10 | MÉDIA |
| Observabilidade | 3/10 | 7/10 | MÉDIA |
| DDD/Bounded Contexts | 2/10 | 5/10 | BAIXA |

### Decisões Estratégicas

| Tecnologia | Decisão | Justificativa |
|------------|---------|---------------|
| **Redis** | **ADICIONAR** | Essencial para 500 users - cache, rate limit, filas |
| **MongoDB** | **REMOVER** | Código morto, não utilizado |
| **Kafka/RabbitMQ** | **NÃO ADICIONAR** | Over-engineering para escala atual |
| **PostgreSQL** | **MANTER** | Source of truth, bem estruturado |
| **Supabase Realtime** | **EXPANDIR** | Eventos em tempo real sem complexidade |

### Investimento Estimado

| Item | Custo Mensal |
|------|--------------|
| Supabase Pro (atual) | $25 |
| Upstash Redis | $10-25 |
| Vercel Pro (se necessário) | $20 |
| **Total** | **$55-70/mês** |

---

## PARTE 1: ANÁLISE DE PROBLEMAS CRÍTICOS

### 1.1 Gargalo Principal: Dashboard Route

**Arquivo:** `app/api/dashboard/route.ts` (800 linhas)

```
PROBLEMA: N+1 Queries Exponencial

1 request =
├─ SELECT * FROM solicitacoes (todas)
├─ Para cada solicitação:
│   ├─ SELECT user (N queries)
│   ├─ SELECT store (N queries)
│   ├─ SELECT items (N queries)
│   └─ Para cada item:
│       ├─ SELECT product (N×M queries)
│       └─ SELECT buyer (N×M queries)
└─ Agregações adicionais

Com 500 solicitações × 5 itens = ~2.750 queries por request
Com 500 users simultâneos = 1.375.000 queries
```

**Impacto:**
- Supabase Pro suporta 100 conexões simultâneas
- Sistema vai colapsar com 50+ usuários simultâneos
- Latência P99 estimada: 10-30 segundos

### 1.2 Acoplamento Síncrono Crítico

| Endpoint | Operações Síncronas | Latência Estimada |
|----------|---------------------|-------------------|
| `/api/dashboard` | 50-2750 queries | 3-30s |
| `/api/inventario/[id]/finalize` | 4 queries sequenciais | 500ms-3s |
| `/api/images/pipeline` | OFF + OpenAI + Storage | 2-5s |
| `/api/compliance/upload` | Google Vision + DB | 1-4s |

### 1.3 Ausência de Proteções

| Proteção | Status | Risco |
|----------|--------|-------|
| Circuit Breaker | **NÃO EXISTE** | OpenAI/Vision falha = sistema falha |
| Rate Limiting | **NÃO EXISTE** | DDoS ou uso excessivo = crash |
| Timeout configurável | **NÃO EXISTE** | Requests eternos |
| Dead Letter Queue | **NÃO EXISTE** | Mensagens perdidas |
| Cache distribuído | **NÃO EXISTE** | Cada request = queries repetidas |

### 1.4 Dependências Externas Frágeis

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
    │ CRÍTICO  │      │   ALTO   │      │  Vision  │
    │ sem isso │      │ pipeline │      │   ALTO   │
    │ nada     │      │ para     │      │compliance│
    │ funciona │      │          │      │  para    │
    └──────────┘      └──────────┘      └──────────┘
           │
           ▼
    ┌──────────┐      ┌──────────────┐
    │ Firebase │      │ Open Food    │
    │   FCM    │      │ Facts API    │
    │  MÉDIO   │      │    BAIXO     │
    └──────────┘      └──────────────┘
```

---

## PARTE 2: ARQUITETURA DE BANCO DE DADOS

### 2.1 Estado Atual

| Banco | Status | Uso Real |
|-------|--------|----------|
| PostgreSQL (Supabase) | **ATIVO** | Banco principal, 30+ tabelas |
| MongoDB | **MORTO** | Código existe, nunca chamado |
| IndexedDB | **ATIVO** | Cache offline no browser |
| Redis | **NÃO EXISTE** | - |

### 2.2 Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                        APLICAÇÃO                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    REDIS      │   │  POSTGRESQL   │   │   INDEXEDDB   │
│   (Upstash)   │   │  (Supabase)   │   │   (Browser)   │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ • Cache       │   │ • Users       │   │ • Inventário  │
│ • Sessions    │   │ • Products    │   │   offline     │
│ • Rate Limit  │   │ • Orders      │   │ • Contagens   │
│ • Pub/Sub     │   │ • Compliance  │   │   pendentes   │
│ • Job Queues  │   │ • Analytics   │   │               │
│               │   │ • Audit Log   │   │               │
│ TTL: segundos │   │ Persistente   │   │ Local only    │
│ a minutos     │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
     NOVO              EXISTENTE           EXISTENTE
```

### 2.3 Distribuição de Responsabilidades

| Dado | Banco | TTL | Justificativa |
|------|-------|-----|---------------|
| Dashboard compilado | Redis | 60s | Evita N+1 queries |
| Lista de usuários | Redis | 5min | Lookup frequente |
| Lista de lojas | Redis | 5min | Lookup frequente |
| Lista de produtos | Redis | 5min | Lookup frequente |
| Sessão do usuário | Redis | 24h | Validação rápida |
| Rate limit counters | Redis | 1min | Controle de acesso |
| Fila FCM | Redis | - | Pub/Sub instantâneo |
| Fila de imagens | Redis | - | BullMQ job queue |
| Dados de negócio | PostgreSQL | - | Source of truth |
| Histórico/Audit | PostgreSQL | - | Compliance |
| Cache offline | IndexedDB | 7d | Funcionalidade offline |

### 2.4 Remoção do MongoDB

**Arquivos a remover:**
```
lib/mongodb.ts                           # Cliente não utilizado
lib/databaseService.ts                   # Se usar MongoDB
prisma/schema.prisma.mongodb.backup      # Backup antigo
scripts/convert-schema-to-postgres.js    # Migração já feita
```

**Dependências a remover do package.json:**
```json
{
  "mongodb": "^7.0.0",        // REMOVER
  "@types/mongodb": "^4.0.6"  // REMOVER
}
```

---

## PARTE 3: ESTRATÉGIA EVENT-DRIVEN (GRADUAL)

### 3.1 Por Que NÃO Kafka/RabbitMQ Agora

| Fator | Kafka/RabbitMQ | Supabase Realtime + Redis |
|-------|----------------|---------------------------|
| Complexidade operacional | Alta | Baixa |
| Custo mensal | $50-200+ | $10-25 |
| Curva de aprendizado | Semanas | Dias |
| Necessidade atual | Não justifica | Suficiente |
| Escala suportada | Milhões msg/s | Milhares msg/s |

### 3.2 Eventos via Supabase Realtime (Já Disponível)

```typescript
// Já existe infraestrutura para isso no LayoutWrapper.tsx
const channel = supabase
  .channel(`events-${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
  }, (payload) => {
    // Reagir ao evento
  })
  .subscribe();
```

**Eventos Sugeridos para Implementar:**

| Evento | Trigger | Consumidores |
|--------|---------|--------------|
| `inventory.finalized` | Inventário fechado | Analytics, Notifications |
| `compliance.completed` | Task concluída | Dashboard, Reports |
| `solicitacao.created` | Nova solicitação | Compradores, Dashboard |
| `solicitacao.approved` | Item aprovado | Solicitante, Estoque |
| `image.processed` | Imagem processada | Produto, Cache |

### 3.3 Filas com Redis + BullMQ

```typescript
// Substituir polling PostgreSQL por BullMQ
import { Queue, Worker } from 'bullmq';

// Produtor
const fcmQueue = new Queue('fcm', { connection: redis });
await fcmQueue.add('send', { userId, title, body });

// Consumidor (Worker separado)
const worker = new Worker('fcm', async (job) => {
  await sendFCMNotification(job.data);
}, { connection: redis });
```

**Benefícios:**
- Processamento instantâneo (vs polling 5s)
- Retry automático com backoff
- Dead Letter Queue nativo
- Dashboard de monitoramento (Bull Board)
- Prioridades e delays

---

## PARTE 4: PLANO DE SPRINTS

### Sprint 1: Fundação Redis (Semana 1-2)
**Objetivo:** Resolver gargalo crítico de performance

#### Tarefas:

- [ ] **1.1 Configurar Upstash Redis**
  ```bash
  npm install @upstash/redis ioredis
  ```
  ```typescript
  // lib/redis.ts
  import { Redis } from '@upstash/redis';

  export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  ```

- [ ] **1.2 Implementar Cache Service**
  ```typescript
  // lib/services/cache.service.ts
  export class CacheService {
    static async get<T>(key: string): Promise<T | null>;
    static async set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    static async invalidate(pattern: string): Promise<void>;
    static async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T>;
  }
  ```

- [ ] **1.3 Refatorar Dashboard com Cache**
  ```typescript
  // ANTES: 2750 queries
  const data = await buildDashboard();

  // DEPOIS: 1 query ou cache hit
  const data = await CacheService.getOrSet(
    `dashboard:${orgId}`,
    () => buildDashboard(),
    60 // 60 segundos
  );
  ```

- [ ] **1.4 Cache de Entidades Frequentes**
  ```typescript
  // Cache de usuários, lojas, produtos
  await CacheService.set(`user:${id}`, user, 300);
  await CacheService.set(`store:${id}`, store, 300);
  await CacheService.set(`product:${id}`, product, 300);
  ```

- [ ] **1.5 Implementar Rate Limiting**
  ```typescript
  // middleware.ts
  const rateLimit = await redis.incr(`ratelimit:${ip}:${minute}`);
  if (rateLimit === 1) await redis.expire(`ratelimit:${ip}:${minute}`, 60);
  if (rateLimit > 100) return new Response('Too Many Requests', { status: 429 });
  ```

#### Entregáveis Sprint 1:
- Redis configurado e funcionando
- Dashboard com cache (latência < 500ms)
- Rate limiting ativo
- Documentação de uso do cache

#### Métricas de Sucesso:
| Métrica | Antes | Depois |
|---------|-------|--------|
| Dashboard latência P50 | 3-5s | < 200ms |
| Dashboard latência P99 | 10-30s | < 500ms |
| Queries por request | 2750 | 1-10 |
| Requests/segundo suportados | ~10 | ~500 |

---

### Sprint 2: Resiliência (Semana 3-4)
**Objetivo:** Sistema não quebra quando dependências falham

#### Tarefas:

- [ ] **2.1 Implementar Circuit Breaker**
  ```bash
  npm install opossum
  ```
  ```typescript
  // lib/resilience/circuit-breaker.ts
  import CircuitBreaker from 'opossum';

  export const openAIBreaker = new CircuitBreaker(callOpenAI, {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  openAIBreaker.fallback(() => ({
    status: 'unavailable',
    cached: true,
    reason: 'circuit_open'
  }));
  ```

- [ ] **2.2 Timeouts em Todas as Chamadas Externas**
  ```typescript
  // lib/utils/fetch-with-timeout.ts
  export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
  ```

- [ ] **2.3 Dead Letter Queue**
  ```sql
  -- Supabase Migration
  CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_queue TEXT NOT NULL,
    original_id TEXT,
    payload JSONB NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    attempts INT DEFAULT 1,
    max_attempts INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
  );

  CREATE INDEX idx_dlq_unresolved ON dead_letter_queue(source_queue)
    WHERE resolved_at IS NULL;
  ```

- [ ] **2.4 Retry Exponencial no FCM Worker**
  ```typescript
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  await new Promise(r => setTimeout(r, delay));
  ```

- [ ] **2.5 Graceful Degradation**
  ```typescript
  // Se OpenAI falhar, continuar sem score
  try {
    score = await openAIBreaker.fire(imageBytes);
  } catch {
    score = { match: null, confidence: 0, reason: 'service_unavailable' };
    await moveToManualReview(productId);
  }
  ```

- [ ] **2.6 Health Checks Completos**
  ```typescript
  // app/api/health/route.ts
  export async function GET() {
    const checks = await Promise.allSettled([
      checkSupabase(),
      checkRedis(),
      checkOpenAI(),
      checkFirebase(),
    ]);

    const healthy = checks.every(c => c.status === 'fulfilled');
    return NextResponse.json({
      status: healthy ? 'healthy' : 'degraded',
      checks: formatChecks(checks),
      timestamp: new Date().toISOString(),
    }, { status: healthy ? 200 : 503 });
  }
  ```

#### Entregáveis Sprint 2:
- Circuit breakers para OpenAI, Google Vision, Firebase
- Timeouts configuráveis
- DLQ funcional com dashboard de monitoramento
- Health check endpoint completo

#### Métricas de Sucesso:
| Métrica | Antes | Depois |
|---------|-------|--------|
| Falha OpenAI = Sistema crash | Sim | Não |
| Mensagens perdidas | ~5% | < 0.1% |
| Tempo de detecção de falha | Manual | < 30s |
| Recovery automático | Não | Sim |

---

### Sprint 3: Filas com Redis (Semana 5-6)
**Objetivo:** Processamento assíncrono eficiente

#### Tarefas:

- [ ] **3.1 Instalar BullMQ**
  ```bash
  npm install bullmq
  ```

- [ ] **3.2 Migrar FCM Queue para Redis**
  ```typescript
  // lib/queues/fcm.queue.ts
  import { Queue, Worker } from 'bullmq';
  import { redis } from '@/lib/redis';

  export const fcmQueue = new Queue('fcm-notifications', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  // Worker em processo separado
  export const fcmWorker = new Worker('fcm-notifications',
    async (job) => {
      await sendFCMNotification(job.data);
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );
  ```

- [ ] **3.3 Migrar Image Queue para Redis**
  ```typescript
  export const imageQueue = new Queue('image-processing', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: 60000, // 1 minuto max
    },
  });
  ```

- [ ] **3.4 Dashboard de Filas (Bull Board)**
  ```typescript
  // app/api/admin/queues/route.ts
  import { createBullBoard } from '@bull-board/api';
  import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

  const serverAdapter = new ExpressAdapter();
  createBullBoard({
    queues: [
      new BullMQAdapter(fcmQueue),
      new BullMQAdapter(imageQueue),
    ],
    serverAdapter,
  });
  ```

- [ ] **3.5 Eventos Pub/Sub para Real-time**
  ```typescript
  // Publicar evento quando job completa
  fcmWorker.on('completed', async (job) => {
    await redis.publish('events', JSON.stringify({
      type: 'notification.sent',
      userId: job.data.userId,
      timestamp: Date.now(),
    }));
  });
  ```

#### Entregáveis Sprint 3:
- FCM usando BullMQ (não mais polling PostgreSQL)
- Image processing usando BullMQ
- Dashboard de monitoramento de filas
- Eventos em tempo real funcionando

#### Métricas de Sucesso:
| Métrica | Antes | Depois |
|---------|-------|--------|
| Latência de notificação | 5s (polling) | < 100ms |
| Throughput FCM | ~50/min | ~500/min |
| Visibilidade de jobs | Nenhuma | Dashboard completo |
| Jobs perdidos | Possível | Zero |

---

### Sprint 4: Observabilidade (Semana 7-8)
**Objetivo:** Visibilidade total do sistema

#### Tarefas:

- [ ] **4.1 Structured Logging**
  ```typescript
  // lib/logger.ts
  import * as Sentry from '@sentry/nextjs';

  type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
      environment: process.env.NODE_ENV,
    };

    // Console (sempre)
    console[level](JSON.stringify(payload));

    // Sentry (errors e warnings em prod)
    if (level === 'error') {
      Sentry.captureMessage(message, { level: 'error', extra: context });
    }
  }
  ```

- [ ] **4.2 Métricas de Performance**
  ```typescript
  // lib/metrics.ts
  export async function trackMetric(name: string, value: number, tags?: Record<string, string>) {
    await redis.zadd(`metrics:${name}`, Date.now(), JSON.stringify({ value, tags, timestamp: Date.now() }));
    await redis.zremrangebyscore(`metrics:${name}`, 0, Date.now() - 86400000); // Keep 24h
  }

  // Uso
  const start = Date.now();
  await processRequest();
  await trackMetric('api.dashboard.latency', Date.now() - start, { org: orgId });
  ```

- [ ] **4.3 Dashboard de Métricas**
  ```typescript
  // app/api/admin/metrics/route.ts
  export async function GET() {
    const metrics = {
      api: {
        dashboard: await getMetricStats('api.dashboard.latency'),
        compliance: await getMetricStats('api.compliance.latency'),
      },
      queues: {
        fcm: await fcmQueue.getJobCounts(),
        images: await imageQueue.getJobCounts(),
      },
      cache: {
        hitRate: await getCacheHitRate(),
        size: await redis.dbsize(),
      },
      errors: await getRecentErrors(),
    };

    return NextResponse.json(metrics);
  }
  ```

- [ ] **4.4 Alertas Automáticos**
  ```typescript
  // Verificar a cada minuto
  if (p99Latency > 2000) {
    await sendSlackAlert({
      channel: '#alerts',
      message: `Dashboard P99 latency: ${p99Latency}ms (threshold: 2000ms)`,
      severity: 'warning',
    });
  }
  ```

- [ ] **4.5 Request Tracing**
  ```typescript
  // middleware.ts
  export function middleware(request: NextRequest) {
    const requestId = crypto.randomUUID();
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);

    // Log será correlacionado por requestId
    return response;
  }
  ```

#### Entregáveis Sprint 4:
- Logs estruturados em JSON
- Dashboard de métricas em tempo real
- Alertas automáticos configurados
- Request tracing funcional

---

### Sprint 5: Otimização de Queries (Semana 9-10)
**Objetivo:** Eliminar N+1 e otimizar acesso ao banco

#### Tarefas:

- [ ] **5.1 Refatorar Dashboard com JOINs**
  ```typescript
  // ANTES: Loop com queries individuais
  for (const sol of solicitacoes) {
    const user = await getUser(sol.created_by);
    const store = await getStore(sol.store_id);
    const items = await getItems(sol.id);
  }

  // DEPOIS: Uma query com JOINs
  const { data } = await supabaseAdmin
    .from('solicitacoes')
    .select(`
      *,
      creator:users!created_by(id, display_name),
      store:stores!store_id(id, name),
      items:solicitacao_itens(
        *,
        product:products!product_id(id, nome, ean)
      )
    `)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });
  ```

- [ ] **5.2 Índices Otimizados**
  ```sql
  -- Índices para queries frequentes
  CREATE INDEX CONCURRENTLY idx_solicitacoes_status_created
    ON solicitacoes(status, created_at DESC)
    WHERE status != 'draft';

  CREATE INDEX CONCURRENTLY idx_solicitacao_itens_solicitacao
    ON solicitacao_itens(solicitacao_id);

  CREATE INDEX CONCURRENTLY idx_products_ean
    ON products(ean) WHERE ean IS NOT NULL;

  CREATE INDEX CONCURRENTLY idx_users_active
    ON users(id) WHERE active = true;
  ```

- [ ] **5.3 Paginação Eficiente**
  ```typescript
  // ANTES: Buscar tudo
  const { data } = await supabaseAdmin.from('products').select('*');

  // DEPOIS: Cursor-based pagination
  const { data } = await supabaseAdmin
    .from('products')
    .select('*')
    .gt('id', cursor)
    .order('id')
    .limit(50);
  ```

- [ ] **5.4 Materializar Agregações**
  ```sql
  -- View materializada para dashboard
  CREATE MATERIALIZED VIEW mv_dashboard_stats AS
  SELECT
    org_id,
    COUNT(*) as total_solicitacoes,
    COUNT(*) FILTER (WHERE status = 'pending') as pendentes,
    COUNT(*) FILTER (WHERE status = 'closed') as fechadas,
    SUM(valor_total) as valor_total
  FROM solicitacoes
  WHERE status != 'draft'
  GROUP BY org_id;

  -- Refresh a cada 5 minutos via cron
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  SELECT cron.schedule('refresh-dashboard', '*/5 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats');
  ```

- [ ] **5.5 Connection Pooling**
  ```typescript
  // Usar Supabase connection pooler
  // Transaction mode para operações curtas
  const supabasePooler = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
      },
    }
  );
  ```

#### Entregáveis Sprint 5:
- Dashboard usando JOINs (1-3 queries no máximo)
- Índices criados e validados
- Paginação em todas as listagens
- Views materializadas para agregações

---

### Sprint 6: Eventos e Notificações (Semana 11-12)
**Objetivo:** Comunicação desacoplada entre módulos

#### Tarefas:

- [ ] **6.1 Event Bus Simples**
  ```typescript
  // lib/events/event-bus.ts
  import { redis } from '@/lib/redis';

  export type DomainEvent = {
    type: string;
    payload: any;
    metadata: {
      timestamp: number;
      correlationId: string;
      userId?: string;
    };
  };

  export async function publish(event: DomainEvent) {
    await redis.publish('domain-events', JSON.stringify(event));

    // Também persistir para replay/audit
    await supabaseAdmin.from('event_log').insert({
      event_type: event.type,
      payload: event.payload,
      metadata: event.metadata,
    });
  }

  export async function subscribe(
    eventTypes: string[],
    handler: (event: DomainEvent) => Promise<void>
  ) {
    const subscriber = redis.duplicate();
    await subscriber.subscribe('domain-events');

    subscriber.on('message', async (channel, message) => {
      const event = JSON.parse(message) as DomainEvent;
      if (eventTypes.includes(event.type)) {
        await handler(event);
      }
    });
  }
  ```

- [ ] **6.2 Eventos de Domínio**
  ```typescript
  // Ao finalizar inventário
  await publish({
    type: 'inventory.finalized',
    payload: {
      inventoryId,
      storeId,
      totalItems: eanTotals.size,
      completedBy: auth.userId,
    },
    metadata: {
      timestamp: Date.now(),
      correlationId: requestId,
      userId: auth.userId,
    },
  });

  // Consumidor: Atualizar analytics
  subscribe(['inventory.finalized'], async (event) => {
    await updateInventoryAnalytics(event.payload);
    await invalidateCache(`dashboard:${event.payload.orgId}`);
  });
  ```

- [ ] **6.3 Notificações Reativas**
  ```typescript
  // Ao criar solicitação, notificar compradores
  subscribe(['solicitacao.created'], async (event) => {
    const buyers = await getBuyersForProducts(event.payload.productIds);

    for (const buyer of buyers) {
      await fcmQueue.add('notify', {
        userId: buyer.id,
        title: 'Nova Solicitação',
        body: `${event.payload.storeName} precisa de produtos`,
        data: { solicitacaoId: event.payload.id },
      });
    }
  });
  ```

- [ ] **6.4 Invalidação de Cache por Eventos**
  ```typescript
  subscribe([
    'product.updated',
    'product.created',
    'product.deleted',
  ], async (event) => {
    await CacheService.invalidate(`product:${event.payload.productId}`);
    await CacheService.invalidate(`products:list:*`);
  });
  ```

#### Entregáveis Sprint 6:
- Event bus funcional
- Eventos de domínio implementados
- Notificações reativas
- Cache invalidation por eventos

---

## PARTE 5: ARQUITETURA FINAL

### 5.1 Diagrama de Arquitetura

```
                              ┌─────────────────┐
                              │   500 Users     │
                              │  (Simultâneos)  │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │   Vercel Edge   │
                              │   (CDN + WAF)   │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │   Next.js API   │
                              │   (Serverless)  │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐             ┌───────────────┐             ┌───────────────┐
│     REDIS     │             │  POSTGRESQL   │             │   EXTERNAL    │
│   (Upstash)   │             │  (Supabase)   │             │    APIS       │
├───────────────┤             ├───────────────┤             ├───────────────┤
│               │             │               │             │               │
│ • Cache       │◄───────────►│ • Users       │             │ • OpenAI      │
│ • Sessions    │  Fallback   │ • Products    │             │ • Google      │
│ • Rate Limit  │             │ • Orders      │             │ • Firebase    │
│ • Job Queues  │             │ • Events Log  │             │ • OFF API     │
│ • Pub/Sub     │             │ • Audit       │             │               │
│               │             │               │             │ Circuit       │
│ TTL-based     │             │ Source of     │             │ Breakers      │
│               │             │ Truth         │             │               │
└───────┬───────┘             └───────────────┘             └───────────────┘
        │
        │ BullMQ
        ▼
┌───────────────┐
│   WORKERS     │
├───────────────┤
│ • FCM Worker  │
│ • Image Worker│
│ • Event Subs  │
└───────────────┘
```

### 5.2 Fluxo de Request (Dashboard)

```
ANTES (Atual):
User ──► API ──► 2750 queries ──► PostgreSQL ──► 3-30s ──► Response

DEPOIS (Otimizado):
User ──► API ──► Redis Cache? ──► Hit ──► 50ms ──► Response
                     │
                     └──► Miss ──► 3 queries (JOINs) ──► PostgreSQL
                                          │
                                          └──► Set Cache ──► 200ms ──► Response
```

### 5.3 Fluxo de Notificação

```
ANTES (Atual):
Event ──► INSERT fcm_queue ──► Worker polls (5s) ──► Process ──► Send

DEPOIS (Otimizado):
Event ──► BullMQ.add() ──► Worker instant ──► Process ──► Send
                │
                └──► Dashboard real-time visibility
```

---

## PARTE 6: CHECKLIST DE IMPLEMENTAÇÃO

### Pré-Requisitos
- [ ] Conta Upstash criada
- [ ] Variáveis de ambiente configuradas
- [ ] Backup do banco de dados

### Sprint 1: Redis
- [ ] Instalar dependências Redis
- [ ] Configurar cliente Redis
- [ ] Implementar CacheService
- [ ] Refatorar Dashboard
- [ ] Implementar rate limiting
- [ ] Testar com carga

### Sprint 2: Resiliência
- [ ] Instalar opossum
- [ ] Implementar circuit breakers
- [ ] Adicionar timeouts
- [ ] Criar DLQ
- [ ] Implementar retry exponencial
- [ ] Criar health checks

### Sprint 3: Filas
- [ ] Instalar BullMQ
- [ ] Migrar FCM queue
- [ ] Migrar Image queue
- [ ] Configurar Bull Board
- [ ] Implementar eventos

### Sprint 4: Observabilidade
- [ ] Estruturar logs
- [ ] Configurar Sentry corretamente
- [ ] Criar dashboard de métricas
- [ ] Configurar alertas
- [ ] Implementar tracing

### Sprint 5: Queries
- [ ] Refatorar com JOINs
- [ ] Criar índices
- [ ] Implementar paginação
- [ ] Criar views materializadas
- [ ] Configurar connection pooling

### Sprint 6: Eventos
- [ ] Implementar event bus
- [ ] Criar eventos de domínio
- [ ] Notificações reativas
- [ ] Cache invalidation

### Limpeza
- [ ] Remover MongoDB
- [ ] Remover código morto
- [ ] Atualizar documentação

---

## PARTE 7: MÉTRICAS DE SUCESSO FINAL

| Métrica | Atual | Alvo | Medição |
|---------|-------|------|---------|
| Dashboard P50 | 3-5s | < 100ms | Datadog/Sentry |
| Dashboard P99 | 10-30s | < 500ms | Datadog/Sentry |
| Usuários simultâneos | ~50 | 500+ | Load test |
| Uptime | ~95% | 99.5% | Status page |
| Notificação latência | 5s | < 200ms | Métricas internas |
| Error rate | ~5% | < 0.5% | Sentry |
| Cache hit rate | 0% | > 80% | Redis metrics |
| Query count/request | 2750 | < 10 | Logs |

---

## PARTE 8: RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Redis indisponível | Baixa | Alto | Fallback para PostgreSQL |
| Migração quebra prod | Média | Crítico | Feature flags, rollback plan |
| Cache stale data | Média | Médio | TTL curtos, invalidação por eventos |
| Complexidade aumenta | Alta | Médio | Documentação, treinamento |
| Custo acima do esperado | Baixa | Baixo | Monitoramento de custos |

---

## CONCLUSÃO

Este plano transforma o MyInventory de um monólito frágil para uma arquitetura resiliente e escalável, mantendo a simplicidade operacional.

**Investimento:** ~$70/mês adicional + 12 semanas de desenvolvimento
**Retorno:** Sistema suporta 500+ usuários simultâneos com latência < 500ms

**Próximo passo imediato:** Configurar Upstash Redis e implementar cache do Dashboard (Sprint 1).

---

*Documento gerado em 2026-02-14*
*Última atualização: v2.0*
