/**
 * Sentry Configuration - Client Side
 * Configuração do Sentry para o lado do cliente (browser)
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Traces Sample Rate: Adjust this value in production
    // 0.1 = 10% of transactions are sent to Sentry
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Integrations
    integrations: [
      // Session Replay for debugging
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),

      // Browser Tracing
      Sentry.browserTracingIntegration(),

      // HTTP Client Integration
      Sentry.httpClientIntegration(),
    ],

    // Performance Monitoring
    beforeSend(event, hint) {
      // Filter out unwanted errors
      const error = hint.originalException;

      // Ignorar erros de rede conhecidos
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;

        if (
          message.includes('Network Error') ||
          message.includes('Failed to fetch') ||
          message.includes('NetworkError') ||
          message.includes('Load failed')
        ) {
          return null; // Não enviar para Sentry
        }
      }

      return event;
    },

    // Ignorar certos tipos de erros
    ignoreErrors: [
      // Erros do browser que não podemos controlar
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Erros de extensões do browser
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,

      // Erros de scripts de terceiros
      'Script error.',
    ],

    // Configurações adicionais
    enabled: ENVIRONMENT !== 'development',
    debug: ENVIRONMENT === 'development',

    // Release tracking (opcional)
    // release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });

  console.log('✅ Sentry initialized (client)');
} else {
  console.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
}
