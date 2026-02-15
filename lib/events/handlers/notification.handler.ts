/**
 * Notification Handlers - Sprint 6 Event-Driven Architecture
 *
 * Handlers para envio de notificações baseadas em eventos.
 */

import { eventBus } from '../event-bus';
import { logger } from '@/lib/logger';
import { addFCMNotification } from '@/lib/queues/fcm.queue';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Registra handlers de notificação
 */
export function registerNotificationHandlers(): void {
  // Notificar quando solicitação é criada
  eventBus.subscribe('solicitacao.created', async (event) => {
    try {
      const { solicitacaoId, storeId, itemCount } = event.payload;

      // Buscar admins da loja para notificar
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id, fcm_token')
        .eq('store_id', storeId)
        .in('role', ['admin', 'manager', 'comprador'])
        .not('fcm_token', 'is', null);

      if (!admins || admins.length === 0) {
        return;
      }

      // Enviar notificação para cada admin
      for (const admin of admins) {
        if (admin.fcm_token) {
          await addFCMNotification({
            token: admin.fcm_token,
            title: 'Nova Solicitação',
            body: `Uma nova solicitação com ${itemCount} item(ns) foi criada`,
            data: {
              type: 'solicitacao_created',
              solicitacaoId,
              storeId,
            },
          });
        }
      }

      logger.debug('Notification sent for solicitacao.created', {
        module: 'notification-handler',
        solicitacaoId,
        recipientCount: admins.length,
      });
    } catch (error) {
      logger.error('Error handling solicitacao.created notification', {
        module: 'notification-handler',
        eventId: event.id,
        error,
      });
    }
  }, { async: true });

  // Notificar quando status da solicitação muda
  eventBus.subscribe('solicitacao.status_changed', async (event) => {
    try {
      const { solicitacaoId, fromStatus, toStatus } = event.payload;

      // Buscar criador da solicitação
      const { data: solicitacao } = await supabaseAdmin
        .from('solicitacoes')
        .select('created_by, users:created_by(fcm_token)')
        .eq('id', solicitacaoId)
        .single();

      if (!solicitacao?.users?.fcm_token) {
        return;
      }

      const statusLabels: Record<string, string> = {
        pending: 'Pendente',
        batched: 'Em Lote',
        approved: 'Aprovada',
        rejected: 'Rejeitada',
        closed: 'Fechada',
        completed: 'Concluída',
      };

      await addFCMNotification({
        token: solicitacao.users.fcm_token,
        title: 'Status Atualizado',
        body: `Sua solicitação mudou de ${statusLabels[fromStatus] || fromStatus} para ${statusLabels[toStatus] || toStatus}`,
        data: {
          type: 'solicitacao_status_changed',
          solicitacaoId,
          fromStatus,
          toStatus,
        },
      });

      logger.debug('Notification sent for solicitacao.status_changed', {
        module: 'notification-handler',
        solicitacaoId,
        fromStatus,
        toStatus,
      });
    } catch (error) {
      logger.error('Error handling solicitacao.status_changed notification', {
        module: 'notification-handler',
        eventId: event.id,
        error,
      });
    }
  }, { async: true });

  // Notificar quando inventário é concluído
  eventBus.subscribe('inventory.completed', async (event) => {
    try {
      const { inventoryId, storeId, itemCount, discrepancyCount } = event.payload;

      // Buscar admins da organização
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('org_id')
        .eq('id', storeId)
        .single();

      if (!store) return;

      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id, fcm_token')
        .eq('org_id', store.org_id)
        .in('role', ['admin', 'super_admin'])
        .not('fcm_token', 'is', null);

      if (!admins || admins.length === 0) {
        return;
      }

      const message = discrepancyCount > 0
        ? `Inventário concluído com ${itemCount} itens e ${discrepancyCount} divergência(s)`
        : `Inventário concluído com ${itemCount} itens sem divergências`;

      for (const admin of admins) {
        if (admin.fcm_token) {
          await addFCMNotification({
            token: admin.fcm_token,
            title: 'Inventário Concluído',
            body: message,
            data: {
              type: 'inventory_completed',
              inventoryId,
              storeId,
            },
          });
        }
      }

      logger.debug('Notification sent for inventory.completed', {
        module: 'notification-handler',
        inventoryId,
        recipientCount: admins.length,
      });
    } catch (error) {
      logger.error('Error handling inventory.completed notification', {
        module: 'notification-handler',
        eventId: event.id,
        error,
      });
    }
  }, { async: true });

  // Notificar sobre erros críticos do sistema
  eventBus.subscribe('system.error', async (event) => {
    try {
      const { severity, error: errorMessage, context } = event.payload;

      if (severity !== 'critical') {
        return;
      }

      // Buscar super admins
      const { data: superAdmins } = await supabaseAdmin
        .from('users')
        .select('id, fcm_token')
        .eq('role', 'super_admin')
        .not('fcm_token', 'is', null);

      if (!superAdmins || superAdmins.length === 0) {
        return;
      }

      for (const admin of superAdmins) {
        if (admin.fcm_token) {
          await addFCMNotification({
            token: admin.fcm_token,
            title: '⚠️ Erro Crítico do Sistema',
            body: errorMessage.slice(0, 100),
            data: {
              type: 'system_error',
              severity,
              context: JSON.stringify(context || {}),
            },
          });
        }
      }
    } catch (error) {
      logger.error('Error handling system.error notification', {
        module: 'notification-handler',
        eventId: event.id,
        error,
      });
    }
  }, { async: true });

  logger.info('Notification handlers registered', {
    module: 'notification-handler',
    events: [
      'solicitacao.created',
      'solicitacao.status_changed',
      'inventory.completed',
      'system.error',
    ],
  });
}
