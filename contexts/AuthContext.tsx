'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import supabase, {
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
  resetPassword as supabaseResetPassword,
} from '@/lib/supabase-client';
import { User } from '@/lib/types/business';
import { canAccessRoute, isPublicRoute } from '@/lib/accessControl';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextData {
  user: User | null;
  firebaseUser: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

function buildAuthUser(user: SupabaseUser | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.display_name as string | undefined) || user.email || null,
    photoURL: (user.user_metadata?.avatar_url as string | undefined) || null,
    getIdToken: async () => getAccessToken(),
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfile = async (accessToken?: string) => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setUser(null);
      return;
    }

    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        await supabaseSignOut();
      }
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data.user || null);
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const currentUser = data.session?.user ?? null;
      setFirebaseUser(buildAuthUser(currentUser));
      if (currentUser) {
        await fetchUserProfile(data.session?.access_token);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setFirebaseUser(buildAuthUser(currentUser));
      if (currentUser) {
        await fetchUserProfile(session?.access_token);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Atualizar presença (lastSeen) do usuário a cada 2 minutos
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const updatePresence = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await fetch('/api/auth/last-seen', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error('Erro ao atualizar presença:', error);
      }
    };

    updatePresence();
    const intervalId = setInterval(updatePresence, 120000);

    const handleFocus = () => {
      updatePresence();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid]);

  // Redirecionar para login se não autenticado e controlar acesso por perfil
  useEffect(() => {
    if (!loading && !user && !isPublicRoute(pathname)) {
      router.push('/login');
      return;
    }

    if (!loading && user && !isPublicRoute(pathname)) {
      const hasAccess = canAccessRoute(user.role, pathname);

      if (!hasAccess) {
        console.warn(`Acesso negado para ${user.role} na rota ${pathname}`);
        router.push('/');
      }
    }
  }, [loading, user, pathname, router]);

  const signIn = async (email: string, password: string) => {
    try {
      await supabaseSignIn(email, password);
      router.push('/');
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabaseSignOut();
      router.push('/login');
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await supabaseResetPassword(email);
    } catch (error: any) {
      console.error('Erro ao enviar email de redefinição de senha:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signOut, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
