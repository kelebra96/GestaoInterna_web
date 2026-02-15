/**
 * Metrics Service - Sprint 4 Observabilidade
 *
 * Coleta e armazena métricas de performance:
 * - Latência de APIs (p50, p95, p99)
 * - Throughput (requests/segundo)
 * - Taxa de erros
 * - Cache hit rate
 * - Métricas de filas
 *
 * Armazena no Redis com TTL de 24h.
 *
 * Uso:
 *   import { MetricsService } from '@/lib/services/metrics.service';
 *
 *   // Registrar latência
 *   await MetricsService.recordLatency('api.dashboard', 150);
 *
 *   // Incrementar contador
 *   await MetricsService.incrementCounter('api.errors', { endpoint: '/api/dashboard' });
 *
 *   // Obter estatísticas
 *   const stats = await MetricsService.getStats('api.dashboard');
 */

import { getRedisClient } from '@/lib/redis';

// Tipos
export interface MetricPoint {
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  lastValue: number;
  lastTimestamp: number;
}

export interface CounterStats {
  total: number;
  lastHour: number;
  last24Hours: number;
  byTag: Record<string, number>;
}

// Configuração
const METRIC_PREFIX = 'metrics:';
const COUNTER_PREFIX = 'counters:';
const METRIC_TTL = 24 * 60 * 60; // 24 horas
const MAX_POINTS_PER_METRIC = 10000;

/**
 * Obtém cliente Redis
 */
function getRedis() {
  return getRedisClient();
}

/**
 * Calcula percentil de um array ordenado
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

export const MetricsService = {
  /**
   * Registra um valor de latência/duração
   */
  async recordLatency(
    name: string,
    valueMs: number,
    tags?: Record<string, string>
  ): Promise<void> {
    const redis = getRedis();
    const key = `${METRIC_PREFIX}${name}`;
    const timestamp = Date.now();

    const point: MetricPoint = {
      value: valueMs,
      timestamp,
      tags,
    };

    try {
      // Adicionar ao sorted set (score = timestamp)
      await redis.zadd(key, timestamp, JSON.stringify(point));

      // Definir TTL
      await redis.expire(key, METRIC_TTL);

      // Limpar pontos antigos (manter últimos MAX_POINTS)
      const count = await redis.zcard(key);
      if (count > MAX_POINTS_PER_METRIC) {
        await redis.zremrangebyrank(key, 0, count - MAX_POINTS_PER_METRIC - 1);
      }
    } catch (error) {
      console.error('[Metrics] Erro ao registrar latência:', error);
    }
  },

  /**
   * Incrementa um contador
   */
  async incrementCounter(
    name: string,
    tags?: Record<string, string>,
    increment: number = 1
  ): Promise<void> {
    const redis = getRedis();
    const timestamp = Date.now();
    const hour = Math.floor(timestamp / (60 * 60 * 1000));

    try {
      // Contador total
      const totalKey = `${COUNTER_PREFIX}${name}:total`;
      await redis.incr(totalKey);

      // Contador por hora
      const hourKey = `${COUNTER_PREFIX}${name}:hour:${hour}`;
      await redis.incr(hourKey);
      await redis.expire(hourKey, 25 * 60 * 60); // 25 horas

      // Contador por tag
      if (tags) {
        for (const [tagKey, tagValue] of Object.entries(tags)) {
          const tagCounterKey = `${COUNTER_PREFIX}${name}:tag:${tagKey}:${tagValue}`;
          await redis.incr(tagCounterKey);
          await redis.expire(tagCounterKey, METRIC_TTL);
        }
      }
    } catch (error) {
      console.error('[Metrics] Erro ao incrementar contador:', error);
    }
  },

  /**
   * Obtém estatísticas de uma métrica de latência
   */
  async getLatencyStats(
    name: string,
    windowMs: number = 60 * 60 * 1000 // última hora
  ): Promise<MetricStats | null> {
    const redis = getRedis();
    const key = `${METRIC_PREFIX}${name}`;
    const minTimestamp = Date.now() - windowMs;

    try {
      // Buscar pontos na janela de tempo
      const rawPoints = await redis.zrangebyscore(key, minTimestamp, '+inf');

      if (!rawPoints || rawPoints.length === 0) {
        return null;
      }

      const points: MetricPoint[] = rawPoints.map((raw) => JSON.parse(raw));
      const values = points.map((p) => p.value).sort((a, b) => a - b);

      const sum = values.reduce((a, b) => a + b, 0);
      const lastPoint = points[points.length - 1];

      return {
        count: values.length,
        sum,
        min: values[0],
        max: values[values.length - 1],
        avg: Math.round(sum / values.length),
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        lastValue: lastPoint.value,
        lastTimestamp: lastPoint.timestamp,
      };
    } catch (error) {
      console.error('[Metrics] Erro ao obter stats:', error);
      return null;
    }
  },

  /**
   * Obtém estatísticas de um contador
   */
  async getCounterStats(name: string): Promise<CounterStats> {
    const redis = getRedis();
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));

    try {
      // Total
      const totalRaw = await redis.get(`${COUNTER_PREFIX}${name}:total`);
      const total = parseInt(totalRaw || '0', 10);

      // Última hora
      const lastHourRaw = await redis.get(`${COUNTER_PREFIX}${name}:hour:${currentHour}`);
      const lastHour = parseInt(lastHourRaw || '0', 10);

      // Últimas 24 horas
      let last24Hours = 0;
      for (let i = 0; i < 24; i++) {
        const hourKey = `${COUNTER_PREFIX}${name}:hour:${currentHour - i}`;
        const hourRaw = await redis.get(hourKey);
        last24Hours += parseInt(hourRaw || '0', 10);
      }

      // Por tags (buscar keys)
      const tagKeys = await redis.keys(`${COUNTER_PREFIX}${name}:tag:*`);
      const byTag: Record<string, number> = {};

      for (const tagKey of tagKeys) {
        const parts = tagKey.split(':');
        const tagName = parts[parts.length - 2];
        const tagValue = parts[parts.length - 1];
        const countRaw = await redis.get(tagKey);
        byTag[`${tagName}:${tagValue}`] = parseInt(countRaw || '0', 10);
      }

      return { total, lastHour, last24Hours, byTag };
    } catch (error) {
      console.error('[Metrics] Erro ao obter contador:', error);
      return { total: 0, lastHour: 0, last24Hours: 0, byTag: {} };
    }
  },

  /**
   * Registra métrica de API (latência + contador)
   */
  async recordAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number
  ): Promise<void> {
    const tags = { endpoint, method, status: String(statusCode) };

    // Registrar latência
    await this.recordLatency(`api.latency.${endpoint.replace(/\//g, '.')}`, durationMs, tags);

    // Incrementar contador de requests
    await this.incrementCounter('api.requests', tags);

    // Se erro, incrementar contador de erros
    if (statusCode >= 400) {
      await this.incrementCounter('api.errors', tags);
    }
  },

  /**
   * Registra hit/miss de cache
   */
  async recordCacheAccess(hit: boolean, key?: string): Promise<void> {
    if (hit) {
      await this.incrementCounter('cache.hits', key ? { key } : undefined);
    } else {
      await this.incrementCounter('cache.misses', key ? { key } : undefined);
    }
  },

  /**
   * Obtém métricas agregadas do sistema
   */
  async getSystemMetrics(): Promise<{
    api: {
      requests: CounterStats;
      errors: CounterStats;
      latency: MetricStats | null;
    };
    cache: {
      hits: CounterStats;
      misses: CounterStats;
      hitRate: number;
    };
    endpoints: Array<{
      name: string;
      latency: MetricStats | null;
    }>;
  }> {
    // API metrics
    const [requests, errors, apiLatency] = await Promise.all([
      this.getCounterStats('api.requests'),
      this.getCounterStats('api.errors'),
      this.getLatencyStats('api.latency'),
    ]);

    // Cache metrics
    const [cacheHits, cacheMisses] = await Promise.all([
      this.getCounterStats('cache.hits'),
      this.getCounterStats('cache.misses'),
    ]);

    const totalCacheAccess = cacheHits.last24Hours + cacheMisses.last24Hours;
    const hitRate = totalCacheAccess > 0
      ? Math.round((cacheHits.last24Hours / totalCacheAccess) * 100)
      : 0;

    // Top endpoints
    const redis = getRedis();
    const endpointKeys = await redis.keys(`${METRIC_PREFIX}api.latency.*`);
    const endpoints: Array<{ name: string; latency: MetricStats | null }> = [];

    for (const key of endpointKeys.slice(0, 10)) {
      const name = key.replace(METRIC_PREFIX, '').replace('api.latency.', '');
      const latency = await this.getLatencyStats(key.replace(METRIC_PREFIX, ''));
      endpoints.push({ name, latency });
    }

    // Ordenar por latência média (decrescente)
    endpoints.sort((a, b) => (b.latency?.avg || 0) - (a.latency?.avg || 0));

    return {
      api: { requests, errors, latency: apiLatency },
      cache: { hits: cacheHits, misses: cacheMisses, hitRate },
      endpoints,
    };
  },

  /**
   * Registra métrica customizada
   */
  async record(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    await this.recordLatency(name, value, tags);
  },

  /**
   * Limpa métricas antigas
   */
  async cleanup(): Promise<number> {
    const redis = getRedis();
    const cutoff = Date.now() - METRIC_TTL * 1000;
    let cleaned = 0;

    try {
      const keys = await redis.keys(`${METRIC_PREFIX}*`);

      for (const key of keys) {
        const removed = await redis.zremrangebyscore(key, 0, cutoff);
        cleaned += removed;
      }

      return cleaned;
    } catch (error) {
      console.error('[Metrics] Erro ao limpar métricas:', error);
      return 0;
    }
  },
};

export default MetricsService;
