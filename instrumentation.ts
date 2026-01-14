/**
 * Next.js Instrumentation
 * Este arquivo é carregado automaticamente pelo Next.js antes da aplicação iniciar
 * Usado para inicializar Sentry e outros serviços de observabilidade
 *
 * Documentação: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Inicializar Sentry no servidor
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  // Inicializar Sentry no edge runtime (se usar)
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.server.config');
  }
}
