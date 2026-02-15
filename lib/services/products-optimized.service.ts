/**
 * Products Optimized Service - Sprint 5 Otimização
 *
 * Queries otimizadas para listagem e busca de produtos.
 * Utiliza:
 * - Índices criados na migration 029
 * - Paginação cursor-based para performance consistente
 * - Cache Redis para buscas frequentes
 * - Full-text search com pg_trgm
 *
 * Uso:
 *   import { ProductsOptimizedService } from '@/lib/services/products-optimized.service';
 *
 *   const { data, pagination } = await ProductsOptimizedService.list(orgId, {
 *     search: 'coca',
 *     limit: 20,
 *     cursor: 'abc123'
 *   });
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getRedisClient } from '@/lib/redis';
import { cursorPaginate, PaginationResult } from '@/lib/helpers/pagination';
import { logger } from '@/lib/logger';

const redis = getRedisClient();

// Cache TTL
const CACHE_TTL_SEARCH = 60; // 1 minuto para buscas
const CACHE_TTL_EAN = 300; // 5 minutos para lookup por EAN

export interface ProductListParams {
  /** Termo de busca (nome) */
  search?: string;
  /** Filtrar por EAN */
  ean?: string;
  /** Filtrar por categoria */
  category?: string;
  /** Filtrar por comprador */
  buyer?: string;
  /** Apenas produtos ativos */
  activeOnly?: boolean;
  /** Itens por página */
  limit?: number;
  /** Cursor para paginação */
  cursor?: string;
  /** Direção da paginação */
  direction?: 'next' | 'prev';
  /** Campo para ordenação */
  orderBy?: 'nome' | 'created_at' | 'updated_at' | 'ean';
  /** Direção da ordenação */
  orderDirection?: 'asc' | 'desc';
}

export interface ProductBasic {
  id: string;
  nome: string;
  ean?: string;
  unidade?: string;
  category?: string;
  comprador?: string;
  active?: boolean;
  org_id?: string;
  created_at?: string;
}

export interface ProductWithDetails extends ProductBasic {
  preco_atual?: number;
  estoque_minimo?: number;
  fornecedor?: string;
  marca?: string;
  descricao?: string;
  imagem_url?: string;
  updated_at?: string;
}

export class ProductsOptimizedService {
  /**
   * Lista produtos com paginação cursor-based
   */
  static async list(
    orgId: string,
    params: ProductListParams = {}
  ): Promise<PaginationResult<ProductBasic>> {
    const {
      search,
      ean,
      category,
      buyer,
      activeOnly = true,
      limit = 20,
      cursor,
      direction = 'next',
      orderBy = 'nome',
      orderDirection = 'asc',
    } = params;

    // Gerar cache key baseada nos parâmetros
    const cacheKey = `products:list:${orgId}:${JSON.stringify(params)}`;

    try {
      // Verificar cache para buscas idênticas
      if (search || ean) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Construir query base
      let query = supabaseAdmin
        .from('products')
        .select('id, nome, ean, unidade, category, comprador, active, org_id, created_at');

      // Filtro por organização
      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      // Filtro de produtos ativos (usa índice idx_products_active)
      if (activeOnly) {
        query = query.or('active.eq.true,active.is.null');
      }

      // Busca por nome (usa índice idx_products_nome_trgm para busca parcial)
      if (search) {
        // ILIKE com % usa o índice trigram quando disponível
        query = query.ilike('nome', `%${search}%`);
      }

      // Busca por EAN (usa índice idx_products_ean)
      if (ean) {
        query = query.eq('ean', ean);
      }

      // Filtros adicionais
      if (category) {
        query = query.eq('category', category);
      }

      if (buyer) {
        query = query.eq('comprador', buyer);
      }

      // Usar paginação cursor-based
      const result = await cursorPaginate<ProductBasic>(
        query,
        { limit, cursor, direction, orderBy, orderDirection },
        'id'
      );

      // Cachear resultado de busca
      if (search || ean) {
        await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEARCH });
      }

      return result;
    } catch (error) {
      logger.error('Failed to list products', {
        module: 'products-optimized',
        operation: 'list',
        orgId,
        params,
        error,
      });
      throw error;
    }
  }

  /**
   * Busca produto por EAN (lookup otimizado)
   */
  static async getByEan(
    ean: string,
    orgId?: string
  ): Promise<ProductWithDetails | null> {
    const cacheKey = `product:ean:${orgId || 'global'}:${ean}`;

    try {
      // Verificar cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query usando índice idx_products_ean
      let query = supabaseAdmin
        .from('products')
        .select('*')
        .eq('ean', ean);

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query.limit(1).single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Cachear resultado
      if (data) {
        await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL_EAN });
      }

      return data;
    } catch (error) {
      logger.error('Failed to get product by EAN', {
        module: 'products-optimized',
        operation: 'getByEan',
        ean,
        orgId,
        error,
      });
      throw error;
    }
  }

  /**
   * Busca múltiplos produtos por EAN (batch lookup)
   */
  static async getByEans(
    eans: string[],
    orgId?: string
  ): Promise<Map<string, ProductWithDetails>> {
    if (eans.length === 0) {
      return new Map();
    }

    const uniqueEans = [...new Set(eans)];
    const result = new Map<string, ProductWithDetails>();
    const uncachedEans: string[] = [];

    try {
      // Verificar cache para cada EAN
      for (const ean of uniqueEans) {
        const cacheKey = `product:ean:${orgId || 'global'}:${ean}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          result.set(ean, JSON.parse(cached));
        } else {
          uncachedEans.push(ean);
        }
      }

      // Buscar EANs não cacheados em batch
      if (uncachedEans.length > 0) {
        let query = supabaseAdmin
          .from('products')
          .select('*')
          .in('ean', uncachedEans);

        if (orgId) {
          query = query.eq('org_id', orgId);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        // Cachear e adicionar ao resultado
        if (data) {
          for (const product of data) {
            if (product.ean) {
              result.set(product.ean, product);
              const cacheKey = `product:ean:${orgId || 'global'}:${product.ean}`;
              await redis.set(cacheKey, JSON.stringify(product), { ex: CACHE_TTL_EAN });
            }
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get products by EANs', {
        module: 'products-optimized',
        operation: 'getByEans',
        eanCount: eans.length,
        orgId,
        error,
      });
      throw error;
    }
  }

  /**
   * Busca textual otimizada (autocomplete)
   */
  static async search(
    orgId: string,
    term: string,
    limit: number = 10
  ): Promise<Array<{ id: string; nome: string; ean?: string }>> {
    if (!term || term.length < 2) {
      return [];
    }

    const cacheKey = `products:search:${orgId}:${term.toLowerCase()}:${limit}`;

    try {
      // Verificar cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Busca usando índice trigram (busca parcial eficiente)
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, nome, ean')
        .eq('org_id', orgId)
        .or('active.eq.true,active.is.null')
        .ilike('nome', `%${term}%`)
        .order('nome')
        .limit(limit);

      if (error) {
        throw error;
      }

      const result = data || [];

      // Cachear resultado
      await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEARCH });

      return result;
    } catch (error) {
      logger.error('Failed to search products', {
        module: 'products-optimized',
        operation: 'search',
        orgId,
        term,
        error,
      });
      throw error;
    }
  }

  /**
   * Conta produtos por categoria
   */
  static async countByCategory(orgId: string): Promise<Array<{ category: string; count: number }>> {
    const cacheKey = `products:categories:${orgId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabaseAdmin
        .from('products')
        .select('category')
        .eq('org_id', orgId)
        .or('active.eq.true,active.is.null')
        .not('category', 'is', null);

      if (error) {
        throw error;
      }

      // Agrupar em memória (mais eficiente que group by no Supabase)
      const counts: Record<string, number> = {};
      for (const item of data || []) {
        const cat = item.category || 'Sem categoria';
        counts[cat] = (counts[cat] || 0) + 1;
      }

      const result = Object.entries(counts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEARCH });

      return result;
    } catch (error) {
      logger.error('Failed to count products by category', {
        module: 'products-optimized',
        operation: 'countByCategory',
        orgId,
        error,
      });
      throw error;
    }
  }

  /**
   * Invalida cache de produtos
   */
  static async invalidateCache(orgId: string, ean?: string): Promise<void> {
    const patterns = [
      `products:list:${orgId}:*`,
      `products:search:${orgId}:*`,
      `products:categories:${orgId}`,
    ];

    if (ean) {
      patterns.push(`product:ean:${orgId}:${ean}`);
      patterns.push(`product:ean:global:${ean}`);
    }

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    logger.debug('Product cache invalidated', {
      module: 'products-optimized',
      operation: 'invalidateCache',
      orgId,
      ean,
    });
  }
}

export default ProductsOptimizedService;
