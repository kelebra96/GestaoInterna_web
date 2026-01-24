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
  Activity,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// TYPES & CONFIG
// ============================================================================

interface MenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  allowedRoles?: string[];
  group: 'principal' | 'operacional' | 'gestao' | 'sistema';
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'principal' },
  { name: 'Meu Perfil', href: '/perfil', icon: User, group: 'principal' },
  { name: 'Solicitações', href: '/solicitacoes', icon: FileText, group: 'operacional', allowedRoles: ['developer', 'admin', 'buyer'] },
  { name: 'Checklists', href: '/checklists', icon: CheckSquare, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Relatórios Checklists', href: '/checklists/relatorios', icon: BarChart3, group: 'operacional', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Inventário', href: '/inventario', icon: ClipboardList, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Planogramas', href: '/planogramas', icon: LayoutGrid, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Usuários', href: '/usuarios', icon: Users, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Lojas', href: '/lojas', icon: Store, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Empresas', href: '/empresas', icon: Building, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Produtos', href: '/produtos', icon: Package, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, group: 'gestao', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Notificações', href: '/notificacoes', icon: Bell, group: 'sistema', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Mensagens', href: '/mensagens', icon: MessageSquare, group: 'sistema', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Monitoramento', href: '/monitoramento', icon: Activity, group: 'sistema', allowedRoles: ['developer'] },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, group: 'sistema', allowedRoles: ['developer'] },
];

const groupConfig = {
  principal: { label: 'Principal', order: 0 },
  operacional: { label: 'Operacional', order: 1 },
  gestao: { label: 'Gestão', order: 2 },
  sistema: { label: 'Sistema', order: 3 },
};

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose
}: SidebarProps) {
  const pathname = usePathname();
  const { user, firebaseUser, signOut } = useAuth();
  const [solBadge, setSolBadge] = useState<number | undefined>();
  const [notifBadge, setNotifBadge] = useState<number | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch badges
  useEffect(() => {
    let cancelled = false;
    const fetchBadges = async () => {
      try {
        const [dashRes, notifRes] = await Promise.all([
          fetch('/api/dashboard', { cache: 'no-store' }),
          fetch('/api/notificacoes?count=true', { cache: 'no-store' })
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          const pending = data?.solicitacoesPorStatus?.pending;
          if (!cancelled) setSolBadge(pending > 0 ? pending : undefined);
        }

        if (notifRes.ok) {
          const data = await notifRes.json();
          if (!cancelled) setNotifBadge(data.count > 0 ? data.count : undefined);
        }
      } catch { /* ignore */ }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Fullscreen detection
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  };

  // Filter menu items by role
  const filteredItems = menuItems.filter(item => {
    if (!item.allowedRoles?.length) return true;
    return item.allowedRoles.includes(user?.role || '');
  });

  // Group items
  const groupedItems = {
    principal: filteredItems.filter(i => i.group === 'principal'),
    operacional: filteredItems.filter(i => i.group === 'operacional'),
    gestao: filteredItems.filter(i => i.group === 'gestao'),
    sistema: filteredItems.filter(i => i.group === 'sistema'),
  };

  // Get badge for item
  const getBadge = (href: string) => {
    if (href === '/solicitacoes') return solBadge;
    if (href === '/notificacoes') return notifBadge;
    return undefined;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? '80px' : '288px' }}
        className={`bg-gradient-to-b from-[#16476A] via-[#3B9797] to-[#132440] text-white flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 h-screen z-50 shadow-2xl ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <div className="flex-shrink-0 p-5 border-b border-white/20">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-4'}`}>
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <img
                src="/icons/GestaoInternaIcon.png"
                alt="Logo"
                style={{ width: collapsed ? '48px' : '56px', height: collapsed ? '48px' : '56px' }}
                className="rounded-2xl shadow-lg"
              />
              <span style={{ width: '14px', height: '14px' }} className="absolute -bottom-1 -right-1 bg-emerald-400 rounded-full border-2 border-[#16476A]" />
            </div>

            {/* Brand */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">MyInventory</h1>
                <p className="text-[11px] text-white/60 font-medium uppercase tracking-widest">
                  Gestão Interna
                </p>
              </div>
            )}

            {/* Mobile Close */}
            {!collapsed && onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* NAVIGATION */}
        {/* ================================================================ */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-white/20">
          {(['principal', 'operacional', 'gestao', 'sistema'] as const).map(groupKey => {
            const items = groupedItems[groupKey];
            if (!items.length) return null;

            return (
              <div key={groupKey} className="mb-6">
                {/* Group Label */}
                {!collapsed && (
                  <h2 className="px-3 mb-2 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    {groupConfig[groupKey].label}
                  </h2>
                )}

                {/* Collapsed Divider */}
                {collapsed && groupKey !== 'principal' && (
                  <div className="mx-2 mb-3 border-t border-white/20" />
                )}

                {/* Menu Items */}
                <ul className="space-y-1">
                  {items.map(item => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    const badge = getBadge(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onMobileClose}
                          title={collapsed ? item.name : undefined}
                          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-white text-[#16476A] shadow-lg font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                          {/* Active Indicator */}
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-[#16476A] rounded-r-full -ml-3" />
                          )}

                          {/* Icon */}
                          <Icon
                            className={`flex-shrink-0 transition-transform duration-200 ${collapsed ? 'w-6 h-6' : 'w-5 h-5'} ${!isActive ? 'group-hover:scale-110' : ''}`}
                            strokeWidth={isActive ? 2.5 : 2}
                          />

                          {/* Label & Badge */}
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-sm truncate">{item.name}</span>
                              {badge && (
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                                  {badge > 99 ? '99+' : badge}
                                </span>
                              )}
                            </>
                          )}

                          {/* Collapsed Badge */}
                          {collapsed && badge && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[#16476A]">
                              {badge > 9 ? '9+' : badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ================================================================ */}
        {/* FOOTER */}
        {/* ================================================================ */}
        <div className="flex-shrink-0 p-4 border-t border-white/20 bg-black/10">
          {/* User Card */}
          {!collapsed ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  {firebaseUser?.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt="Avatar"
                      style={{ width: '40px', height: '40px' }}
                      className="rounded-full object-cover ring-2 ring-white/30"
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px' }} className="rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                      <UserCircle style={{ width: '24px', height: '24px' }} />
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#16476A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.displayName || 'Usuário'}</p>
                  <p className="text-xs text-white/60 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-red-500/80 rounded-lg transition-all duration-200 text-sm font-medium border border-white/10 hover:border-red-400"
              >
                <LogOut style={{ width: '16px', height: '16px' }} />
                Sair da Conta
              </button>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <button
                onClick={() => signOut()}
                title="Sair da conta"
                className="relative group"
              >
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt="Avatar"
                    style={{ width: '40px', height: '40px' }}
                    className="rounded-full object-cover ring-2 ring-white/30 group-hover:ring-red-400 transition-all"
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px' }} className="rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 group-hover:ring-red-400 transition-all">
                    <UserCircle style={{ width: '24px', height: '24px' }} />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 group-hover:bg-red-500 rounded-full border-2 border-[#16476A] transition-colors" />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className={`flex ${collapsed ? 'flex-col' : ''} gap-2`}>
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 hover:border-white/30 transition-all duration-200 group ${collapsed ? 'w-full' : 'flex-1'}`}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 group-hover:scale-110 transition-transform" />
              ) : (
                <Maximize className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              {!collapsed && (
                <span className="text-xs font-semibold">
                  {isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}
                </span>
              )}
            </button>

            {/* Collapse Button */}
            {onToggle && (
              <button
                onClick={onToggle}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 hover:border-white/30 transition-all duration-200 group ${collapsed ? 'w-full' : 'flex-1'}`}
              >
                {collapsed ? (
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                ) : (
                  <>
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-semibold">Recolher</span>
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
