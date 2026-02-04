#!/usr/bin/env tsx
/**
 * Image Pipeline Worker
 *
 * Processa jobs da fila image_jobs com:
 * - Concorrência configurável (default: 3)
 * - Backoff exponencial em falhas
 * - Retries automáticos (max 3)
 * - Lock atômico para múltiplas instâncias
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx scripts/image-worker.ts
 *   npm run image-worker
 *
 * Env vars:
 *   IMAGE_WORKER_CONCURRENCY=3
 *   IMAGE_WORKER_POLL_INTERVAL=5000
 *   IMAGE_WORKER_ID=worker-1
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const CONCURRENCY = Number(process.env.IMAGE_WORKER_CONCURRENCY || 3);
const POLL_INTERVAL = Number(process.env.IMAGE_WORKER_POLL_INTERVAL || 5000);
const WORKER_ID = process.env.IMAGE_WORKER_ID || `worker-${process.pid}`;
const MAX_BACKOFF = 60000; // 1 minuto

// Cliente Supabase admin
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================
// TIPOS
// ============================================================
type Job = {
  id: string;
  product_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
};

type Product = {
  id: string;
  nome: string | null;
  descricao: string | null;
  ean: string | null;
  sku: string | null;
};

// ============================================================
// FUNÇÕES DO PIPELINE (importadas inline para worker standalone)
// ============================================================

// Importar dinamicamente para funcionar com tsx
let pipeline: any = null;

async function loadPipeline() {
  if (!pipeline) {
    // O caminho relativo funciona porque estamos no diretório do projeto
    pipeline = await import('../lib/images/pipeline');
  }
  return pipeline;
}

// ============================================================
// WORKER
// ============================================================

let isShuttingDown = false;
let activeJobs = 0;
let consecutiveErrors = 0;
let processedCount = 0;
let successCount = 0;
let failCount = 0;

async function claimJobs(limit: number): Promise<Job[]> {
  const { data, error } = await supabase.rpc('claim_image_jobs', {
    p_worker_id: WORKER_ID,
    p_limit: limit,
    p_lock_timeout_minutes: 30,
  });

  if (error) {
    throw new Error(`Erro ao claim jobs: ${error.message}`);
  }

  return (data || []) as Job[];
}

async function completeJob(jobId: string, status: 'done' | 'failed' | 'needs_review', errorMsg?: string) {
  const { error } = await supabase.rpc('complete_image_job', {
    p_job_id: jobId,
    p_status: status,
    p_error: errorMsg || null,
  });

  if (error) {
    console.error(`❌ Erro ao completar job ${jobId}:`, error.message);
  }
}

async function getProduct(productId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, nome, descricao, ean, sku')
    .eq('id', productId)
    .single();

  if (error) {
    console.error(`❌ Erro ao buscar produto ${productId}:`, error.message);
    return null;
  }

  return data as Product;
}

async function processJob(job: Job): Promise<void> {
  const startTime = Date.now();
  const { processProductImage } = await loadPipeline();

  console.log(`🔄 [${WORKER_ID}] Processando job ${job.id} (produto: ${job.product_id}, tentativa: ${job.attempts})`);

  try {
    const product = await getProduct(job.product_id);

    if (!product) {
      await completeJob(job.id, 'failed', 'Produto não encontrado');
      failCount++;
      return;
    }

    const result = await processProductImage(product);
    const duration = Date.now() - startTime;

    if (result.status === 'ok') {
      await completeJob(job.id, 'done');
      successCount++;
      console.log(`✅ [${WORKER_ID}] Job ${job.id} concluído em ${duration}ms (confidence: ${result.confidence})`);
    } else if (result.status === 'needs_review') {
      await completeJob(job.id, 'needs_review', result.reason);
      console.log(`⚠️ [${WORKER_ID}] Job ${job.id} precisa revisão: ${result.reason}`);
    } else {
      await completeJob(job.id, 'failed', result.reason || 'Erro desconhecido');
      failCount++;
      console.log(`❌ [${WORKER_ID}] Job ${job.id} falhou: ${result.reason}`);
    }

    consecutiveErrors = 0;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMsg = error?.message || 'Erro desconhecido';

    failCount++;
    consecutiveErrors++;

    // Se ainda tem tentativas, mantém como queued para retry
    if (job.attempts < job.max_attempts) {
      await completeJob(job.id, 'failed', errorMsg);
      console.log(`⚠️ [${WORKER_ID}] Job ${job.id} falhou (${job.attempts}/${job.max_attempts}): ${errorMsg}`);
    } else {
      await completeJob(job.id, 'failed', `Max tentativas excedido: ${errorMsg}`);
      console.log(`❌ [${WORKER_ID}] Job ${job.id} esgotou tentativas: ${errorMsg}`);
    }

    console.log(`   Duração: ${duration}ms`);
  } finally {
    processedCount++;
    activeJobs--;
  }
}

async function runWorkerCycle(): Promise<number> {
  const slotsAvailable = CONCURRENCY - activeJobs;

  if (slotsAvailable <= 0) {
    return 0;
  }

  const jobs = await claimJobs(slotsAvailable);

  if (jobs.length === 0) {
    return 0;
  }

  console.log(`📥 [${WORKER_ID}] Claimed ${jobs.length} jobs`);

  // Processa jobs em paralelo (até CONCURRENCY)
  const promises = jobs.map(async (job) => {
    activeJobs++;
    await processJob(job);
  });

  // Não espera terminar - permite polling contínuo
  Promise.all(promises).catch((err) => {
    console.error(`❌ [${WORKER_ID}] Erro no batch:`, err);
  });

  return jobs.length;
}

function calculateBackoff(): number {
  if (consecutiveErrors === 0) {
    return POLL_INTERVAL;
  }
  // Backoff exponencial: 5s, 10s, 20s, 40s... até MAX_BACKOFF
  const backoff = Math.min(POLL_INTERVAL * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF);
  return backoff;
}

async function mainLoop(): Promise<void> {
  console.log(`🚀 [${WORKER_ID}] Worker iniciado`);
  console.log(`   Concorrência: ${CONCURRENCY}`);
  console.log(`   Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log('');

  while (!isShuttingDown) {
    try {
      const claimed = await runWorkerCycle();

      if (claimed === 0 && activeJobs === 0) {
        // Sem jobs, aplica backoff
        const waitTime = calculateBackoff();
        if (consecutiveErrors > 0) {
          console.log(`⏳ [${WORKER_ID}] Backoff: ${waitTime}ms (${consecutiveErrors} erros consecutivos)`);
        }
        await sleep(waitTime);
      } else {
        // Jobs ativos, poll mais rápido
        await sleep(500);
      }
    } catch (error: any) {
      consecutiveErrors++;
      console.error(`❌ [${WORKER_ID}] Erro no ciclo:`, error?.message || error);
      const waitTime = calculateBackoff();
      console.log(`⏳ [${WORKER_ID}] Aguardando ${waitTime}ms antes de retry...`);
      await sleep(waitTime);
    }
  }

  // Aguarda jobs ativos terminarem
  console.log(`🛑 [${WORKER_ID}] Encerrando... aguardando ${activeJobs} jobs ativos`);
  while (activeJobs > 0) {
    await sleep(1000);
  }

  console.log('');
  console.log(`📊 [${WORKER_ID}] Estatísticas finais:`);
  console.log(`   Processados: ${processedCount}`);
  console.log(`   Sucesso: ${successCount}`);
  console.log(`   Falhas: ${failCount}`);
  console.log(`   Taxa de sucesso: ${processedCount > 0 ? ((successCount / processedCount) * 100).toFixed(1) : 0}%`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function handleShutdown(signal: string) {
  console.log(`\n📤 [${WORKER_ID}] Recebido ${signal}, iniciando shutdown...`);
  isShuttingDown = true;
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// ============================================================
// ENTRYPOINT
// ============================================================

mainLoop()
  .then(() => {
    console.log(`👋 [${WORKER_ID}] Worker encerrado`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`💥 [${WORKER_ID}] Erro fatal:`, err);
    process.exit(1);
  });
