/**
 * Pagination Helpers - Sprint 5 Otimização
 *
 * Implementa paginação cursor-based (keyset pagination) que é mais
 * eficiente que offset-based para grandes conjuntos de dados.
 *
 * Benefícios:
 * - Performance consistente independente da página
 * - Não pula/duplica itens quando dados mudam
 * - Funciona bem com dados em tempo real
 *
 * Uso:
 *   const { data, pagination } = await paginatedQuery(
 *     supabaseAdmin.from('products'),
 *     { limit: 20, cursor: 'abc123' }
 *   );
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Tipos
export interface PaginationParams {
  /** Número de itens por página */
  limit?: number;
  /** Cursor para próxima página (ID do último item) */
  cursor?: string;
  /** Direção: 'next' ou 'prev' */
  direction?: 'next' | 'prev';
  /** Campo para ordenação */
  orderBy?: string;
  /** Direção da ordenação */
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  /** Dados da página atual */
  data: T[];
  /** Informações de paginação */
  pagination: {
    /** Cursor para próxima página */
    nextCursor: string | null;
    /** Cursor para página anterior */
    prevCursor: string | null;
    /** Se há mais páginas */
    hasMore: boolean;
    /** Total de itens (se disponível) */
    total?: number;
    /** Número de itens retornados */
    count: number;
  };
}

export interface OffsetPaginationParams {
  /** Página atual (1-indexed) */
  page?: number;
  /** Itens por página */
  limit?: number;
  /** Campo para ordenação */
  orderBy?: string;
  /** Direção da ordenação */
  orderDirection?: 'asc' | 'desc';
}

export interface OffsetPaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parâmetros padrão de paginação
 */
export const DEFAULT_PAGINATION: Required<PaginationParams> = {
  limit: 20,
  cursor: '',
  direction: 'next',
  orderBy: 'id',
  orderDirection: 'desc',
};

/**
 * Extrai parâmetros de paginação de uma URL
 */
export function parsePaginationParams(url: URL): PaginationParams {
  return {
    limit: parseInt(url.searchParams.get('limit') || '20', 10),
    cursor: url.searchParams.get('cursor') || undefined,
    direction: (url.searchParams.get('direction') as 'next' | 'prev') || 'next',
    orderBy: url.searchParams.get('orderBy') || 'id',
    orderDirection: (url.searchParams.get('order') as 'asc' | 'desc') || 'desc',
  };
}

/**
 * Executa query paginada com cursor (keyset pagination)
 *
 * @param query Query builder do Supabase
 * @param params Parâmetros de paginação
 * @param idField Campo usado como cursor (default: 'id')
 */
export async function cursorPaginate<T extends { id: string }>(
  query: any, // Supabase query builder
  params: PaginationParams = {},
  idField: keyof T = 'id' as keyof T
): Promise<PaginationResult<T>> {
  const {
    limit = DEFAULT_PAGINATION.limit,
    cursor,
    direction = DEFAULT_PAGINATION.direction,
    orderBy = String(idField),
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params;

  // Buscar um item a mais para detectar se há próxima página
  const fetchLimit = limit + 1;

  // Construir query
  let paginatedQuery = query;

  // Aplicar cursor
  if (cursor) {
    if (direction === 'next') {
      // Próxima página: itens após o cursor
      if (orderDirection === 'desc') {
        paginatedQuery = paginatedQuery.lt(orderBy, cursor);
      } else {
        paginatedQuery = paginatedQuery.gt(orderBy, cursor);
      }
    } else {
      // Página anterior: itens antes do cursor
      if (orderDirection === 'desc') {
        paginatedQuery = paginatedQuery.gt(orderBy, cursor);
      } else {
        paginatedQuery = paginatedQuery.lt(orderBy, cursor);
      }
    }
  }

  // Aplicar ordenação e limite
  paginatedQuery = paginatedQuery
    .order(orderBy, { ascending: orderDirection === 'asc' })
    .limit(fetchLimit);

  const { data, error } = await paginatedQuery;

  if (error) {
    throw error;
  }

  const items = (data || []) as T[];

  // Verificar se há mais itens
  const hasMore = items.length > limit;

  // Remover item extra usado para detectar hasMore
  const pageData = hasMore ? items.slice(0, limit) : items;

  // Calcular cursors
  const firstItem = pageData[0];
  const lastItem = pageData[pageData.length - 1];

  return {
    data: pageData,
    pagination: {
      nextCursor: hasMore && lastItem ? String(lastItem[idField]) : null,
      prevCursor: cursor && firstItem ? String(firstItem[idField]) : null,
      hasMore,
      count: pageData.length,
    },
  };
}

/**
 * Paginação offset-based tradicional (para casos onde cursor não é viável)
 *
 * AVISO: Evite usar em tabelas grandes (>100k rows)
 */
export async function offsetPaginate<T>(
  query: any,
  params: OffsetPaginationParams = {}
): Promise<OffsetPaginationResult<T>> {
  const {
    page = 1,
    limit = 20,
    orderBy = 'id',
    orderDirection = 'desc',
  } = params;

  const offset = (page - 1) * limit;

  // Query com count
  const { data, error, count } = await query
    .order(orderBy, { ascending: orderDirection === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Cria links de paginação para API response
 */
export function createPaginationLinks(
  baseUrl: string,
  pagination: PaginationResult<any>['pagination']
): {
  self: string;
  next: string | null;
  prev: string | null;
} {
  const url = new URL(baseUrl);

  return {
    self: url.toString(),
    next: pagination.nextCursor
      ? `${url.origin}${url.pathname}?cursor=${pagination.nextCursor}&direction=next`
      : null,
    prev: pagination.prevCursor
      ? `${url.origin}${url.pathname}?cursor=${pagination.prevCursor}&direction=prev`
      : null,
  };
}

/**
 * Helper para criar resposta paginada
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationResult<any>['pagination'],
  request?: Request
): {
  data: T[];
  pagination: PaginationResult<any>['pagination'];
  links?: ReturnType<typeof createPaginationLinks>;
} {
  const response: any = { data, pagination };

  if (request) {
    response.links = createPaginationLinks(request.url, pagination);
  }

  return response;
}

/**
 * Infinite scroll helper - retorna formato adequado para React Query/SWR
 */
export function infiniteScrollFormat<T>(
  result: PaginationResult<T>
): {
  items: T[];
  nextCursor: string | null;
} {
  return {
    items: result.data,
    nextCursor: result.pagination.nextCursor,
  };
}

export default {
  cursorPaginate,
  offsetPaginate,
  parsePaginationParams,
  createPaginationLinks,
  paginatedResponse,
  infiniteScrollFormat,
};
