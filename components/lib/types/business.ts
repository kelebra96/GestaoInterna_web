/**
 * Tipos e Interfaces para Regras de Negócio v2.0
 * MyInventory - Sistema de Gestão de Solicitações
 * Migrado para Supabase - sem dependências Firebase
 */

// ============================================
// PERFIS DE USUÁRIO
// ============================================

export type UserRole = 'developer' | 'admin' | 'buyer' | 'agent' | 'manager';

export const USER_ROLES: Record<UserRole, { name: string; nameEn: string }> = {
  developer: { name: 'Desenvolvedor', nameEn: 'Developer' },
  admin: { name: 'Administrador', nameEn: 'Administrator' },
  buyer: { name: 'Comprador', nameEn: 'Buyer' },
  agent: { name: 'Agente', nameEn: 'Agent' },
  manager: { name: 'Gerente', nameEn: 'Manager' },
};

// ============================================
// INTERFACES
// ============================================

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  tradingName?: string;
  active: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface Store {
  id: string;
  name: string;
  companyId: string;
  managerId: string; // UID do gerente
  agentId: string; // UID do agente
  address?: string;
  city?: string;
  state?: string;
  active: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  storeId?: string; // Opcional para developer, admin, buyer
  companyId?: string; // Auto-preenchido pela loja
  active: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
  fcmToken?: string;
}

export interface Solicitacao {
  id?: string;
  storeId: string;
  companyId: string; // NOVO: obrigatório
  buyerId?: string;
  createdBy: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  status: 'pending' | 'batched' | 'closed';
  dayKey: string;
  itemCount?: number;
}

// ============================================
// ESCOPO DE DADOS
// ============================================

export type DataScope = 'global' | 'store';

export const DATA_SCOPE_BY_ROLE: Record<UserRole, DataScope> = {
  developer: 'global',
  admin: 'global',
  buyer: 'global',
  manager: 'store',
  agent: 'store',
};

// ============================================
// PERMISSÕES
// ============================================

export interface Permissions {
  canCreateSolicitacao: boolean;
  canManageSolicitacoes: boolean;
  canAccessDashboard: boolean;
  canManageUsers: boolean;
  canManageStores: boolean;
  canManageCompanies: boolean;
  dataScope: DataScope;
}

export const PERMISSIONS_BY_ROLE: Record<UserRole, Permissions> = {
  developer: {
    canCreateSolicitacao: true,
    canManageSolicitacoes: true,
    canAccessDashboard: true,
    canManageUsers: true,
    canManageStores: true,
    canManageCompanies: true,
    dataScope: 'global',
  },
  admin: {
    canCreateSolicitacao: true,
    canManageSolicitacoes: true,
    canAccessDashboard: true,
    canManageUsers: true,
    canManageStores: true,
    canManageCompanies: true,
    dataScope: 'global',
  },
  buyer: {
    canCreateSolicitacao: false, // Comprador NÃO pode criar
    canManageSolicitacoes: true,
    canAccessDashboard: true,
    canManageUsers: false,
    canManageStores: false,
    canManageCompanies: false,
    dataScope: 'global',
  },
  manager: {
    canCreateSolicitacao: true,
    canManageSolicitacoes: true,
    canAccessDashboard: true,
    canManageUsers: false,
    canManageStores: false,
    canManageCompanies: false,
    dataScope: 'store', // Apenas sua loja
  },
  agent: {
    canCreateSolicitacao: true,
    canManageSolicitacoes: true,
    canAccessDashboard: true,
    canManageUsers: false,
    canManageStores: false,
    canManageCompanies: false,
    dataScope: 'store', // Apenas sua loja
  },
};

// ============================================
// MENSAGENS DE ERRO
// ============================================

export const ERROR_MESSAGES = {
  // Empresas
  COMPANY_NAME_REQUIRED: 'Nome da empresa é obrigatório',
  COMPANY_CNPJ_INVALID: 'CNPJ inválido',
  COMPANY_CNPJ_DUPLICATE: 'CNPJ já cadastrado no sistema',
  COMPANY_HAS_ACTIVE_STORES: 'Não é possível desativar empresa com lojas ativas',
  COMPANY_NOT_FOUND: 'Empresa não encontrada',

  // Lojas
  STORE_NAME_REQUIRED: 'Nome da loja é obrigatório',
  STORE_COMPANY_REQUIRED: 'Empresa é obrigatória para criar loja',
  STORE_COMPANY_NOT_FOUND: 'Empresa não encontrada',
  STORE_MANAGER_REQUIRED: 'Gerente é obrigatório para criar loja',
  STORE_AGENT_REQUIRED: 'Agente é obrigatório para criar loja',
  STORE_MANAGER_ALREADY_ASSIGNED: 'Este gerente já está vinculado a outra loja',
  STORE_AGENT_ALREADY_ASSIGNED: 'Este agente já está vinculado a outra loja',
  STORE_HAS_ACTIVE_USERS: 'Não é possível desativar loja com usuários ativos',
  STORE_NOT_FOUND: 'Loja não encontrada',

  // Usuários
  USER_EMAIL_REQUIRED: 'Email é obrigatório',
  USER_EMAIL_DUPLICATE: 'Email já cadastrado no sistema',
  USER_ROLE_REQUIRED: 'Perfil de usuário é obrigatório',
  USER_STORE_REQUIRED_FOR_ROLE: 'Loja é obrigatória para perfil Manager/Agent',
  USER_STORE_NOT_FOUND: 'Loja não encontrada',
  USER_STORE_INACTIVE: 'Loja está inativa',
  USER_NO_PERMISSION_MANAGE_USERS: 'Você não tem permissão para gerenciar usuários',
  USER_NOT_FOUND: 'Usuário não encontrado',
  USER_NOT_AUTHENTICATED: 'Usuário não autenticado',

  // Solicitações
  SOLICITACAO_BUYER_CANNOT_CREATE: 'Usuários com perfil Comprador não podem criar solicitações',
  SOLICITACAO_STORE_MISMATCH: 'Você só pode criar solicitações para a sua loja',
  SOLICITACAO_STORE_REQUIRED: 'Loja é obrigatória',
  SOLICITACAO_COMPANY_REQUIRED: 'Empresa é obrigatória',
  SOLICITACAO_MINIMUM_ITEMS: 'Solicitação deve ter pelo menos 1 item',
  SOLICITACAO_ALREADY_BATCHED: 'Solicitação já foi agrupada em ficha',
  SOLICITACAO_NOT_PENDING: 'Apenas solicitações pendentes podem ser editadas',
  SOLICITACAO_NOT_FOUND: 'Solicitação não encontrada',

  // Permissões
  PERMISSION_DENIED: 'Você não tem permissão para esta ação',
  PERMISSION_STORE_ACCESS_DENIED: 'Você não tem acesso a dados desta loja',
  PERMISSION_COMPANY_ACCESS_DENIED: 'Você não tem acesso a dados desta empresa',
  PERMISSION_MANAGE_USERS_DENIED: 'Você não tem permissão para gerenciar usuários',
  PERMISSION_MANAGE_STORES_DENIED: 'Você não tem permissão para gerenciar lojas',
  PERMISSION_MANAGE_COMPANIES_DENIED: 'Você não tem permissão para gerenciar empresas',
};

// ============================================
// TIPOS DE VALIDAÇÃO
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface CreateSolicitacaoValidation {
  canCreate: boolean;
  storeId: string;
  companyId: string;
  error?: string;
}
