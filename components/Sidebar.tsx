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
  ClipboardList,
  Activity,
  CalendarClock,
  Brain,
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
  { name: 'Validade', href: '/validade', icon: CalendarClock, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Planogramas', href: '/planogramas', icon: LayoutGrid, group: 'operacional', allowedRoles: ['developer', 'admin'] },
  { name: 'Usuários', href: '/usuarios', icon: Users, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Lojas', href: '/lojas', icon: Store, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Empresas', href: '/empresas', icon: Building, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Produtos', href: '/produtos', icon: Package, group: 'gestao', allowedRoles: ['developer'] },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, group: 'gestao', allowedRoles: ['developer', 'admin', 'buyer', 'manager', 'agent'] },
  { name: 'Analytics de Vencimentos', href: '/analytics/expiry', icon: BarChart3, group: 'gestao', allowedRoles: ['developer', 'admin', 'buyer', 'manager'] },
  { name: 'Inteligência & ML', href: '/inteligencia', icon: Brain, group: 'gestao', allowedRoles: ['developer', 'admin', 'buyer', 'manager'] },
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
  isMobile?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  isMobile = false
}: SidebarProps) {
  const pathname = usePathname();
  const { user, firebaseUser, signOut } = useAuth();
  const [solBadge, setSolBadge] = useState<number | undefined>();
  const [notifBadge, setNotifBadge] = useState<number | undefined>();

  // Fetch badges
  useEffect(() => {
    if (!firebaseUser) return;

    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchBadges = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const [dashRes, notifRes] = await Promise.all([
          fetch('/api/dashboard', { cache: 'no-store', headers, signal }),
          fetch('/api/notificacoes?count=true', { cache: 'no-store', headers, signal })
        ]);

        if (signal.aborted) return;

        if (dashRes.ok) {
          const data = await dashRes.json();
          const pending = data?.solicitacoesPorStatus?.pending;
          setSolBadge(pending > 0 ? pending : undefined);
        }

        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifBadge(data.count > 0 ? data.count : undefined);
        }
      } catch (err) {
        // Ignorar erros de abort
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [firebaseUser]);

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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm lg:hidden"
          style={{ zIndex: 'var(--z-overlay)' }}
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          app-sidebar bg-gradient-to-b from-[var(--sidebar-from)] via-[var(--sidebar-via)] to-[var(--sidebar-to)]
          text-[var(--sidebar-text)] flex flex-col
          fixed left-0 top-0 h-screen shadow-xl
          transition-all duration-[var(--duration-slow)] ease-[var(--ease-default)]
          ${isMobile
            ? (mobileOpen
              ? 'translate-x-0 opacity-100 pointer-events-auto'
              : '-translate-x-full opacity-0 pointer-events-none')
            : 'translate-x-0 opacity-100 pointer-events-auto'
          }
        `}
        style={{
          width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
          zIndex: 'var(--z-sidebar)',
        }}
        aria-hidden={isMobile && !mobileOpen}
      >
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <div className="flex-shrink-0 p-5 border-b border-[var(--sidebar-border)]">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-4'}`}>
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <img
                src="/icons/GestaoInternaIcon.png"
                alt="Logo"
                className="rounded-2xl shadow-lg"
                style={{
                  width: collapsed ? '44px' : '52px',
                  height: collapsed ? '44px' : '52px',
                }}
              />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-[var(--sidebar-from)]" />
            </div>

            {/* Brand */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">MyInventory</h1>
                <p className="text-[11px] text-[var(--sidebar-text-muted)] font-medium uppercase tracking-widest">
                  Gestão Interna
                </p>
              </div>
            )}

            {/* Mobile Close */}
            {!collapsed && onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden p-2 hover:bg-[var(--sidebar-hover)] rounded-lg transition-colors"
                aria-label="Fechar menu"
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
              <div key={groupKey} className="mb-5">
                {/* Group Label */}
                {!collapsed && (
                  <h2 className="px-3 mb-2 text-[11px] font-semibold text-[var(--sidebar-text-muted)] uppercase tracking-wider">
                    {groupConfig[groupKey].label}
                  </h2>
                )}

                {/* Collapsed Divider */}
                {collapsed && groupKey !== 'principal' && (
                  <div className="mx-2 mb-3 border-t border-[var(--sidebar-border)]" />
                )}

                {/* Menu Items */}
                <ul className="space-y-0.5">
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
                          className={`
                            group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                            transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)]
                            ${collapsed ? 'justify-center' : ''}
                            ${isActive
                              ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-md font-semibold'
                              : 'text-white/80 hover:bg-[var(--sidebar-hover)] hover:text-white'
                            }
                          `}
                        >
                          {/* Active Indicator */}
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full -ml-3" />
                          )}

                          {/* Icon */}
                          <Icon
                            className={`flex-shrink-0 transition-transform duration-[var(--duration-normal)] ${collapsed ? 'w-5.5 h-5.5' : 'w-[18px] h-[18px]'} ${!isActive ? 'group-hover:scale-110' : ''}`}
                            strokeWidth={isActive ? 2.5 : 2}
                          />

                          {/* Label & Badge */}
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-sm truncate">{item.name}</span>
                              {badge && (
                                <span className="bg-error-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                                  {badge > 99 ? '99+' : badge}
                                </span>
                              )}
                            </>
                          )}

                          {/* Collapsed Badge */}
                          {collapsed && badge && (
                            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-error-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[var(--sidebar-from)]">
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
        <div className="flex-shrink-0 p-4 border-t border-[var(--sidebar-border)] bg-black/10">
          {/* User Card */}
          {!collapsed ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 mb-3 border border-[var(--sidebar-border)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  {firebaseUser?.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt="Avatar"
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                      <UserCircle className="w-5 h-5" />
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success-500 rounded-full border-2 border-[var(--sidebar-from)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.displayName || 'Usuário'}</p>
                  <p className="text-xs text-[var(--sidebar-text-muted)] truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-error-500/80 rounded-lg transition-all duration-[var(--duration-normal)] text-sm font-medium border border-[var(--sidebar-border)] hover:border-error-400"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </button>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <button
                onClick={() => signOut()}
                title="Sair da conta"
                className="relative group"
              >
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt="Avatar"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30 group-hover:ring-error-400 transition-all"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 group-hover:ring-error-400 transition-all">
                    <UserCircle className="w-5 h-5" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success-500 group-hover:bg-error-500 rounded-full border-2 border-[var(--sidebar-from)] transition-colors" />
              </button>
            </div>
          )}

          {/* Collapse Button */}
          {onToggle && !isMobile && (
            <button
              onClick={onToggle}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-[var(--sidebar-border)] hover:border-white/30 transition-all duration-[var(--duration-normal)] group"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-xs font-semibold">Recolher</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
