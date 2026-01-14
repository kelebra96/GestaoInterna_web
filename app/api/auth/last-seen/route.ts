import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', auth.userId);

  if (error) {
    console.error('Erro ao atualizar last_seen:', error);
    return NextResponse.json({ error: 'Falha ao atualizar presen‡a' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
