import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  const allowedRoles: Role[] = [Role.super_admin, Role.admin_rede];
  if (!auth || !allowedRoles.includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const productId = formData.get('productId') as string | null;

  if (!file || !productId) {
    return NextResponse.json({ error: 'file e productId são obrigatórios' }, { status: 400 });
  }

  const contentType = file.type || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Arquivo inválido (não é imagem)' }, { status: 400 });
  }

  const ext = contentType.split('/')[1] || 'jpg';
  const path = `products/${productId}/main.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from('product-images')
    .upload(path, bytes, { contentType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path);
  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('produtos')
    .update({
      image_url: data.publicUrl,
      image_status: 'ok',
      image_source: 'manual',
      image_confidence: 1,
      image_updated_at: now,
      updated_at: now,
    })
    .eq('id', productId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, imageUrl: data.publicUrl });
}
