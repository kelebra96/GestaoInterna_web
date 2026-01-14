'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  Store,
  Package,
  BarChart3,
  Settings,
  Bell,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCircle,
  User,
  Building,
  X,
  CheckSquare,
  LayoutGrid,
  Maximize,
  Minimize,
  ClipboardList,
} from 'lucide-react';

interface MenuItem {
  name: string;
  href: string;
  icon: any;
  badge?: number;
  allowedRoles?: string[]; // Roles permitidas (vazio = todos)
  group: 'principal' | 'operacional' | 'gestao' | 'sistema';
}

const menuItems: MenuItem[] = [
  // Rotas acessíveis por TODOS os perfis
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'principal' },
  { name: 'Meu Perfil', href: '/perfil', icon: User, group: 'principal' },

  // Rotas operacionais
  { name: 'Solicitações', href: '/solicitacoes', icon: FileText, group: 'operacional', allowedRoles: ['developer', 'admin', 'buyer'] },
  { name: 'Checklists', href: '/checklists', icon: CheckSquare, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Relatórios Checklists', href: '/checklists/relatorios', icon: BarChart3, group: 'operacional', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Inventário', href: '/inventario', icon: ClipboardList, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Planogramas', href: '/planogramas', icon: LayoutGrid, group: 'operacional', allowedRoles: ['developer', 'admin'] },

  // Rotas de gestão (apenas developer - acesso total)
  { name: 'Usuários', href: '/usuarios', icon: Users, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Lojas', href: '/lojas', icon: Store, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Empresas', href: '/empresas', icon: Building, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Produtos', href: '/produtos', icon: Package, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, group: 'gestao', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },

  // Rotas de sistema
  { name: 'Notificações', href: '/notificacoes', icon: Bell, group: 'sistema', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Mensagens', href: '/mensagens', icon: MessageSquare, group: 'sistema', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, group: 'sistema', allowedRoles: ['developer'] },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, firebaseUser, signOut } = useAuth();
  const [solBadge, setSolBadge] = useState<number | undefined>(undefined);
  const [notifBadge, setNotifBadge] = useState<number | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const pending = data?.solicitacoesPorStatus?.pending;
        const value = typeof pending === 'number' ? pending : undefined;
        if (!cancelled) setSolBadge(value && value > 0 ? value : undefined);
      } catch {
        // ignore
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/notificacoes?count=true', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const count = typeof data.count === 'number' ? data.count : 0;
        if (!cancelled) setNotifBadge(count > 0 ? count : undefined);
      } catch {
        // ignore
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Detectar mudanças no estado de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
      );
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
  }, []);

  // Filtrar itens do menu baseado no role do usuário
  const filteredMenuItems = menuItems.filter((item) => {
    // Se não há restrição de roles, mostrar para todos
    if (!item.allowedRoles || item.allowedRoles.length === 0) {
      return true;
    }
    // Verificar se o role do usuário está na lista de permitidos
    return item.allowedRoles.includes(user?.role || '');
  });

  // Organizar items por grupo
  const groupedItems = {
    principal: filteredMenuItems.filter(item => item.group === 'principal'),
    operacional: filteredMenuItems.filter(item => item.group === 'operacional'),
    gestao: filteredMenuItems.filter(item => item.group === 'gestao'),
    sistema: filteredMenuItems.filter(item => item.group === 'sistema'),
  };

  // Função para toggle fullscreen
  const toggleFullscreen = async () => {
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

  return (
    <>
      {/* Overlay para mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-72'
        } bg-gradient-to-b from-[#16476A] via-[#3B9797] to-[#132440] text-white flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 h-screen z-50 shadow-2xl border-r-2 border-white/10
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {/* Header com Logo */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>
          <div className="relative p-6 border-b-2 border-white/20">
            <div className="flex items-center justify-between">
              {!collapsed && (
                <div className="flex items-center gap-3 flex-1">
                  <img src="/icons/GestaoInternaIcon.png" alt="Logo" className="w-20 h-20 rounded-xl shadow-2xl" />
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">MyInventory</h1>
                    <p className="text-xs text-[#E0E7EF] font-semibold mt-0.5 tracking-wide">GESTÃO INTERNA</p>
                  </div>
                </div>
              )}
              {collapsed && (
                <div className="w-full flex justify-center">
                  <img src="/icons/GestaoInternaIcon.png" alt="Logo" className="w-16 h-16 rounded-xl shadow-2xl" />
                </div>
              )}
              {/* Botão fechar mobile */}
              {!collapsed && onMobileClose && (
                <button
                  onClick={onMobileClose}
                  className="lg:hidden p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6 py-6 px-4">
          {/* Grupo: Principal */}
          {groupedItems.principal.length > 0 && (
            <>
              {!collapsed && (
                <div>
                  <p className="text-xs font-bold text-[#E0E7EF] uppercase tracking-wider mb-3 px-3">Principal</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {groupedItems.principal.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  let computedBadge = item.badge;
                  if (item.href === '/solicitacoes') computedBadge = solBadge;
                  if (item.href === '/notificacoes') computedBadge = notifBadge;

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                          isActive
                            ? 'bg-white text-[#16476A] shadow-xl font-bold'
                            : 'text-[#E0E7EF] hover:bg-white/15 hover:text-white hover:shadow-lg'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-white to-[#E9ECEF] opacity-100" />
                        )}
                        <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 relative z-10 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} strokeWidth={isActive ? 2.5 : 2} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 font-semibold text-sm relative z-10">{item.name}</span>
                            {computedBadge && (
                              <span className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg relative z-10">{computedBadge}</span>
                            )}
                          </>
                        )}
                        {collapsed && computedBadge && (
                          <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] rounded-full ring-2 ring-white shadow-lg" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Grupo: Operacional */}
          {groupedItems.operacional.length > 0 && (
            <>
              {!collapsed && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-[#E0E7EF] uppercase tracking-wider mb-3 px-3">Operacional</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {groupedItems.operacional.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              let computedBadge = item.badge;
              if (item.href === '/solicitacoes') computedBadge = solBadge;
              if (item.href === '/notificacoes') computedBadge = notifBadge;

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                      isActive
                        ? 'bg-white text-[#16476A] shadow-xl font-bold'
                        : 'text-[#E0E7EF] hover:bg-white/15 hover:text-white hover:shadow-lg'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white to-[#E9ECEF] opacity-100" />
                    )}
                    <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 relative z-10 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 font-semibold text-sm relative z-10">{item.name}</span>
                        {computedBadge && (
                          <span className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg relative z-10">{computedBadge}</span>
                        )}
                      </>
                    )}
                    {collapsed && computedBadge && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] rounded-full ring-2 ring-white shadow-lg" />
                    )}
                  </Link>
                </li>
              );
            })}
                </ul>
              </>
            )}

          {/* Grupo: Gestão */}
          {groupedItems.gestao.length > 0 && (
            <>
              {!collapsed && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-[#E0E7EF] uppercase tracking-wider mb-3 px-3">Gestão</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {groupedItems.gestao.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              let computedBadge = item.badge;
              if (item.href === '/solicitacoes') computedBadge = solBadge;
              if (item.href === '/notificacoes') computedBadge = notifBadge;

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                      isActive
                        ? 'bg-white text-[#16476A] shadow-xl font-bold'
                        : 'text-[#E0E7EF] hover:bg-white/15 hover:text-white hover:shadow-lg'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white to-[#E9ECEF] opacity-100" />
                    )}
                    <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 relative z-10 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 font-semibold text-sm relative z-10">{item.name}</span>
                        {computedBadge && (
                          <span className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg relative z-10">{computedBadge}</span>
                        )}
                      </>
                    )}
                    {collapsed && computedBadge && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] rounded-full ring-2 ring-white shadow-lg" />
                    )}
                  </Link>
                </li>
              );
            })}
                </ul>
              </>
            )}

          {/* Grupo: Sistema */}
          {groupedItems.sistema.length > 0 && (
            <>
              {!collapsed && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-[#E0E7EF] uppercase tracking-wider mb-3 px-3">Sistema</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {groupedItems.sistema.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              let computedBadge = item.badge;
              if (item.href === '/solicitacoes') computedBadge = solBadge;
              if (item.href === '/notificacoes') computedBadge = notifBadge;

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                      isActive
                        ? 'bg-white text-[#16476A] shadow-xl font-bold'
                        : 'text-[#E0E7EF] hover:bg-white/15 hover:text-white hover:shadow-lg'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white to-[#E9ECEF] opacity-100" />
                    )}
                    <Icon className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 relative z-10 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 font-semibold text-sm relative z-10">{item.name}</span>
                        {computedBadge && (
                          <span className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg relative z-10">{computedBadge}</span>
                        )}
                      </>
                    )}
                    {collapsed && computedBadge && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] rounded-full ring-2 ring-white shadow-lg" />
                    )}
                  </Link>
                </li>
              );
                })}
              </ul>
            </>
          )}
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t-2 border-white/20 bg-gradient-to-t from-black/20 to-transparent">
        {!collapsed ? (
          <div className="bg-white/15 backdrop-blur-md rounded-xl p-4 mb-3 border-2 border-white/20 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              {firebaseUser?.photoURL ? (
                <div className="relative">
                  <img src={firebaseUser.photoURL} alt="Foto de Perfil" className="w-12 h-12 rounded-xl object-cover border-2 border-white/30 shadow-lg" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full border-2 border-[#16476A] shadow-lg"></div>
                </div>
              ) : (
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-white/30 to-white/10 rounded-xl flex items-center justify-center border-2 border-white/30 shadow-lg">
                    <UserCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full border-2 border-[#16476A] shadow-lg"></div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.displayName || 'Usuário'}</p>
                <p className="text-xs text-[#E0E7EF] truncate font-medium">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-white/20 to-white/10 hover:from-white/30 hover:to-white/20 rounded-xl transition-all duration-300 text-sm font-bold border-2 border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 mb-3">
            <div className="relative">
              {firebaseUser?.photoURL ? (
                <img src={firebaseUser.photoURL} alt="Foto" className="w-12 h-12 rounded-xl object-cover border-2 border-white/30 shadow-xl" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-white/30 to-white/10 rounded-xl flex items-center justify-center border-2 border-white/30 shadow-xl">
                  <UserCircle className="w-7 h-7 text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full border-2 border-[#16476A]"></div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 hover:scale-110 border-2 border-white/30 shadow-lg"
              title="Sair"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Botões de Controle - esconder em mobile */}
        <div className="hidden lg:flex flex-col gap-2">
          {/* Botão Tela Cheia */}
          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center justify-center py-3 bg-white/15 hover:bg-white/25 rounded-xl transition-all duration-300 border-2 border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl group"
            title={isFullscreen ? 'Sair do modo tela cheia' : 'Modo tela cheia'}
          >
            {collapsed ? (
              isFullscreen ? (
                <Minimize className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              ) : (
                <Maximize className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              )
            ) : (
              <>
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <Maximize className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                )}
                <span className="text-xs font-bold">{isFullscreen ? 'Sair Tela Cheia' : 'Modo Tela Cheia'}</span>
              </>
            )}
          </button>

          {/* Toggle Sidebar Button */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center py-3 bg-white/15 hover:bg-white/25 rounded-xl transition-all duration-300 border-2 border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl group"
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
                  <span className="text-xs font-bold">Recolher Menu</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}

