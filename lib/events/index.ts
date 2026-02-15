/**
 * Events Module - Sprint 6 Event-Driven Architecture
 *
 * Sistema completo de eventos para arquitetura event-driven.
 *
 * Componentes:
 * - Event Bus: Publicação e assinatura de eventos
 * - Event Store: Persistência e auditoria
 * - Webhooks: Notificações para sistemas externos
 * - Handlers: Reações automáticas a eventos
 *
 * Uso básico:
 *   import { eventBus, publishWithContext } from '@/lib/events';
 *
 *   // Publicar evento
 *   await eventBus.publish('solicitacao.created', {
 *     solicitacaoId: '123',
 *     storeId: 'abc',
 *     status: 'pending',
 *     itemCount: 5
 *   }, { userId: 'user123', orgId: 'org456' });
 *
 *   // Com helper de contexto
 *   await publishWithContext('product.updated', {
 *     productId: '789',
 *     changes: { price: { from: 10, to: 15 } }
 *   }, { userId, orgId, correlationId });
 *
 * Inicialização:
 *   import { initializeEvents } from '@/lib/events';
 *
 *   // No bootstrap da aplicação
 *   initializeEvents();
 */

// Types
export * from './types';

// Event Bus
export { eventBus, createEvent, publishWithContext } from './event-bus';

// Event Store
export { eventStore } from './event-store';
export type { StoredEvent, EventQuery, EventStats } from './event-store';

// Webhooks
export { webhookService } from './webhook.service';
export type {
  Webhook,
  WebhookDelivery,
  RegisterWebhookInput,
  DeliveryResult,
} from './webhook.service';

// Handlers
export {
  registerAllHandlers,
  clearAllHandlers,
  registerNotificationHandlers,
  registerCacheHandlers,
  registerAnalyticsHandlers,
} from './handlers';

export { getAnalyticsSummary } from './handlers/analytics.handler';

// ==========================================
// Initialization
// ==========================================

let initialized = false;

/**
 * Inicializa o sistema de eventos
 * Deve ser chamado no bootstrap da aplicação
 */
export function initializeEvents(): void {
  if (initialized) {
    console.warn('[Events] Already initialized');
    return;
  }

  const { registerAllHandlers } = require('./handlers');
  registerAllHandlers();

  initialized = true;
  console.log('[Events] System initialized');
}

/**
 * Verifica se o sistema de eventos está inicializado
 */
export function isEventsInitialized(): boolean {
  return initialized;
}

/**
 * Reseta o sistema de eventos (útil para testes)
 */
export function resetEvents(): void {
  const { clearAllHandlers } = require('./handlers');
  clearAllHandlers();
  initialized = false;
}
