import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let query = supabaseAdmin.from('companies').select('*');
    if (auth.role !== 'super_admin' && auth.orgId) {
      query = query.eq('id', auth.orgId);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const companies = (data || []).map((row) => mapCompany(row as DbCompany));
    return NextResponse.json({ companies });
  } catch (error) {
    console.error('Erro ao listar empresas:', error);
    return NextResponse.json({ error: 'Falha ao listar empresas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name, cnpj, tradingName } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome da empresa ‚ obrigat¢rio' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        cnpj: cnpj || null,
        trading_name: tradingName || null,
        active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Falha ao criar empresa');
    }

    return NextResponse.json({ company: mapCompany(data as DbCompany) }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    return NextResponse.json({ error: 'Falha ao criar empresa' }, { status: 500 });
  }
}
