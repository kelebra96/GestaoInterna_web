import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const allowedAdminRoles = new Set(['super_admin', 'admin_rede']);

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
  last_seen: string | null;
};

function mapUser(row: DbUser) {
  const lastSeen = row.last_seen ?? null;
  const isOnline = lastSeen ? (Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000) : false;
  return {
    id: row.id,
    displayName: row.display_name || row.email || 'Sem nome',
    email: row.email,
    role: row.role,
    storeId: row.store_id || null,
    storeIds: Array.isArray(row.store_ids) ? row.store_ids : (row.store_id ? [row.store_id] : []),
    companyId: row.company_id || null,
    active: row.active !== false,
    createdAt: row.created_at,
    lastSeen,
    isOnline,
  };
}

async function fetchUserRow(id: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as DbUser;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
  }

  const row = await fetchUserRow(id);
  if (!row) {
    return NextResponse.json({ error: 'Usu rio nÆo encontrado' }, { status: 404 });
  }

  const isSelf = auth.userId === id;
  const isAdmin = allowedAdminRoles.has(auth.role);
  const sameCompany = auth.orgId && row.company_id && auth.orgId === row.company_id;

  if (!isSelf && !(auth.role === 'super_admin' || (isAdmin && sameCompany))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  return NextResponse.json({ usuario: mapUser(row) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requester = await getAuthFromRequest(req);
  if (!requester || !allowedAdminRoles.has(requester.role)) {
    return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};

  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.role === 'string') update.role = body.role;
  if (typeof body.storeId === 'string' || body.storeId === null) update.store_id = body.storeId;
  if (typeof body.companyId === 'string' || body.companyId === null) update.company_id = body.companyId;
  if (Array.isArray(body.storeIds)) {
    const filtered = body.storeIds.filter((s: any) => typeof s === 'string');
    update.store_ids = filtered;
    if (!Object.prototype.hasOwnProperty.call(update, 'store_id')) {
      update.store_id = filtered.length > 0 ? filtered[0] : null;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo v lido para atualizar' }, { status: 400 });
  }

  try {
    const current = await fetchUserRow(id);
    if (!current) {
      return NextResponse.json({ error: 'Usu rio nÆo encontrado' }, { status: 404 });
    }

    if (requester.role !== 'super_admin') {
      const currentCompany = current.company_id || null;
      if (currentCompany && requester.orgId && currentCompany !== requester.orgId) {
        return NextResponse.json({ error: 'Acesso negado a este usu rio' }, { status: 403 });
      }
      if (Object.prototype.hasOwnProperty.call(update, 'company_id') && update.company_id && requester.orgId && update.company_id !== requester.orgId) {
        return NextResponse.json({ error: 'NÆo ‚ permitido alterar empresa para fora do seu escopo' }, { status: 403 });
      }
      if (Object.prototype.hasOwnProperty.call(update, 'role') && (update.role === 'developer' || update.role === 'admin')) {
        return NextResponse.json({ error: 'Perfil nÆo permitido' }, { status: 403 });
      }
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Falha ao atualizar usu rio');
    }

    if (Object.prototype.hasOwnProperty.call(update, 'role')) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        app_metadata: { role: update.role },
      });
    }

    return NextResponse.json({ usuario: mapUser(data as DbUser) });
  } catch (error) {
    console.error('Erro ao atualizar usu rio:', error);
    return NextResponse.json({ error: 'Falha ao atualizar usu rio' }, { status: 500 });
  }
}
