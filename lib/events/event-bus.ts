/**
 * Event Bus - Sprint 6 Event-Driven Architecture
 *
 * Sistema central de publicação e assinatura de eventos.
 * Suporta handlers síncronos e assíncronos, wildcards e prioridades.
 *
 * Uso:
 *   import { eventBus } from '@/lib/events';
 *
 *   // Publicar evento
 *   await eventBus.publish('solicitacao.created', {
 *     solicitacaoId: '123',
 *     storeId: 'abc',
 *     status: 'pending',
 *     itemCount: 5
 *   });
 *
 *   // Assinar evento
 *   eventBus.subscribe('solicitacao.created', async (event) => {
 *     console.log('Nova solicitação:', event.payload);
 *   });
 *
 *   // Assinar todos eventos de uma categoria
 *   eventBus.subscribe('solicitacao.*', async (event) => {
 *     console.log('Evento de solicitação:', event.type);
 *   });
 */

import { AppEvent, EventType, EventPayload, EventHandler, BaseEvent } from './types';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

// ==========================================
// Types
// ==========================================

interface Subscription {
  id: string;
  pattern: string;
  handler: EventHandler<any>;
  priority: number;
  async: boolean;
}

interface PublishOptions {
  /** ID de correlação para tracing */
  correlationId?: string;
  /** ID do usuário que gerou o evento */
  userId?: string;
  /** ID da organização */
  orgId?: string;
  /** Metadados adicionais */
  metadata?: Record<string, any>;
  /** Se true, não persiste no event store */
  ephemeral?: boolean;
  /** Se true, aguarda todos os handlers completarem */
  waitForHandlers?: boolean;
}

interface SubscribeOptions {
  /** Prioridade do handler (maior = executa primeiro) */
  priority?: number;
  /** Se true, handler é assíncrono (não bloqueia publish) */
  async?: boolean;
}

// ==========================================
// Event Bus Implementation
// ==========================================

class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private middlewares: Array<(event: AppEvent) => Promise<AppEvent | null>> = [];
  private eventStore: ((event: AppEvent) => Promise<void>) | null = null;
  private redis = getRedisClient();
  private subscriptionCounter = 0;

  /**
   * Publica um evento no bus
   */
  async publish<T extends EventType>(
    type: T,
    payload: EventPayload<T>,
    options: PublishOptions = {}
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    // Criar evento com metadados
    const event: AppEvent = {
      id: eventId,
      type,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: options.correlationId || crypto.randomUUID(),
      userId: options.userId,
      orgId: options.orgId,
      metadata: options.metadata,
    } as AppEvent;

    logger.debug('Publishing event', {
      module: 'event-bus',
      operation: 'publish',
      eventType: type,
      eventId,
      correlationId: event.correlationId,
    });

    // Executar middlewares
    let processedEvent: AppEvent | null = event;
    for (const middleware of this.middlewares) {
      processedEvent = await middleware(processedEvent);
      if (!processedEvent) {
        logger.debug('Event cancelled by middleware', {
          module: 'event-bus',
          eventId,
          eventType: type,
        });
        return eventId;
      }
    }

    // Persistir no event store (se configurado e não ephemeral)
    if (this.eventStore && !options.ephemeral) {
      try {
        await this.eventStore(processedEvent);
      } catch (error) {
        logger.error('Failed to persist event', {
          module: 'event-bus',
          eventId,
          eventType: type,
          error,
        });
      }
    }

    // Encontrar handlers que correspondem ao tipo
    const handlers = this.getMatchingHandlers(type);

    // Separar handlers síncronos e assíncronos
    const syncHandlers = handlers.filter(h => !h.async);
    const asyncHandlers = handlers.filter(h => h.async);

    // Executar handlers síncronos
    for (const subscription of syncHandlers) {
      try {
        await subscription.handler(processedEvent);
      } catch (error) {
        logger.error('Event handler error', {
          module: 'event-bus',
          eventId,
          eventType: type,
          handlerId: subscription.id,
          error,
        });
      }
    }

    // Executar handlers assíncronos
    if (asyncHandlers.length > 0) {
      const asyncPromises = asyncHandlers.map(subscription =>
        Promise.resolve(subscription.handler(processedEvent!)).catch(error => {
          logger.error('Async event handler error', {
            module: 'event-bus',
            eventId,
            eventType: type,
            handlerId: subscription.id,
            error,
          });
        })
      );

      if (options.waitForHandlers) {
        await Promise.all(asyncPromises);
      }
    }

    // Publicar no Redis para outros processos (se disponível)
    try {
      await this.redis.publish(`events:${type}`, JSON.stringify(processedEvent));
    } catch (error) {
      // Redis pub/sub é opcional
      logger.debug('Redis publish failed (non-critical)', {
        module: 'event-bus',
        eventType: type,
      });
    }

    return eventId;
  }

  /**
   * Assina um tipo de evento
   */
  subscribe<T extends EventType>(
    pattern: T | `${string}.*` | '*',
    handler: EventHandler<T>,
    options: SubscribeOptions = {}
  ): () => void {
    const subscriptionId = `sub_${++this.subscriptionCounter}`;

    const subscription: Subscription = {
      id: subscriptionId,
      pattern,
      handler,
      priority: options.priority || 0,
      async: options.async || false,
    };

    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);
    }

    const subs = this.subscriptions.get(pattern)!;
    subs.push(subscription);

    // Ordenar por prioridade (maior primeiro)
    subs.sort((a, b) => b.priority - a.priority);

    logger.debug('Event subscription added', {
      module: 'event-bus',
      subscriptionId,
      pattern,
      priority: subscription.priority,
    });

    // Retornar função para cancelar assinatura
    return () => {
      this.unsubscribe(subscriptionId);
    };
  }

  /**
   * Cancela uma assinatura
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [pattern, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        logger.debug('Event subscription removed', {
          module: 'event-bus',
          subscriptionId,
          pattern,
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Adiciona um middleware de processamento
   */
  use(middleware: (event: AppEvent) => Promise<AppEvent | null>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Configura o event store
   */
  setEventStore(store: (event: AppEvent) => Promise<void>): void {
    this.eventStore = store;
  }

  /**
   * Encontra handlers que correspondem a um tipo de evento
   */
  private getMatchingHandlers(eventType: string): Subscription[] {
    const handlers: Subscription[] = [];

    for (const [pattern, subs] of this.subscriptions.entries()) {
      if (this.matchPattern(pattern, eventType)) {
        handlers.push(...subs);
      }
    }

    // Ordenar por prioridade
    handlers.sort((a, b) => b.priority - a.priority);

    return handlers;
  }

  /**
   * Verifica se um padrão corresponde a um tipo de evento
   */
  private matchPattern(pattern: string, eventType: string): boolean {
    // Correspondência exata
    if (pattern === eventType) {
      return true;
    }

    // Wildcard: "solicitacao.*" corresponde a "solicitacao.created"
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix + '.');
    }

    // Wildcard global
    if (pattern === '*') {
      return true;
    }

    return false;
  }

  /**
   * Lista todas as assinaturas ativas
   */
  getSubscriptions(): Array<{ id: string; pattern: string; priority: number }> {
    const result: Array<{ id: string; pattern: string; priority: number }> = [];

    for (const [pattern, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        result.push({
          id: sub.id,
          pattern,
          priority: sub.priority,
        });
      }
    }

    return result;
  }

  /**
   * Limpa todas as assinaturas (útil para testes)
   */
  clear(): void {
    this.subscriptions.clear();
    this.middlewares = [];
    this.subscriptionCounter = 0;
  }
}

// ==========================================
// Singleton Instance
// ==========================================

export const eventBus = new EventBus();

// ==========================================
// Helper Functions
// ==========================================

/**
 * Cria um evento com metadados padrão
 */
export function createEvent<T extends EventType>(
  type: T,
  payload: EventPayload<T>,
  options: Partial<BaseEvent> = {}
): Extract<AppEvent, { type: T }> {
  return {
    id: options.id || crypto.randomUUID(),
    type,
    payload,
    timestamp: options.timestamp || new Date().toISOString(),
    correlationId: options.correlationId,
    userId: options.userId,
    orgId: options.orgId,
    metadata: options.metadata,
  } as Extract<AppEvent, { type: T }>;
}

/**
 * Wrapper para publicar evento com contexto do request
 */
export async function publishWithContext<T extends EventType>(
  type: T,
  payload: EventPayload<T>,
  context: {
    userId?: string;
    orgId?: string;
    correlationId?: string;
  }
): Promise<string> {
  return eventBus.publish(type, payload, {
    userId: context.userId,
    orgId: context.orgId,
    correlationId: context.correlationId,
  });
}

export default eventBus;
