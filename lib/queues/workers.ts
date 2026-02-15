/**
 * Queue Workers Initialization
 *
 * Inicializa todos os workers de filas quando a aplicação inicia.
 * Em ambiente serverless (Vercel), os workers não rodam automaticamente.
 * Use este módulo em um processo separado ou em edge functions dedicadas.
 *
 * Para desenvolvimento local:
 *   npx tsx lib/queues/workers.ts
 *
 * Para produção, considere:
 * - Vercel Edge Functions
 * - Processo separado (PM2, systemd)
 * - Vercel Cron Jobs para processar em intervalos
 */

import { isQueueConfigured } from './connection';
import { startFCMWorker, fcmQueue } from './fcm.queue';
import { startImageWorker, imageQueue } from './image.queue';

// Status dos workers
let workersStarted = false;

/**
 * Inicia todos os workers de filas
 */
export async function startAllWorkers(): Promise<boolean> {
  if (workersStarted) {
    console.log('[Workers] Workers já estão rodando');
    return true;
  }

  if (!isQueueConfigured()) {
    console.warn('[Workers] Redis não configurado. Workers não iniciados.');
    return false;
  }

  console.log('[Workers] Iniciando workers...');

  try {
    // Iniciar workers
    startFCMWorker();
    startImageWorker();

    workersStarted = true;
    console.log('[Workers] Todos os workers iniciados com sucesso');

    return true;
  } catch (error: any) {
    console.error('[Workers] Erro ao iniciar workers:', error.message);
    return false;
  }
}

/**
 * Verifica se os workers estão rodando
 */
export function areWorkersRunning(): boolean {
  return workersStarted;
}

/**
 * Obtém informações sobre os workers
 */
export async function getWorkersInfo() {
  return {
    configured: isQueueConfigured(),
    running: workersStarted,
    queues: {
      fcm: {
        name: 'fcm-notifications',
        active: !!fcmQueue,
      },
      image: {
        name: 'image-processing',
        active: !!imageQueue,
      },
    },
  };
}

// Auto-start se executado diretamente
if (require.main === module) {
  console.log('========================================');
  console.log('  BullMQ Workers - MyInventory');
  console.log('========================================');
  console.log('');

  startAllWorkers()
    .then((success) => {
      if (success) {
        console.log('');
        console.log('[Workers] Pressione Ctrl+C para encerrar');
        console.log('');
      } else {
        console.error('[Workers] Falha ao iniciar workers');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('[Workers] Erro fatal:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Workers] Encerrando...');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Workers] Encerrando...');
    process.exit(0);
  });
}

export default startAllWorkers;
