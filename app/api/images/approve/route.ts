import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';
import {
  downloadAndValidateImage,
  persistImageToSupabaseStorage,
} from '@/lib/images/pipeline';

/**
 * POST /api/images/approve
 *
 * Aprova uma imagem candidata por URL.
 * Baixa, valida, gera thumbnail e persiste no Storage.
 *
 * Body: { productId: string, imageUrl: string }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = body?.productId;
  const imageUrl = body?.imageUrl;

  if (!productId || !imageUrl) {
    return NextResponse.json(
      { error: 'productId e imageUrl são obrigatórios' },
      { status: 400 }
    );
  }

  try {
    // 1. Download e validação
    const { bytes, contentType, metadata } = await downloadAndValidateImage(imageUrl);

    // 2. Persist com thumbnail
    const stored = await persistImageToSupabaseStorage(productId, bytes, contentType);

    // 3. Atualizar produto
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('products')
      .update({
        image_url: stored.publicUrl,
        image_thumb_url: stored.thumbUrl,
        image_status: 'ok',
        image_source: 'manual',
        image_confidence: 1,
        image_width: metadata.width,
        image_height: metadata.height,
        image_bytes: metadata.bytes,
        image_mime: metadata.mime,
        image_updated_at: now,
        updated_at: now,
        image_ai_reason: `Aprovado manualmente por ${auth.userId}`,
      })
      .eq('id', productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. Marcar job como done (se existir)
    await supabaseAdmin
      .from('image_jobs')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .eq('product_id', productId)
      .in('status', ['queued', 'running', 'needs_review']);

    return NextResponse.json({
      success: true,
      imageUrl: stored.publicUrl,
      thumbUrl: stored.thumbUrl,
      metadata,
    });
  } catch (error: any) {
    console.error('[approve] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar imagem' },
      { status: 500 }
    );
  }
}
