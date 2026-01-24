import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Buscar dados de monitoramento
export async function GET() {
  try {
    console.log('[MONITORING] Fetching data via direct queries...');

    // Executar queries em paralelo para performance
    const [
      { data: testRuns, error: runsError },
      { data: systemHealth, error: healthError },
      { data: securityScans, error: scansError },
      { data: qualityMetrics, error: qualityError },
      { data: loadMetrics, error: loadError }
    ] = await Promise.all([
      supabaseAdmin.from('test_runs').select('*').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('system_health').select('*').gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order('checked_at', { ascending: false }),
      supabaseAdmin.from('security_scans').select('*').order('started_at', { ascending: false }).limit(10),
      supabaseAdmin.from('quality_metrics').select('*').order('measured_at', { ascending: false }).limit(20),
      supabaseAdmin.from('load_test_metrics').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    if (runsError) console.error('[MONITORING] Error fetching test_runs:', runsError);
    if (healthError) console.error('[MONITORING] Error fetching system_health:', healthError);
    
    // Fallback para arrays vazios em caso de erro (para não quebrar a página toda se uma tabela falhar)
    const safeTestRuns = testRuns || [];
    const safeSystemHealth = systemHealth || [];
    const safeSecurityScans = securityScans || [];
    const safeQualityMetrics = qualityMetrics || [];
    const safeLoadMetrics = loadMetrics || [];

    // Calcular estatísticas
    const stats = {
      totalRuns: safeTestRuns.length,
      passedRuns: safeTestRuns.filter((r: any) => r.status === 'passed').length,
      failedRuns: safeTestRuns.filter((r: any) => r.status === 'failed').length,
      avgCoverage: safeTestRuns.reduce((acc: number, r: any) => acc + (r.coverage_percent || 0), 0) / (safeTestRuns.length || 1),
      healthyEndpoints: safeSystemHealth.filter((h: any) => h.status === 'healthy').length,
      degradedEndpoints: safeSystemHealth.filter((h: any) => h.status === 'degraded').length,
      unhealthyEndpoints: safeSystemHealth.filter((h: any) => h.status === 'unhealthy').length,
      totalVulnerabilities: safeSecurityScans.reduce((acc: number, s: any) => acc + (s.vulnerabilities_found || 0), 0),
      criticalVulnerabilities: safeSecurityScans.reduce((acc: number, s: any) => acc + (s.critical_count || 0), 0),
    };

    // Agrupar execuções por tipo
    const runsByType = {
      unit: safeTestRuns.filter((r: any) => r.test_type === 'unit'),
      load: safeTestRuns.filter((r: any) => r.test_type === 'load'),
      stress: safeTestRuns.filter((r: any) => r.test_type === 'stress'),
      regression: safeTestRuns.filter((r: any) => r.test_type === 'regression'),
      quality: safeTestRuns.filter((r: any) => r.test_type === 'quality'),
      security: safeTestRuns.filter((r: any) => r.test_type === 'security'),
    };

    // Último status por tipo
    const latestByType = {
      unit: runsByType.unit[0] || null,
      load: runsByType.load[0] || null,
      stress: runsByType.stress[0] || null,
      regression: runsByType.regression[0] || null,
      quality: runsByType.quality[0] || null,
      security: runsByType.security[0] || null,
    };

    console.log('[MONITORING] Data fetched successfully');

    return NextResponse.json({
      stats,
      latestByType,
      testRuns: safeTestRuns,
      systemHealth: safeSystemHealth,
      securityScans: safeSecurityScans,
      qualityMetrics: safeQualityMetrics,
      loadMetrics: safeLoadMetrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[MONITORING] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
