/**
 * Controle de Acesso por Perfil
 * Define quais rotas cada perfil pode acessar
 */

import { UserRole } from './types/business';

const PUBLIC_ROUTES = ['/login', '/reset-password', '/criar-conta'];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

// Rotas permitidas para cada perfil
export const ALLOWED_ROUTES: Record<UserRole, string[]> = {
  developer: ['*'], // Acesso total (apenas developer mantém acesso irrestrito)
  admin: [
    '/',
    '/perfil',
    '/solicitacoes',
    '/checklists',
    '/checklists/relatorios',
    '/inventario',
    '/planogramas',
    '/relatorios',
    '/notificacoes',
    '/mensagens',
  ],
  buyer: [
    '/',
    '/perfil',
    '/solicitacoes',
    '/checklists/relatorios',
    '/relatorios',
    '/notificacoes',
    '/mensagens',
  ],
  manager: [
    '/',
    '/perfil',
    '/checklists/relatorios',
    '/relatorios',
    '/notificacoes',
    '/mensagens',
  ],
  agent: [
    '/',
    '/perfil',
    '/checklists/relatorios',
    '/relatorios',
    '/notificacoes',
    '/mensagens',
  ],
};

/**
 * Verifica se o usuário tem permissão para acessar uma rota
 */
export function canAccessRoute(userRole: UserRole | undefined, pathname: string): boolean {
  if (isPublicRoute(pathname)) {
    return true;
  }

  // Sem role, sem acesso (exceto login)
  if (!userRole) {
    return pathname === '/login';
  }

  const allowedRoutes = ALLOWED_ROUTES[userRole];

  // Acesso total para developer e admin
  if (allowedRoutes.includes('*')) {
    return true;
  }

  // Rota de login sempre permitida
  if (pathname === '/login') {
    return true;
  }

  // Verifica se a rota está na lista de permitidas
  // Suporta rotas exatas e rotas com subrotas
  return allowedRoutes.some((route) => {
    // Rota exata
    if (pathname === route) {
      return true;
    }
    // Subrota (ex: /checklists/relatorios permite /checklists/relatorios/123)
    if (pathname.startsWith(route + '/')) {
      return true;
    }
    return false;
  });
}

/**
 * Verifica se o usuário pode ver um item do menu
 */
export function canAccessMenuItem(userRole: UserRole | undefined, allowedRoles: string[] | undefined): boolean {
  // Se não há restrição de roles, todos podem ver
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // Se não há role de usuário, não pode ver
  if (!userRole) {
    return false;
  }

  // Verifica se o role do usuário está na lista de permitidos
  return allowedRoles.includes(userRole);
}

/**
 * Obtém a rota de redirecionamento padrão para cada perfil
 */
export function getDefaultRoute(userRole: UserRole): string {
  // Todos os perfis vão para o dashboard por padrão
  return '/';
}

/**
 * Verifica se o usuário é developer (acesso total)
 */
export function isDeveloper(userRole: UserRole | undefined): boolean {
  return userRole === 'developer';
}

/**
 * Verifica se o usuário tem permissão de admin
 */
export function isAdmin(userRole: UserRole | undefined): boolean {
  return userRole === 'admin';
}

/**
 * Verifica se o usuário tem permissões elevadas (developer ou admin)
 */
export function hasElevatedPermissions(userRole: UserRole | undefined): boolean {
  return userRole === 'developer' || userRole === 'admin';
}

/**
 * Verifica se o usuário tem permissão de gestão limitada
 */
export function isManager(userRole: UserRole | undefined): boolean {
  return userRole === 'manager';
}

/**
 * Verifica se o usuário é um agente
 */
export function isAgent(userRole: UserRole | undefined): boolean {
  return userRole === 'agent';
}

/**
 * Verifica se o usuário tem acesso limitado (manager ou agent)
 */
export function hasLimitedAccess(userRole: UserRole | undefined): boolean {
  return isManager(userRole) || isAgent(userRole);
}
