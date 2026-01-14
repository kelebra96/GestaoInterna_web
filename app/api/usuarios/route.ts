import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const allowedAdminRoles = new Set(['super_admin', 'admin_rede']);

const userSchema = z.object({
  displayName: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inv lido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['developer', 'admin', 'manager', 'agent', 'buyer']),
  companyId: z.string().optional(),
  storeId: z.string().optional(),
});

type DbUser = {
  id: string;
  display_name: string | null;
  email: string;
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

export async function POST(req: NextRequest) {
  try {
    const requester = await getAuthFromRequest(req);
    if (!requester || !allowedAdminRoles.has(requester.role)) {
      return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const validation = userSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { displayName, email, password, role, companyId, storeId } = validation.data;

    const isSuperAdmin = requester.role === 'super_admin';
    const resolvedCompanyId = isSuperAdmin ? (companyId || null) : requester.orgId;
    if (!resolvedCompanyId && !isSuperAdmin) {
      return NextResponse.json({ error: 'Empresa obrigat¢ria para criar usu rio' }, { status: 400 });
    }

    if ((role === 'manager' || role === 'agent') && !storeId) {
      return NextResponse.json({ error: 'storeId ‚ obrigat¢rio para perfis Manager/Agent' }, { status: 400 });
    }
    if (!isSuperAdmin && (role === 'developer' || role === 'admin')) {
      return NextResponse.json({ error: 'Somente super admin pode criar usu rios admin/developer' }, { status: 403 });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado no sistema.' }, { status: 409 });
    }

    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
      app_metadata: { role },
    });

    if (createAuthError || !createdAuth.user) {
      return NextResponse.json({ error: createAuthError?.message || 'Falha ao criar usu rio' }, { status: 500 });
    }

    const storeIds = storeId ? [storeId] : [];

    const { data: createdProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: createdAuth.user.id,
        email,
        display_name: displayName,
        role,
        company_id: resolvedCompanyId,
        store_id: storeId || null,
        store_ids: storeIds,
        active: true,
      })
      .select()
      .single();

    if (profileError || !createdProfile) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return NextResponse.json({ error: profileError?.message || 'Falha ao criar usu rio' }, { status: 500 });
    }

    return NextResponse.json({ usuario: mapUser(createdProfile as DbUser) }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar usu rio:', error);
    return NextResponse.json({ error: error.message || 'Falha ao criar usu rio' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const requester = await getAuthFromRequest(req);
    if (!requester || !allowedAdminRoles.has(requester.role)) {
      return NextResponse.json({ error: 'NÆo autorizado' }, { status: 401 });
    }

    let query = supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (requester.role !== 'super_admin' && requester.orgId) {
      query = query.eq('company_id', requester.orgId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const usuarios = (data || []).map((row) => mapUser(row as DbUser));

    return NextResponse.json({ usuarios });
  } catch (error) {
    console.error('Erro ao listar usu rios:', error);
    return NextResponse.json({ error: 'Falha ao listar usu rios' }, { status: 500 });
  }
}
