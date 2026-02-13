import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Busca o displayName do usuário
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', auth.userId)
    .single();

  const displayName = userData?.display_name || 'Usuário';

  // Atualiza last_seen na tabela users (para compatibilidade)
  const { error: usersError } = await supabaseAdmin
    .from('users')
    .update({ last_seen: now })
    .eq('id', auth.userId);

  if (usersError) {
    console.error('Erro ao atualizar last_seen em users:', usersError);
  }

  // Atualiza/insere na tabela presence (usado pelo mobile app para verificar status online)
  const { error: presenceError } = await supabaseAdmin
    .from('presence')
    .upsert({
      user_id: auth.userId,
      display_name: displayName,
      online: true,
      last_seen: now,
    }, {
      onConflict: 'user_id'
    });

  if (presenceError) {
    console.error('Erro ao atualizar presence:', presenceError);
    // Não falhar a requisição se a tabela presence não existir ou estiver indisponível.
    return NextResponse.json({ ok: true, warning: 'presence_update_failed' });
  }

  return NextResponse.json({ ok: true });
}
