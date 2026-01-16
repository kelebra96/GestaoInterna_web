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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ error: 'Company id is required' }, { status: 400 });
  }

  if (auth.role !== 'super_admin' && auth.orgId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company: mapCompany(data as DbCompany) });
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 });
  }
}
