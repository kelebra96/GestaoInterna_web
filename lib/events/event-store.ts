/**
 * Event Store - Sprint 6 Event-Driven Architecture
 *
 * Serviço para persistência de eventos no banco de dados.
 * Permite auditoria completa e replay de eventos.
 *
 * Uso:
 *   import { eventStore } from '@/lib/events';
 *
 *   // Salvar evento
 *   await eventStore.save(event);
 *
 *   // Buscar eventos de um agregado
 *   const events = await eventStore.getByAggregate('solicitacao', '123');
 *
 *   // Buscar eventos por tipo
 *   const recentEvents = await eventStore.getByType('solicitacao.created', { limit: 100 });
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { AppEvent, EventType } from './types';
import { logger } from '@/lib/logger';

// ==========================================
// Types
// ==========================================

export interface StoredEvent {
  id: string;
  type: string;
  payload: Record<string, any>;
  aggregate_type?: string;
  aggregate_id?: string;
  correlation_id?: string;
  causation_id?: string;
  user_id?: string;
  org_id?: string;
  version: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EventQuery {
  /** Tipo de evento (suporta wildcard: "solicitacao.*") */
  type?: string;
  /** Tipo do agregado (ex: "solicitacao", "product") */
  aggregateType?: string;
  /** ID do agregado */
  aggregateId?: string;
  /** ID de correlação */
  correlationId?: string;
  /** ID do usuário */
  userId?: string;
  /** ID da organização */
  orgId?: string;
  /** Data inicial */
  fromDate?: Date;
  /** Data final */
  toDate?: Date;
  /** Limite de resultados */
  limit?: number;
  /** Offset para paginação */
  offset?: number;
  /** Ordem: 'asc' ou 'desc' */
  order?: 'asc' | 'desc';
}

export interface EventStats {
  event_type: string;
  count: number;
  first_at: string;
  last_at: string;
}

// ==========================================
// Event Store Implementation
// ==========================================

class EventStore {
  /**
   * Salva um evento no store
   */
  async save(event: AppEvent): Promise<string> {
    try {
      // Extrair aggregate info do tipo de evento
      const aggregateType = this.extractAggregateType(event.type);
      const aggregateId = this.extractAggregateId(event);

      const { data, error } = await supabaseAdmin
        .from('events')
        .insert({
          id: event.id,
          type: event.type,
          payload: event.payload,
          aggregate_type: aggregateType,
          aggregate_id: aggregateId,
          correlation_id: event.correlationId,
          user_id: event.userId,
          org_id: event.orgId,
          metadata: event.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      logger.debug('Event saved to store', {
        module: 'event-store',
        operation: 'save',
        eventId: event.id,
        eventType: event.type,
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to save event', {
        module: 'event-store',
        operation: 'save',
        eventId: event.id,
        eventType: event.type,
        error,
      });
      throw error;
    }
  }

  /**
   * Salva múltiplos eventos em batch
   */
  async saveBatch(events: AppEvent[]): Promise<string[]> {
    if (events.length === 0) return [];

    try {
      const records = events.map(event => ({
        id: event.id,
        type: event.type,
        payload: event.payload,
        aggregate_type: this.extractAggregateType(event.type),
        aggregate_id: this.extractAggregateId(event),
        correlation_id: event.correlationId,
        user_id: event.userId,
        org_id: event.orgId,
        metadata: event.metadata || {},
      }));

      const { data, error } = await supabaseAdmin
        .from('events')
        .insert(records)
        .select('id');

      if (error) {
        throw error;
      }

      return data.map(d => d.id);
    } catch (error) {
      logger.error('Failed to save events batch', {
        module: 'event-store',
        operation: 'saveBatch',
        count: events.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Busca um evento por ID
   */
  async getById(eventId: string): Promise<StoredEvent | null> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Busca eventos por tipo
   */
  async getByType(
    type: EventType | string,
    options: Omit<EventQuery, 'type'> = {}
  ): Promise<StoredEvent[]> {
    return this.query({ ...options, type });
  }

  /**
   * Busca eventos de um agregado
   */
  async getByAggregate(
    aggregateType: string,
    aggregateId: string,
    options: { fromVersion?: number; limit?: number } = {}
  ): Promise<StoredEvent[]> {
    let query = supabaseAdmin
      .from('events')
      .select('*')
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('version', { ascending: true });

    if (options.fromVersion) {
      query = query.gt('version', options.fromVersion);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Busca eventos com filtros
   */
  async query(options: EventQuery = {}): Promise<StoredEvent[]> {
    let query = supabaseAdmin.from('events').select('*');

    // Filtro por tipo (suporta wildcard)
    if (options.type) {
      if (options.type.endsWith('.*')) {
        const prefix = options.type.slice(0, -2);
        query = query.like('type', `${prefix}.%`);
      } else {
        query = query.eq('type', options.type);
      }
    }

    // Outros filtros
    if (options.aggregateType) {
      query = query.eq('aggregate_type', options.aggregateType);
    }

    if (options.aggregateId) {
      query = query.eq('aggregate_id', options.aggregateId);
    }

    if (options.correlationId) {
      query = query.eq('correlation_id', options.correlationId);
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options.orgId) {
      query = query.eq('org_id', options.orgId);
    }

    if (options.fromDate) {
      query = query.gte('created_at', options.fromDate.toISOString());
    }

    if (options.toDate) {
      query = query.lte('created_at', options.toDate.toISOString());
    }

    // Ordenação
    query = query.order('created_at', {
      ascending: options.order === 'asc',
    });

    // Paginação
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Conta eventos com filtros
   */
  async count(options: Omit<EventQuery, 'limit' | 'offset' | 'order'> = {}): Promise<number> {
    let query = supabaseAdmin
      .from('events')
      .select('id', { count: 'exact', head: true });

    if (options.type) {
      if (options.type.endsWith('.*')) {
        const prefix = options.type.slice(0, -2);
        query = query.like('type', `${prefix}.%`);
      } else {
        query = query.eq('type', options.type);
      }
    }

    if (options.orgId) {
      query = query.eq('org_id', options.orgId);
    }

    if (options.fromDate) {
      query = query.gte('created_at', options.fromDate.toISOString());
    }

    if (options.toDate) {
      query = query.lte('created_at', options.toDate.toISOString());
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Obtém estatísticas de eventos
   */
  async getStats(hours: number = 24): Promise<EventStats[]> {
    const { data, error } = await supabaseAdmin.rpc('get_event_stats', {
      p_hours: hours,
    });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Replay eventos para um handler
   */
  async replay(
    options: EventQuery,
    handler: (event: StoredEvent) => Promise<void>,
    batchSize: number = 100
  ): Promise<{ processed: number; errors: number }> {
    let offset = 0;
    let processed = 0;
    let errors = 0;

    while (true) {
      const events = await this.query({
        ...options,
        limit: batchSize,
        offset,
        order: 'asc',
      });

      if (events.length === 0) {
        break;
      }

      for (const event of events) {
        try {
          await handler(event);
          processed++;
        } catch (error) {
          errors++;
          logger.error('Replay error', {
            module: 'event-store',
            operation: 'replay',
            eventId: event.id,
            error,
          });
        }
      }

      offset += events.length;

      if (events.length < batchSize) {
        break;
      }
    }

    logger.info('Replay completed', {
      module: 'event-store',
      operation: 'replay',
      processed,
      errors,
    });

    return { processed, errors };
  }

  /**
   * Extrai tipo do agregado do tipo de evento
   */
  private extractAggregateType(eventType: string): string | undefined {
    const parts = eventType.split('.');
    return parts.length > 0 ? parts[0] : undefined;
  }

  /**
   * Extrai ID do agregado do payload
   */
  private extractAggregateId(event: AppEvent): string | undefined {
    const payload = event.payload as Record<string, any>;

    // Tentar encontrar ID com diferentes nomes
    const idFields = [
      'solicitacaoId',
      'productId',
      'inventoryId',
      'userId',
      'storeId',
      'id',
    ];

    for (const field of idFields) {
      if (payload[field]) {
        return String(payload[field]);
      }
    }

    return undefined;
  }
}

// ==========================================
// Singleton Instance
// ==========================================

export const eventStore = new EventStore();

export default eventStore;
