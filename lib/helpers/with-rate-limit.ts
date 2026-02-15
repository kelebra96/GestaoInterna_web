/**
 * Higher-order function para aplicar rate limiting em API routes
 *
 * Uso:
 *   // Em uma API route
 *   import { withRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/helpers/with-rate-limit';
 *
 *   export const GET = withRateLimit(
 *     async (request) => {
 *       // Sua lógica aqui
 *       return NextResponse.json({ data: 'ok' });
 *     },
 *     RATE_LIMIT_CONFIGS.dashboard
 *   );
 */

import { NextResponse } from 'next/server';
import { RateLimitService, RateLimitConfig, RATE_LIMIT_CONFIGS } from '@/lib/services/rate-limit.service';

export { RATE_LIMIT_CONFIGS };

type RouteHandler = (request: Request, context?: any) => Promise<Response>;

/**
 * Wrapper que aplica rate limiting a uma route handler
 */
export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
): RouteHandler {
  return async (request: Request, context?: any) => {
    // Verificar rate limit
    const rateLimitResponse = await RateLimitService.checkAndRespond(request, config);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Rate limit OK, executar handler
    const response = await handler(request, context);

    // Adicionar headers de rate limit na resposta
    const identifier = RateLimitService.getIdentifier(request);
    const result = await RateLimitService.check(identifier, config);
    const headers = RateLimitService.getHeaders(result);

    // Clonar response para adicionar headers
    const newHeaders = new Headers(response.headers);
    Object.entries(headers).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Verificação manual de rate limit para casos mais complexos
 *
 * Uso:
 *   const rateLimitError = await checkRateLimit(request, RATE_LIMIT_CONFIGS.auth);
 *   if (rateLimitError) return rateLimitError;
 */
export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.default,
  userId?: string
): Promise<Response | null> {
  return RateLimitService.checkAndRespond(request, config, userId);
}

/**
 * Adiciona headers de rate limit a uma response existente
 */
export async function addRateLimitHeaders(
  response: NextResponse,
  request: Request,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
): Promise<NextResponse> {
  const identifier = RateLimitService.getIdentifier(request);
  const result = await RateLimitService.check(identifier, config);
  const headers = RateLimitService.getHeaders(result);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
