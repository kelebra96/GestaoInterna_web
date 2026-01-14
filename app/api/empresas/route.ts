import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const companySchema = z.object({
  name: z.string().min(3, 'O nome da empresa deve ter pelo menos 3 caracteres'),
  cnpj: z.string().optional(),
  tradingName: z.string().optional(),
});

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

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
  }

  let query = supabaseAdmin.from('companies').select('*').order('name', { ascending: true });
  if (auth.role !== 'super_admin' && auth.orgId) {
    query = query.eq('id', auth.orgId);
  }

  try {
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const empresas = (data || []).map((row) => mapCompany(row as DbCompany));
    return NextResponse.json({ empresas });
  } catch (error) {
    console.error('Erro ao listar empresas:', error);
    return NextResponse.json({ error: 'Falha ao listar empresas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const validation = companySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, cnpj, tradingName } = validation.data;

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

    return NextResponse.json({ empresa: mapCompany(data as DbCompany) }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    return NextResponse.json({ error: 'Falha ao criar empresa' }, { status: 500 });
  }
}
