/**
 * Health Check API - Sprint 2 Expanded
 *
 * Verifica a saúde de todos os serviços:
 * - Redis (cache)
 * - Supabase (banco de dados)
 * - Circuit Breakers (resiliência)
 * - Dead Letter Queue (filas falhadas)
 * - Sistema geral
 *
 * Endpoints:
 * - GET /api/health - Status geral
 * - GET /api/health?detailed=true - Status detalhado com métricas
 */

import { NextResponse } from 'next/server';
import { CacheService } from '@/lib/services/cache.service';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCircuitBreakerMetrics } from '@/lib/resilience/circuit-breaker';
import { RetryService } from '@/lib/resilience/retry.service';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
  details?: Record<string, any>;
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await CacheService.healthCheck();
    return {
      name: 'redis',
      status: result.healthy ? 'healthy' : 'unhealthy',
      latencyMs: result.latencyMs,
      message: result.error || 'Redis responding normally',
    };
  } catch (error: any) {
    return {
      name: 'redis',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error.message || 'Failed to connect to Redis',
    };
  }
}

async function checkSupabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Query simples para verificar conexão
    const { error } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      // Se a tabela não existe, ainda assim o Supabase está funcionando
      if (error.code === 'PGRST205') {
        return {
          name: 'supabase',
          status: 'healthy',
          latencyMs,
          message: 'Supabase connected (table may not exist)',
        };
      }
      return {
        name: 'supabase',
        status: 'degraded',
        latencyMs,
        message: error.message,
      };
    }

    return {
      name: 'supabase',
      status: 'healthy',
      latencyMs,
      message: 'Supabase responding normally',
    };
  } catch (error: any) {
    return {
      name: 'supabase',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error.message || 'Failed to connect to Supabase',
    };
  }
}

async function checkSystem(): Promise<HealthCheck> {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  // Verificar se o uso de memória está saudável (< 90% do heap)
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const status = heapUsedPercent < 90 ? 'healthy' : 'degraded';

  return {
    name: 'system',
    status,
    message: `Heap usage: ${heapUsedPercent.toFixed(1)}%`,
    details: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      uptimeSeconds: Math.floor(uptime),
      nodeVersion: process.version,
    },
  };
}

function checkCircuitBreakers(): HealthCheck {
  try {
    const metrics = getCircuitBreakerMetrics();

    // Verificar se algum circuit breaker está aberto
    const openBreakers = metrics.filter(m => m.state === 'OPEN');
    const halfOpenBreakers = metrics.filter(m => m.state === 'HALF_OPEN');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'All circuit breakers closed';

    if (openBreakers.length > 0) {
      status = 'degraded';
      message = `${openBreakers.length} circuit breaker(s) open: ${openBreakers.map(b => b.name).join(', ')}`;
    } else if (halfOpenBreakers.length > 0) {
      status = 'healthy';
      message = `${halfOpenBreakers.length} circuit breaker(s) recovering`;
    }

    // Calcular totais
    const totals = metrics.reduce(
      (acc, m) => ({
        successes: acc.successes + m.stats.successes,
        failures: acc.failures + m.stats.failures,
        timeouts: acc.timeouts + m.stats.timeouts,
        fallbacks: acc.fallbacks + m.stats.fallbacks,
      }),
      { successes: 0, failures: 0, timeouts: 0, fallbacks: 0 }
    );

    return {
      name: 'circuit_breakers',
      status,
      message,
      details: {
        breakers: metrics.map(m => ({
          name: m.name,
          state: m.state,
          ...m.stats,
        })),
        totals,
      },
    };
  } catch (error: any) {
    return {
      name: 'circuit_breakers',
      status: 'healthy',
      message: 'No circuit breakers active yet',
    };
  }
}

async function checkDLQ(): Promise<HealthCheck> {
  try {
    const stats = await RetryService.getDLQStats();
    const totalPending = Object.values(stats).reduce((sum, s) => sum + s.pending, 0);
    const totalResolved = Object.values(stats).reduce((sum, s) => sum + s.resolved, 0);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'No pending items in DLQ';

    if (totalPending > 100) {
      status = 'degraded';
      message = `High DLQ backlog: ${totalPending} pending items`;
    } else if (totalPending > 0) {
      status = 'healthy';
      message = `${totalPending} pending item(s) in DLQ`;
    }

    return {
      name: 'dead_letter_queue',
      status,
      message,
      details: {
        pending: totalPending,
        resolved: totalResolved,
        byQueue: stats,
      },
    };
  } catch (error: any) {
    // DLQ table might not exist yet
    return {
      name: 'dead_letter_queue',
      status: 'healthy',
      message: 'DLQ not configured or table not created',
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const detailed = url.searchParams.get('detailed') === 'true';

  const startTime = Date.now();

  // Executar verificações em paralelo
  const [redisCheck, supabaseCheck, systemCheck, circuitBreakerCheck, dlqCheck] = await Promise.all([
    checkRedis(),
    checkSupabase(),
    checkSystem(),
    Promise.resolve(checkCircuitBreakers()),
    checkDLQ(),
  ]);

  const checks = [redisCheck, supabaseCheck, systemCheck, circuitBreakerCheck, dlqCheck];
  const totalLatency = Date.now() - startTime;

  // Determinar status geral (ignorar DLQ para status crítico)
  const criticalChecks = [redisCheck, supabaseCheck, systemCheck];
  const hasUnhealthy = criticalChecks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  // Resposta básica
  const response: any = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: totalLatency,
  };

  // Adicionar detalhes se solicitado
  if (detailed) {
    response.checks = checks;
    response.cache = CacheService.getMetrics();
    response.circuitBreakers = circuitBreakerCheck.details?.breakers || [];
    response.dlq = dlqCheck.details || {};
    response.environment = process.env.NODE_ENV;
  } else {
    // Versão simplificada
    response.services = {
      redis: redisCheck.status,
      supabase: supabaseCheck.status,
      system: systemCheck.status,
      circuitBreakers: circuitBreakerCheck.status,
      dlq: dlqCheck.status,
    };
  }

  // Status HTTP baseado na saúde
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
