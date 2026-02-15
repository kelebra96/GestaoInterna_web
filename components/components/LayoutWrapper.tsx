'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isPublicRoute } from '@/lib/accessControl';
import { Menu, Maximize, Minimize, Share, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
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

      // Mostrar notificação
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
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3002';
    const signalingPath = process.env.NEXT_PUBLIC_SIGNALING_SOCKET_PATH || '/socket.io';
    const socket = io(signalingUrl, {
      path: signalingPath,
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', { userId: user.uid, conversationId: 'global' });
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
    // Para iOS: mostrar instruções para adicionar à tela inicial
    if (isIOS && !isStandalone) {
      setShowIOSInstructions(true);
      return;
    }

    // Para iOS já em modo standalone: não fazer nada (já está em tela cheia)
    if (isIOS && isStandalone) {
      setShowFullscreenToast(true);
      setTimeout(() => setShowFullscreenToast(false), 3000);
      return;
    }

    // Para outros navegadores: usar Fullscreen API
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

  // Não mostrar sidebar em rotas públicas (login, reset, criar conta, etc)
  const isPublicPage = isPublicRoute(pathname);

  // Rotas públicas não esperam autenticação
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1F53A2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#757575]">Carregando...</p>
        </div>
      </div>
    );
  }

  // Usuário autenticado - mostrar sidebar
  if (user) {
    return (
      <>
        {/* Modal de Instruções iOS */}
        {showIOSInstructions && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] px-4 py-3 flex items-center justify-between flex-shrink-0">
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

              {/* Content - Scrollable */}
              <div className="p-4 overflow-y-auto flex-1">
                <p className="text-[#212121] mb-4 text-sm font-medium">
                  Para ter a experiência em tela cheia no Safari, adicione este app à sua tela inicial:
                </p>

                <div className="space-y-3 mb-4">
                  {/* Passo 1 */}
                  <div className="flex gap-3 p-3 bg-gradient-to-br from-[#E3EFFF] to-[#F0F7FF] rounded-xl border border-[#1F53A2]/20">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] rounded-full flex items-center justify-center text-white text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#212121] text-sm mb-1">Toque no botão Compartilhar</p>
                      <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                        <Share className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Na barra inferior</span>
                      </div>
                    </div>
                  </div>

                  {/* Passo 2 */}
                  <div className="flex gap-3 p-3 bg-gradient-to-br from-[#E8F5E9] to-[#F1F8E9] rounded-xl border border-[#4CAF50]/20">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#212121] text-sm mb-1">Adicionar à Tela de Início</p>
                      <p className="text-xs text-[#757575]">Role o menu para encontrar</p>
                    </div>
                  </div>

                  {/* Passo 3 */}
                  <div className="flex gap-3 p-3 bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] rounded-xl border border-[#FF9800]/20">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#212121] text-sm mb-1">Abra pelo ícone criado</p>
                      <p className="text-xs text-[#757575]">Tela cheia automática</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <p className="text-xs text-[#757575] text-center leading-relaxed">
                    <strong className="text-[#1F53A2]">Dica:</strong> Funcionará como app nativo sem barras do navegador.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 flex-shrink-0 border-t border-[#E0E0E0]">
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="w-full bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast de Tela Cheia */}
        {showFullscreenToast && (
          <div className="fixed top-20 lg:top-6 right-6 z-[100] animate-in slide-in-from-top-5">
            <div className={`px-6 py-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 ${
              isFullscreen || (isIOS && isStandalone)
                ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] border-[#4CAF50]/30 text-white'
                : 'bg-gradient-to-r from-[#2196F3] to-[#1976D2] border-[#2196F3]/30 text-white'
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

        {appToasts.length > 0 && (
          <div className="fixed top-32 lg:top-20 right-6 z-[120] space-y-3">
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
                className="w-80 text-left bg-white border border-[#E0E0E0] rounded-2xl shadow-2xl px-4 py-3 hover:shadow-3xl transition-all"
              >
                <div className="text-sm font-bold text-[#212121]">{toast.title}</div>
                {toast.body && <div className="text-xs text-[#757575] mt-1 line-clamp-2">{toast.body}</div>}
              </button>
            ))}
          </div>
        )}

        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          isMobile={isMobile}
        />

        {/* Mobile Header com menu hamburguer - só aparece em telas < 1024px */}
        {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#1F53A2] via-[#2E67C3] to-[#5C94CC] border-b-2 border-white/20 z-30 flex items-center justify-between px-4 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-110 border-2 border-white/20"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <img src="/icons/GestaoInternaIcon.png" alt="Logo" className="w-12 h-12 rounded-lg shadow-2xl" />
              <h1 className="text-lg font-bold text-white tracking-tight">MyInventory</h1>
            </div>
          </div>

          {/* Botão Tela Cheia Mobile */}
          <button
            onClick={toggleFullscreen}
            className={`p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-110 border-2 ${
              isIOS && isStandalone ? 'border-[#4CAF50] bg-[#4CAF50]/20' : 'border-white/20'
            }`}
            aria-label={
              isIOS && isStandalone
                ? 'App em modo tela cheia'
                : isFullscreen
                ? 'Sair do modo tela cheia'
                : 'Modo tela cheia'
            }
            title={
              isIOS && isStandalone
                ? 'App em modo tela cheia'
                : isFullscreen
                ? 'Sair do modo tela cheia'
                : 'Modo tela cheia'
            }
          >
            {isIOS && isStandalone ? (
              <Maximize className="w-5 h-5 text-white" />
            ) : isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
        )}

        {/* Main content com padding responsivo */}
        <main style={{ paddingLeft: isMobile ? '0' : '288px', paddingTop: isMobile ? '64px' : '0' }} className="min-h-screen">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </>
    );
  }

  // Não autenticado e não em rota pública - mostra loading
  // (AuthContext vai redirecionar para /login)
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#1F53A2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#757575]">Redirecionando...</p>
      </div>
    </div>
  );
}
