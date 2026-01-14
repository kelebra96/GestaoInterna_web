/**
 * Sentry Configuration - Server Side
 * Configuração do Sentry para o lado do servidor (Node.js/API Routes)
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Traces Sample Rate: Adjust this value in production
    // 0.1 = 10% of API requests are traced
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Integrations (Sentry 8.x já inclui HTTP integration por padrão)
    integrations: [
      // Node Profiling (opcional, para análise de performance)
      // Sentry.nodeProfilingIntegration(),
    ],

    // Performance Monitoring
    beforeSend(event, hint) {
      // Custom error filtering
      const error = hint.originalException;

      // Filtrar erros específicos do servidor
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;

        // Ignorar erros de conexão conhecidos
        if (
          message.includes('ECONNREFUSED') ||
          message.includes('ENOTFOUND') ||
          message.includes('ETIMEDOUT')
        ) {
          // Log localmente mas não enviar para Sentry
          console.error('Connection error:', message);
          return null;
        }
      }

      return event;
    },

    // Ignorar certos tipos de erros
    ignoreErrors: [
      // Erros de timeout esperados
      'Request timeout',
      'AbortError',

      // Erros de validação (já tratados pela aplicação)
      'ValidationError',
    ],

    // Configurações adicionais
    enabled: ENVIRONMENT !== 'development',
    debug: ENVIRONMENT === 'development',

    // Context adicional para debugging
    beforeBreadcrumb(breadcrumb) {
      // Filtrar breadcrumbs sensíveis
      if (breadcrumb.category === 'console') {
        return null; // Não capturar logs de console
      }

      return breadcrumb;
    },

    // Release tracking (opcional)
    // release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });

  console.log('✅ Sentry initialized (server)');
} else {
  console.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
}
