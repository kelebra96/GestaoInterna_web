/**
 * CacheService - Serviço de cache distribuído
 *
 * Fornece uma interface de alto nível para cache usando Redis.
 * Suporta cache de objetos, invalidação por padrão, e fallback automático.
 *
 * Uso:
 *   // Cache simples
 *   await CacheService.set('user:123', userData, 300);
 *   const user = await CacheService.get<User>('user:123');
 *
 *   // Get or Set (lazy loading)
 *   const dashboard = await CacheService.getOrSet(
 *     'dashboard:org:456',
 *     () => buildDashboardData(),
 *     60
 *   );
 *
 *   // Invalidação
 *   await CacheService.invalidate('user:123');
 *   await CacheService.invalidatePattern('dashboard:*');
 */

import { redis, RedisClient } from '@/lib/redis';

// Prefixo para todas as chaves do cache
const CACHE_PREFIX = 'cache:';

// TTL padrão em segundos (5 minutos)
const DEFAULT_TTL = 300;

// Métricas de cache
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastReset: Date;
}

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  lastReset: new Date(),
};

/**
 * Serializa valor para armazenamento
 */
function serialize(value: unknown): string {
  return JSON.stringify({
    data: value,
    cachedAt: Date.now(),
  });
}

/**
 * Deserializa valor do cache
 */
function deserialize<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.data as T;
  } catch {
    return null;
  }
}

/**
 * Gera chave com prefixo
 */
function prefixKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export const CacheService = {
  /**
   * Obtém valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(prefixKey(key));
      const value = deserialize<T>(raw);

      if (value !== null) {
        metrics.hits++;
      } else {
        metrics.misses++;
      }

      return value;
    } catch (error) {
      metrics.errors++;
      console.error('[CacheService] Erro ao ler cache:', key, error);
      return null;
    }
  },

  /**
   * Define valor no cache
   */
  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<boolean> {
    try {
      const serialized = serialize(value);
      await redis.setex(prefixKey(key), ttlSeconds, serialized);
      return true;
    } catch (error) {
      metrics.errors++;
      console.error('[CacheService] Erro ao escrever cache:', key, error);
      return false;
    }
  },

  /**
   * Obtém valor do cache ou executa fetcher e armazena resultado
   * Padrão cache-aside com lazy loading
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<T> {
    // Tentar obter do cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - executar fetcher
    const value = await fetcher();

    // Armazenar no cache (não bloquear)
    this.set(key, value, ttlSeconds).catch((error) => {
      console.error('[CacheService] Erro ao salvar cache após fetch:', key, error);
    });

    return value;
  },

  /**
   * Invalida uma chave específica
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      await redis.del(prefixKey(key));
      return true;
    } catch (error) {
      metrics.errors++;
      console.error('[CacheService] Erro ao invalidar cache:', key, error);
      return false;
    }
  },

  /**
   * Invalida todas as chaves que correspondem ao padrão
   * Exemplo: invalidatePattern('dashboard:*') invalida todas as chaves que começam com 'dashboard:'
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(prefixKey(pattern));
      if (keys.length === 0) return 0;

      const deleted = await redis.del(...keys);
      return deleted;
    } catch (error) {
      metrics.errors++;
      console.error('[CacheService] Erro ao invalidar padrão:', pattern, error);
      return 0;
    }
  },

  /**
   * Verifica se chave existe no cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const count = await redis.exists(prefixKey(key));
      return count > 0;
    } catch (error) {
      metrics.errors++;
      return false;
    }
  },

  /**
   * Obtém TTL restante de uma chave em segundos
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(prefixKey(key));
    } catch (error) {
      metrics.errors++;
      return -2;
    }
  },

  /**
   * Cache de entidade por ID
   * Útil para cachear users, stores, products, etc.
   */
  async getEntity<T>(entityType: string, id: string): Promise<T | null> {
    return this.get<T>(`entity:${entityType}:${id}`);
  },

  async setEntity<T>(
    entityType: string,
    id: string,
    value: T,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<boolean> {
    return this.set(`entity:${entityType}:${id}`, value, ttlSeconds);
  },

  async getOrSetEntity<T>(
    entityType: string,
    id: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<T> {
    return this.getOrSet<T>(`entity:${entityType}:${id}`, fetcher, ttlSeconds);
  },

  async invalidateEntity(entityType: string, id: string): Promise<boolean> {
    return this.invalidate(`entity:${entityType}:${id}`);
  },

  async invalidateEntityType(entityType: string): Promise<number> {
    return this.invalidatePattern(`entity:${entityType}:*`);
  },

  /**
   * Cache de listagens com paginação
   */
  async getList<T>(listKey: string): Promise<T[] | null> {
    return this.get<T[]>(`list:${listKey}`);
  },

  async setList<T>(
    listKey: string,
    items: T[],
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<boolean> {
    return this.set(`list:${listKey}`, items, ttlSeconds);
  },

  async invalidateList(listKey: string): Promise<boolean> {
    return this.invalidate(`list:${listKey}`);
  },

  /**
   * Métricas do cache
   */
  getMetrics(): CacheMetrics & { hitRate: number } {
    const total = metrics.hits + metrics.misses;
    const hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;

    return {
      ...metrics,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  },

  resetMetrics(): void {
    metrics.hits = 0;
    metrics.misses = 0;
    metrics.errors = 0;
    metrics.lastReset = new Date();
  },

  /**
   * Warm up - pré-carrega dados no cache
   */
  async warmUp<T>(
    entries: Array<{ key: string; fetcher: () => Promise<T>; ttl?: number }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await Promise.all(
      entries.map(async ({ key, fetcher, ttl }) => {
        try {
          const value = await fetcher();
          await this.set(key, value, ttl);
          success++;
        } catch (error) {
          console.error('[CacheService] Warm up failed:', key, error);
          failed++;
        }
      })
    );

    return { success, failed };
  },

  /**
   * Verifica saúde do cache
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await redis.ping();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error.message,
      };
    }
  },
};

// Helper para cache de dashboard por organização
export const DashboardCache = {
  key: (orgId: string) => `dashboard:${orgId}`,

  async get(orgId: string) {
    return CacheService.get<any>(this.key(orgId));
  },

  async set(orgId: string, data: any, ttlSeconds: number = 60) {
    return CacheService.set(this.key(orgId), data, ttlSeconds);
  },

  async getOrSet(orgId: string, fetcher: () => Promise<any>, ttlSeconds: number = 60) {
    return CacheService.getOrSet(this.key(orgId), fetcher, ttlSeconds);
  },

  async invalidate(orgId: string) {
    return CacheService.invalidate(this.key(orgId));
  },

  async invalidateAll() {
    return CacheService.invalidatePattern('dashboard:*');
  },
};

// Helper para cache de entidades comuns
export const UserCache = {
  async get(userId: string) {
    return CacheService.getEntity<any>('user', userId);
  },

  async set(userId: string, user: any, ttlSeconds: number = 300) {
    return CacheService.setEntity('user', userId, user, ttlSeconds);
  },

  async getOrSet(userId: string, fetcher: () => Promise<any>, ttlSeconds: number = 300) {
    return CacheService.getOrSetEntity('user', userId, fetcher, ttlSeconds);
  },

  async invalidate(userId: string) {
    return CacheService.invalidateEntity('user', userId);
  },
};

export const StoreCache = {
  async get(storeId: string) {
    return CacheService.getEntity<any>('store', storeId);
  },

  async set(storeId: string, store: any, ttlSeconds: number = 300) {
    return CacheService.setEntity('store', storeId, store, ttlSeconds);
  },

  async getOrSet(storeId: string, fetcher: () => Promise<any>, ttlSeconds: number = 300) {
    return CacheService.getOrSetEntity('store', storeId, fetcher, ttlSeconds);
  },

  async invalidate(storeId: string) {
    return CacheService.invalidateEntity('store', storeId);
  },
};

export const ProductCache = {
  async get(productId: string) {
    return CacheService.getEntity<any>('product', productId);
  },

  async set(productId: string, product: any, ttlSeconds: number = 300) {
    return CacheService.setEntity('product', productId, product, ttlSeconds);
  },

  async getOrSet(productId: string, fetcher: () => Promise<any>, ttlSeconds: number = 300) {
    return CacheService.getOrSetEntity('product', productId, fetcher, ttlSeconds);
  },

  async invalidate(productId: string) {
    return CacheService.invalidateEntity('product', productId);
  },

  async invalidateAll() {
    return CacheService.invalidatePattern('entity:product:*');
  },
};

export default CacheService;
