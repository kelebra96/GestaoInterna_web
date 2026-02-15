import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const updateStoreSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  address: z.string().min(5, 'Address is required').optional(),
  city: z.string().min(2, 'City is required').optional(),
  region: z.string().min(2, 'Region is required').optional(),
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

async function fetchStore(id: string) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as DbStore;
}

async function checkAccess(auth: any, storeId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;
  const store = await fetchStore(storeId);
  if (!store) return false;
  if (auth.role === 'admin_rede' && store.company_id === auth.orgId) return true;
  if (auth.role === 'gestor_loja' && auth.storeIds?.includes(storeId) && store.company_id === auth.orgId) return true;
  return false;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const store = await fetchStore(id);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store: mapStore(store) });
  } catch (error) {
    console.error(`Error fetching store ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = updateStoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const update = {
      name: validation.data.name,
      code: validation.data.code,
      address: validation.data.address,
      city: validation.data.city,
      state: validation.data.region,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('stores')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update store');
    }

    return NextResponse.json({ store: mapStore(data as DbStore) });
  } catch (error) {
    console.error(`Error updating store ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting store ${id}:`, error);
    return NextResponse.json({ error: 'Failed to delete store. Ensure it has no associated products or planograms.' }, { status: 409 });
  }
}
