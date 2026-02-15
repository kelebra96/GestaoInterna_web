import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';
import { persistImageToSupabaseStorage } from '@/lib/images/pipeline';

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

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  const allowedRoles: Role[] = [Role.super_admin, Role.admin_rede];
  if (!auth || !allowedRoles.includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = body?.productId;
  const imageUrl = body?.imageUrl;

  if (!productId || !imageUrl) {
    return NextResponse.json({ error: 'productId e imageUrl são obrigatórios' }, { status: 400 });
  }

  const { bytes, contentType } = await downloadImageBytes(imageUrl);
  const stored = await persistImageToSupabaseStorage(productId, bytes, contentType);

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('produtos')
    .update({
      image_url: stored.publicUrl,
      image_status: 'ok',
      image_source: 'manual',
      image_confidence: 1,
      image_updated_at: now,
      updated_at: now,
    })
    .eq('id', productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, imageUrl: stored.publicUrl });
}
