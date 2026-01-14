import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type DbCompany = {
  id: string;
  name: string;
  cnpj: string | null;
  trading_name: string | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapCompany(row: DbCompany) {
  return {
    id: row.id,
    name: row.name,
    tradingName: row.trading_name || undefined,
    cnpj: row.cnpj || null,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  if (auth.role !== 'super_admin' && auth.orgId !== id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Empresa nÆo encontrada' }, { status: 404 });
    }

    return NextResponse.json({ empresa: mapCompany(data as DbCompany) });
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return NextResponse.json({ error: 'Falha ao buscar empresa' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
  }

  if (auth.role !== 'super_admin' && auth.orgId !== id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};

  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.cnpj === 'string') update.cnpj = body.cnpj;
  if (typeof body.tradingName === 'string') update.trading_name = body.tradingName;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo v lido para atualizar' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Falha ao atualizar empresa');
    }

    return NextResponse.json({ empresa: mapCompany(data as DbCompany) });
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    return NextResponse.json({ error: 'Falha ao atualizar empresa' }, { status: 500 });
  }
}
