import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { fetchProductsNeedingImages, enqueueMultipleJobs } from '@/lib/images/pipeline';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/images/backfill
 *
 * APENAS ENFILEIRA jobs para processamento posterior pelo worker.
 * Retorna rápido sem processar imagens.
 *
 * Query params:
 *   - limit: número máximo de produtos para enfileirar (default: 50, max: 500)
 *   - cursor: UUID para paginação
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 500);
  const cursor = searchParams.get('cursor') || undefined;

  try {
    // 1. Busca produtos sem imagem
    const products = await fetchProductsNeedingImages(limit, cursor);

    if (products.length === 0) {
      return NextResponse.json({
        enqueued: 0,
        message: 'Nenhum produto pendente encontrado',
        nextCursor: null,
      });
    }

    // 2. Enfileira jobs (idempotente)
    const productIds = products.map((p) => p.id);
    const enqueued = await enqueueMultipleJobs(productIds);

    // 3. Cursor para próxima página
    const lastId = products[products.length - 1]?.id || null;

    return NextResponse.json({
      enqueued,
      total: products.length,
      nextCursor: lastId,
      message: `${enqueued} jobs enfileirados. Execute o worker para processar.`,
    });
  } catch (error: any) {
    console.error('[backfill] Erro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

/**
 * GET /api/images/backfill
 *
 * Atalho para desenvolvimento - mesma lógica do POST.
 */
export async function GET(request: Request) {
  const devBypass = process.env.NODE_ENV !== 'production';
  if (!devBypass) {
    return NextResponse.json({ error: 'Use POST em produção' }, { status: 405 });
  }

  // Em dev, simula auth de admin
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 500);
  const cursor = searchParams.get('cursor') || undefined;

  try {
    const products = await fetchProductsNeedingImages(limit, cursor);

    if (products.length === 0) {
      return NextResponse.json({
        enqueued: 0,
        message: 'Nenhum produto pendente encontrado',
        nextCursor: null,
      });
    }

    const productIds = products.map((p) => p.id);
    const enqueued = await enqueueMultipleJobs(productIds);
    const lastId = products[products.length - 1]?.id || null;

    return NextResponse.json({
      enqueued,
      total: products.length,
      nextCursor: lastId,
      message: `${enqueued} jobs enfileirados (dev mode).`,
    });
  } catch (error: any) {
    console.error('[backfill] Erro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
