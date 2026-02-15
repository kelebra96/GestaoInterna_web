/**
 * Middleware Global - Next.js Edge Middleware
 *
 * Funcionalidades:
 * - Rate Limiting por IP
 * - Request ID para tracing
 * - Headers de segurança
 *
 * Nota: Este middleware roda no Edge Runtime, então usa uma versão
 * simplificada do rate limiting (in-memory para Edge, Redis para API routes)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limit em memória para Edge (fallback simples)
// Em produção, o rate limiting real acontece nas API routes com Redis
const edgeRateLimits = new Map<string, { count: number; resetAt: number }>();

// Limpar rate limits antigos a cada 60 segundos
const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const nowSeconds = Math.floor(now / 1000);

  for (const [key, value] of edgeRateLimits.entries()) {
    if (value.resetAt < nowSeconds) {
      edgeRateLimits.delete(key);
    }
  }
}

function checkEdgeRateLimit(ip: string, limit = 200, windowSeconds = 60): boolean {
  cleanupOldEntries();

  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);
  const key = `${ip}:${windowKey}`;

  const entry = edgeRateLimits.get(key);

  if (!entry) {
    edgeRateLimits.set(key, { count: 1, resetAt: (windowKey + 1) * windowSeconds });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Gerar Request ID para tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);

  // Obter IP do cliente
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  // Rate limiting básico no Edge (proteção contra DDoS extremo)
  // O rate limiting real com Redis acontece nas API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowed = checkEdgeRateLimit(ip, 200, 60); // 200 req/min no Edge

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded at edge. Please slow down.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }

  // Headers de segurança
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Adicionar IP ao header para uso nas API routes
  response.headers.set('X-Client-IP', ip);

  return response;
}

// Aplicar middleware apenas em rotas específicas
export const config = {
  matcher: [
    // Aplicar em todas as API routes
    '/api/:path*',
    // Excluir arquivos estáticos
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
  ],
};
