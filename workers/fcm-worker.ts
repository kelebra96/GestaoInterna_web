/**
 * FCM Worker - Background Process
 * Processa a fila fcm_queue e envia notificações push via Firebase Cloud Messaging
 *
 * Como executar:
 * - Desenvolvimento: npm run fcm-worker:dev (com tsx watch)
 * - Produção: npm run fcm-worker (com PM2 ou systemd)
 */

import { createClient } from '@supabase/supabase-js';
import { sendFCMNotification, sendBatchFCMNotifications } from '../lib/fcm-admin';

// ==========================================
// Configuração
// ==========================================

const POLL_INTERVAL = 5000; // 5 segundos
const MAX_RETRIES = 3;
const BATCH_SIZE = 50; // Processar até 50 notificações por vez
const ENABLE_BATCH_MODE = false; // Usar envio em lote (experimental)

// Supabase Admin Client (com service role key)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ==========================================
// Tipos
// ==========================================

interface FCMQueueItem {
  id: string;
  user_id: string;
  fcm_token: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

// ==========================================
// Funções de Processamento
// ==========================================

/**
 * Busca notificações pendentes da fila
 */
async function fetchPendingNotifications(): Promise<FCMQueueItem[]> {
  const { data, error } = await supabase
    .from('fcm_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Error fetching pending notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * Processa uma notificação individual
 */
async function processNotification(notification: FCMQueueItem): Promise<boolean> {
  try {
    // Converter data object para strings (FCM aceita apenas string values)
    const dataAsStrings: Record<string, string> = {};
    for (const [key, value] of Object.entries(notification.data)) {
      dataAsStrings[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    // Enviar via FCM
    await sendFCMNotification({
      token: notification.fcm_token,
      title: notification.title,
      body: notification.body,
      data: dataAsStrings,
      notificationType: notification.notification_type,
    });

    // Marcar como enviada
    const { error } = await supabase
      .from('fcm_queue')
      .update({
        status: 'sent',
        processed_at: new Date().toISOString(),
      })
      .eq('id', notification.id);

    if (error) {
      console.error(`⚠️  Failed to update notification ${notification.id} status:`, error);
      return false;
    }

    console.log(`✅ [${notification.id}] Sent to user ${notification.user_id} (${notification.notification_type})`);
    return true;

  } catch (error: any) {
    console.error(`❌ [${notification.id}] Failed to send:`, error.message);

    // Incrementar tentativas e registrar erro
    const newAttempts = notification.attempts + 1;
    const newStatus = newAttempts >= MAX_RETRIES ? 'failed' : 'pending';

    const { error: updateError } = await supabase
      .from('fcm_queue')
      .update({
        attempts: newAttempts,
        error_message: error.message || 'Unknown error',
        status: newStatus,
      })
      .eq('id', notification.id);

    if (updateError) {
      console.error(`⚠️  Failed to update notification ${notification.id} error:`, updateError);
    }

    return false;
  }
}

/**
 * Processa notificações em lote (modo experimental)
 */
async function processBatch(notifications: FCMQueueItem[]): Promise<void> {
  try {
    const fcmOptions = notifications.map(notif => {
      const dataAsStrings: Record<string, string> = {};
      for (const [key, value] of Object.entries(notif.data)) {
        dataAsStrings[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }

      return {
        token: notif.fcm_token,
        title: notif.title,
        body: notif.body,
        data: dataAsStrings,
        notificationType: notif.notification_type,
      };
    });

    const response = await sendBatchFCMNotifications(fcmOptions);

    // Processar respostas individuais
    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      const result = response.responses[i];

      if (result.success) {
        await supabase
          .from('fcm_queue')
          .update({
            status: 'sent',
            processed_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        console.log(`✅ [${notification.id}] Batch sent successfully`);
      } else {
        const newAttempts = notification.attempts + 1;
        const newStatus = newAttempts >= MAX_RETRIES ? 'failed' : 'pending';

        await supabase
          .from('fcm_queue')
          .update({
            attempts: newAttempts,
            error_message: result.error?.message || 'Batch send failed',
            status: newStatus,
          })
          .eq('id', notification.id);

        console.error(`❌ [${notification.id}] Batch send failed:`, result.error?.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Batch processing failed:', error.message);

    // Marcar todas como failed se o batch inteiro falhar
    for (const notification of notifications) {
      await supabase
        .from('fcm_queue')
        .update({
          attempts: notification.attempts + 1,
          error_message: error.message || 'Batch processing error',
          status: notification.attempts + 1 >= MAX_RETRIES ? 'failed' : 'pending',
        })
        .eq('id', notification.id);
    }
  }
}

/**
 * Processa fila de notificações
 */
async function processFCMQueue(): Promise<void> {
  try {
    const notifications = await fetchPendingNotifications();

    if (notifications.length === 0) {
      return; // Nada para processar
    }

    console.log(`📬 Processing ${notifications.length} pending notification(s)...`);

    if (ENABLE_BATCH_MODE && notifications.length > 1) {
      // Modo batch (experimental)
      await processBatch(notifications);
    } else {
      // Modo individual (recomendado)
      let successCount = 0;
      let failureCount = 0;

      for (const notification of notifications) {
        const success = await processNotification(notification);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Pequeno delay entre envios para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`📊 Results: ${successCount} sent, ${failureCount} failed`);
    }
  } catch (error) {
    console.error('❌ Error processing FCM queue:', error);
  }
}

/**
 * Limpa registros antigos da fila (> 30 dias)
 */
async function cleanupOldQueue(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error, count } = await supabase
      .from('fcm_queue')
      .delete()
      .in('status', ['sent', 'failed'])
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('❌ Error cleaning up old queue:', error);
    } else if (count && count > 0) {
      console.log(`🧹 Cleaned up ${count} old queue entries`);
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// ==========================================
// Worker Principal
// ==========================================

let isRunning = true;
let cleanupCounter = 0;

async function startWorker() {
  console.log('🚀 FCM Worker started');
  console.log(`   Polling interval: ${POLL_INTERVAL}ms`);
  console.log(`   Max retries: ${MAX_RETRIES}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Batch mode: ${ENABLE_BATCH_MODE ? 'enabled' : 'disabled'}`);
  console.log('');

  while (isRunning) {
    try {
      await processFCMQueue();

      // Fazer limpeza a cada 100 iterações (~8 minutos)
      cleanupCounter++;
      if (cleanupCounter >= 100) {
        await cleanupOldQueue();
        cleanupCounter = 0;
      }
    } catch (error) {
      console.error('❌ Unexpected error in worker loop:', error);
    }

    // Aguardar próxima iteração
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  console.log('🛑 FCM Worker stopped');
}

// ==========================================
// Graceful Shutdown
// ==========================================

process.on('SIGINT', () => {
  console.log('\n⏸️  Received SIGINT, shutting down gracefully...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  console.log('\n⏸️  Received SIGTERM, shutting down gracefully...');
  isRunning = false;
});

// ==========================================
// Iniciar Worker
// ==========================================

if (require.main === module) {
  startWorker().catch(error => {
    console.error('❌ Fatal error in FCM worker:', error);
    process.exit(1);
  });
}

export { startWorker, processFCMQueue, cleanupOldQueue };
