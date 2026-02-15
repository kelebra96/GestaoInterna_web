import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

const bootstrapSchema = z.object({
  displayName: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha muito curta'),
});

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
    lastSeen: row.last_seen ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const validation = bootstrapSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { displayName, email, password } = validation.data;

    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: 'Usuarios ja cadastrados. Use o login ou a criacao via admin.' },
        { status: 409 }
      );
    }

    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
      app_metadata: { role: 'developer' },
    });

    if (createAuthError || !createdAuth.user) {
      return NextResponse.json(
        { error: createAuthError?.message || 'Falha ao criar usuario' },
        { status: 500 }
      );
    }

    const { data: createdProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: createdAuth.user.id,
        email,
        display_name: displayName,
        role: 'developer',
        company_id: null,
        store_id: null,
        store_ids: [],
        active: true,
      })
      .select()
      .single();

    if (profileError || !createdProfile) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return NextResponse.json(
        { error: profileError?.message || 'Falha ao criar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ usuario: mapUser(createdProfile as DbUser) }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar usuario inicial:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao criar usuario inicial' },
      { status: 500 }
    );
  }
}
