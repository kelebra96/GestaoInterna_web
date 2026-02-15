/**
 * API Route Metrics Wrapper - Sprint 4 Observabilidade
 *
 * HOC para adicionar métricas automáticas a API routes.
 * Registra latência, status code e erros automaticamente.
 *
 * Uso:
 *   import { withMetrics } from '@/lib/helpers/with-metrics';
 *
 *   export const GET = withMetrics('/api/dashboard', async (request) => {
 *     // Sua lógica aqui
 *     return NextResponse.json({ data: 'ok' });
 *   });
 */

import { NextResponse } from 'next/server';
import { MetricsService } from '@/lib/services/metrics.service';
import { logger } from '@/lib/logger';

type RouteHandler = (request: any, context?: any) => Promise<Response>;

export interface WithMetricsOptions {
  /** Nome do endpoint para métricas */
  endpoint?: string;
  /** Não registrar métricas para este endpoint */
  skip?: boolean;
  /** Tags extras para métricas */
  tags?: Record<string, string>;
}

/**
 * Wrapper que adiciona métricas a uma API route
 */
export function withMetrics(
  endpointOrOptions: string | WithMetricsOptions,
  handler: RouteHandler
): RouteHandler {
  const options: WithMetricsOptions =
    typeof endpointOrOptions === 'string'
      ? { endpoint: endpointOrOptions }
      : endpointOrOptions;

  return async (request: Request, context?: any): Promise<Response> => {
    const startTime = Date.now();
    const method = request.method;
    const endpoint = options.endpoint || new URL(request.url).pathname;

    // Obter correlationId do header (set pelo middleware)
    const correlationId =
      request.headers.get('x-correlation-id') ||
      request.headers.get('x-request-id') ||
      crypto.randomUUID();

    // Log de início
    logger.debug('API request started', {
      module: 'api',
      operation: endpoint,
      correlationId,
      method,
    });

    let response: Response;
    let statusCode: number;
    let error: Error | undefined;

    try {
      response = await handler(request, context);
      statusCode = response.status;
    } catch (err: any) {
      error = err;
      statusCode = 500;

      // Log de erro
      logger.error('API request failed', {
        module: 'api',
        operation: endpoint,
        correlationId,
        method,
        error: err,
        durationMs: Date.now() - startTime,
      });

      // Retornar erro genérico
      response = NextResponse.json(
        {
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : undefined,
          correlationId,
        },
        { status: 500 }
      );
    }

    const durationMs = Date.now() - startTime;

    // Registrar métricas (async, não bloqueia resposta)
    if (!options.skip) {
      MetricsService.recordAPICall(endpoint, method, statusCode, durationMs).catch(
        (err) => {
          console.error('[withMetrics] Erro ao registrar métricas:', err);
        }
      );
    }

    // Log de conclusão
    if (!error) {
      logger.info('API request completed', {
        module: 'api',
        operation: endpoint,
        correlationId,
        method,
        statusCode,
        durationMs,
      });
    }

    // Adicionar headers de observabilidade
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Response-Time', `${durationMs}ms`);
    newHeaders.set('X-Correlation-ID', correlationId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Helper para medir duração de operações específicas
 */
export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const durationMs = Date.now() - startTime;

    await MetricsService.recordLatency(name, durationMs, tags);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await MetricsService.recordLatency(`${name}.error`, durationMs, tags);
    await MetricsService.incrementCounter(`${name}.errors`, tags);

    throw error;
  }
}

/**
 * Decorator simples para funções
 */
export function tracked(metricName: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: T
  ): T {
    return (async (...args: any[]) => {
      return measureOperation(metricName, () => target(...args));
    }) as T;
  };
}

export default withMetrics;
