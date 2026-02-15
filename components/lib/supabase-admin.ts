import { createClient } from '@supabase/supabase-js';

// URL e Service Key do Supabase (server-side only)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://kong:8000';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';

if (!supabaseServiceKey) {
  console.warn('??  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY not set - admin client will not work');
}

// Cliente Supabase Admin (bypassa Row Level Security)
// APENAS para uso server-side (API routes, server components)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Tipos de dados do banco
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'developer' | 'admin' | 'manager' | 'agent' | 'buyer';
  companyId: string | null;
  storeId: string | null;
  storeIds: string[];
  active: boolean;
  createdAt: string;
  lastSeen: string | null;
  isOnline?: boolean;
}

export interface Company {
  id: string;
  name: string;
  tradingName?: string;
  cnpj?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  companyId: string;
  managerId?: string | null;
  agentId?: string | null;
  address?: string;
  city?: string;
  state?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

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

type DbCompany = {
  id: string;
  name: string;
  cnpj: string | null;
  trading_name: string | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

type DbStore = {
  id: string;
  name: string;
  code: string;
  company_id: string;
  manager_id: string | null;
  agent_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
};

function mapUserRow(row: DbUser): User {
  const lastSeen = row.last_seen ?? null;
  const isOnline = lastSeen ? (Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000) : false;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email || 'Sem nome',
    role: row.role as User['role'],
    companyId: row.company_id,
    storeId: row.store_id,
    storeIds: Array.isArray(row.store_ids) ? row.store_ids : (row.store_id ? [row.store_id] : []),
    active: row.active !== false,
    createdAt: row.created_at,
    lastSeen,
    isOnline,
  };
}

function mapCompanyRow(row: DbCompany): Company {
  return {
    id: row.id,
    name: row.name,
    tradingName: row.trading_name ?? undefined,
    cnpj: row.cnpj ?? undefined,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStoreRow(row: DbStore): Store {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    companyId: row.company_id,
    managerId: row.manager_id ?? null,
    agentId: row.agent_id ?? null,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Helper Functions para opera‡äes comuns
 */

// ========================================
// USERS
// ========================================

export async function getAllUsers() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapUserRow);
}

export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return mapUserRow(data as DbUser);
}

export async function getUsersByCompany(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapUserRow);
}

export async function createUser(user: Partial<User>) {
  const payload = {
    id: user.id,
    email: user.email,
    display_name: user.displayName ?? null,
    role: user.role,
    company_id: user.companyId ?? null,
    store_id: user.storeId ?? null,
    store_ids: user.storeIds ?? (user.storeId ? [user.storeId] : []),
    active: user.active ?? true,
  };
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return mapUserRow(data as DbUser);
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const payload: Partial<DbUser> & { updated_at?: string } = {
    display_name: updates.displayName,
    role: updates.role,
    company_id: updates.companyId ?? undefined,
    store_id: updates.storeId ?? undefined,
    store_ids: updates.storeIds,
    active: typeof updates.active === 'boolean' ? updates.active : undefined,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapUserRow(data as DbUser);
}

export async function deleteUser(userId: string) {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) throw error;
}

// ========================================
// COMPANIES
// ========================================

export async function getAllCompanies() {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCompanyRow);
}

export async function getCompanyById(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) throw error;
  return mapCompanyRow(data as DbCompany);
}

export async function createCompany(company: Partial<Company>) {
  const payload = {
    id: company.id,
    name: company.name,
    trading_name: company.tradingName ?? null,
    cnpj: company.cnpj ?? null,
    active: company.active ?? true,
  };
  const { data, error } = await supabaseAdmin
    .from('companies')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return mapCompanyRow(data as DbCompany);
}

export async function updateCompany(companyId: string, updates: Partial<Company>) {
  const payload = {
    name: updates.name,
    trading_name: updates.tradingName ?? undefined,
    cnpj: updates.cnpj ?? undefined,
    active: typeof updates.active === 'boolean' ? updates.active : undefined,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from('companies')
    .update(payload)
    .eq('id', companyId)
    .select()
    .single();

  if (error) throw error;
  return mapCompanyRow(data as DbCompany);
}

// ========================================
// STORES
// ========================================

export async function getAllStores() {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapStoreRow);
}

export async function getStoresByCompany(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapStoreRow);
}

export async function getStoreById(storeId: string) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) throw error;
  return mapStoreRow(data as DbStore);
}

export async function createStore(store: Partial<Store>) {
  const payload = {
    id: store.id,
    name: store.name,
    code: store.code,
    company_id: store.companyId,
    manager_id: store.managerId ?? null,
    agent_id: store.agentId ?? null,
    address: store.address ?? null,
    city: store.city ?? null,
    state: store.state ?? null,
    active: store.active ?? true,
  };
  const { data, error } = await supabaseAdmin
    .from('stores')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return mapStoreRow(data as DbStore);
}

export async function updateStore(storeId: string, updates: Partial<Store>) {
  const payload = {
    name: updates.name,
    code: updates.code,
    company_id: updates.companyId,
    manager_id: updates.managerId ?? undefined,
    agent_id: updates.agentId ?? undefined,
    address: updates.address ?? undefined,
    city: updates.city ?? undefined,
    state: updates.state ?? undefined,
    active: typeof updates.active === 'boolean' ? updates.active : undefined,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from('stores')
    .update(payload)
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw error;
  return mapStoreRow(data as DbStore);
}

/**
 * Helper para verificar JWT token do usu rio
 */
export async function verifyToken(token: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error) throw error;
  return user;
}

export default supabaseAdmin;
