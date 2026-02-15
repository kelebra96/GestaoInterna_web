/**
 * Queue Module - Sprint 3
 *
 * Sistema de filas com BullMQ para processamento assíncrono.
 * Substitui polling PostgreSQL por processamento instantâneo.
 *
 * Filas disponíveis:
 * - fcmQueue: Notificações push (Firebase Cloud Messaging)
 * - imageQueue: Processamento de imagens
 *
 * Uso:
 *   import { fcmQueue, imageQueue } from '@/lib/queues';
 *
 *   // Adicionar job
 *   await fcmQueue.add('send', { userId, title, body });
 *
 *   // Verificar status
 *   const counts = await fcmQueue.getJobCounts();
 */

import { Queue, Worker, Job } from 'bullmq';
import { queueConnection, defaultQueueOptions, isQueueConfigured } from './connection';

// Re-exportar tipos úteis
export { Job } from 'bullmq';
export { queueConnection, isQueueConfigured } from './connection';

// Registry de filas para monitoramento
const queueRegistry: Map<string, Queue> = new Map();
const workerRegistry: Map<string, Worker> = new Map();

/**
 * Cria uma nova fila com configurações padrão
 */
export function createQueue<T = any>(
  name: string,
  options?: Partial<typeof defaultQueueOptions>
): Queue<T> {
  if (queueRegistry.has(name)) {
    return queueRegistry.get(name)! as Queue<T>;
  }

  const queue = new Queue<T>(name, {
    connection: queueConnection,
    ...defaultQueueOptions,
    ...options,
  });

  queueRegistry.set(name, queue);

  console.log(`[Queues] Fila "${name}" criada`);

  return queue;
}

/**
 * Cria um worker para processar jobs de uma fila
 */
export function createWorker<T = any>(
  queueName: string,
  processor: (job: Job<T>) => Promise<any>,
  options?: {
    concurrency?: number;
    limiter?: { max: number; duration: number };
  }
): Worker<T> {
  if (workerRegistry.has(queueName)) {
    console.warn(`[Queues] Worker "${queueName}" já existe. Retornando existente.`);
    return workerRegistry.get(queueName)! as Worker<T>;
  }

  const worker = new Worker<T>(queueName, processor, {
    connection: queueConnection,
    concurrency: options?.concurrency || 5,
    limiter: options?.limiter,
  });

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Queues] Job ${job.id} completado na fila "${queueName}"`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Queues] Job ${job?.id} falhou na fila "${queueName}":`, error.message);
  });

  worker.on('error', (error) => {
    console.error(`[Queues] Erro no worker "${queueName}":`, error.message);
  });

  workerRegistry.set(queueName, worker);

  console.log(`[Queues] Worker "${queueName}" iniciado`);

  return worker;
}

/**
 * Obtém estatísticas de todas as filas
 */
export async function getQueueStats(): Promise<
  Array<{
    name: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    isPaused: boolean;
  }>
> {
  const stats = [];

  for (const [name, queue] of queueRegistry) {
    try {
      const [counts, isPaused] = await Promise.all([
        queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
        queue.isPaused(),
      ]);

      stats.push({
        name,
        counts,
        isPaused,
      });
    } catch (error: any) {
      console.error(`[Queues] Erro ao obter stats de "${name}":`, error.message);
      stats.push({
        name,
        counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        isPaused: false,
      });
    }
  }

  return stats;
}

/**
 * Obtém jobs recentes de uma fila
 */
export async function getRecentJobs(
  queueName: string,
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'waiting',
  limit: number = 20
): Promise<Job[]> {
  const queue = queueRegistry.get(queueName);
  if (!queue) {
    return [];
  }

  try {
    return await queue.getJobs([status], 0, limit - 1);
  } catch (error) {
    console.error(`[Queues] Erro ao obter jobs de "${queueName}":`, error);
    return [];
  }
}

/**
 * Pausa uma fila
 */
export async function pauseQueue(queueName: string): Promise<boolean> {
  const queue = queueRegistry.get(queueName);
  if (!queue) return false;

  await queue.pause();
  console.log(`[Queues] Fila "${queueName}" pausada`);
  return true;
}

/**
 * Resume uma fila
 */
export async function resumeQueue(queueName: string): Promise<boolean> {
  const queue = queueRegistry.get(queueName);
  if (!queue) return false;

  await queue.resume();
  console.log(`[Queues] Fila "${queueName}" resumida`);
  return true;
}

/**
 * Limpa jobs completados/falhados de uma fila
 */
export async function cleanQueue(
  queueName: string,
  grace: number = 60000, // Jobs mais antigos que 1 minuto
  status: 'completed' | 'failed' = 'completed'
): Promise<number[]> {
  const queue = queueRegistry.get(queueName);
  if (!queue) return [];

  const cleaned = await queue.clean(grace, 1000, status);
  console.log(`[Queues] ${cleaned.length} jobs "${status}" limpos de "${queueName}"`);
  return cleaned;
}

/**
 * Obtém lista de filas registradas
 */
export function getRegisteredQueues(): string[] {
  return Array.from(queueRegistry.keys());
}

/**
 * Obtém uma fila pelo nome
 */
export function getQueue(name: string): Queue | undefined {
  return queueRegistry.get(name);
}

/**
 * Fecha todas as conexões (cleanup)
 */
export async function closeAllQueues(): Promise<void> {
  for (const [name, worker] of workerRegistry) {
    await worker.close();
    console.log(`[Queues] Worker "${name}" fechado`);
  }

  for (const [name, queue] of queueRegistry) {
    await queue.close();
    console.log(`[Queues] Fila "${name}" fechada`);
  }

  queueRegistry.clear();
  workerRegistry.clear();
}
