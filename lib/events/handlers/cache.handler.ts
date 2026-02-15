/**
 * Cache Handlers - Sprint 6 Event-Driven Architecture
 *
 * Handlers para invalidação automática de cache baseada em eventos.
 */

import { eventBus } from '../event-bus';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { ProductsOptimizedService } from '@/lib/services/products-optimized.service';
import { DashboardViewsService } from '@/lib/services/dashboard-views.service';

/**
 * Registra handlers de cache
 */
export function registerCacheHandlers(): void {
  const redis = getRedisClient();

  // Invalidar cache de produtos quando produto é criado/atualizado/deletado
  eventBus.subscribe('product.created', async (event) => {
    try {
      const { ean } = event.payload;
      if (event.orgId) {
        await ProductsOptimizedService.invalidateCache(event.orgId, ean);
      }
      logger.debug('Product cache invalidated on create', {
        module: 'cache-handler',
        eventType: event.type,
        ean,
      });
    } catch (error) {
      logger.error('Error invalidating product cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  eventBus.subscribe('product.updated', async (event) => {
    try {
      const { ean } = event.payload;
      if (event.orgId) {
        await ProductsOptimizedService.invalidateCache(event.orgId, ean);
      }
      logger.debug('Product cache invalidated on update', {
        module: 'cache-handler',
        eventType: event.type,
        ean,
      });
    } catch (error) {
      logger.error('Error invalidating product cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  eventBus.subscribe('product.deleted', async (event) => {
    try {
      const { ean } = event.payload;
      if (event.orgId) {
        await ProductsOptimizedService.invalidateCache(event.orgId, ean);
      }
      logger.debug('Product cache invalidated on delete', {
        module: 'cache-handler',
        eventType: event.type,
        ean,
      });
    } catch (error) {
      logger.error('Error invalidating product cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Invalidar cache de dashboard quando solicitações mudam
  eventBus.subscribe('solicitacao.*', async (event) => {
    try {
      if (event.orgId) {
        await DashboardViewsService.invalidateCache(event.orgId);
      }
      logger.debug('Dashboard cache invalidated', {
        module: 'cache-handler',
        eventType: event.type,
        orgId: event.orgId,
      });
    } catch (error) {
      logger.error('Error invalidating dashboard cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Invalidar cache de usuário quando usuário é atualizado
  eventBus.subscribe('user.updated', async (event) => {
    try {
      const { userId } = event.payload;
      await redis.del(`user:${userId}`);
      await redis.del(`user:profile:${userId}`);

      logger.debug('User cache invalidated', {
        module: 'cache-handler',
        eventType: event.type,
        userId,
      });
    } catch (error) {
      logger.error('Error invalidating user cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Invalidar cache de loja quando loja é atualizada
  eventBus.subscribe('store.updated', async (event) => {
    try {
      const { storeId } = event.payload;
      await redis.del(`store:${storeId}`);

      // Também invalidar lista de lojas da organização
      if (event.orgId) {
        const keys = await redis.keys(`stores:list:${event.orgId}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.debug('Store cache invalidated', {
        module: 'cache-handler',
        eventType: event.type,
        storeId,
      });
    } catch (error) {
      logger.error('Error invalidating store cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Invalidar cache de inventário quando inventário muda
  eventBus.subscribe('inventory.*', async (event) => {
    try {
      if (event.orgId) {
        // Invalidar métricas de inventário
        await redis.del(`mv:inventory:${event.orgId}`);
      }

      logger.debug('Inventory cache invalidated', {
        module: 'cache-handler',
        eventType: event.type,
        orgId: event.orgId,
      });
    } catch (error) {
      logger.error('Error invalidating inventory cache', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Cache de sessão do usuário no login
  eventBus.subscribe('user.login', async (event) => {
    try {
      const { userId, email } = event.payload;

      // Cachear informações básicas da sessão
      await redis.set(
        `session:active:${userId}`,
        JSON.stringify({
          email,
          loginAt: event.timestamp,
          ipAddress: event.payload.ipAddress,
        }),
        { ex: 86400 } // 24 horas
      );

      // Incrementar contador de logins
      await redis.incr('metrics:logins:total');
      const today = new Date().toISOString().split('T')[0];
      await redis.incr(`metrics:logins:${today}`);

      logger.debug('User session cached', {
        module: 'cache-handler',
        eventType: event.type,
        userId,
      });
    } catch (error) {
      logger.error('Error caching user session', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  // Limpar cache de sessão no logout
  eventBus.subscribe('user.logout', async (event) => {
    try {
      const { userId } = event.payload;
      await redis.del(`session:active:${userId}`);

      logger.debug('User session cleared', {
        module: 'cache-handler',
        eventType: event.type,
        userId,
      });
    } catch (error) {
      logger.error('Error clearing user session', {
        module: 'cache-handler',
        eventType: event.type,
        error,
      });
    }
  }, { async: true });

  logger.info('Cache handlers registered', {
    module: 'cache-handler',
    events: [
      'product.*',
      'solicitacao.*',
      'user.updated',
      'user.login',
      'user.logout',
      'store.updated',
      'inventory.*',
    ],
  });
}
