'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types/business';
import { AlertTriangle } from 'lucide-react';

/**
 * Definição de permissões por role
 *
 * - developer: Acesso total
 * - admin: Acesso total
 * - manager: Acesso a todas as páginas exceto gerenciamento de usuários
 * - buyer: Acesso a dashboard, solicitações e planograma
 * - agent: APENAS acesso a /inventario/[id]/coleta
 */

interface RoutePermissions {
  allowedPaths: string[]; // Caminhos exatos permitidos
  allowedPatterns: RegExp[]; // Padrões regex permitidos
  defaultRedirect: string; // Rota padrão para redirecionar
}

const ROLE_PERMISSIONS: Record<UserRole, RoutePermissions> = {
  developer: {
    allowedPaths: ['*'], // Acesso total
    allowedPatterns: [/.*/],
    defaultRedirect: '/',
  },
  admin: {
    allowedPaths: ['*'], // Acesso total
    allowedPatterns: [/.*/],
    defaultRedirect: '/',
  },
  manager: {
    allowedPaths: ['*'], // Acesso total exceto algumas rotas
    allowedPatterns: [/.*/],
    defaultRedirect: '/',
  },
  buyer: {
    allowedPaths: [
      '/',
      '/solicitacoes',
      '/planograma',
      '/inventario',
      '/lojas',
      '/empresas',
    ],
    allowedPatterns: [
      /^\/$/,
      /^\/solicitacoes/,
      /^\/planograma/,
      /^\/inventario/,
      /^\/lojas/,
      /^\/empresas/,
    ],
    defaultRedirect: '/',
  },
  agent: {
    allowedPaths: ['/inventario'], // APENAS a lista de inventários
    allowedPatterns: [
      /^\/inventario$/, // APENAS /inventario (lista)
      /^\/inventario\/[^/]+$/, // /inventario/{id} (detalhes do inventário)
      /^\/inventario\/[^/]+\/coleta$/, // /inventario/{id}/coleta (página de coleta)
    ],
    defaultRedirect: '/inventario', // Redireciona para lista de inventários
  },
};

// Rotas que não devem ser protegidas
const PUBLIC_ROUTES = ['/login'];

interface RoleGuardProps {
  children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Não verificar enquanto está carregando
    if (loading) return;

    // Permitir acesso a rotas públicas
    if (PUBLIC_ROUTES.includes(pathname)) return;

    // Se não há usuário, não fazer nada (AuthContext vai redirecionar)
    if (!user) return;

    // Verificar permissões
    const permissions = ROLE_PERMISSIONS[user.role as UserRole];
    if (!permissions) {
      console.warn(`Role desconhecida: ${user.role}`);
      router.push('/login');
      return;
    }

    // Acesso total para developer e admin
    if (permissions.allowedPaths.includes('*')) {
      return;
    }

    // Verificar se a rota atual é permitida
    const isAllowed =
      permissions.allowedPaths.includes(pathname) ||
      permissions.allowedPatterns.some((pattern) => pattern.test(pathname));

    if (!isAllowed) {
      console.warn(`Acesso negado para ${user.role} em ${pathname}`);

      // Para agentes, redirecionar para a lista de inventários
      // Para outros, redirecionar para a rota padrão
      router.push(permissions.defaultRedirect);
    }
  }, [user, loading, pathname, router]);

  // Mostrar loading enquanto verifica
  if (loading) {
    return <>{children}</>;
  }

  // Não mostrar nada se não há usuário (AuthContext vai redirecionar)
  if (!user) {
    return <>{children}</>;
  }

  // Verificar permissões para renderização
  const permissions = ROLE_PERMISSIONS[user.role as UserRole];
  if (!permissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#BF092F] to-[#E82129] rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121] mb-2">Acesso Negado</h1>
          <p className="text-[#757575]">Perfil de usuário desconhecido.</p>
        </div>
      </div>
    );
  }

  // Permitir acesso a rotas públicas
  if (PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  // Acesso total para developer e admin
  if (permissions.allowedPaths.includes('*')) {
    return <>{children}</>;
  }

  // Verificar se a rota atual é permitida
  const isAllowed =
    permissions.allowedPaths.includes(pathname) ||
    permissions.allowedPatterns.some((pattern) => pattern.test(pathname));

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#BF092F] to-[#E82129] rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121] mb-2">Acesso Negado</h1>
          <p className="text-[#757575] mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => router.push(permissions.defaultRedirect)}
            className="bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Ir para Página Inicial
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
