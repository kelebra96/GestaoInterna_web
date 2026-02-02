import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || ![Role.super_admin, Role.admin_rede].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = body?.productId;

  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('produtos')
    .update({
      image_status: 'error',
      image_source: 'manual',
      image_confidence: null,
      image_candidate_urls: [],
      image_updated_at: now,
      updated_at: now,
    })
    .eq('id', productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
