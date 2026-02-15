/**
 * Dashboard Optimized API - Sprint 5 Otimização
 *
 * Endpoint que utiliza views materializadas para queries ultra-rápidas.
 * Ideal para dashboards com atualização frequente.
 *
 * GET /api/dashboard/optimized?org_id=xxx
 * POST /api/dashboard/optimized/refresh (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DashboardViewsService } from '@/lib/services/dashboard-views.service';
import { withMetrics } from '@/lib/helpers/with-metrics';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withMetrics('/api/dashboard/optimized', async (request: NextRequest) => {
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

    // Obter org_id do usuário ou query param
    const url = new URL(request.url);
    const orgId = url.searchParams.get('org_id');
    const viewType = url.searchParams.get('view'); // overview, stores, products, etc.

    if (!orgId) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    let data;

    // Retornar dados específicos ou dashboard completo
    switch (viewType) {
      case 'overview':
        data = await DashboardViewsService.getOrgDashboard(orgId);
        break;
      case 'status':
        data = await DashboardViewsService.getStatusSummary(orgId);
        break;
      case 'stores':
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const orderBy = url.searchParams.get('orderBy') || 'total_solicitacoes';
        data = await DashboardViewsService.getStoreMetrics(orgId, { limit, orderBy });
        break;
      case 'products':
        const productLimit = parseInt(url.searchParams.get('limit') || '10', 10);
        data = await DashboardViewsService.getTopProducts(orgId, productLimit);
        break;
      case 'inventory':
        data = await DashboardViewsService.getInventoryMetrics(orgId);
        break;
      case 'compliance':
        data = await DashboardViewsService.getComplianceSummary(orgId);
        break;
      case 'health':
        data = await DashboardViewsService.checkViewsHealth();
        break;
      default:
        // Dashboard completo
        data = await DashboardViewsService.getFullDashboard(orgId);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data,
      meta: {
        source: 'materialized_views',
        cached: false,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Dashboard Optimized] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
});

export const POST = withMetrics('/api/dashboard/optimized', async (request: NextRequest) => {
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

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'refresh';

    switch (action) {
      case 'refresh':
        const result = await DashboardViewsService.refreshViews();
        return NextResponse.json({
          success: result.success,
          message: result.success
            ? 'Materialized views refreshed successfully'
            : `Failed to refresh views: ${result.error}`,
        });

      case 'invalidate':
        const orgId = body.org_id;
        if (!orgId) {
          return NextResponse.json(
            { error: 'org_id is required for invalidate action' },
            { status: 400 }
          );
        }
        await DashboardViewsService.invalidateCache(orgId);
        return NextResponse.json({
          success: true,
          message: `Cache invalidated for org ${orgId}`,
        });

      case 'health':
        const health = await DashboardViewsService.checkViewsHealth();
        return NextResponse.json({
          success: true,
          data: health,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Dashboard Optimized] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
});
