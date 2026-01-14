import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type DbCompany = {
  id: string;
  active: boolean | null;
};

type DbUser = {
  id: string;
  role: string | null;
  active: boolean | null;
  display_name: string | null;
};

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

function generateStoreCode(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'LOJA';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
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
    .select('id, role, active, display_name')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as DbUser;
}

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    console.log('[API /lojas] Acesso negado - usu rio nÆo autenticado');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let query = supabaseAdmin.from('stores').select('*');

    if (auth.role !== 'super_admin' && auth.orgId) {
      query = query.eq('company_id', auth.orgId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const lojas = (data || []).map((row) => mapStore(row as DbStore));
    return NextResponse.json({ lojas });
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    return NextResponse.json({ error: 'Falha ao listar lojas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, companyId, managerId, address, city, state } = body;

    if (!name || !companyId) {
      return NextResponse.json({ error: 'Nome e Empresa sÆo obrigat¢rios' }, { status: 400 });
    }

    const companyOk = await ensureCompanyActive(companyId);
    if (!companyOk) {
      return NextResponse.json({ error: 'Empresa nÆo encontrada ou inativa' }, { status: 400 });
    }

    if (managerId) {
      const manager = await loadUser(managerId);
      if (!manager || manager.active === false || manager.role !== 'manager') {
        return NextResponse.json({ error: 'Gerente inv lido ou inativo' }, { status: 400 });
      }
      const { data: existingManager } = await supabaseAdmin
        .from('stores')
        .select('id, name')
        .eq('manager_id', managerId);
      if (existingManager && existingManager.length > 0) {
        return NextResponse.json({
          error: `Gerente "${manager.display_name || managerId}" j  est  vinculado a outra loja.`,
        }, { status: 400 });
      }
    }

    let code = generateStoreCode(name);
    let created: DbStore | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supabaseAdmin
        .from('stores')
        .insert({
          name,
          code,
          company_id: companyId,
          manager_id: managerId || null,
          agent_id: null,
          address: address || null,
          city: city || null,
          state: state || null,
          active: true,
        })
        .select()
        .single();

      if (!error && data) {
        created = data as DbStore;
        break;
      }

      lastError = error;
      if (error?.code === '23505') {
        code = generateStoreCode(name);
        continue;
      }

      break;
    }

    if (!created) {
      throw lastError || new Error('Falha ao criar loja');
    }

    return NextResponse.json({ loja: mapStore(created) }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar loja:', error);
    return NextResponse.json({ error: 'Falha ao criar loja' }, { status: 500 });
  }
}
