/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const scriptByType = {
  load: path.join(__dirname, 'k6', 'load.js'),
  stress: path.join(__dirname, 'k6', 'stress.js'),
};

function runK6(testType) {
  const script = scriptByType[testType];
  if (!script) throw new Error(`Unsupported testType: ${testType}`);

  const tmpFile = path.join(os.tmpdir(), `k6-summary-${Date.now()}.json`);
  const result = spawnSync('k6', ['run', '--summary-export', tmpFile, script], {
    stdio: 'inherit',
    env: {
      ...process.env,
      APP_URL,
      NEXT_PUBLIC_APP_URL: APP_URL,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (!fs.existsSync(tmpFile)) {
    throw new Error('k6 summary file not generated.');
  }

  const summary = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
  fs.unlinkSync(tmpFile);
  return summary;
}

function extractMetrics(summary) {
  const duration = summary?.metrics?.http_req_duration?.values || {};
  const failed = summary?.metrics?.http_req_failed?.values?.rate || 0;
  const requests = summary?.metrics?.http_reqs?.values?.count || 0;
  const rps = summary?.metrics?.http_reqs?.values?.rate || 0;

  return {
    avg: Math.round(duration.avg || 0),
    min: Math.round(duration.min || 0),
    max: Math.round(duration.max || 0),
    p50: Math.round(duration['p(50)'] || 0),
    p95: Math.round(duration['p(95)'] || 0),
    p99: Math.round(duration['p(99)'] || 0),
    errorRate: Math.round((failed * 100) * 100) / 100,
    totalRequests: Math.round(requests || 0),
    rps: Math.round(rps || 0),
  };
}

async function markRun(runId, updates) {
  const { error } = await supabase.from('test_runs').update(updates).eq('id', runId);
  if (error) throw error;
}

async function insertLoadMetric(runId, metrics, testType) {
  const { error } = await supabase.from('load_test_metrics').insert({
    run_id: runId,
    endpoint: '/api/monitoring',
    method: 'GET',
    requests_total: metrics.totalRequests,
    requests_per_second: metrics.rps,
    avg_response_time_ms: metrics.avg,
    min_response_time_ms: metrics.min,
    max_response_time_ms: metrics.max,
    p50_response_time_ms: metrics.p50,
    p95_response_time_ms: metrics.p95,
    p99_response_time_ms: metrics.p99,
    error_rate: metrics.errorRate,
    concurrent_users: testType === 'stress' ? 100 : 10,
  });
  if (error) throw error;
}

async function main() {
  const { data: runs, error } = await supabase
    .from('test_runs')
    .select('*')
    .in('test_type', ['load', 'stress'])
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  if (!runs || runs.length === 0) {
    console.log('No queued tests.');
    return;
  }

  const run = runs[0];
  const testType = run.test_type;

  await markRun(run.id, { status: 'running', started_at: new Date().toISOString() });
  const summary = runK6(testType);
  const metrics = extractMetrics(summary);

  await insertLoadMetric(run.id, metrics, testType);
  await markRun(run.id, {
    status: metrics.errorRate > 5 ? 'failed' : 'passed',
    duration_ms: Math.round(summary?.state?.testRunDurationMs || 0),
    total_tests: 1,
    passed_tests: metrics.errorRate > 5 ? 0 : 1,
    failed_tests: metrics.errorRate > 5 ? 1 : 0,
    skipped_tests: 0,
    coverage_percent: 0,
    metadata: {
      rps: metrics.rps,
      errorRate: metrics.errorRate,
      source: 'k6',
    },
    completed_at: new Date().toISOString(),
  });

  console.log(`Completed ${testType} run ${run.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
