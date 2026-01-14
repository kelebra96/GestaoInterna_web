import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type DbUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  company_id: string | null;
  store_id: string | null;
  store_ids: string[] | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', auth.userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  const row = data as DbUser;
  return NextResponse.json({
    user: {
      uid: row.id,
      displayName: row.display_name || row.email || 'Sem nome',
      email: row.email,
      role: row.role,
      storeId: row.store_id || undefined,
      companyId: row.company_id || undefined,
      active: row.active !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}
