'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isPublicRoute } from '@/lib/accessControl';
import { Menu, Maximize, Minimize, X, Bell, Search } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { resolveSignalingUrl } from '@/lib/utils/signaling';
import { supabase } from '@/lib/supabase-client';
import Sidebar from './Sidebar';
import { RoleGuard } from './RoleGuard';

interface AppToast {
  id: string;
  title: string;
  body?: string;
  href?: string;
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenToast, setShowFullscreenToast] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appToasts, setAppToasts] = useState<AppToast[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const pendingCallRef = useRef<{
    timerId?: number;
    callerId?: string;
    callerName?: string;
    conversationId?: string;
    callType?: 'voice' | 'video';
  } | null>(null);

  // Detectar se é mobile (< 1024px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Detectar iOS e modo standalone
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    setIsIOS(iOS);
    setIsStandalone(standalone);
  }, []);

  // Detectar mudanças no estado de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const newFullscreenState = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreen(newFullscreenState);

      if (!isIOS || !isStandalone) {
        setShowFullscreenToast(true);
        const timer = setTimeout(() => setShowFullscreenToast(false), 3000);
        return () => clearTimeout(timer);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isIOS, isStandalone]);

  // Atalho de teclado F11
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const addToast = (toast: Omit<AppToast, 'id'> & { id?: string }) => {
    const id = toast.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setAppToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setAppToasts((prev) => prev.filter((item) => item.id !== id));
    }, 6000);
  };

  const notificationsEnabled = () => {
    try {
      return localStorage.getItem('pref.notifications') !== 'off';
    } catch {
      return true;
    }
  };

  const notifyBrowser = async (title: string, body: string, href?: string) => {
    if (!notificationsEnabled()) return;
    if (!('Notification' in window)) return;
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = 'default';
      }
    }
    if (permission !== 'granted') return;
    const notif = new Notification(title, { body });
    notif.onclick = () => {
      window.focus();
      if (href) {
        router.push(href);
      }
      notif.close();
    };
  };

  const registerCallNotification = async (payload: {
    receiverId: string;
    callerId?: string;
    callerName?: string;
    conversationId?: string;
    callType?: 'voice' | 'video';
    status?: 'received' | 'missed';
  }) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch('/api/notificacoes/call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Erro ao registrar notificação de chamada:', error);
    }
  };

  const clearPendingCall = () => {
    if (pendingCallRef.current?.timerId) {
      window.clearTimeout(pendingCallRef.current.timerId);
    }
    pendingCallRef.current = null;
  };

  useEffect(() => {
    if (pathname?.startsWith('/mensagens')) {
      clearPendingCall();
    }
  }, [pathname]);

  useEffect(() => {
    if (!user?.uid) return;
    const channel = supabase
      .channel(`global-messages-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.uid}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;
          if (pathname?.startsWith('/mensagens')) return;

          let attachments: any[] = [];
          if (Array.isArray(newMsg.attachments)) {
            attachments = newMsg.attachments;
          } else if (typeof newMsg.attachments === 'string') {
            try {
              const parsed = JSON.parse(newMsg.attachments);
              if (Array.isArray(parsed)) attachments = parsed;
            } catch {
              attachments = [];
            }
          }

          const isImage = attachments.some((item) => item?.type === 'image');
          const body =
            (newMsg.text && String(newMsg.text).trim()) ||
            (attachments.length > 0 ? (isImage ? 'Enviou uma imagem' : 'Enviou um arquivo') : 'Nova mensagem');
          const senderName = newMsg.sender_name || 'Nova mensagem';
          const href = newMsg.conversation_id ? `/mensagens/${newMsg.conversation_id}` : undefined;

          addToast({
            title: senderName,
            body,
            href,
          });
          void notifyBrowser(senderName, body, href);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname, router, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const savedSignalingUrl = typeof window !== 'undefined' ? localStorage.getItem('pref.signalingServerUrl') : null;
    const signalingUrl = resolveSignalingUrl(savedSignalingUrl, process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL);
    const signalingPath = process.env.NEXT_PUBLIC_SIGNALING_SOCKET_PATH || '/socket.io';

    console.log('🔌 [Signaling] Conectando ao servidor:', signalingUrl);

    const socket = io(signalingUrl, {
      path: signalingPath,
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 [Signaling] Conectado com ID:', socket.id);
      socket.emit('register', { userId: user.uid, conversationId: 'global' });
      console.log('👤 [Signaling] Usuário registrado:', user.uid);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 [Signaling] Erro de conexão:', error.message);
    });

    socket.on('incoming-call', ({ callType, caller }) => {
      if (pathname?.startsWith('/mensagens')) return;
      const callerName = caller?.userId ? `Chamada de ${caller.userId}` : 'Chamada recebida';
      const callLabel = callType === 'video' ? 'Chamada de vídeo' : 'Chamada de voz';
      const href = caller?.conversationId ? `/mensagens/${caller.conversationId}` : undefined;

      addToast({
        title: callerName,
        body: callLabel,
        href,
      });
      void notifyBrowser(callerName, callLabel, href);
      void registerCallNotification({
        receiverId: user.uid,
        callerId: caller?.userId,
        conversationId: caller?.conversationId,
        callType,
        status: 'received',
      });

      clearPendingCall();
      const timerId = window.setTimeout(() => {
        if (!pendingCallRef.current) return;
        void registerCallNotification({
          receiverId: user.uid,
          callerId: pendingCallRef.current.callerId,
          callerName: pendingCallRef.current.callerName,
          conversationId: pendingCallRef.current.conversationId,
          callType: pendingCallRef.current.callType,
          status: 'missed',
        });
        clearPendingCall();
      }, 35000);

      pendingCallRef.current = {
        timerId,
        callerId: caller?.userId,
        callerName: caller?.displayName || caller?.userId,
        conversationId: caller?.conversationId,
        callType,
      };
    });

    socket.on('call-ended', () => {
      if (!pendingCallRef.current) return;
      void registerCallNotification({
        receiverId: user.uid,
        callerId: pendingCallRef.current.callerId,
        callerName: pendingCallRef.current.callerName,
        conversationId: pendingCallRef.current.conversationId,
        callType: pendingCallRef.current.callType,
        status: 'missed',
      });
      clearPendingCall();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearPendingCall();
    };
  }, [pathname, router, user?.uid]);

  // Função para toggle fullscreen
  const toggleFullscreen = async () => {
    if (isIOS && !isStandalone) {
      setShowIOSInstructions(true);
      return;
    }

    if (isIOS && isStandalone) {
      setShowFullscreenToast(true);
      setTimeout(() => setShowFullscreenToast(false), 3000);
      return;
    }

    try {
      if (!isFullscreen) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Erro ao alternar modo tela cheia:', error);
    }
  };

  // ============================================================================
  // LOADING / PUBLIC ROUTE STATES
  // ============================================================================

  // Aguardar pathname estar disponível
  if (!pathname) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-14 h-14 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  const isPublicPage = isPublicRoute(pathname);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-14 h-14 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED LAYOUT — CSS Grid
  // ============================================================================

  if (user) {
    const layoutClass = isMobile
      ? 'app-layout app-layout--mobile'
      : sidebarCollapsed
        ? 'app-layout app-layout--collapsed'
        : 'app-layout';

    return (
      <>
        {/* ================================================================ */}
        {/* iOS Fullscreen Instructions Modal */}
        {/* ================================================================ */}
        {showIOSInstructions && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" style={{ zIndex: 'var(--z-modal)' }}>
            <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-slideUp max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg">
                    <Maximize className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Modo Tela Cheia</h3>
                </div>
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto flex-1">
                <p className="text-text-primary mb-4 text-sm font-medium">
                  Para ter a experiência em tela cheia no Safari, adicione este app à sua tela inicial:
                </p>

                <div className="space-y-3 mb-4">
                  {[
                    { step: 1, title: 'Toque no botão Compartilhar', desc: 'Na barra inferior', color: 'primary' },
                    { step: 2, title: 'Adicionar à Tela de Início', desc: 'Role o menu para encontrar', color: 'success' },
                    { step: 3, title: 'Abra pelo ícone criado', desc: 'Tela cheia automática', color: 'warning' },
                  ].map(({ step, title, desc, color }) => (
                    <div key={step} className={`flex gap-3 p-3 bg-${color}-50 rounded-xl border border-${color}-200`}>
                      <div className={`flex-shrink-0 w-6 h-6 bg-${color}-500 rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                        {step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary text-sm mb-0.5">{title}</p>
                        <p className="text-xs text-text-secondary">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-surface-hover rounded-xl border border-border">
                  <p className="text-xs text-text-secondary text-center leading-relaxed">
                    <strong className="text-primary-600">Dica:</strong> Funcionará como app nativo sem barras do navegador.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex-shrink-0 border-t border-border">
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Fullscreen Toast */}
        {/* ================================================================ */}
        {showFullscreenToast && (
          <div className="fixed top-20 lg:top-6 right-6 animate-slideUp" style={{ zIndex: 'var(--z-toast)' }}>
            <div className={`px-5 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
              isFullscreen || (isIOS && isStandalone)
                ? 'bg-success-500 border-success-600 text-white'
                : 'bg-primary-500 border-primary-600 text-white'
            }`}>
              {(isFullscreen || (isIOS && isStandalone)) ? (
                <>
                  <Maximize className="w-5 h-5" />
                  <div>
                    <p className="font-bold text-sm">Modo Tela Cheia Ativo</p>
                    <p className="text-xs opacity-90">{isIOS ? 'App rodando em tela cheia' : 'Pressione ESC para sair'}</p>
                  </div>
                </>
              ) : (
                <>
                  <Minimize className="w-5 h-5" />
                  <div>
                    <p className="font-bold text-sm">Modo Normal</p>
                    <p className="text-xs opacity-90">Tela cheia desativada</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* App Toasts */}
        {/* ================================================================ */}
        {appToasts.length > 0 && (
          <div className="fixed top-32 lg:top-20 right-6 space-y-3" style={{ zIndex: 'var(--z-toast)' }}>
            {appToasts.map((toast) => (
              <button
                key={toast.id}
                type="button"
                onClick={() => {
                  if (toast.href) {
                    router.push(toast.href);
                  }
                  setAppToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
                className="w-80 text-left bg-card border border-border rounded-xl shadow-lg px-4 py-3 hover:shadow-xl hover:border-border-strong transition-all animate-slideUp"
              >
                <div className="text-sm font-bold text-text-primary">{toast.title}</div>
                {toast.body && <div className="text-xs text-text-secondary mt-1 line-clamp-2">{toast.body}</div>}
              </button>
            ))}
          </div>
        )}

        {/* ================================================================ */}
        {/* CSS GRID LAYOUT */}
        {/* ================================================================ */}
        <div className={layoutClass}>
          {/* Sidebar */}
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
            isMobile={isMobile}
          />

          {/* Navbar */}
          <nav className="app-navbar sticky top-0 bg-[var(--navbar-bg)] border-b border-[var(--navbar-border)] flex items-center justify-between px-4 lg:px-8 shadow-xs" style={{ zIndex: 'var(--z-sticky)' }}>
            {/* Left side */}
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 hover:bg-surface-hover rounded-xl transition-colors"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-5 h-5 text-text-primary" />
                </button>
              )}

              {isMobile && (
                <div className="flex items-center gap-2.5">
                  <img src="/icons/GestaoInternaIcon.png" alt="Logo" className="w-9 h-9 rounded-lg shadow-sm" />
                  <h1 className="text-base font-bold text-text-primary tracking-tight">MyInventory</h1>
                </div>
              )}

              {!isMobile && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {pathname === '/' ? 'Dashboard' : pathname?.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' › ')}
                  </span>
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Search (desktop only) */}
              {!isMobile && (
                <div className="relative mr-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    className="pl-9 pr-4 py-2 bg-surface-hover border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-400 focus:bg-surface w-48 focus:w-64 transition-all"
                  />
                </div>
              )}

              {/* Notifications */}
              <button
                onClick={() => router.push('/notificacoes')}
                className="relative p-2.5 hover:bg-surface-hover rounded-xl transition-colors"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5 text-text-secondary" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 hover:bg-surface-hover rounded-xl transition-colors"
                aria-label={isFullscreen ? 'Sair tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 text-text-secondary" />
                ) : (
                  <Maximize className="w-5 h-5 text-text-secondary" />
                )}
              </button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="app-main bg-background">
            <RoleGuard>{children}</RoleGuard>
          </main>
        </div>
      </>
    );
  }

  // Não autenticado
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-14 h-14 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm font-medium">Redirecionando...</p>
      </div>
    </div>
  );
}
