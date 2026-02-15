/**
 * FCM Queue - Push Notifications com BullMQ
 *
 * Substitui o polling PostgreSQL por processamento instantâneo.
 * Usa BullMQ para filas com retry automático e DLQ.
 *
 * Benefícios vs polling:
 * - Latência: 5s → <100ms
 * - Throughput: ~50/min → ~500/min
 * - Visibilidade: Dashboard em tempo real
 * - Confiabilidade: Retry automático + DLQ
 *
 * Uso:
 *   import { fcmQueue, addFCMNotification } from '@/lib/queues/fcm.queue';
 *
 *   // Enviar notificação
 *   await addFCMNotification({
 *     userId: 'user-123',
 *     token: 'fcm-token...',
 *     title: 'Nova mensagem',
 *     body: 'Você tem uma nova solicitação',
 *   });
 */

import { Job } from 'bullmq';
import { createQueue, createWorker, isQueueConfigured } from './index';
import { sendFCMNotification, FCMNotificationOptions } from '@/lib/fcm-admin';
import { RetryService } from '@/lib/resilience/retry.service';
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';

// Nome da fila
const QUEUE_NAME = 'fcm-notifications';

// Tipos
export interface FCMJobData {
  /** ID do usuário destinatário */
  userId: string;
  /** Token FCM do dispositivo */
  token: string;
  /** Título da notificação */
  title: string;
  /** Corpo da mensagem */
  body: string;
  /** Tipo de notificação (para channel Android) */
  notificationType?: string;
  /** Dados extras (key-value) */
  data?: Record<string, string>;
  /** URL da imagem (opcional) */
  imageUrl?: string;
  /** Prioridade: high para notificações importantes */
  priority?: 'high' | 'normal';
  /** Metadata para tracking */
  metadata?: {
    source?: string;
    correlationId?: string;
    createdAt?: string;
  };
}

export interface FCMJobResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: string;
}

// Criar a fila
export const fcmQueue = createQueue<FCMJobData>(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60, // 24 horas
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 60 * 60, // 7 dias
    },
  },
});

/**
 * Processa um job de notificação FCM
 */
async function processFCMJob(job: Job<FCMJobData>): Promise<FCMJobResult> {
  const { userId, token, title, body, notificationType, data, imageUrl } = job.data;

  console.log(`[FCM Queue] Processando job ${job.id} para user ${userId}`);

  try {
    // Usar circuit breaker para proteger contra falhas do Firebase
    const messageId = await circuitBreakers.firebase.fire(
      async () => {
        return await sendFCMNotification({
          token,
          title,
          body,
          data,
          notificationType,
          imageUrl,
        });
      },
      () => {
        throw new Error('Firebase circuit breaker open');
      }
    );

    console.log(`[FCM Queue] Job ${job.id} enviado com sucesso: ${messageId}`);

    return {
      success: true,
      messageId: typeof messageId === 'string' ? messageId : undefined,
      sentAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[FCM Queue] Job ${job.id} falhou:`, error.message);

    // Verificar se é erro de token inválido (não deve fazer retry)
    if (
      error.message?.includes('Invalid or expired FCM token') ||
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      // Token inválido - não fazer retry, enviar para DLQ
      await RetryService.execute(
        'fcm-invalid-token',
        async () => {
          throw error;
        },
        {
          maxRetries: 0,
          payload: job.data,
          originalId: job.id,
          metadata: { reason: 'invalid_token' },
        }
      );

      // Retornar sem erro para não fazer retry
      return {
        success: false,
        error: 'Invalid FCM token - moved to DLQ',
        sentAt: new Date().toISOString(),
      };
    }

    // Para outros erros, deixar BullMQ fazer retry
    throw error;
  }
}

// Criar worker (apenas se Redis estiver configurado)
let fcmWorker: ReturnType<typeof createWorker<FCMJobData>> | null = null;

export function startFCMWorker() {
  if (!isQueueConfigured()) {
    console.warn('[FCM Queue] Redis não configurado. Worker não iniciado.');
    return null;
  }

  if (fcmWorker) {
    console.warn('[FCM Queue] Worker já está rodando.');
    return fcmWorker;
  }

  fcmWorker = createWorker<FCMJobData>(QUEUE_NAME, processFCMJob, {
    concurrency: 10, // Processar 10 notificações simultaneamente
    limiter: {
      max: 100, // Máximo 100 por segundo
      duration: 1000,
    },
  });

  // Eventos do worker
  fcmWorker.on('completed', (job, result: FCMJobResult) => {
    if (result.success) {
      console.log(`[FCM Queue] ✅ Job ${job.id} completado`);
    }
  });

  fcmWorker.on('failed', async (job, error) => {
    console.error(`[FCM Queue] ❌ Job ${job?.id} falhou após ${job?.attemptsMade} tentativas:`, error.message);

    // Se esgotou todas as tentativas, enviar para DLQ
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await RetryService.execute(
        'fcm',
        async () => {
          throw error;
        },
        {
          maxRetries: 0,
          payload: job.data,
          originalId: job.id,
          metadata: {
            attempts: job.attemptsMade,
            lastError: error.message,
          },
        }
      );
    }
  });

  console.log('[FCM Queue] Worker iniciado com concurrency=10');
  return fcmWorker;
}

/**
 * Adiciona uma notificação na fila
 */
export async function addFCMNotification(
  data: FCMJobData,
  options?: {
    delay?: number; // Delay em ms antes de processar
    priority?: number; // Prioridade (maior = mais urgente)
    jobId?: string; // ID customizado do job
  }
): Promise<string> {
  // Adicionar metadata
  const jobData: FCMJobData = {
    ...data,
    metadata: {
      ...data.metadata,
      createdAt: new Date().toISOString(),
    },
  };

  const job = await fcmQueue.add('send', jobData, {
    delay: options?.delay,
    priority: options?.priority,
    jobId: options?.jobId,
  });

  console.log(`[FCM Queue] Job ${job.id} adicionado para user ${data.userId}`);

  return job.id!;
}

/**
 * Adiciona múltiplas notificações em batch
 */
export async function addFCMNotificationBatch(
  notifications: FCMJobData[]
): Promise<string[]> {
  const jobs = await fcmQueue.addBulk(
    notifications.map((data) => ({
      name: 'send',
      data: {
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: new Date().toISOString(),
        },
      },
    }))
  );

  console.log(`[FCM Queue] ${jobs.length} jobs adicionados em batch`);

  return jobs.map((job) => job.id!);
}

/**
 * Agenda notificação para um horário específico
 */
export async function scheduleFCMNotification(
  data: FCMJobData,
  scheduledFor: Date
): Promise<string> {
  const delay = scheduledFor.getTime() - Date.now();

  if (delay <= 0) {
    // Se já passou, enviar imediatamente
    return addFCMNotification(data);
  }

  return addFCMNotification(data, { delay });
}

/**
 * Obtém estatísticas da fila FCM
 */
export async function getFCMQueueStats() {
  const [counts, isPaused] = await Promise.all([
    fcmQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    fcmQueue.isPaused(),
  ]);

  return {
    name: QUEUE_NAME,
    counts,
    isPaused,
  };
}

/**
 * Obtém jobs falhados recentes
 */
export async function getFailedFCMJobs(limit: number = 20) {
  return fcmQueue.getJobs(['failed'], 0, limit - 1);
}

/**
 * Retry um job falhado
 */
export async function retryFCMJob(jobId: string): Promise<boolean> {
  const job = await fcmQueue.getJob(jobId);
  if (!job) return false;

  await job.retry();
  return true;
}

export default fcmQueue;
