/**
 * Products Optimized API - Sprint 5 Otimização
 *
 * Endpoint otimizado para listagem e busca de produtos.
 * Utiliza índices, cache Redis e paginação cursor-based.
 *
 * GET /api/products/optimized?org_id=xxx&search=coca&limit=20&cursor=abc
 * GET /api/products/optimized/search?org_id=xxx&term=coca (autocomplete)
 * GET /api/products/optimized/ean/:ean (lookup por EAN)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductsOptimizedService } from '@/lib/services/products-optimized.service';
import { withMetrics } from '@/lib/helpers/with-metrics';
import { parsePaginationParams } from '@/lib/helpers/pagination';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export const GET = withMetrics('/api/products/optimized', async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    // Autenticação
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const orgId = url.searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Determinar tipo de operação
    const operation = url.searchParams.get('operation') || 'list';

    let data;

    switch (operation) {
      case 'search':
        // Autocomplete/busca rápida
        const term = url.searchParams.get('term') || '';
        const searchLimit = parseInt(url.searchParams.get('limit') || '10', 10);
        data = await ProductsOptimizedService.search(orgId, term, searchLimit);
        break;

      case 'ean':
        // Lookup por EAN
        const ean = url.searchParams.get('ean');
        if (!ean) {
          return NextResponse.json(
            { error: 'ean is required for operation=ean' },
            { status: 400 }
          );
        }
        data = await ProductsOptimizedService.getByEan(ean, orgId);
        break;

      case 'eans':
        // Batch lookup por EANs
        const eansParam = url.searchParams.get('eans');
        if (!eansParam) {
          return NextResponse.json(
            { error: 'eans is required for operation=eans (comma-separated)' },
            { status: 400 }
          );
        }
        const eans = eansParam.split(',').map(e => e.trim()).filter(Boolean);
        const map = await ProductsOptimizedService.getByEans(eans, orgId);
        data = Object.fromEntries(map);
        break;

      case 'categories':
        // Contagem por categoria
        data = await ProductsOptimizedService.countByCategory(orgId);
        break;

      case 'list':
      default:
        // Listagem com paginação
        const paginationParams = parsePaginationParams(url);
        const result = await ProductsOptimizedService.list(orgId, {
          search: url.searchParams.get('search') || undefined,
          ean: url.searchParams.get('ean') || undefined,
          category: url.searchParams.get('category') || undefined,
          buyer: url.searchParams.get('buyer') || undefined,
          activeOnly: url.searchParams.get('active') !== 'false',
          limit: paginationParams.limit,
          cursor: paginationParams.cursor,
          direction: paginationParams.direction,
          orderBy: (paginationParams.orderBy as any) || 'nome',
          orderDirection: paginationParams.orderDirection,
        });

        const duration = Date.now() - startTime;

        return NextResponse.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          meta: {
            durationMs: duration,
            timestamp: new Date().toISOString(),
          },
        });
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data,
      meta: {
        operation,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Products Optimized] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
});

export const POST = withMetrics('/api/products/optimized', async (request: NextRequest) => {
  try {
    // Autenticação
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, org_id, ean, eans } = body;

    switch (action) {
      case 'invalidate':
        // Invalidar cache
        if (!org_id) {
          return NextResponse.json(
            { error: 'org_id is required' },
            { status: 400 }
          );
        }
        await ProductsOptimizedService.invalidateCache(org_id, ean);
        return NextResponse.json({
          success: true,
          message: 'Cache invalidated',
        });

      case 'batch_lookup':
        // Batch lookup por EANs
        if (!org_id || !eans || !Array.isArray(eans)) {
          return NextResponse.json(
            { error: 'org_id and eans array are required' },
            { status: 400 }
          );
        }
        const map = await ProductsOptimizedService.getByEans(eans, org_id);
        return NextResponse.json({
          success: true,
          data: Object.fromEntries(map),
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Products Optimized] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
});
