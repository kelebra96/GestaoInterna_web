import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const storeSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  region: z.string().min(2, 'Region is required'),
  orgId: z.string().optional(),
});

type DbStore = {
  id: string;
  name: string;
  code: string;
  company_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapStore(row: DbStore) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    orgId: row.company_id,
    address: row.address,
    city: row.city,
    region: row.state,
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
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    let query = supabaseAdmin.from('stores').select('*');

    if (auth.role === 'super_admin') {
      if (orgId) {
        query = query.eq('company_id', orgId);
      }
    } else {
      query = query.eq('company_id', auth.orgId);
      if (auth.role === 'gestor_loja' && auth.storeIds && auth.storeIds.length > 0) {
        query = query.in('id', auth.storeIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const stores = (data || []).map((row) => mapStore(row as DbStore));
    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = storeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    let { orgId, region, ...storeData } = validation.data;

    if (auth.role === 'super_admin') {
      if (!orgId) {
        return NextResponse.json({ error: 'orgId is required for super_admin' }, { status: 400 });
      }
    } else {
      orgId = auth.orgId;
    }

    const { data: existing } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('code', storeData.code)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'A store with this code already exists in this organization' }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('stores')
      .insert({
        name: storeData.name,
        code: storeData.code,
        company_id: orgId,
        address: storeData.address,
        city: storeData.city,
        state: region,
        active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create store');
    }

    return NextResponse.json({ store: mapStore(data as DbStore) }, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
