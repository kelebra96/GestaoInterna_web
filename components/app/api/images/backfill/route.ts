import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { processProductImage, ProductImageRow } from '@/lib/images/pipeline';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

type JobSummary = {
  processed: number;
  ok: number;
  needs_review: number;
  error: number;
  failures: { productId: string; reason: string }[];
};

const MAX_CONCURRENCY = 5;

async function ensureJob(productId: string) {
  const { data: existing } = await supabaseAdmin
    .from('image_jobs')
    .select('id, status')
    .eq('product_id', productId)
    .in('status', ['queued', 'running'])
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabaseAdmin
    .from('image_jobs')
    .insert({ product_id: productId, status: 'queued', attempts: 0 })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function updateJob(jobId: string, updates: Record<string, any>) {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { error } = await supabaseAdmin.from('image_jobs').update(payload).eq('id', jobId);
  if (error) throw error;
}

async function handleBackfill(request: Request, skipAuth = false) {
  if (!skipAuth) {
    const auth = await getAuthFromRequest(request);
    const allowedRoles: Role[] = [Role.super_admin, Role.admin_rede];
    if (!auth || !allowedRoles.includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const cursor = searchParams.get('cursor');

  let query = supabaseAdmin
    .from('produtos')
    .select('id, nome, descricao, ean, sku, image_url, image_status, image_source, image_confidence, image_candidate_urls')
    .not('ean', 'is', null)
    .or('image_status.is.null,image_status.eq.missing,image_status.eq.error')
    .is('image_url', null)
    .order('id', { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt('id', cursor);
  }

  const { data: products, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = (products || []) as ProductImageRow[];
  const summary: JobSummary = { processed: 0, ok: 0, needs_review: 0, error: 0, failures: [] };

  const worker = async () => {
    while (queue.length > 0) {
      const product = queue.shift();
      if (!product) break;

      const jobId = await ensureJob(product.id);
      const { data: job } = await supabaseAdmin.from('image_jobs').select('attempts').eq('id', jobId).single();
      const attempts = (job?.attempts || 0) + 1;
      await updateJob(jobId, { status: 'running', attempts });

      try {
        const result = await processProductImage(product);
        summary.processed += 1;
        if (result.status === 'ok') summary.ok += 1;
        else if (result.status === 'needs_review') summary.needs_review += 1;
        else summary.error += 1;
        if (result.status !== 'ok') {
          summary.failures.push({ productId: product.id, reason: (result as any).reason || 'unknown' });
        }
        await updateJob(jobId, { status: result.status === 'ok' ? 'done' : result.status, last_error: (result as any).reason || null });
      } catch (err: any) {
        summary.processed += 1;
        summary.error += 1;
        summary.failures.push({ productId: product.id, reason: err?.message || 'Erro desconhecido' });
        await updateJob(jobId, { status: 'failed', last_error: err?.message || 'Erro desconhecido' });
      }
    }
  };

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length || 1) }, () => worker());
  await Promise.all(workers);

  const lastId = products && products.length > 0 ? products[products.length - 1].id : null;
  return NextResponse.json({ ...summary, nextCursor: lastId });
}

// POST - padrão
export async function POST(request: Request) {
  return handleBackfill(request);
}

// GET - atalho de desenvolvimento (evita 405 no browser)
export async function GET(request: Request) {
  const devBypass = process.env.NODE_ENV !== 'production';
  return handleBackfill(request, devBypass);
}
