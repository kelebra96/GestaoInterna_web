/**
 * Hook de Proteção de Rotas
 * Verifica se o usuário tem permissão para acessar a rota atual
 * Redireciona automaticamente se não tiver permissão
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessRoute, isPublicRoute } from '@/lib/accessControl';

interface UseRouteProtectionOptions {
  redirectTo?: string;
  showUnauthorized?: boolean;
}

export function useRouteProtection(options: UseRouteProtectionOptions = {}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const { redirectTo = '/', showUnauthorized = false } = options;

  useEffect(() => {
    // Aguardar carregamento
    if (loading) {
      return;
    }

    // Se não estiver autenticado e não estiver na página de login
    if (!user && !isPublicRoute(pathname)) {
      router.push('/login');
      return;
    }

    // Se estiver autenticado, verificar permissão de acesso
    if (user && !isPublicRoute(pathname)) {
      const hasAccess = canAccessRoute(user.role, pathname);

      if (!hasAccess) {
        if (showUnauthorized) {
          // Redirecionar para página de "não autorizado" (se existir)
          router.push('/unauthorized');
        } else {
          // Redirecionar para a rota padrão
          router.push(redirectTo);
        }
      }
    }
  }, [user, loading, pathname, router, redirectTo, showUnauthorized]);

  return {
    user,
    loading,
    hasAccess: user ? canAccessRoute(user.role, pathname) : isPublicRoute(pathname),
  };
}
