import { supabaseAdmin } from '@/lib/supabase-admin';

// ==========================================
// TESTES DE CARGA
// ==========================================
export async function runLoadTests(runId: string) {
  const startTime = Date.now();

  const endpoints = [
    { path: '/api/dashboard', method: 'GET' },
    { path: '/api/usuarios', method: 'GET' },
    { path: '/api/solicitacoes', method: 'GET' },
    { path: '/api/monitoring', method: 'GET' },
  ];

  const concurrentUsers = 10;
  const requestsPerEndpoint = 20;
  let totalRequests = 0;
  let successfulRequests = 0;

  for (const endpoint of endpoints) {
    const responseTimes: number[] = [];
    let errors = 0;

    const promises = [];
    for (let i = 0; i < requestsPerEndpoint; i++) {
      promises.push(
        (async () => {
          const reqStart = Date.now();
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
            const response = await fetch(`${baseUrl}${endpoint.path}`, {
              method: endpoint.method,
              headers: { 'Content-Type': 'application/json' },
            });

            responseTimes.push(Date.now() - reqStart);
            if (response.ok) successfulRequests++;
            else errors++;
          } catch {
            responseTimes.push(Date.now() - reqStart);
            errors++;
          }
          totalRequests++;
        })()
      );

      if (promises.length >= concurrentUsers) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
    await Promise.all(promises);

    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    // Salvar métricas via RPC
    await supabaseAdmin.rpc('insert_load_test_metric', {
      p_run_id: runId,
      p_endpoint: endpoint.path,
      p_method: endpoint.method,
      p_requests_total: requestsPerEndpoint,
      p_requests_per_second: requestsPerEndpoint / ((Date.now() - startTime) / 1000),
      p_avg_response_time_ms: Math.round(avgTime),
      p_min_response_time_ms: sortedTimes[0] || 0,
      p_max_response_time_ms: sortedTimes[sortedTimes.length - 1] || 0,
      p_p50_response_time_ms: p50,
      p_p95_response_time_ms: p95,
      p_p99_response_time_ms: p99,
      p_error_rate: (errors / requestsPerEndpoint) * 100,
      p_concurrent_users: concurrentUsers,
    });
  }

  return {
    total: endpoints.length,
    passed: successfulRequests > totalRequests * 0.9 ? endpoints.length : 0,
    failed: successfulRequests <= totalRequests * 0.9 ? endpoints.length : 0,
    skipped: 0,
    duration: Date.now() - startTime,
    coverage: Math.round((successfulRequests / totalRequests) * 100),
    metadata: {
      totalRequests,
      successfulRequests,
      concurrentUsers,
      endpoints: endpoints.length,
    },
  };
}

// ==========================================
// TESTES DE STRESS
// ==========================================
export async function runStressTests(runId: string) {
  const startTime = Date.now();

  const levels = [10, 25, 50, 100];
  let maxConcurrentHandled = 0;
  let breakingPoint = 0;

  for (const concurrent of levels) {
    const testStart = Date.now();
    let errors = 0;
    const promises = [];

    for (let i = 0; i < concurrent; i++) {
      promises.push(
        (async () => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
            const response = await fetch(`${baseUrl}/api/monitoring`, {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) errors++;
          } catch {
            errors++;
          }
        })()
      );
    }

    await Promise.all(promises);

    const errorRate = (errors / concurrent) * 100;

    if (errorRate < 10) {
      maxConcurrentHandled = concurrent;
    } else if (breakingPoint === 0) {
      breakingPoint = concurrent;
    }

    // Salvar resultado do nível via RPC
    await supabaseAdmin.rpc('insert_test_result', {
      p_run_id: runId,
      p_test_name: `Stress Level ${concurrent} users`,
      p_test_suite: 'Stress',
      p_status: errorRate < 10 ? 'passed' : 'failed',
      p_duration_ms: Date.now() - testStart,
      p_metadata: { concurrent, errorRate, errors },
    });
  }

  return {
    total: levels.length,
    passed: levels.filter(l => l <= maxConcurrentHandled).length,
    failed: levels.filter(l => l > maxConcurrentHandled).length,
    skipped: 0,
    duration: Date.now() - startTime,
    coverage: Math.round((maxConcurrentHandled / levels[levels.length - 1]) * 100),
    metadata: {
      maxConcurrentHandled,
      breakingPoint,
      levelsTested: levels,
    },
  };
}

// Conceptual worker function
export async function processQueuedTests() {
  console.log('[Test Processor] Checking for queued tests...');

  // In a real scenario, this would poll a queue or listen for Supabase changes
  // For demonstration, let's simulate fetching a queued test
  const { data: queuedRuns, error } = await supabaseAdmin
    .from('test_runs')
    .select('*')
    .eq('status', 'queued')
    .limit(1);

  if (error) {
    console.error('[Test Processor] Error fetching queued tests:', error);
    return;
  }

  if (queuedRuns && queuedRuns.length > 0) {
    const testRun = queuedRuns[0];
    console.log(`[Test Processor] Processing queued test: ${testRun.test_type} (runId: ${testRun.id})`);

    // Update status to 'running'
    await supabaseAdmin.rpc('update_test_run_status', { p_id: testRun.id, p_status: 'running' });

    let results;
    try {
      if (testRun.test_type === 'load') {
        results = await runLoadTests(testRun.id);
      } else if (testRun.test_type === 'stress') {
        results = await runStressTests(testRun.id);
      } else {
        console.warn(`[Test Processor] Unknown queued test type: ${testRun.test_type}`);
        results = { failed: 1, total: 1, duration: 0, passed: 0, skipped: 0, coverage: 0, metadata: {} }; // Default failure
      }

      // Update status to 'completed' with results
      await supabaseAdmin.rpc('update_test_run', {
        p_id: testRun.id,
        p_status: results.failed > 0 ? 'failed' : 'passed',
        p_duration_ms: results.duration,
        p_total_tests: results.total,
        p_passed_tests: results.passed,
        p_failed_tests: results.failed,
        p_skipped_tests: results.skipped,
        p_coverage_percent: results.coverage,
        p_metadata: results.metadata,
      });

      console.log(`[Test Processor] Test ${testRun.test_type} (runId: ${testRun.id}) completed.`);
    } catch (e: any) {
      console.error(`[Test Processor] Error executing test ${testRun.test_type} (runId: ${testRun.id}):`, e);
      // Update status to 'failed'
      await supabaseAdmin.rpc('update_test_run_status', { p_id: testRun.id, p_status: 'failed' });
    }
  } else {
    console.log('[Test Processor] No queued tests found.');
  }
}
