/**
 * Retry Service
 *
 * Serviço de retry com backoff exponencial e integração com DLQ.
 * Quando todas as tentativas falham, a mensagem é enviada para a
 * Dead Letter Queue para análise posterior.
 *
 * Uso:
 *   const result = await RetryService.execute(
 *     'fcm',
 *     async () => await sendNotification(data),
 *     { maxRetries: 3, payload: data }
 *   );
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// Tipos
export interface RetryOptions {
  /** Número máximo de tentativas */
  maxRetries?: number;
  /** Delay inicial em ms */
  initialDelayMs?: number;
  /** Delay máximo em ms */
  maxDelayMs?: number;
  /** Fator de multiplicação do backoff */
  backoffFactor?: number;
  /** Payload original para DLQ */
  payload?: any;
  /** ID original do job */
  originalId?: string;
  /** Metadata adicional */
  metadata?: Record<string, any>;
  /** Função para decidir se deve fazer retry */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback chamado a cada retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  dlqId?: string;
}

// Configurações padrão
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'payload' | 'originalId' | 'metadata' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  shouldRetry: () => true,
};

/**
 * Calcula o delay com jitter para evitar thundering herd
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number
): number {
  // Exponential backoff
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Aguarda um tempo determinado
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adiciona item à Dead Letter Queue
 */
async function addToDLQ(
  sourceQueue: string,
  payload: any,
  error: Error,
  attempts: number,
  maxAttempts: number,
  originalId?: string,
  metadata?: Record<string, any>
): Promise<string | null> {
  try {
    const { data, error: dbError } = await supabaseAdmin
      .from('dead_letter_queue')
      .insert({
        source_queue: sourceQueue,
        original_id: originalId,
        payload: payload,
        error_message: error.message,
        error_stack: error.stack,
        error_code: (error as any).code || null,
        attempts: attempts,
        max_attempts: maxAttempts,
        metadata: metadata || {},
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[RetryService] Failed to add to DLQ:', dbError);
      return null;
    }

    console.warn(`[RetryService] Added to DLQ: ${data.id} (queue: ${sourceQueue})`);
    return data.id;
  } catch (err) {
    console.error('[RetryService] Error adding to DLQ:', err);
    return null;
  }
}

export const RetryService = {
  /**
   * Executa uma função com retry e backoff exponencial
   */
  async execute<T>(
    queueName: string,
    action: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxRetries,
      initialDelayMs,
      maxDelayMs,
      backoffFactor,
      shouldRetry,
    } = { ...DEFAULT_OPTIONS, ...options };

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const result = await action();
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
        };
      } catch (error: any) {
        lastError = error;
        attempt++;

        console.warn(
          `[RetryService] ${queueName} attempt ${attempt}/${maxRetries + 1} failed:`,
          error.message
        );

        // Verificar se deve fazer retry
        if (attempt > maxRetries || !shouldRetry(error, attempt)) {
          break;
        }

        // Calcular e aplicar delay
        const delay = calculateDelay(attempt - 1, initialDelayMs, maxDelayMs, backoffFactor);

        if (options.onRetry) {
          options.onRetry(error, attempt, delay);
        }

        console.info(`[RetryService] ${queueName} retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    // Todas as tentativas falharam - enviar para DLQ
    let dlqId: string | undefined;
    if (options.payload !== undefined) {
      const id = await addToDLQ(
        queueName,
        options.payload,
        lastError!,
        attempt,
        maxRetries + 1,
        options.originalId,
        options.metadata
      );
      dlqId = id || undefined;
    }

    return {
      success: false,
      error: lastError!,
      attempts: attempt,
      dlqId,
    };
  },

  /**
   * Executa múltiplas ações em paralelo com retry individual
   */
  async executeAll<T>(
    queueName: string,
    actions: Array<{ action: () => Promise<T>; payload?: any; id?: string }>,
    options: Omit<RetryOptions, 'payload' | 'originalId'> = {}
  ): Promise<RetryResult<T>[]> {
    return Promise.all(
      actions.map(({ action, payload, id }) =>
        this.execute(queueName, action, {
          ...options,
          payload,
          originalId: id,
        })
      )
    );
  },

  /**
   * Obtém itens pendentes da DLQ
   */
  async getDLQItems(
    sourceQueue?: string,
    limit: number = 50
  ): Promise<any[]> {
    let query = supabaseAdmin
      .from('dead_letter_queue')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sourceQueue) {
      query = query.eq('source_queue', sourceQueue);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RetryService] Failed to get DLQ items:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Resolve um item da DLQ
   */
  async resolveDLQItem(
    id: string,
    resolvedBy: string,
    resolutionType: 'reprocessed' | 'ignored' | 'fixed',
    notes?: string
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('dead_letter_queue')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        resolution_type: resolutionType,
        resolution_notes: notes,
      })
      .eq('id', id)
      .is('resolved_at', null);

    if (error) {
      console.error('[RetryService] Failed to resolve DLQ item:', error);
      return false;
    }

    return true;
  },

  /**
   * Reprocessa um item da DLQ
   */
  async reprocessDLQItem<T>(
    id: string,
    action: (payload: any) => Promise<T>,
    resolvedBy: string
  ): Promise<RetryResult<T> & { resolved: boolean }> {
    // Buscar item
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('dead_letter_queue')
      .select('*')
      .eq('id', id)
      .is('resolved_at', null)
      .single();

    if (fetchError || !item) {
      return {
        success: false,
        error: new Error('DLQ item not found or already resolved'),
        attempts: 0,
        resolved: false,
      };
    }

    // Tentar reprocessar
    const result = await this.execute(
      item.source_queue,
      () => action(item.payload),
      {
        maxRetries: 1, // Apenas uma tentativa no reprocessamento
        payload: item.payload,
        originalId: item.original_id,
      }
    );

    // Se sucesso, marcar como resolvido
    if (result.success) {
      await this.resolveDLQItem(id, resolvedBy, 'reprocessed');
    }

    return {
      ...result,
      resolved: result.success,
    };
  },

  /**
   * Obtém estatísticas da DLQ
   */
  async getDLQStats(): Promise<Record<string, { pending: number; resolved: number }>> {
    const { data, error } = await supabaseAdmin
      .from('dead_letter_queue')
      .select('source_queue, resolved_at');

    if (error || !data) {
      return {};
    }

    const stats: Record<string, { pending: number; resolved: number }> = {};

    for (const item of data) {
      if (!stats[item.source_queue]) {
        stats[item.source_queue] = { pending: 0, resolved: 0 };
      }

      if (item.resolved_at) {
        stats[item.source_queue].resolved++;
      } else {
        stats[item.source_queue].pending++;
      }
    }

    return stats;
  },
};

export default RetryService;
