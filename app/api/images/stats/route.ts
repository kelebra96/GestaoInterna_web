import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/images/stats
 *
 * Retorna estatísticas do pipeline de imagens.
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Estatísticas de produtos por status
    const { data: productStats } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT
          COALESCE(image_status::text, 'null') as status,
          COUNT(*)::int as count
        FROM products
        GROUP BY image_status
        ORDER BY count DESC
      `,
    });

    // Estatísticas de jobs
    const { data: jobStats } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT
          status,
          COUNT(*)::int as count,
          AVG(attempts)::numeric(4,2) as avg_attempts
        FROM image_jobs
        GROUP BY status
        ORDER BY count DESC
      `,
    });

    // Jobs nas últimas 24h
    const { data: recentJobs } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT
          status,
          COUNT(*)::int as count
        FROM image_jobs
        WHERE updated_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `,
    });

    // Produtos processados hoje
    const { data: todayStats } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT
          image_status::text as status,
          image_source::text as source,
          COUNT(*)::int as count,
          AVG(image_confidence)::numeric(4,3) as avg_confidence
        FROM products
        WHERE image_updated_at > NOW() - INTERVAL '24 hours'
          AND image_status IS NOT NULL
        GROUP BY image_status, image_source
        ORDER BY count DESC
      `,
    });

    // Validations cache stats
    const { data: cacheStats } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT
          COUNT(*)::int as total_cached,
          COUNT(CASE WHEN is_match THEN 1 END)::int as matches,
          AVG(confidence)::numeric(4,3) as avg_confidence
        FROM image_validations_cache
      `,
    });

    // Jobs travados (running há mais de 30 min)
    const { data: stuckJobs } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*)::int as count
        FROM image_jobs
        WHERE status = 'running'
          AND locked_at < NOW() - INTERVAL '30 minutes'
      `,
    });

    return NextResponse.json({
      products: {
        byStatus: productStats || [],
      },
      jobs: {
        byStatus: jobStats || [],
        recent24h: recentJobs || [],
        stuck: stuckJobs?.[0]?.count || 0,
      },
      today: todayStats || [],
      cache: cacheStats?.[0] || { total_cached: 0, matches: 0, avg_confidence: 0 },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[stats] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
