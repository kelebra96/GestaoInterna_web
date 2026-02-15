/**
 * Image Processing Queue - BullMQ
 *
 * Processa imagens em background:
 * - Upload e otimização
 * - Geração de thumbnails
 * - Análise com OpenAI/Vision
 * - Busca de produtos por imagem
 *
 * Uso:
 *   import { imageQueue, addImageJob } from '@/lib/queues/image.queue';
 *
 *   // Processar upload
 *   await addImageJob({
 *     type: 'process_upload',
 *     productId: 'prod-123',
 *     imageUrl: 'https://...',
 *   });
 */

import { Job } from 'bullmq';
import { createQueue, createWorker, isQueueConfigured } from './index';
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';
import { RetryService } from '@/lib/resilience/retry.service';

// Nome da fila
const QUEUE_NAME = 'image-processing';

// Tipos de jobs de imagem
export type ImageJobType =
  | 'process_upload'      // Processar novo upload
  | 'generate_thumbnail'  // Gerar thumbnail
  | 'analyze_product'     // Analisar imagem com AI
  | 'search_product'      // Buscar produto por imagem
  | 'backfill_images'     // Preencher imagens faltantes
  | 'validate_image';     // Validar qualidade da imagem

export interface ImageJobData {
  /** Tipo de processamento */
  type: ImageJobType;
  /** ID do produto relacionado */
  productId?: string;
  /** URL da imagem a processar */
  imageUrl?: string;
  /** Bytes da imagem (base64) */
  imageBase64?: string;
  /** ID do usuário que solicitou */
  userId?: string;
  /** Organização */
  orgId?: string;
  /** Opções específicas do tipo de job */
  options?: {
    /** Tamanho do thumbnail (ex: 150x150) */
    thumbnailSize?: string;
    /** Qualidade de compressão (1-100) */
    quality?: number;
    /** Forçar reprocessamento */
    force?: boolean;
    /** Callback URL para notificar quando terminar */
    callbackUrl?: string;
  };
  /** Metadata para tracking */
  metadata?: {
    source?: string;
    correlationId?: string;
    createdAt?: string;
  };
}

export interface ImageJobResult {
  success: boolean;
  type: ImageJobType;
  productId?: string;
  resultUrl?: string;
  analysis?: {
    confidence: number;
    matchedProduct?: string;
    labels?: string[];
  };
  error?: string;
  processedAt: string;
  durationMs: number;
}

// Criar a fila com timeout maior (imagens demoram)
export const imageQueue = createQueue<ImageJobData>(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s (imagens precisam mais tempo)
    },
    removeOnComplete: {
      count: 500,
      age: 12 * 60 * 60, // 12 horas
    },
    removeOnFail: {
      count: 2000,
      age: 7 * 24 * 60 * 60, // 7 dias
    },
  },
});

/**
 * Processa um job de imagem
 */
async function processImageJob(job: Job<ImageJobData>): Promise<ImageJobResult> {
  const startTime = Date.now();
  const { type, productId, imageUrl } = job.data;

  console.log(`[Image Queue] Processando job ${job.id} tipo=${type} produto=${productId}`);

  try {
    let result: Partial<ImageJobResult> = {};

    switch (type) {
      case 'process_upload':
        result = await processUpload(job.data);
        break;

      case 'generate_thumbnail':
        result = await generateThumbnail(job.data);
        break;

      case 'analyze_product':
        result = await analyzeProduct(job.data);
        break;

      case 'search_product':
        result = await searchProduct(job.data);
        break;

      case 'validate_image':
        result = await validateImage(job.data);
        break;

      case 'backfill_images':
        result = await backfillImages(job.data);
        break;

      default:
        throw new Error(`Unknown image job type: ${type}`);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Image Queue] Job ${job.id} completado em ${durationMs}ms`);

    return {
      success: true,
      type,
      productId,
      ...result,
      processedAt: new Date().toISOString(),
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[Image Queue] Job ${job.id} falhou após ${durationMs}ms:`, error.message);

    // Verificar se deve enviar para DLQ
    if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
      await RetryService.execute(
        'image-processing',
        async () => {
          throw error;
        },
        {
          maxRetries: 0,
          payload: job.data,
          originalId: job.id,
          metadata: {
            type,
            productId,
            attempts: job.attemptsMade,
          },
        }
      );
    }

    throw error;
  }
}

// ==========================================
// Processadores por tipo
// ==========================================

async function processUpload(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // TODO: Implementar processamento de upload
  // - Validar formato
  // - Otimizar/comprimir
  // - Upload para storage
  // - Atualizar produto no banco

  console.log(`[Image Queue] Processando upload para produto ${data.productId}`);

  // Placeholder - implementar lógica real
  return {
    resultUrl: data.imageUrl,
  };
}

async function generateThumbnail(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // TODO: Implementar geração de thumbnail
  // - Redimensionar imagem
  // - Aplicar crop
  // - Upload thumbnail

  console.log(`[Image Queue] Gerando thumbnail para ${data.imageUrl}`);

  // Placeholder
  return {
    resultUrl: data.imageUrl?.replace(/\.(\w+)$/, '_thumb.$1'),
  };
}

async function analyzeProduct(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // Usar circuit breaker para OpenAI
  const analysis = await circuitBreakers.openai.fire(
    async () => {
      // TODO: Implementar análise com OpenAI Vision
      // Por enquanto, retorna placeholder
      console.log(`[Image Queue] Analisando imagem com AI para produto ${data.productId}`);

      return {
        confidence: 0.85,
        matchedProduct: data.productId,
        labels: ['produto', 'embalagem'],
      };
    },
    () => ({
      confidence: 0,
      matchedProduct: undefined,
      labels: [],
    })
  );

  return { analysis };
}

async function searchProduct(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // Usar circuit breaker para serviços externos
  const analysis = await circuitBreakers.external.fire(
    'image-search',
    async () => {
      // TODO: Implementar busca de produto por imagem
      console.log(`[Image Queue] Buscando produto por imagem`);

      return {
        confidence: 0.75,
        matchedProduct: undefined,
        labels: [],
      };
    }
  );

  return { analysis };
}

async function validateImage(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // Validar qualidade da imagem
  console.log(`[Image Queue] Validando imagem ${data.imageUrl}`);

  // TODO: Implementar validação
  // - Resolução mínima
  // - Formato correto
  // - Não é imagem genérica

  return {
    analysis: {
      confidence: 1.0,
      labels: ['valid'],
    },
  };
}

async function backfillImages(data: ImageJobData): Promise<Partial<ImageJobResult>> {
  // Processar múltiplos produtos sem imagem
  console.log(`[Image Queue] Backfill de imagens para org ${data.orgId}`);

  // TODO: Implementar backfill
  // - Buscar produtos sem imagem
  // - Tentar encontrar imagem em APIs externas
  // - Atualizar produtos

  return {};
}

// ==========================================
// Worker
// ==========================================

let imageWorker: ReturnType<typeof createWorker<ImageJobData>> | null = null;

export function startImageWorker() {
  if (!isQueueConfigured()) {
    console.warn('[Image Queue] Redis não configurado. Worker não iniciado.');
    return null;
  }

  if (imageWorker) {
    console.warn('[Image Queue] Worker já está rodando.');
    return imageWorker;
  }

  imageWorker = createWorker<ImageJobData>(QUEUE_NAME, processImageJob, {
    concurrency: 3, // Imagens são pesadas, processar menos simultaneamente
    limiter: {
      max: 20, // Máximo 20 por segundo
      duration: 1000,
    },
  });

  console.log('[Image Queue] Worker iniciado com concurrency=3');
  return imageWorker;
}

// ==========================================
// API Helper
// ==========================================

/**
 * Adiciona um job de imagem na fila
 */
export async function addImageJob(
  data: ImageJobData,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
  }
): Promise<string> {
  const jobData: ImageJobData = {
    ...data,
    metadata: {
      ...data.metadata,
      createdAt: new Date().toISOString(),
    },
  };

  const job = await imageQueue.add(data.type, jobData, {
    delay: options?.delay,
    priority: options?.priority,
    jobId: options?.jobId,
  });

  console.log(`[Image Queue] Job ${job.id} adicionado tipo=${data.type}`);

  return job.id!;
}

/**
 * Adiciona múltiplos jobs em batch
 */
export async function addImageJobBatch(
  jobs: ImageJobData[]
): Promise<string[]> {
  const bulkJobs = jobs.map((data) => ({
    name: data.type,
    data: {
      ...data,
      metadata: {
        ...data.metadata,
        createdAt: new Date().toISOString(),
      },
    },
  }));

  const results = await imageQueue.addBulk(bulkJobs);

  console.log(`[Image Queue] ${results.length} jobs adicionados em batch`);

  return results.map((job) => job.id!);
}

/**
 * Obtém estatísticas da fila
 */
export async function getImageQueueStats() {
  const [counts, isPaused] = await Promise.all([
    imageQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    imageQueue.isPaused(),
  ]);

  return {
    name: QUEUE_NAME,
    counts,
    isPaused,
  };
}

export default imageQueue;
