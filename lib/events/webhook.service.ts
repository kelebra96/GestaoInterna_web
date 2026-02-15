/**
 * Webhook Service - Sprint 6 Event-Driven Architecture
 *
 * Sistema de webhooks para notificar sistemas externos sobre eventos.
 * Inclui assinatura HMAC, retry automático e monitoramento.
 *
 * Uso:
 *   import { webhookService } from '@/lib/events';
 *
 *   // Registrar webhook
 *   const webhook = await webhookService.register({
 *     name: 'ERP Integration',
 *     url: 'https://erp.example.com/webhook',
 *     eventTypes: ['solicitacao.created', 'solicitacao.status_changed'],
 *     orgId: 'org123'
 *   });
 *
 *   // Entregar evento
 *   await webhookService.deliver(event);
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { AppEvent } from './types';
import { logger } from '@/lib/logger';
import { fetchWithRetry } from '@/lib/utils/fetch-with-timeout';
import crypto from 'crypto';

// ==========================================
// Types
// ==========================================

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  event_types: string[];
  active: boolean;
  org_id?: string;
  max_retries: number;
  retry_delay_seconds: number;
  headers: Record<string, string>;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  last_delivery_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  response_status?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  retry_count: number;
  next_retry_at?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
}

export interface RegisterWebhookInput {
  name: string;
  url: string;
  eventTypes: string[];
  orgId?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelaySeconds?: number;
}

export interface DeliveryResult {
  webhookId: string;
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

// ==========================================
// Webhook Service Implementation
// ==========================================

class WebhookService {
  /**
   * Registra um novo webhook
   */
  async register(input: RegisterWebhookInput): Promise<Webhook> {
    // Gerar secret para assinatura HMAC
    const secret = this.generateSecret();

    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .insert({
        name: input.name,
        url: input.url,
        secret,
        event_types: input.eventTypes,
        org_id: input.orgId,
        headers: input.headers || {},
        max_retries: input.maxRetries || 3,
        retry_delay_seconds: input.retryDelaySeconds || 60,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Webhook registered', {
      module: 'webhooks',
      operation: 'register',
      webhookId: data.id,
      name: input.name,
      eventTypes: input.eventTypes,
    });

    return data;
  }

  /**
   * Atualiza um webhook
   */
  async update(
    webhookId: string,
    updates: Partial<Pick<Webhook, 'name' | 'url' | 'event_types' | 'active' | 'headers' | 'max_retries' | 'retry_delay_seconds'>>
  ): Promise<Webhook> {
    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .update(updates)
      .eq('id', webhookId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Remove um webhook
   */
  async delete(webhookId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('webhooks')
      .delete()
      .eq('id', webhookId);

    if (error) {
      throw error;
    }

    logger.info('Webhook deleted', {
      module: 'webhooks',
      operation: 'delete',
      webhookId,
    });
  }

  /**
   * Regenera o secret de um webhook
   */
  async regenerateSecret(webhookId: string): Promise<string> {
    const newSecret = this.generateSecret();

    const { error } = await supabaseAdmin
      .from('webhooks')
      .update({ secret: newSecret })
      .eq('id', webhookId);

    if (error) {
      throw error;
    }

    return newSecret;
  }

  /**
   * Lista webhooks de uma organização
   */
  async list(orgId?: string): Promise<Webhook[]> {
    let query = supabaseAdmin.from('webhooks').select('*');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Obtém um webhook por ID
   */
  async getById(webhookId: string): Promise<Webhook | null> {
    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Entrega um evento para todos os webhooks assinados
   */
  async deliver(event: AppEvent): Promise<DeliveryResult[]> {
    // Buscar webhooks ativos que assinaram este tipo de evento
    const webhooks = await this.getMatchingWebhooks(event.type, event.orgId);

    if (webhooks.length === 0) {
      return [];
    }

    const results: DeliveryResult[] = [];

    // Entregar para cada webhook em paralelo
    const deliveryPromises = webhooks.map(webhook =>
      this.deliverToWebhook(webhook, event)
    );

    const deliveryResults = await Promise.allSettled(deliveryPromises);

    for (let i = 0; i < deliveryResults.length; i++) {
      const result = deliveryResults[i];
      const webhook = webhooks[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          webhookId: webhook.id,
          deliveryId: '',
          success: false,
          error: result.reason?.message || 'Unknown error',
          durationMs: 0,
        });
      }
    }

    return results;
  }

  /**
   * Entrega um evento para um webhook específico
   */
  private async deliverToWebhook(
    webhook: Webhook,
    event: AppEvent
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    // Criar registro de delivery
    const { data: delivery, error: insertError } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_id: event.id,
        event_type: event.type,
        payload: event,
        status: 'pending',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    try {
      // Preparar payload
      const payload = JSON.stringify({
        event: event.type,
        timestamp: event.timestamp,
        data: event.payload,
        metadata: {
          eventId: event.id,
          correlationId: event.correlationId,
          userId: event.userId,
          orgId: event.orgId,
        },
      });

      // Calcular assinatura HMAC
      const signature = this.signPayload(payload, webhook.secret);

      // Fazer request
      const response = await fetchWithRetry(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.type,
          'X-Webhook-Delivery': delivery.id,
          ...webhook.headers,
        },
        body: payload,
      }, {
        maxRetries: 0, // Retry será controlado pelo sistema de webhooks
        timeout: 30000,
      });

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text();

      // Atualizar delivery como sucesso
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          response_status: response.status,
          response_body: responseBody.slice(0, 10000), // Limitar tamanho
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', delivery.id);

      // Atualizar estatísticas do webhook
      await supabaseAdmin
        .from('webhooks')
        .update({
          total_deliveries: webhook.total_deliveries + 1,
          successful_deliveries: webhook.successful_deliveries + 1,
          last_delivery_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', webhook.id);

      logger.info('Webhook delivered', {
        module: 'webhooks',
        operation: 'deliver',
        webhookId: webhook.id,
        deliveryId: delivery.id,
        eventType: event.type,
        statusCode: response.status,
        durationMs,
      });

      return {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        success: true,
        statusCode: response.status,
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';

      // Verificar se deve retry
      const shouldRetry = delivery.retry_count < webhook.max_retries;
      const nextRetryAt = shouldRetry
        ? new Date(Date.now() + webhook.retry_delay_seconds * 1000 * Math.pow(2, delivery.retry_count))
        : null;

      // Atualizar delivery como falha/retry
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: shouldRetry ? 'retrying' : 'failed',
          error: errorMessage,
          retry_count: delivery.retry_count + 1,
          next_retry_at: nextRetryAt?.toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', delivery.id);

      // Atualizar estatísticas do webhook
      await supabaseAdmin
        .from('webhooks')
        .update({
          total_deliveries: webhook.total_deliveries + 1,
          failed_deliveries: webhook.failed_deliveries + 1,
          last_delivery_at: new Date().toISOString(),
          last_error: errorMessage,
        })
        .eq('id', webhook.id);

      logger.warn('Webhook delivery failed', {
        module: 'webhooks',
        operation: 'deliver',
        webhookId: webhook.id,
        deliveryId: delivery.id,
        eventType: event.type,
        error: errorMessage,
        willRetry: shouldRetry,
        durationMs,
      });

      return {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Processa retries pendentes
   */
  async processRetries(): Promise<number> {
    const now = new Date().toISOString();

    // Buscar deliveries pendentes de retry
    const { data: pendingRetries, error } = await supabaseAdmin
      .from('webhook_deliveries')
      .select('*, webhooks(*)')
      .eq('status', 'retrying')
      .lte('next_retry_at', now)
      .limit(100);

    if (error) {
      throw error;
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      return 0;
    }

    let processed = 0;

    for (const delivery of pendingRetries) {
      const webhook = delivery.webhooks as Webhook;

      if (!webhook || !webhook.active) {
        // Marcar como falha se webhook não existe ou está inativo
        await supabaseAdmin
          .from('webhook_deliveries')
          .update({ status: 'failed', error: 'Webhook inactive or deleted' })
          .eq('id', delivery.id);
        continue;
      }

      // Recriar evento para retry
      const event: AppEvent = delivery.payload as AppEvent;

      try {
        await this.deliverToWebhook(webhook, event);
        processed++;
      } catch (error) {
        // Erro já tratado dentro de deliverToWebhook
        processed++;
      }
    }

    logger.info('Webhook retries processed', {
      module: 'webhooks',
      operation: 'processRetries',
      processed,
    });

    return processed;
  }

  /**
   * Lista entregas de um webhook
   */
  async getDeliveries(
    webhookId: string,
    options: { limit?: number; status?: string } = {}
  ): Promise<WebhookDelivery[]> {
    let query = supabaseAdmin
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
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
   * Busca webhooks que assinaram um tipo de evento
   */
  private async getMatchingWebhooks(
    eventType: string,
    orgId?: string
  ): Promise<Webhook[]> {
    let query = supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('active', true)
      .contains('event_types', [eventType]);

    // Também buscar webhooks com wildcard
    const category = eventType.split('.')[0];
    const wildcardPattern = `${category}.*`;

    const { data: exactMatch, error: error1 } = await query;

    let wildcardQuery = supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('active', true)
      .contains('event_types', [wildcardPattern]);

    const { data: wildcardMatch, error: error2 } = await wildcardQuery;

    if (error1 || error2) {
      throw error1 || error2;
    }

    // Combinar e deduplicar
    const allWebhooks = [...(exactMatch || []), ...(wildcardMatch || [])];
    const uniqueWebhooks = allWebhooks.filter(
      (webhook, index, self) => index === self.findIndex(w => w.id === webhook.id)
    );

    // Filtrar por organização se especificado
    if (orgId) {
      return uniqueWebhooks.filter(w => !w.org_id || w.org_id === orgId);
    }

    return uniqueWebhooks;
  }

  /**
   * Gera secret para assinatura
   */
  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Assina payload com HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verifica assinatura de webhook (para uso em endpoints)
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    try {
      const parts = signature.split(',');
      const timestamp = parseInt(parts[0].split('=')[1]);
      const receivedSignature = parts[1].split('=')[1];

      // Verificar timestamp
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSeconds) {
        return false;
      }

      // Verificar assinatura
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
}

// ==========================================
// Singleton Instance
// ==========================================

export const webhookService = new WebhookService();

export default webhookService;
