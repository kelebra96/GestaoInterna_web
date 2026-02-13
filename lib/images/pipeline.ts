import OpenAI from 'openai';
import sharp from 'sharp';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================================
// CONSTANTES
// ============================================================
const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v0/product';
const IMAGE_BUCKET = 'product-images';
const DEFAULT_CONFIDENCE_THRESHOLD = Number(process.env.IMAGE_CONFIDENCE_THRESHOLD || 0.65);
const ACCEPT_OFF_DIRECT = process.env.IMAGE_ACCEPT_OFF_DIRECT === 'true';
const PROMPT_VERSION = 'v2';

// Limites de validação
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_IMAGE_WIDTH = 100;
const MIN_IMAGE_HEIGHT = 100;
const THUMB_SIZE = 256;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ============================================================
// OPENAI CLIENT
// ============================================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================
// TIPOS
// ============================================================
export type ProductImageRow = {
  id: string;
  nome?: string | null;
  descricao?: string | null;
  ean?: string | null;
  sku?: string | null;
  image_url?: string | null;
  image_status?: string | null;
  image_source?: string | null;
  image_confidence?: number | null;
  image_candidate_urls?: string[] | null;
};

export type ImageScore = {
  match: boolean;
  confidence: number;
  reason: string;
};

export type ImageMetadata = {
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

export type ProcessResult = {
  status: 'ok' | 'needs_review' | 'error';
  source?: string;
  confidence?: number;
  reason?: string;
  candidates?: number;
};

type OffCandidate = {
  imageUrl: string | null;
  raw?: any;
};

// ============================================================
// UTILITÁRIOS
// ============================================================
const normalizeEan = (ean?: string | null): string => (ean || '').replace(/\D/g, '');

const hashUrl = (url: string): string =>
  crypto.createHash('sha256').update(url).digest('hex').substring(0, 64);

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// ============================================================
// 1. QUERY PRODUTOS SEM IMAGEM
// ============================================================
export async function fetchProductsNeedingImages(limit = 50, cursor?: string) {
  let query = supabaseAdmin
    .from('products')
    .select('id, name, description, ean, sku, image_url, image_status, image_source, image_confidence, image_candidate_urls')
    .not('ean', 'is', null)
    .or('image_status.is.null,image_status.eq.missing,image_status.eq.error')
    .is('image_url', null)
    .order('id', { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt('id', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Map to ProductImageRow (nome/descricao for compatibility)
  return (data || []).map((p: any) => ({
    id: p.id,
    nome: p.name,
    descricao: p.description,
    ean: p.ean,
    sku: p.sku,
    image_url: p.image_url,
    image_status: p.image_status,
    image_source: p.image_source,
    image_confidence: p.image_confidence,
    image_candidate_urls: p.image_candidate_urls,
  })) as ProductImageRow[];
}

// ============================================================
// 2. CRIAR/ENFILEIRAR JOBS (com lock/idempotência)
// ============================================================
export async function enqueueImageJob(productId: string): Promise<string> {
  // Verifica se já existe job ativo (queued ou running)
  const { data: existing } = await supabaseAdmin
    .from('image_jobs')
    .select('id, status')
    .eq('product_id', productId)
    .in('status', ['queued', 'running'])
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Insere novo job (UNIQUE index garante idempotência)
  const { data, error } = await supabaseAdmin
    .from('image_jobs')
    .insert({
      product_id: productId,
      status: 'queued',
      attempts: 0,
      max_attempts: 3,
    })
    .select('id')
    .single();

  if (error) {
    // Se erro de duplicata, busca o existente
    if (error.code === '23505') {
      const { data: dup } = await supabaseAdmin
        .from('image_jobs')
        .select('id')
        .eq('product_id', productId)
        .in('status', ['queued', 'running'])
        .single();
      return dup?.id || '';
    }
    throw error;
  }

  return data.id as string;
}

export async function enqueueMultipleJobs(productIds: string[]): Promise<number> {
  let enqueued = 0;
  for (const pid of productIds) {
    try {
      await enqueueImageJob(pid);
      enqueued++;
    } catch (err) {
      console.warn('[enqueueMultipleJobs] Falha ao enfileirar:', pid, err);
    }
  }
  return enqueued;
}

// ============================================================
// 3. CLAIM JOBS COM LOCK ATÔMICO
// ============================================================
export async function claimJobs(workerId: string, limit = 5): Promise<any[]> {
  const { data, error } = await supabaseAdmin.rpc('claim_image_jobs', {
    p_worker_id: workerId,
    p_limit: limit,
    p_lock_timeout_minutes: 30,
  });

  if (error) throw error;
  return data || [];
}

export async function completeJob(
  jobId: string,
  status: 'done' | 'failed' | 'needs_review',
  errorMsg?: string
) {
  const { error } = await supabaseAdmin.rpc('complete_image_job', {
    p_job_id: jobId,
    p_status: status,
    p_error: errorMsg || null,
  });
  if (error) throw error;
}

// ============================================================
// 4. OPEN FOOD FACTS
// ============================================================
export async function fetchFromOpenFoodFacts(ean: string): Promise<OffCandidate> {
  if (!ean) return { imageUrl: null };
  try {
    const response = await fetch(`${OFF_ENDPOINT}/${encodeURIComponent(ean)}.json`, {
      cache: 'no-store',
    });
    if (!response.ok) return { imageUrl: null };
    const payload = await response.json();
    const product = payload?.product || {};
    const imageUrl =
      product.image_front_url ||
      product.image_url ||
      product.image_front_small_url ||
      null;
    return { imageUrl, raw: payload };
  } catch {
    return { imageUrl: null };
  }
}

// ============================================================
// 5. DOWNLOAD E VALIDAÇÃO DE IMAGEM
// ============================================================
export async function downloadAndValidateImage(
  url: string
): Promise<{ bytes: Buffer; contentType: string; metadata: ImageMetadata }> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Validar MIME type
  const baseMime = contentType.split(';')[0].trim();
  if (!ALLOWED_MIME_TYPES.includes(baseMime)) {
    throw new Error(`MIME type não permitido: ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  // Validar tamanho
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`Imagem excede limite de ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
  }

  // Validar dimensões com sharp
  const sharpImage = sharp(bytes);
  const metadata = await sharpImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Não foi possível ler dimensões da imagem');
  }

  if (metadata.width < MIN_IMAGE_WIDTH || metadata.height < MIN_IMAGE_HEIGHT) {
    throw new Error(
      `Imagem muito pequena: ${metadata.width}x${metadata.height} (mínimo: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT})`
    );
  }

  return {
    bytes,
    contentType: baseMime,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      bytes: bytes.length,
      mime: baseMime,
    },
  };
}

// ============================================================
// 6. GERAR THUMBNAIL COM SHARP
// ============================================================
export async function generateThumbnail(
  imageBytes: Buffer,
  size = THUMB_SIZE
): Promise<Buffer> {
  return sharp(imageBytes)
    .resize(size, size, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// ============================================================
// 7. OPENAI SCORE COM CACHE E AUDITORIA
// ============================================================
export async function scoreImageWithOpenAI(
  product: ProductImageRow,
  imageBytes: Buffer,
  imageUrl?: string
): Promise<ImageScore & { cached: boolean }> {
  const model = process.env.OPENAI_IMAGE_SCORE_MODEL || 'gpt-4o-mini';

  // Verificar cache se tiver URL
  if (imageUrl) {
    const urlHash = hashUrl(imageUrl);
    const { data: cached } = await supabaseAdmin
      .from('image_validations_cache')
      .select('is_match, confidence, reason')
      .eq('url_hash', urlHash)
      .eq('product_id', product.id)
      .maybeSingle();

    if (cached) {
      return {
        match: cached.is_match,
        confidence: Number(cached.confidence),
        reason: cached.reason || '',
        cached: true,
      };
    }
  }

  const imageBase64 = imageBytes.toString('base64');
  const prompt = [
    'Você é um assistente que valida se a imagem corresponde a um produto.',
    'Analise a imagem e retorne JSON puro com:',
    '- match: boolean (true se a imagem corresponde ao produto)',
    '- confidence: number entre 0 e 1',
    '- reason: string curta explicando a decisão',
    '',
    'Dados do produto:',
    `Nome: ${product.nome || 'N/A'}`,
    `Descrição: ${product.descricao || 'N/A'}`,
    `EAN: ${product.ean || 'N/A'}`,
    `SKU: ${product.sku || 'N/A'}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      { role: 'system', content: 'Responda apenas JSON válido, sem markdown ou código.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const parsed = safeJsonParse<ImageScore>(raw, { match: false, confidence: 0, reason: 'parse_error' });

  const result: ImageScore = {
    match: Boolean(parsed.match),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
    reason: String(parsed.reason || ''),
  };

  // Salvar no cache
  if (imageUrl) {
    const urlHash = hashUrl(imageUrl);
    await supabaseAdmin
      .from('image_validations_cache')
      .upsert(
        {
          url_hash: urlHash,
          product_id: product.id,
          is_match: result.match,
          confidence: result.confidence,
          reason: result.reason,
          model,
          prompt_version: PROMPT_VERSION,
          raw_response: { raw },
        },
        { onConflict: 'url_hash,product_id' }
      )
      .select()
      .maybeSingle();
  }

  return { ...result, cached: false };
}

// ============================================================
// 8. UPLOAD PARA SUPABASE STORAGE (main + thumb)
// ============================================================
export async function persistImageToSupabaseStorage(
  productId: string,
  bytes: Buffer,
  contentType: string
): Promise<{ publicUrl: string; thumbUrl: string; mainPath: string; thumbPath: string }> {
  const ext = contentType.split('/')[1] || 'jpg';
  const mainPath = `products/${productId}/main.${ext}`;
  const thumbPath = `products/${productId}/thumb.jpg`;

  // Upload main
  const { error: mainError } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(mainPath, bytes, { contentType, upsert: true });

  if (mainError) throw mainError;

  // Gerar e upload thumbnail
  const thumbBytes = await generateThumbnail(bytes);
  const { error: thumbError } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(thumbPath, thumbBytes, { contentType: 'image/jpeg', upsert: true });

  if (thumbError) {
    console.warn('[persistImage] Falha ao salvar thumbnail:', thumbError);
  }

  const { data: mainData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(mainPath);
  const { data: thumbData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(thumbPath);

  return {
    publicUrl: mainData.publicUrl,
    thumbUrl: thumbData.publicUrl,
    mainPath,
    thumbPath,
  };
}

// ============================================================
// 9. ATUALIZAR PRODUTO COM METADADOS COMPLETOS
// ============================================================
export async function updateProductImageFields(
  productId: string,
  updates: {
    image_url?: string | null;
    image_thumb_url?: string | null;
    image_status?: string;
    image_source?: string | null;
    image_confidence?: number | null;
    image_candidate_urls?: string[];
    image_width?: number | null;
    image_height?: number | null;
    image_bytes?: number | null;
    image_mime?: string | null;
    image_ai_model?: string | null;
    image_ai_prompt_version?: string | null;
    image_ai_reason?: string | null;
  }
) {
  const now = new Date().toISOString();
  const payload = { ...updates, image_updated_at: now, updated_at: now };

  const { error } = await supabaseAdmin.from('products').update(payload).eq('id', productId);

  if (error) throw error;
}

// ============================================================
// 10. PROCESSAR IMAGEM DE UM PRODUTO (ORQUESTRAÇÃO)
// ============================================================
export async function processProductImage(product: ProductImageRow): Promise<ProcessResult> {
  const ean = normalizeEan(product.ean);
  const model = process.env.OPENAI_IMAGE_SCORE_MODEL || 'gpt-4o-mini';

  if (!ean) {
    await updateProductImageFields(product.id, {
      image_status: 'needs_review',
      image_source: null,
      image_confidence: null,
      image_candidate_urls: [],
      image_ai_reason: 'EAN inválido ou ausente',
    });
    return { status: 'needs_review', reason: 'EAN inválido' };
  }

  // Marcar como fetching
  await updateProductImageFields(product.id, {
    image_status: 'fetching',
    image_source: null,
    image_confidence: null,
  });

  const candidates: string[] = [];

  // ──────────────────────────────────────────────────────────
  // ETAPA 1: Open Food Facts
  // ──────────────────────────────────────────────────────────
  const off = await fetchFromOpenFoodFacts(ean);
  if (off.imageUrl) {
    candidates.push(off.imageUrl);

    try {
      const { bytes, contentType, metadata } = await downloadAndValidateImage(off.imageUrl);

      if (ACCEPT_OFF_DIRECT) {
        const stored = await persistImageToSupabaseStorage(product.id, bytes, contentType);
        await updateProductImageFields(product.id, {
          image_url: stored.publicUrl,
          image_thumb_url: stored.thumbUrl,
          image_status: 'ok',
          image_source: 'openfoodfacts',
          image_confidence: 0.99,
          image_candidate_urls: candidates,
          image_width: metadata.width,
          image_height: metadata.height,
          image_bytes: metadata.bytes,
          image_mime: metadata.mime,
          image_ai_model: null,
          image_ai_prompt_version: null,
          image_ai_reason: 'Aceito direto do Open Food Facts',
        });
        return { status: 'ok', source: 'openfoodfacts', confidence: 0.99 };
      }

      // Validar com OpenAI
      const score = await scoreImageWithOpenAI(product, bytes, off.imageUrl);

      if (score.confidence >= DEFAULT_CONFIDENCE_THRESHOLD && score.match) {
        const stored = await persistImageToSupabaseStorage(product.id, bytes, contentType);
        await updateProductImageFields(product.id, {
          image_url: stored.publicUrl,
          image_thumb_url: stored.thumbUrl,
          image_status: 'ok',
          image_source: 'openfoodfacts',
          image_confidence: score.confidence,
          image_candidate_urls: candidates,
          image_width: metadata.width,
          image_height: metadata.height,
          image_bytes: metadata.bytes,
          image_mime: metadata.mime,
          image_ai_model: model,
          image_ai_prompt_version: PROMPT_VERSION,
          image_ai_reason: score.reason,
        });
        return { status: 'ok', source: 'openfoodfacts', confidence: score.confidence };
      }
    } catch (error: any) {
      console.warn('[ImagePipeline] OFF candidate failed', {
        productId: product.id,
        ean,
        error: error?.message || error,
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // ETAPA 2: Avaliar candidatos coletados
  // ──────────────────────────────────────────────────────────
  if (candidates.length > 0) {
    let best: {
      url: string;
      score: ImageScore;
      bytes: Buffer;
      contentType: string;
      metadata: ImageMetadata;
    } | null = null;

    for (const url of candidates.slice(0, 5)) {
      try {
        const { bytes, contentType, metadata } = await downloadAndValidateImage(url);
        const score = await scoreImageWithOpenAI(product, bytes, url);
        if (!best || score.confidence > best.score.confidence) {
          best = { url, score, bytes, contentType, metadata };
        }
      } catch (error: any) {
        console.warn('[ImagePipeline] Candidate failed', {
          productId: product.id,
          url,
          error: error?.message,
        });
      }
    }

    if (best && best.score.confidence >= DEFAULT_CONFIDENCE_THRESHOLD && best.score.match) {
      const stored = await persistImageToSupabaseStorage(product.id, best.bytes, best.contentType);
      await updateProductImageFields(product.id, {
        image_url: stored.publicUrl,
        image_thumb_url: stored.thumbUrl,
        image_status: 'ok',
        image_source: 'search_api',
        image_confidence: best.score.confidence,
        image_candidate_urls: candidates,
        image_width: best.metadata.width,
        image_height: best.metadata.height,
        image_bytes: best.metadata.bytes,
        image_mime: best.metadata.mime,
        image_ai_model: model,
        image_ai_prompt_version: PROMPT_VERSION,
        image_ai_reason: best.score.reason,
      });
      return { status: 'ok', source: 'search_api', confidence: best.score.confidence };
    }
  }

  // ──────────────────────────────────────────────────────────
  // ETAPA 3: Needs review
  // ──────────────────────────────────────────────────────────
  await updateProductImageFields(product.id, {
    image_status: 'needs_review',
    image_source: candidates.length > 0 ? 'search_api' : off.imageUrl ? 'openfoodfacts' : null,
    image_confidence: null,
    image_candidate_urls: candidates,
    image_ai_model: model,
    image_ai_prompt_version: PROMPT_VERSION,
    image_ai_reason: candidates.length ? 'Confiança baixa em todos os candidatos' : 'Nenhum candidato encontrado',
  });

  return {
    status: 'needs_review',
    candidates: candidates.length,
    reason: candidates.length ? 'low_confidence' : 'no_candidates',
  };
}

// ============================================================
// 11. GERAR QUERIES DE BUSCA COM OPENAI (para future use)
// ============================================================
export async function generateQueriesWithOpenAI(product: ProductImageRow): Promise<string[]> {
  const model = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';
  const prompt = [
    'Gere 3 queries curtas e específicas para buscar imagem do produto.',
    'Retorne JSON com array de strings.',
    `Nome: ${product.nome || 'N/A'}`,
    `Descrição: ${product.descricao || 'N/A'}`,
    `EAN: ${product.ean || 'N/A'}`,
    `SKU: ${product.sku || 'N/A'}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 150,
    messages: [
      { role: 'system', content: 'Responda apenas JSON válido, sem markdown.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const parsed = safeJsonParse<any>(raw, []);
  const queries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.queries)
      ? parsed.queries
      : [];

  return queries
    .filter((q: any) => typeof q === 'string')
    .map((q: string) => q.trim())
    .filter((q: string) => q.length > 2)
    .slice(0, 3);
}

// Placeholder para search API
export async function searchImages(_provider?: string, _query?: string): Promise<string[]> {
  return [];
}
