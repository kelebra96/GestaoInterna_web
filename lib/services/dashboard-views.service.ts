/**
 * Dashboard Views Service - Sprint 5 Otimização
 *
 * Serviço para queries otimizadas do dashboard usando views materializadas.
 * As views são atualizadas periodicamente pelo PostgreSQL, garantindo
 * leituras rápidas mesmo com grande volume de dados.
 *
 * Uso:
 *   import { DashboardViewsService } from '@/lib/services/dashboard-views.service';
 *
 *   const summary = await DashboardViewsService.getStatusSummary(orgId);
 *   const storeMetrics = await DashboardViewsService.getStoreMetrics(orgId);
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

// TTL do cache em segundos (views já são cache, então TTL curto)
const CACHE_TTL = 60; // 1 minuto

export interface StatusSummary {
  org_id: string;
  status: string;
  total_count: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_created: string | null;
}

export interface StoreMetrics {
  store_id: string;
  store_name: string;
  org_id: string;
  total_solicitacoes: number;
  completed: number;
  pending: number;
  rejected: number;
  total_value_completed: number;
  avg_completion_hours: number;
  last_solicitacao: string | null;
}

export interface TopProduct {
  org_id: string;
  ean: string;
  nome: string;
  unidade: string;
  num_solicitacoes: number;
  total_quantity: number;
  total_value: number;
  last_requested: string | null;
}

export interface InventoryMetrics {
  store_id: string;
  store_name: string;
  org_id: string;
  total_inventories: number;
  completed: number;
  in_progress: number;
  last_30d: number;
  total_items_counted: number;
  last_inventory: string | null;
}

export interface ComplianceSummary {
  store_id: string;
  store_name: string;
  org_id: string;
  total_tasks: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_rate: number;
  tasks_last_7d: number;
}

export interface OrgDashboard {
  org_id: string;
  org_name: string;
  total_stores: number;
  total_users: number;
  total_solicitacoes: number;
  pending_solicitacoes: number;
  total_products: number;
  total_inventories: number;
  refreshed_at: string;
}

export class DashboardViewsService {
  private static redis = getRedisClient();

  /**
   * Obtém resumo de status das solicitações (from materialized view)
   */
  static async getStatusSummary(orgId: string): Promise<StatusSummary[]> {
    const cacheKey = `mv:status:${orgId}`;

    try {
      // Tentar cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query na view materializada
      const { data, error } = await supabaseAdmin
        .from('mv_dashboard_status_summary')
        .select('*')
        .eq('org_id', orgId);

      if (error) {
        logger.error('Error fetching status summary from MV', {
          module: 'dashboard-views',
          operation: 'getStatusSummary',
          error,
        });
        throw error;
      }

      const result = data || [];

      // Cachear resultado
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Failed to get status summary', {
        module: 'dashboard-views',
        operation: 'getStatusSummary',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém métricas por loja (from materialized view)
   */
  static async getStoreMetrics(
    orgId: string,
    options?: { limit?: number; orderBy?: string }
  ): Promise<StoreMetrics[]> {
    const cacheKey = `mv:stores:${orgId}:${JSON.stringify(options || {})}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      let query = supabaseAdmin
        .from('mv_store_metrics')
        .select('*')
        .eq('org_id', orgId);

      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: false });
      } else {
        query = query.order('total_solicitacoes', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const result = data || [];
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Failed to get store metrics', {
        module: 'dashboard-views',
        operation: 'getStoreMetrics',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém produtos mais solicitados (from materialized view)
   */
  static async getTopProducts(
    orgId: string,
    limit: number = 10
  ): Promise<TopProduct[]> {
    const cacheKey = `mv:products:${orgId}:${limit}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabaseAdmin
        .from('mv_top_products')
        .select('*')
        .eq('org_id', orgId)
        .order('num_solicitacoes', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      const result = data || [];
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Failed to get top products', {
        module: 'dashboard-views',
        operation: 'getTopProducts',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém métricas de inventário (from materialized view)
   */
  static async getInventoryMetrics(orgId: string): Promise<InventoryMetrics[]> {
    const cacheKey = `mv:inventory:${orgId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabaseAdmin
        .from('mv_inventory_metrics')
        .select('*')
        .eq('org_id', orgId)
        .order('last_inventory', { ascending: false });

      if (error) {
        throw error;
      }

      const result = data || [];
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Failed to get inventory metrics', {
        module: 'dashboard-views',
        operation: 'getInventoryMetrics',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém resumo de compliance (from materialized view)
   */
  static async getComplianceSummary(orgId: string): Promise<ComplianceSummary[]> {
    const cacheKey = `mv:compliance:${orgId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabaseAdmin
        .from('mv_compliance_summary')
        .select('*')
        .eq('org_id', orgId)
        .order('completion_rate', { ascending: true });

      if (error) {
        throw error;
      }

      const result = data || [];
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Failed to get compliance summary', {
        module: 'dashboard-views',
        operation: 'getComplianceSummary',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém KPIs agregados da organização (from materialized view)
   */
  static async getOrgDashboard(orgId: string): Promise<OrgDashboard | null> {
    const cacheKey = `mv:org:${orgId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabaseAdmin
        .from('mv_org_dashboard')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        await this.redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL });
      }

      return data;
    } catch (error) {
      logger.error('Failed to get org dashboard', {
        module: 'dashboard-views',
        operation: 'getOrgDashboard',
        error,
      });
      throw error;
    }
  }

  /**
   * Obtém dashboard completo (todas as métricas das views)
   * Executa todas as queries em paralelo para máxima performance
   */
  static async getFullDashboard(orgId: string): Promise<{
    overview: OrgDashboard | null;
    statusSummary: StatusSummary[];
    storeMetrics: StoreMetrics[];
    topProducts: TopProduct[];
    inventoryMetrics: InventoryMetrics[];
    complianceSummary: ComplianceSummary[];
  }> {
    const startTime = Date.now();

    // Executar queries em paralelo
    const [
      overview,
      statusSummary,
      storeMetrics,
      topProducts,
      inventoryMetrics,
      complianceSummary,
    ] = await Promise.all([
      this.getOrgDashboard(orgId),
      this.getStatusSummary(orgId),
      this.getStoreMetrics(orgId, { limit: 10 }),
      this.getTopProducts(orgId, 10),
      this.getInventoryMetrics(orgId),
      this.getComplianceSummary(orgId),
    ]);

    const duration = Date.now() - startTime;
    logger.debug('Full dashboard loaded from MVs', {
      module: 'dashboard-views',
      operation: 'getFullDashboard',
      orgId,
      durationMs: duration,
    });

    return {
      overview,
      statusSummary,
      storeMetrics,
      topProducts,
      inventoryMetrics,
      complianceSummary,
    };
  }

  /**
   * Força refresh das views materializadas
   * (Apenas para admins - geralmente feito via cron)
   */
  static async refreshViews(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin.rpc('refresh_dashboard_views');

      if (error) {
        throw error;
      }

      // Limpar cache após refresh
      const patterns = [
        'mv:status:*',
        'mv:stores:*',
        'mv:products:*',
        'mv:inventory:*',
        'mv:compliance:*',
        'mv:org:*',
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      logger.info('Dashboard materialized views refreshed', {
        module: 'dashboard-views',
        operation: 'refreshViews',
      });

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to refresh views', {
        module: 'dashboard-views',
        operation: 'refreshViews',
        error,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Invalida cache do dashboard para uma organização
   */
  static async invalidateCache(orgId: string): Promise<void> {
    const patterns = [
      `mv:status:${orgId}`,
      `mv:stores:${orgId}:*`,
      `mv:products:${orgId}:*`,
      `mv:inventory:${orgId}`,
      `mv:compliance:${orgId}`,
      `mv:org:${orgId}`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }

    logger.debug('Dashboard MV cache invalidated', {
      module: 'dashboard-views',
      operation: 'invalidateCache',
      orgId,
    });
  }

  /**
   * Verifica se as views materializadas estão disponíveis
   */
  static async checkViewsHealth(): Promise<{
    available: boolean;
    views: Record<string, boolean>;
    error?: string;
  }> {
    const viewNames = [
      'mv_dashboard_status_summary',
      'mv_store_metrics',
      'mv_top_products',
      'mv_inventory_metrics',
      'mv_compliance_summary',
      'mv_org_dashboard',
    ];

    const views: Record<string, boolean> = {};

    try {
      for (const viewName of viewNames) {
        const { error } = await supabaseAdmin
          .from(viewName)
          .select('*')
          .limit(1);

        views[viewName] = !error;
      }

      const allAvailable = Object.values(views).every(Boolean);

      return { available: allAvailable, views };
    } catch (error: any) {
      logger.error('Failed to check views health', {
        module: 'dashboard-views',
        operation: 'checkViewsHealth',
        error,
      });
      return {
        available: false,
        views,
        error: error.message,
      };
    }
  }
}

export default DashboardViewsService;
