import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v0/product';
const IMAGE_BUCKET = 'product-images';
const DEFAULT_CONFIDENCE_THRESHOLD = Number(process.env.IMAGE_CONFIDENCE_THRESHOLD || 0.65);
const ACCEPT_OFF_DIRECT = process.env.IMAGE_ACCEPT_OFF_DIRECT === 'true';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

type ImageScore = {
  match: boolean;
  confidence: number;
  reason?: string;
};

type OffCandidate = {
  imageUrl: string | null;
  raw?: any;
};

const normalizeEan = (ean?: string | null) => (ean || '').replace(/\D/g, '');

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export async function fetchFromOpenFoodFacts(ean: string): Promise<OffCandidate> {
  if (!ean) return { imageUrl: null };
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
}

async function downloadImageBytes(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao baixar imagem: ${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Conteúdo inválido (content-type: ${contentType})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, contentType };
}

export async function scoreImageWithOpenAI(product: ProductImageRow, imageBytes: Buffer): Promise<ImageScore> {
  const model = process.env.OPENAI_IMAGE_SCORE_MODEL || 'gpt-4o-mini';
  const imageBase64 = imageBytes.toString('base64');
  const prompt = [
    'Você é um assistente que valida se a imagem corresponde a um produto.',
    'Retorne JSON puro com: match (boolean), confidence (0..1), reason (string curta).',
    'Dados do produto:',
    `Nome: ${product.nome || 'N/A'}`,
    `Descrição: ${product.descricao || 'N/A'}`,
    `EAN: ${product.ean || 'N/A'}`,
    `SKU: ${product.sku || 'N/A'}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: 'Responda apenas JSON válido, sem markdown.' },
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
  return {
    match: Boolean(parsed.match),
    confidence: Number(parsed.confidence || 0),
    reason: parsed.reason || '',
  };
}

export async function generateQueriesWithOpenAI(product: ProductImageRow): Promise<string[]> {
  const model = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';
  const prompt = [
    'Gere 3 queries curtas para buscar imagem do produto.',
    'Retorne JSON com array de strings.',
    `Nome: ${product.nome || 'N/A'}`,
    `Descrição: ${product.descricao || 'N/A'}`,
    `EAN: ${product.ean || 'N/A'}`,
    `SKU: ${product.sku || 'N/A'}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Responda apenas JSON válido, sem markdown.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const parsed = safeJsonParse<any>(raw, []);
  const queries: string[] = Array.isArray(parsed)
    ? parsed.filter((q: unknown): q is string => typeof q === 'string')
    : Array.isArray(parsed?.queries)
      ? parsed.queries.filter((q: unknown): q is string => typeof q === 'string')
      : typeof parsed === 'string'
        ? [parsed]
        : [];
  return queries
    .map((q) => q.trim())
    .filter((q) => q.length > 2)
    .slice(0, 3);
}

export async function searchImages() {
  return [];
}

export async function persistImageToSupabaseStorage(productId: string, bytes: Buffer, contentType: string) {
  const ext = contentType.split('/')[1] || 'jpg';
  const path = `products/${productId}/main.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}

export async function updateProductImageFields(productId: string, updates: Record<string, any>) {
  const now = new Date().toISOString();
  const payload = { ...updates, image_updated_at: now, updated_at: now };

  const { error } = await supabaseAdmin
    .from('produtos')
    .update(payload)
    .eq('id', productId);

  if (error) throw error;
}

export async function processProductImage(product: ProductImageRow) {
  const ean = normalizeEan(product.ean);
  if (!ean) {
    await updateProductImageFields(product.id, {
      image_status: 'needs_review',
      image_source: null,
      image_confidence: null,
      image_candidate_urls: null,
    });
    return { status: 'needs_review', reason: 'EAN inválido' };
  }

  await updateProductImageFields(product.id, {
    image_status: 'fetching',
    image_source: null,
    image_confidence: null,
  });

  const candidates: string[] = [];

  // Etapa 1: Open Food Facts
  const off = await fetchFromOpenFoodFacts(ean);
  if (off.imageUrl) {
    candidates.push(off.imageUrl);
    try {
      const { bytes, contentType } = await downloadImageBytes(off.imageUrl);
      if (ACCEPT_OFF_DIRECT) {
        const stored = await persistImageToSupabaseStorage(product.id, bytes, contentType);
        await updateProductImageFields(product.id, {
          image_url: stored.publicUrl,
          image_status: 'ok',
          image_source: 'openfoodfacts',
          image_confidence: 0.99,
          image_candidate_urls: candidates,
        });
        return { status: 'ok', source: 'openfoodfacts', confidence: 0.99 };
      }
      const score = await scoreImageWithOpenAI(product, bytes);
      if (score.confidence >= DEFAULT_CONFIDENCE_THRESHOLD && score.match) {
        const stored = await persistImageToSupabaseStorage(product.id, bytes, contentType);
        await updateProductImageFields(product.id, {
          image_url: stored.publicUrl,
          image_status: 'ok',
          image_source: 'openfoodfacts',
          image_confidence: score.confidence,
          image_candidate_urls: candidates,
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

  const searchApiFailed = false;
  const searchApiError: string | null = null;

  if (candidates.length > 0) {
    let best: { url: string; score: ImageScore; bytes: Buffer; contentType: string } | null = null;

    for (const url of candidates.slice(0, 5)) {
      try {
        const { bytes, contentType } = await downloadImageBytes(url);
        const score = await scoreImageWithOpenAI(product, bytes);
        if (!best || score.confidence > best.score.confidence) {
          best = { url, score, bytes, contentType };
        }
      } catch (error: any) {
        console.warn('[ImagePipeline] Candidate download/score failed', {
          productId: product.id,
          url,
          error: error?.message || error,
        });
      }
    }

    if (best && best.score.confidence >= DEFAULT_CONFIDENCE_THRESHOLD && best.score.match) {
      const stored = await persistImageToSupabaseStorage(product.id, best.bytes, best.contentType);
      await updateProductImageFields(product.id, {
        image_url: stored.publicUrl,
        image_status: 'ok',
        image_source: 'search_api',
        image_confidence: best.score.confidence,
        image_candidate_urls: candidates,
      });
      return { status: 'ok', source: 'search_api', confidence: best.score.confidence };
    }
  }

  // Etapa 4: Needs review
  await updateProductImageFields(product.id, {
    image_status: 'needs_review',
    image_source: candidates.length > 0 ? 'search_api' : off.imageUrl ? 'openfoodfacts' : null,
    image_confidence: null,
    image_candidate_urls: candidates,
  });

  const reason = candidates.length ? 'low_confidence' : 'no_candidates';

  return { status: 'needs_review', candidates: candidates.length, reason };
}
