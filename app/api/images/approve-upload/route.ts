import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';
import sharp from 'sharp';

const IMAGE_BUCKET = 'product-images';
const THUMB_SIZE = 256;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/images/approve-upload
 *
 * Upload direto de arquivo de imagem.
 * Valida, gera thumbnail e persiste.
 *
 * FormData: { file: File, productId: string }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const productId = formData.get('productId') as string | null;

  if (!file || !productId) {
    return NextResponse.json(
      { error: 'file e productId são obrigatórios' },
      { status: 400 }
    );
  }

  const contentType = file.type || 'image/jpeg';

  // Validar MIME type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Tipo de arquivo não permitido: ${contentType}` },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Validar tamanho
  if (bytes.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo excede limite de ${MAX_IMAGE_BYTES / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  try {
    // Validar dimensões com sharp
    const sharpImage = sharp(bytes);
    const metadata = await sharpImage.metadata();

    if (!metadata.width || !metadata.height) {
      return NextResponse.json(
        { error: 'Não foi possível ler dimensões da imagem' },
        { status: 400 }
      );
    }

    if (metadata.width < 100 || metadata.height < 100) {
      return NextResponse.json(
        { error: `Imagem muito pequena: ${metadata.width}x${metadata.height} (mínimo: 100x100)` },
        { status: 400 }
      );
    }

    // Upload main
    const ext = contentType.split('/')[1] || 'jpg';
    const mainPath = `products/${productId}/main.${ext}`;
    const thumbPath = `products/${productId}/thumb.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(mainPath, bytes, { contentType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Gerar e upload thumbnail
    const thumbBytes = await sharp(bytes)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const { error: thumbError } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(thumbPath, thumbBytes, { contentType: 'image/jpeg', upsert: true });

    if (thumbError) {
      console.warn('[approve-upload] Falha ao salvar thumbnail:', thumbError);
    }

    // URLs públicas
    const { data: mainData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(mainPath);
    const { data: thumbData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(thumbPath);

    // Atualizar produto
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        image_url: mainData.publicUrl,
        image_thumb_url: thumbData.publicUrl,
        image_status: 'ok',
        image_source: 'manual',
        image_confidence: 1,
        image_width: metadata.width,
        image_height: metadata.height,
        image_bytes: bytes.length,
        image_mime: contentType,
        image_updated_at: now,
        updated_at: now,
        image_ai_reason: `Upload manual por ${auth.userId}`,
      })
      .eq('id', productId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Marcar job como done
    await supabaseAdmin
      .from('image_jobs')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .eq('product_id', productId)
      .in('status', ['queued', 'running', 'needs_review']);

    return NextResponse.json({
      success: true,
      imageUrl: mainData.publicUrl,
      thumbUrl: thumbData.publicUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        bytes: bytes.length,
        mime: contentType,
      },
    });
  } catch (error: any) {
    console.error('[approve-upload] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar imagem' },
      { status: 500 }
    );
  }
}
