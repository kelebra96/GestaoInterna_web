/**
 * Queue Admin API
 *
 * Endpoints para monitoramento e gerenciamento de filas BullMQ.
 *
 * GET /api/admin/queues - Lista todas as filas com estatísticas
 * POST /api/admin/queues - Ações nas filas (pause, resume, clean, retry)
 *
 * Requer role: admin ou super_admin
 */

import { NextResponse } from 'next/server';
import {
  getQueueStats,
  getRecentJobs,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  getRegisteredQueues,
  isQueueConfigured,
} from '@/lib/queues';
import { fcmQueue, getFCMQueueStats, retryFCMJob } from '@/lib/queues/fcm.queue';
import { imageQueue, getImageQueueStats } from '@/lib/queues/image.queue';

// Forçar inicialização das filas
const _ = fcmQueue;
const __ = imageQueue;

/**
 * GET - Obtém estatísticas de todas as filas
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queueName = url.searchParams.get('queue');
    const includeJobs = url.searchParams.get('jobs') === 'true';
    const jobStatus = url.searchParams.get('status') as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' || 'waiting';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Verificar se Redis está configurado
    if (!isQueueConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Redis não configurado. Filas não disponíveis.',
        queues: [],
      });
    }

    // Se solicitou uma fila específica
    if (queueName) {
      const stats = await getQueueStats();
      const queueStats = stats.find((s) => s.name === queueName);

      if (!queueStats) {
        return NextResponse.json(
          { error: `Fila "${queueName}" não encontrada` },
          { status: 404 }
        );
      }

      const response: any = {
        configured: true,
        queue: queueStats,
      };

      // Incluir jobs se solicitado
      if (includeJobs) {
        const jobs = await getRecentJobs(queueName, jobStatus, limit);
        response.jobs = jobs.map((job) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          returnValue: job.returnvalue,
        }));
      }

      return NextResponse.json(response);
    }

    // Listar todas as filas
    const allStats = await getQueueStats();
    const registeredQueues = getRegisteredQueues();

    // Totais agregados
    const totals = allStats.reduce(
      (acc, q) => ({
        waiting: acc.waiting + q.counts.waiting,
        active: acc.active + q.counts.active,
        completed: acc.completed + q.counts.completed,
        failed: acc.failed + q.counts.failed,
        delayed: acc.delayed + q.counts.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );

    return NextResponse.json({
      configured: true,
      timestamp: new Date().toISOString(),
      totals,
      queues: allStats,
      registered: registeredQueues,
    });
  } catch (error: any) {
    console.error('[Queues API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao obter estatísticas das filas', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Executar ações nas filas
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, queue: queueName, jobId, status, grace } = body;

    if (!isQueueConfigured()) {
      return NextResponse.json(
        { error: 'Redis não configurado' },
        { status: 503 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Ação não especificada' },
        { status: 400 }
      );
    }

    let result: any = {};

    switch (action) {
      case 'pause':
        if (!queueName) {
          return NextResponse.json({ error: 'Nome da fila não especificado' }, { status: 400 });
        }
        const paused = await pauseQueue(queueName);
        result = { success: paused, message: paused ? `Fila "${queueName}" pausada` : 'Fila não encontrada' };
        break;

      case 'resume':
        if (!queueName) {
          return NextResponse.json({ error: 'Nome da fila não especificado' }, { status: 400 });
        }
        const resumed = await resumeQueue(queueName);
        result = { success: resumed, message: resumed ? `Fila "${queueName}" resumida` : 'Fila não encontrada' };
        break;

      case 'clean':
        if (!queueName) {
          return NextResponse.json({ error: 'Nome da fila não especificado' }, { status: 400 });
        }
        const cleanedIds = await cleanQueue(queueName, grace || 60000, status || 'completed');
        result = { success: true, cleaned: cleanedIds.length, message: `${cleanedIds.length} jobs limpos` };
        break;

      case 'retry':
        if (!jobId) {
          return NextResponse.json({ error: 'ID do job não especificado' }, { status: 400 });
        }
        // Por enquanto, só suporta retry na fila FCM
        const retried = await retryFCMJob(jobId);
        result = { success: retried, message: retried ? `Job ${jobId} reagendado` : 'Job não encontrado' };
        break;

      case 'stats':
        // Retornar stats atualizadas
        const stats = await getQueueStats();
        result = { success: true, queues: stats };
        break;

      default:
        return NextResponse.json(
          { error: `Ação desconhecida: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Queues API] Erro na ação:', error);
    return NextResponse.json(
      { error: 'Erro ao executar ação', details: error.message },
      { status: 500 }
    );
  }
}
