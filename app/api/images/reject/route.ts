import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

/**
 * POST /api/images/reject
 *
 * Rejeita um produto do fluxo de imagens.
 * Marca como 'error' para não ser processado novamente.
 *
 * Body: { productId: string, reason?: string }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = body?.productId;
  const reason = body?.reason || 'Rejeitado manualmente';

  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Atualizar produto
    const { error } = await supabaseAdmin
      .from('products')
      .update({
        image_status: 'error',
        image_source: 'manual',
        image_confidence: null,
        image_candidate_urls: [],
        image_updated_at: now,
        updated_at: now,
        image_ai_reason: `${reason} por ${auth.userId}`,
      })
      .eq('id', productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Marcar job como failed
    await supabaseAdmin
      .from('image_jobs')
      .update({
        status: 'failed',
        last_error: reason,
        completed_at: now,
        updated_at: now,
      })
      .eq('product_id', productId)
      .in('status', ['queued', 'running', 'needs_review']);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[reject] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao rejeitar' },
      { status: 500 }
    );
  }
}
