/**
 * RateLimitService - Serviço de Rate Limiting usando Redis
 *
 * Implementa sliding window rate limiting para proteger a API contra abusos.
 *
 * Uso:
 *   const result = await RateLimitService.check('ip:192.168.1.1', {
 *     limit: 100,
 *     windowSeconds: 60,
 *   });
 *
 *   if (!result.allowed) {
 *     return new Response('Too Many Requests', { status: 429 });
 *   }
 */

import { redis } from '@/lib/redis';

export interface RateLimitConfig {
  /** Número máximo de requests permitidos na janela */
  limit: number;
  /** Tamanho da janela em segundos */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Se o request é permitido */
  allowed: boolean;
  /** Número de requests restantes */
  remaining: number;
  /** Timestamp de quando o limite reseta (em segundos) */
  resetAt: number;
  /** Total de requests na janela atual */
  current: number;
  /** Limite configurado */
  limit: number;
}

// Configurações padrão por tipo de endpoint
export const RATE_LIMIT_CONFIGS = {
  // API geral: 100 requests por minuto
  default: { limit: 100, windowSeconds: 60 },

  // Autenticação: 10 tentativas por minuto (proteção contra brute force)
  auth: { limit: 10, windowSeconds: 60 },

  // Dashboard: 30 requests por minuto (é pesado mesmo com cache)
  dashboard: { limit: 30, windowSeconds: 60 },

  // Upload: 20 uploads por minuto
  upload: { limit: 20, windowSeconds: 60 },

  // AI/OpenAI: 10 requests por minuto (caro e lento)
  ai: { limit: 10, windowSeconds: 60 },

  // Webhook: 1000 requests por minuto (precisa ser alto para integrações)
  webhook: { limit: 1000, windowSeconds: 60 },
};

export const RateLimitService = {
  /**
   * Verifica se um request deve ser permitido
   * Implementa sliding window com Redis INCR + EXPIRE
   */
  async check(
    identifier: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
  ): Promise<RateLimitResult> {
    const { limit, windowSeconds } = config;

    // Gerar chave baseada no identificador e janela de tempo
    const windowKey = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${identifier}:${windowKey}`;

    try {
      // Incrementar contador
      const current = await redis.incr(key);

      // Se é o primeiro request na janela, definir expiração
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const resetAt = (windowKey + 1) * windowSeconds;

      return {
        allowed,
        remaining,
        resetAt,
        current,
        limit,
      };
    } catch (error) {
      console.error('[RateLimit] Erro ao verificar rate limit:', error);
      // Em caso de erro no Redis, permitir o request (fail-open)
      return {
        allowed: true,
        remaining: limit,
        resetAt: Math.floor(Date.now() / 1000) + windowSeconds,
        current: 0,
        limit,
      };
    }
  },

  /**
   * Gera headers de rate limit para a resposta
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt),
    };
  },

  /**
   * Extrai identificador do request (IP ou userId)
   */
  getIdentifier(request: Request, userId?: string): string {
    // Preferir userId se disponível (mais preciso)
    if (userId) {
      return `user:${userId}`;
    }

    // Fallback para IP
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

    return `ip:${ip}`;
  },

  /**
   * Verifica rate limit e retorna Response 429 se excedido
   * Retorna null se permitido
   */
  async checkAndRespond(
    request: Request,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.default,
    userId?: string
  ): Promise<Response | null> {
    const identifier = this.getIdentifier(request, userId);
    const result = await this.check(identifier, config);

    if (!result.allowed) {
      const headers = this.getHeaders(result);
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${result.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
          retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)),
            ...headers,
          },
        }
      );
    }

    return null;
  },

  /**
   * Reseta o rate limit para um identificador
   * Útil após login bem-sucedido para resetar contador de auth
   */
  async reset(identifier: string): Promise<void> {
    const pattern = `ratelimit:${identifier}:*`;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('[RateLimit] Erro ao resetar rate limit:', error);
    }
  },

  /**
   * Obtém estatísticas de rate limit para um identificador
   */
  async getStats(identifier: string): Promise<{
    windowsActive: number;
    totalRequests: number;
  }> {
    const pattern = `ratelimit:${identifier}:*`;
    try {
      const keys = await redis.keys(pattern);
      let totalRequests = 0;

      for (const key of keys) {
        const count = await redis.get(key);
        totalRequests += parseInt(count || '0', 10);
      }

      return {
        windowsActive: keys.length,
        totalRequests,
      };
    } catch (error) {
      console.error('[RateLimit] Erro ao obter estatísticas:', error);
      return { windowsActive: 0, totalRequests: 0 };
    }
  },
};

export default RateLimitService;
