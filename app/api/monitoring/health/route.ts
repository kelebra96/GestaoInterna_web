import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Health check automatizado
export async function GET() {
  const results: any[] = [];
  const startTime = Date.now();

  const now = new Date().toISOString();

  // 1. Verificar Database (Supabase)
  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    results.push({
      check_type: 'database',
      endpoint: 'supabase',
      status: error ? 'unhealthy' : 'healthy',
      response_time_ms: Date.now() - dbStart,
      error_message: error?.message,
      checked_at: now,
    });
  } catch (err: any) {
    results.push({
      check_type: 'database',
      endpoint: 'supabase',
      status: 'unhealthy',
      response_time_ms: Date.now() - dbStart,
      error_message: err.message,
      checked_at: now,
    });
  }

  // 2. Verificar Auth
  const authStart = Date.now();
  try {
    const { error } = await supabaseAdmin.auth.getSession();
    results.push({
      check_type: 'auth',
      endpoint: 'supabase-auth',
      status: error ? 'degraded' : 'healthy',
      response_time_ms: Date.now() - authStart,
      error_message: error?.message,
      checked_at: now,
    });
  } catch (err: any) {
    results.push({
      check_type: 'auth',
      endpoint: 'supabase-auth',
      status: 'unhealthy',
      response_time_ms: Date.now() - authStart,
      error_message: err.message,
      checked_at: now,
    });
  }

  // 3. Verificar APIs principais (checagens internas sem HTTP)
  const apiChecks = [
    { path: '/api/dashboard', query: () => supabaseAdmin.from('stores').select('count').limit(1) },
    { path: '/api/usuarios', query: () => supabaseAdmin.from('users').select('count').limit(1) },
    { path: '/api/solicitacoes', query: () => supabaseAdmin.from('solicitacoes').select('count').limit(1) },
  ];

  for (const api of apiChecks) {
    const apiStart = Date.now();
    const apiNow = new Date().toISOString();
    try {
      const { error } = await api.query();
      results.push({
        check_type: 'api',
        endpoint: api.path,
        status: error ? 'unhealthy' : 'healthy',
        response_time_ms: Date.now() - apiStart,
        error_message: error?.message,
        checked_at: apiNow,
      });
    } catch (err: any) {
      results.push({
        check_type: 'api',
        endpoint: api.path,
        status: 'unhealthy',
        response_time_ms: Date.now() - apiStart,
        error_message: err.message,
        checked_at: apiNow,
      });
    }
  }

  // Salvar resultados no banco
  for (const result of results) {
    // Tentar insert direto
    const { error } = await supabaseAdmin.from('system_health').insert(result);
    
    if (error) {
      console.error('[Health Check] Direct insert failed:', error);
      
      // Tentar via RPC como fallback
      try {
        const { error: rpcError } = await supabaseAdmin.rpc('insert_system_health', {
          p_check_type: result.check_type,
          p_endpoint: result.endpoint,
          p_status: result.status,
          p_response_time_ms: result.response_time_ms,
          p_status_code: result.status_code,
          p_error_message: result.error_message
        });
        
        if (rpcError) console.error('[Health Check] RPC failed:', rpcError);
      } catch (e) {
        console.error('[Health Check] RPC exception:', e);
      }
    }
  }

  // Calcular status geral
  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;

  let overallStatus = 'healthy';
  if (unhealthyCount > 0) overallStatus = 'unhealthy';
  else if (degradedCount > 0) overallStatus = 'degraded';

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    checks: results,
    summary: {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: degradedCount,
      unhealthy: unhealthyCount,
    },
  });
}
