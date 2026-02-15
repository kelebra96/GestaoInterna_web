/**
 * Metrics Admin API - Sprint 4 Observabilidade
 *
 * Endpoints para visualização de métricas do sistema.
 *
 * GET /api/admin/metrics - Métricas gerais do sistema
 * GET /api/admin/metrics?type=api - Métricas de API
 * GET /api/admin/metrics?type=cache - Métricas de cache
 * GET /api/admin/metrics?type=queues - Métricas de filas
 * GET /api/admin/metrics?endpoint=/api/dashboard - Métricas de endpoint específico
 */

import { NextResponse } from 'next/server';
import { MetricsService } from '@/lib/services/metrics.service';
import { CacheService } from '@/lib/services/cache.service';
import { getQueueStats } from '@/lib/queues';
import { getCircuitBreakerMetrics } from '@/lib/resilience/circuit-breaker';
import { RetryService } from '@/lib/resilience/retry.service';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const endpoint = url.searchParams.get('endpoint');
    const window = url.searchParams.get('window') || '1h';

    // Converter window para ms
    const windowMs = parseWindow(window);

    // Métricas de endpoint específico
    if (endpoint) {
      const latencyKey = `api.latency.${endpoint.replace(/\//g, '.')}`;
      const latency = await MetricsService.getLatencyStats(latencyKey, windowMs);

      return NextResponse.json({
        endpoint,
        window,
        latency,
        timestamp: new Date().toISOString(),
      });
    }

    // Métricas por tipo
    if (type) {
      switch (type) {
        case 'api':
          return NextResponse.json(await getAPIMetrics(windowMs));

        case 'cache':
          return NextResponse.json(await getCacheMetrics());

        case 'queues':
          return NextResponse.json(await getQueueMetrics());

        case 'resilience':
          return NextResponse.json(await getResilienceMetrics());

        default:
          return NextResponse.json(
            { error: `Tipo desconhecido: ${type}` },
            { status: 400 }
          );
      }
    }

    // Métricas completas do sistema
    const [systemMetrics, cacheMetrics, queueMetrics, resilienceMetrics] = await Promise.all([
      MetricsService.getSystemMetrics(),
      getCacheMetrics(),
      getQueueMetrics(),
      getResilienceMetrics(),
    ]);

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      window,
      durationMs,
      api: systemMetrics.api,
      cache: {
        ...systemMetrics.cache,
        ...cacheMetrics,
      },
      queues: queueMetrics,
      resilience: resilienceMetrics,
      endpoints: systemMetrics.endpoints,
    });
  } catch (error: any) {
    console.error('[Metrics API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao obter métricas', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(m|h|d)$/);
  if (!match) return 60 * 60 * 1000; // default 1h

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

/**
 * Métricas de API
 */
async function getAPIMetrics(windowMs: number) {
  const [requests, errors] = await Promise.all([
    MetricsService.getCounterStats('api.requests'),
    MetricsService.getCounterStats('api.errors'),
  ]);

  const errorRate = requests.last24Hours > 0
    ? Math.round((errors.last24Hours / requests.last24Hours) * 100 * 100) / 100
    : 0;

  return {
    type: 'api',
    timestamp: new Date().toISOString(),
    requests: {
      total: requests.total,
      lastHour: requests.lastHour,
      last24Hours: requests.last24Hours,
    },
    errors: {
      total: errors.total,
      lastHour: errors.lastHour,
      last24Hours: errors.last24Hours,
      rate: errorRate,
    },
    byEndpoint: requests.byTag,
    byStatus: errors.byTag,
  };
}

/**
 * Métricas de cache
 */
async function getCacheMetrics() {
  const inMemoryMetrics = CacheService.getMetrics();

  const [hits, misses] = await Promise.all([
    MetricsService.getCounterStats('cache.hits'),
    MetricsService.getCounterStats('cache.misses'),
  ]);

  const total = hits.last24Hours + misses.last24Hours;
  const hitRate = total > 0 ? Math.round((hits.last24Hours / total) * 100) : 0;

  return {
    type: 'cache',
    timestamp: new Date().toISOString(),
    inMemory: inMemoryMetrics,
    redis: {
      hits: hits.last24Hours,
      misses: misses.last24Hours,
      hitRate,
    },
  };
}

/**
 * Métricas de filas
 */
async function getQueueMetrics() {
  try {
    const queueStats = await getQueueStats();

    const totals = queueStats.reduce(
      (acc, q) => ({
        waiting: acc.waiting + q.counts.waiting,
        active: acc.active + q.counts.active,
        completed: acc.completed + q.counts.completed,
        failed: acc.failed + q.counts.failed,
        delayed: acc.delayed + q.counts.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );

    return {
      type: 'queues',
      timestamp: new Date().toISOString(),
      totals,
      queues: queueStats,
    };
  } catch (error) {
    return {
      type: 'queues',
      timestamp: new Date().toISOString(),
      error: 'Queues not available',
      totals: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      queues: [],
    };
  }
}

/**
 * Métricas de resiliência
 */
async function getResilienceMetrics() {
  const circuitBreakers = getCircuitBreakerMetrics();
  const dlqStats = await RetryService.getDLQStats();

  const openBreakers = circuitBreakers.filter((cb) => cb.state === 'OPEN');
  const halfOpenBreakers = circuitBreakers.filter((cb) => cb.state === 'HALF_OPEN');

  const totalDLQPending = Object.values(dlqStats).reduce(
    (sum, s) => sum + s.pending,
    0
  );

  return {
    type: 'resilience',
    timestamp: new Date().toISOString(),
    circuitBreakers: {
      total: circuitBreakers.length,
      open: openBreakers.length,
      halfOpen: halfOpenBreakers.length,
      closed: circuitBreakers.length - openBreakers.length - halfOpenBreakers.length,
      details: circuitBreakers,
    },
    dlq: {
      pending: totalDLQPending,
      byQueue: dlqStats,
    },
    health: openBreakers.length === 0 && totalDLQPending < 100 ? 'healthy' : 'degraded',
  };
}
