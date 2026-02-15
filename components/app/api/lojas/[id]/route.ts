import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type DbStore = {
  id: string;
  name: string;
  code: string;
  company_id: string | null;
  manager_id: string | null;
  agent_id: string | null;
  active: boolean | null;
  created_at: string;
  address: string | null;
  city: string | null;
  state: string | null;
};

type DbCompany = {
  id: string;
  active: boolean | null;
};

type DbUser = {
  id: string;
  role: string | null;
  active: boolean | null;
};

function mapStore(row: DbStore) {
  return {
    id: row.id,
    name: row.name || 'Sem nome',
    code: row.code,
    companyId: row.company_id || null,
    managerId: row.manager_id || null,
    agentId: row.agent_id || null,
    active: row.active !== false,
    createdAt: row.created_at,
    city: row.city || undefined,
    address: row.address || undefined,
    state: row.state || undefined,
  };
}

async function fetchStore(id: string) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as DbStore;
}

async function ensureCompanyActive(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, active')
    .eq('id', companyId)
    .single();
  if (error || !data) return false;
  const company = data as DbCompany;
  return company.active !== false;
}

async function loadUser(userId: string): Promise<DbUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, role, active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as DbUser;
}

async function checkAccess(auth: any, storeId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;
  const store = await fetchStore(storeId);
  if (!store) return false;
  return !!auth.orgId && store.company_id === auth.orgId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthFromRequest(request);
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const store = await fetchStore(id);
    if (!store) {
      return NextResponse.json({ error: 'Loja nÆo encontrada' }, { status: 404 });
    }
    return NextResponse.json({ loja: mapStore(store) });
  } catch (error) {
    console.error('Erro ao buscar loja:', error);
    return NextResponse.json({ error: 'Falha ao buscar loja' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthFromRequest(req);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};

  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.city === 'string') update.city = body.city;
  if (typeof body.address === 'string') update.address = body.address;
  if (typeof body.state === 'string') update.state = body.state;
  if (typeof body.companyId === 'string') update.company_id = body.companyId;
  if (typeof body.managerId === 'string') {
    const trimmed = body.managerId.trim();
    update.manager_id = trimmed.length > 0 ? trimmed : null;
  }
  if (typeof body.agentId === 'string') {
    const trimmed = body.agentId.trim();
    update.agent_id = trimmed.length > 0 ? trimmed : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo v lido para atualizar' }, { status: 400 });
  }

  try {
    if (update.company_id) {
      const companyOk = await ensureCompanyActive(update.company_id);
      if (!companyOk) {
        return NextResponse.json({ error: 'Empresa nÆo encontrada ou inativa' }, { status: 400 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(update, 'manager_id')) {
      if (update.manager_id === null) {
        // ok limpar
      } else {
        const manager = await loadUser(update.manager_id);
        const allowedRoles = new Set(['manager', 'admin', 'developer', 'agent']);
        if (!manager || manager.active === false || !allowedRoles.has(manager.role || '')) {
          return NextResponse.json({ error: 'Gerente inv lido ou inativo (permitido: manager/admin/developer/agent)' }, { status: 400 });
        }
        const { data: existingManagerStore } = await supabaseAdmin
          .from('stores')
          .select('id')
          .eq('manager_id', update.manager_id)
          .neq('id', id);
        if (existingManagerStore && existingManagerStore.length > 0) {
          return NextResponse.json({ error: 'Gerente j  vinculado a outra loja' }, { status: 400 });
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(update, 'agent_id')) {
      if (update.agent_id === null) {
        // ok limpar
      } else {
        const agent = await loadUser(update.agent_id);
        if (!agent || agent.active === false || agent.role !== 'agent') {
          return NextResponse.json({ error: 'Agente inv lido ou inativo' }, { status: 400 });
        }
        const { data: existingAgentStore } = await supabaseAdmin
          .from('stores')
          .select('id')
          .eq('agent_id', update.agent_id)
          .neq('id', id);
        if (existingAgentStore && existingAgentStore.length > 0) {
          return NextResponse.json({ error: 'Agente j  vinculado a outra loja' }, { status: 400 });
        }
      }
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('stores')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Falha ao atualizar loja');
    }

    return NextResponse.json({ loja: mapStore(data as DbStore) });
  } catch (error) {
    console.error('Erro ao atualizar loja:', error);
    return NextResponse.json({ error: 'Falha ao atualizar loja' }, { status: 500 });
  }
}
