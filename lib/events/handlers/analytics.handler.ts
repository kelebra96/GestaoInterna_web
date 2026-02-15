/**
 * Analytics Handlers - Sprint 6 Event-Driven Architecture
 *
 * Handlers para tracking de métricas de negócio baseadas em eventos.
 */

import { eventBus } from '../event-bus';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { MetricsService } from '@/lib/services/metrics.service';

/**
 * Registra handlers de analytics
 */
export function registerAnalyticsHandlers(): void {
  const redis = getRedisClient();

  // Track criação de solicitações
  eventBus.subscribe('solicitacao.created', async (event) => {
    try {
      const { storeId, itemCount, totalValue } = event.payload;
      const today = new Date().toISOString().split('T')[0];

      // Incrementar contadores
      await redis.incr('analytics:solicitacoes:total');
      await redis.incr(`analytics:solicitacoes:daily:${today}`);

      if (storeId) {
        await redis.incr(`analytics:solicitacoes:store:${storeId}`);
      }

      if (event.orgId) {
        await redis.incr(`analytics:solicitacoes:org:${event.orgId}`);
      }

      // Track itens
      if (itemCount) {
        await redis.incrBy(`analytics:itens:total`, itemCount);
        await redis.incrBy(`analytics:itens:daily:${today}`, itemCount);
      }

      // Track valor (se disponível)
      if (totalValue && totalValue > 0) {
        // Usar hash para valores decimais
        const currentValue = await redis.hget('analytics:valor', 'total');
        const newValue = (parseFloat(currentValue || '0') + totalValue).toFixed(2);
        await redis.hset('analytics:valor', 'total', newValue);

        const dailyValue = await redis.hget('analytics:valor', `daily:${today}`);
        const newDailyValue = (parseFloat(dailyValue || '0') + totalValue).toFixed(2);
        await redis.hset('analytics:valor', `daily:${today}`, newDailyValue);
      }

      // Registrar métrica
      await MetricsService.incrementCounter('solicitacoes.created', {
        store: storeId,
        org: event.orgId || '',
      });

      logger.debug('Solicitacao analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        storeId,
        itemCount,
      });
    } catch (error) {
      logger.error('Error tracking solicitacao analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Track mudanças de status
  eventBus.subscribe('solicitacao.status_changed', async (event) => {
    try {
      const { fromStatus, toStatus } = event.payload;
      const today = new Date().toISOString().split('T')[0];

      // Incrementar contador do novo status
      await redis.incr(`analytics:status:${toStatus}:total`);
      await redis.incr(`analytics:status:${toStatus}:daily:${today}`);

      // Track transições
      await redis.incr(`analytics:transitions:${fromStatus}_to_${toStatus}`);

      // Métricas de aprovação/rejeição
      if (toStatus === 'approved' || toStatus === 'completed') {
        await redis.incr('analytics:solicitacoes:approved');
      } else if (toStatus === 'rejected') {
        await redis.incr('analytics:solicitacoes:rejected');
      }

      await MetricsService.incrementCounter(`solicitacoes.status.${toStatus}`, {
        from: fromStatus,
      });

      logger.debug('Status change analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        fromStatus,
        toStatus,
      });
    } catch (error) {
      logger.error('Error tracking status change analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Track inventários
  eventBus.subscribe('inventory.completed', async (event) => {
    try {
      const { storeId, itemCount, discrepancyCount } = event.payload;
      const today = new Date().toISOString().split('T')[0];

      await redis.incr('analytics:inventories:completed');
      await redis.incr(`analytics:inventories:daily:${today}`);

      if (storeId) {
        await redis.incr(`analytics:inventories:store:${storeId}`);
      }

      // Track discrepâncias
      if (discrepancyCount > 0) {
        await redis.incrBy('analytics:discrepancies:total', discrepancyCount);
        await redis.incr('analytics:inventories:with_discrepancies');
      } else {
        await redis.incr('analytics:inventories:without_discrepancies');
      }

      // Calcular taxa de acurácia
      const totalItems = itemCount || 0;
      const discrepancies = discrepancyCount || 0;
      const accuracy = totalItems > 0
        ? ((totalItems - discrepancies) / totalItems * 100).toFixed(2)
        : '100.00';

      await redis.hset('analytics:accuracy', storeId || 'global', accuracy);

      await MetricsService.incrementCounter('inventories.completed', {
        store: storeId,
        hasDiscrepancies: String(discrepancyCount > 0),
      });

      logger.debug('Inventory analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        storeId,
        itemCount,
        discrepancyCount,
      });
    } catch (error) {
      logger.error('Error tracking inventory analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Track logins
  eventBus.subscribe('user.login', async (event) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      await redis.incr('analytics:logins:total');
      await redis.incr(`analytics:logins:daily:${today}`);
      await redis.incr(`analytics:logins:hourly:${hour}`);

      // Track usuários únicos por dia
      await redis.sadd(`analytics:users:active:${today}`, event.payload.userId);

      // Track por organização
      if (event.orgId) {
        await redis.incr(`analytics:logins:org:${event.orgId}`);
        await redis.sadd(`analytics:users:active:${event.orgId}:${today}`, event.payload.userId);
      }

      await MetricsService.incrementCounter('users.login', {
        org: event.orgId || '',
      });

      logger.debug('Login analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        userId: event.payload.userId,
      });
    } catch (error) {
      logger.error('Error tracking login analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Track mudanças de preço
  eventBus.subscribe('product.price_changed', async (event) => {
    try {
      const { productId, ean, oldPrice, newPrice, percentChange } = event.payload;
      const today = new Date().toISOString().split('T')[0];

      await redis.incr('analytics:price_changes:total');
      await redis.incr(`analytics:price_changes:daily:${today}`);

      // Track direção da mudança
      if (percentChange > 0) {
        await redis.incr('analytics:price_changes:increases');
      } else {
        await redis.incr('analytics:price_changes:decreases');
      }

      // Track mudanças significativas (>10%)
      if (Math.abs(percentChange) > 10) {
        await redis.incr('analytics:price_changes:significant');

        // Adicionar ao sorted set para alertas
        await redis.zadd(
          'analytics:price_alerts',
          Math.abs(percentChange),
          `${productId}:${Date.now()}`
        );
      }

      await MetricsService.incrementCounter('products.price_changed', {
        direction: percentChange > 0 ? 'increase' : 'decrease',
        significant: String(Math.abs(percentChange) > 10),
      });

      logger.debug('Price change analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        productId,
        ean,
        percentChange,
      });
    } catch (error) {
      logger.error('Error tracking price change analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Track erros do sistema
  eventBus.subscribe('system.error', async (event) => {
    try {
      const { severity } = event.payload;
      const today = new Date().toISOString().split('T')[0];

      await redis.incr('analytics:errors:total');
      await redis.incr(`analytics:errors:${severity}`);
      await redis.incr(`analytics:errors:daily:${today}`);

      await MetricsService.incrementCounter('system.errors', {
        severity,
      });

      logger.debug('System error analytics tracked', {
        module: 'analytics-handler',
        eventType: event.type,
        severity,
      });
    } catch (error) {
      logger.error('Error tracking system error analytics', {
        module: 'analytics-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  logger.info('Analytics handlers registered', {
    module: 'analytics-handler',
    events: [
      'solicitacao.created',
      'solicitacao.status_changed',
      'inventory.completed',
      'user.login',
      'product.price_changed',
      'system.error',
    ],
  });
}

/**
 * Obtém analytics resumidas
 */
export async function getAnalyticsSummary(): Promise<{
  solicitacoes: { total: number; today: number; approved: number; rejected: number };
  inventories: { total: number; withDiscrepancies: number; withoutDiscrepancies: number };
  users: { loginsTotal: number; loginsToday: number; activeToday: number };
  errors: { total: number; critical: number; high: number };
}> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    solicitacoesTotal,
    solicitacoesToday,
    solicitacoesApproved,
    solicitacoesRejected,
    inventoriesTotal,
    inventoriesWithDisc,
    inventoriesWithoutDisc,
    loginsTotal,
    loginsToday,
    activeTodayCount,
    errorsTotal,
    errorsCritical,
    errorsHigh,
  ] = await Promise.all([
    redis.get('analytics:solicitacoes:total'),
    redis.get(`analytics:solicitacoes:daily:${today}`),
    redis.get('analytics:solicitacoes:approved'),
    redis.get('analytics:solicitacoes:rejected'),
    redis.get('analytics:inventories:completed'),
    redis.get('analytics:inventories:with_discrepancies'),
    redis.get('analytics:inventories:without_discrepancies'),
    redis.get('analytics:logins:total'),
    redis.get(`analytics:logins:daily:${today}`),
    redis.smembers(`analytics:users:active:${today}`),
    redis.get('analytics:errors:total'),
    redis.get('analytics:errors:critical'),
    redis.get('analytics:errors:high'),
  ]);

  return {
    solicitacoes: {
      total: parseInt(solicitacoesTotal || '0'),
      today: parseInt(solicitacoesToday || '0'),
      approved: parseInt(solicitacoesApproved || '0'),
      rejected: parseInt(solicitacoesRejected || '0'),
    },
    inventories: {
      total: parseInt(inventoriesTotal || '0'),
      withDiscrepancies: parseInt(inventoriesWithDisc || '0'),
      withoutDiscrepancies: parseInt(inventoriesWithoutDisc || '0'),
    },
    users: {
      loginsTotal: parseInt(loginsTotal || '0'),
      loginsToday: parseInt(loginsToday || '0'),
      activeToday: activeTodayCount.length,
    },
    errors: {
      total: parseInt(errorsTotal || '0'),
      critical: parseInt(errorsCritical || '0'),
      high: parseInt(errorsHigh || '0'),
    },
  };
}
