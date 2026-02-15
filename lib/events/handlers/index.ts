/**
 * Event Handlers - Sprint 6 Event-Driven Architecture
 *
 * Handlers que reagem automaticamente a eventos do sistema.
 * Cada handler é responsável por uma ação específica.
 *
 * Uso:
 *   import { registerAllHandlers } from '@/lib/events/handlers';
 *
 *   // No bootstrap da aplicação
 *   registerAllHandlers();
 */

import { eventBus } from '../event-bus';
import { eventStore } from '../event-store';
import { webhookService } from '../webhook.service';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

// Import handlers
import { registerNotificationHandlers } from './notification.handler';
import { registerCacheHandlers } from './cache.handler';
import { registerAnalyticsHandlers } from './analytics.handler';

// ==========================================
// Core Handlers
// ==========================================

/**
 * Handler para persistir eventos no Event Store
 */
function registerEventStoreHandler() {
  // Configurar event bus para usar o event store
  eventBus.setEventStore(async (event) => {
    await eventStore.save(event);
  });

  logger.info('Event store handler registered', {
    module: 'event-handlers',
    handler: 'event-store',
  });
}

/**
 * Handler para entregar eventos via webhooks
 */
function registerWebhookHandler() {
  eventBus.subscribe('*', async (event) => {
    try {
      await webhookService.deliver(event);
    } catch (error) {
      logger.error('Webhook delivery error', {
        module: 'event-handlers',
        handler: 'webhooks',
        eventType: event.type,
        error,
      });
    }
  }, { async: true, priority: -100 }); // Prioridade baixa, executa por último

  logger.info('Webhook handler registered', {
    module: 'event-handlers',
    handler: 'webhooks',
  });
}

/**
 * Handler para logging de eventos
 */
function registerLoggingHandler() {
  eventBus.subscribe('*', async (event) => {
    logger.info('Event occurred', {
      module: 'events',
      eventType: event.type,
      eventId: event.id,
      correlationId: event.correlationId,
      userId: event.userId,
      orgId: event.orgId,
    });
  }, { async: true, priority: 100 }); // Alta prioridade, executa primeiro

  logger.info('Logging handler registered', {
    module: 'event-handlers',
    handler: 'logging',
  });
}

/**
 * Handler para métricas de eventos
 */
function registerMetricsHandler() {
  const redis = getRedisClient();

  eventBus.subscribe('*', async (event) => {
    try {
      const now = Date.now();
      const category = event.type.split('.')[0];

      // Incrementar contador por tipo
      await redis.incr(`metrics:events:${event.type}:count`);
      await redis.incr(`metrics:events:${category}:count`);
      await redis.incr('metrics:events:total:count');

      // Registrar no sorted set para timeline
      await redis.zadd(`metrics:events:timeline`, now, `${event.type}:${event.id}`);

      // Limpar eventos antigos (manter últimas 24h)
      const dayAgo = now - 24 * 60 * 60 * 1000;
      await redis.zremrangebyscore('metrics:events:timeline', 0, dayAgo);
    } catch (error) {
      // Não falhar por erro de métricas
      logger.debug('Metrics recording error', {
        module: 'event-handlers',
        handler: 'metrics',
        error,
      });
    }
  }, { async: true, priority: 50 });

  logger.info('Metrics handler registered', {
    module: 'event-handlers',
    handler: 'metrics',
  });
}

// ==========================================
// Registration
// ==========================================

let handlersRegistered = false;

/**
 * Registra todos os handlers de eventos
 */
export function registerAllHandlers(): void {
  if (handlersRegistered) {
    logger.warn('Event handlers already registered', {
      module: 'event-handlers',
    });
    return;
  }

  logger.info('Registering event handlers...', {
    module: 'event-handlers',
  });

  // Core handlers
  registerEventStoreHandler();
  registerWebhookHandler();
  registerLoggingHandler();
  registerMetricsHandler();

  // Domain handlers
  registerNotificationHandlers();
  registerCacheHandlers();
  registerAnalyticsHandlers();

  handlersRegistered = true;

  logger.info('All event handlers registered', {
    module: 'event-handlers',
    subscriptions: eventBus.getSubscriptions().length,
  });
}

/**
 * Limpa todos os handlers (útil para testes)
 */
export function clearAllHandlers(): void {
  eventBus.clear();
  handlersRegistered = false;

  logger.info('All event handlers cleared', {
    module: 'event-handlers',
  });
}

export {
  registerNotificationHandlers,
  registerCacheHandlers,
  registerAnalyticsHandlers,
};
