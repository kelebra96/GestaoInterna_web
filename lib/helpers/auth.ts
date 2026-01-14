// web/lib/helpers/auth.ts
import { Buffer } from 'buffer';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

const AuthPayloadSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  role: z.nativeEnum(Role),
  storeIds: z.array(z.string()).default([]),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

// Maps roles from Supabase/public.users to the Prisma Role enum
const roleMapping: Record<string, Role> = {
  super_admin: Role.super_admin,
  admin_rede: Role.admin_rede,
  gestor_loja: Role.gestor_loja,
  merchandiser: Role.merchandiser,
  repositor: Role.repositor,
  developer: Role.super_admin, // legacy role -> highest access
  admin: Role.admin_rede,
  manager: Role.gestor_loja,
  agent: Role.repositor,
  buyer: Role.merchandiser,
};

function mapRole(rawRole?: string | null): Role {
  if (!rawRole) return Role.repositor; // Role padrao mais restritiva
  const normalized = String(rawRole).toLowerCase();
  return roleMapping[normalized] || Role.repositor;
}

function decodeJwtWithoutVerification(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode bearer token:', error);
    return null;
  }
}

type UserProfileRow = {
  id: string;
  role: string | null;
  company_id: string | null;
  store_id: string | null;
  store_ids: string[] | null;
};

async function fetchUserProfile(userId: string): Promise<UserProfileRow | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, role, company_id, store_id, store_ids')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile from Supabase:', error);
      return null;
    }

    return data as UserProfileRow;
  } catch (error) {
    console.error('Error fetching user profile from Supabase:', error);
    return null;
  }
}

/**
 * Extracts and parses the user authentication payload from the request headers.
 */
export async function getAuthFromRequest(request: Request): Promise<AuthPayload | null> {
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!bearer) return null;

  const decodedFromBearer = decodeJwtWithoutVerification(bearer);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(bearer);
    if (error || !user) {
      console.error('Supabase auth validation failed:', error);
      return null;
    }

    const profile = await fetchUserProfile(user.id);

    const roleValue =
      profile?.role ||
      (user.user_metadata?.role as string | undefined) ||
      (user.app_metadata?.role as string | undefined) ||
      (decodedFromBearer?.['role'] as string | undefined);

    const orgIdValue =
      profile?.company_id ||
      (user.user_metadata?.companyId as string | undefined) ||
      (user.user_metadata?.company_id as string | undefined) ||
      (decodedFromBearer?.['orgId'] as string | undefined) ||
      (decodedFromBearer?.['companyId'] as string | undefined) ||
      (decodedFromBearer?.['company_id'] as string | undefined);

    let storeIdsValue: string[] = [];
    if (Array.isArray(profile?.store_ids) && profile?.store_ids.length > 0) {
      storeIdsValue = profile.store_ids;
    } else if (profile?.store_id) {
      storeIdsValue = [profile.store_id];
    } else if (Array.isArray(user.user_metadata?.storeIds)) {
      storeIdsValue = (user.user_metadata?.storeIds as string[]).filter(Boolean);
    } else if (user.user_metadata?.storeId) {
      storeIdsValue = [String(user.user_metadata?.storeId)];
    }

    const payload = {
      userId: user.id,
      orgId: orgIdValue || 'unknown-org',
      role: mapRole(roleValue),
      storeIds: storeIdsValue,
      iat: decodedFromBearer?.['iat'] as number | undefined,
      exp: decodedFromBearer?.['exp'] as number | undefined,
    };

    const validation = AuthPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.error('Auth payload validation failed:', validation.error);
      return null;
    }

    return validation.data;
  } catch (error) {
    console.error('Failed to validate auth payload:', error);
    return null;
  }
}
