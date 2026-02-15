/**
 * Events API - Sprint 6 Event-Driven Architecture
 *
 * Endpoints para consulta de eventos (auditoria).
 *
 * GET /api/events - Lista eventos com filtros
 * GET /api/events/stats - Estatísticas de eventos
 */

import { NextRequest, NextResponse } from 'next/server';
import { eventStore, getAnalyticsSummary } from '@/lib/events';
import { withMetrics } from '@/lib/helpers/with-metrics';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export const GET = withMetrics('/api/events', async (request: NextRequest) => {
  try {
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const view = url.searchParams.get('view');

    // Estatísticas resumidas
    if (view === 'stats') {
      const hours = parseInt(url.searchParams.get('hours') || '24', 10);
      const stats = await eventStore.getStats(hours);

      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    // Analytics de negócio
    if (view === 'analytics') {
      const analytics = await getAnalyticsSummary();

      return NextResponse.json({
        success: true,
        data: analytics,
      });
    }

    // Lista de eventos
    const type = url.searchParams.get('type') || undefined;
    const aggregateType = url.searchParams.get('aggregateType') || undefined;
    const aggregateId = url.searchParams.get('aggregateId') || undefined;
    const correlationId = url.searchParams.get('correlationId') || undefined;
    const userId = url.searchParams.get('userId') || undefined;
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const events = await eventStore.query({
      type,
      aggregateType,
      aggregateId,
      correlationId,
      userId,
      orgId: user.org_id,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: Math.min(limit, 100),
      offset,
      order: 'desc',
    });

    const total = await eventStore.count({
      type,
      orgId: user.org_id,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});
