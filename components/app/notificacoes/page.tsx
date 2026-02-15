'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Link as LinkIcon,
  RefreshCw,
  CheckCheck,
  Eye,
  EyeOff,
  Inbox,
  Mail,
  MailOpen,
  Filter,
} from 'lucide-react';

type Tipo = 'info' | 'warning' | 'error' | 'success' | 'item_approved' | 'item_rejected' | 'new_solicitacao';

interface Notificacao {
  id: string;
  userId: string;
  solicitacaoId?: string;
  itemId?: string;
  type: Tipo;
  read: boolean;
  sentAt: string;
  motivoRejeicao?: string;
}

export default function NotificacoesPage() {
  const [data, setData] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notificacoes', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) throw new Error('Falha ao carregar notificações');
      const json = await res.json();
      setData(json.notifications || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getNotificationTitle = (n: Notificacao): string => {
    if (n.type === 'item_approved') return 'Item Aprovado';
    if (n.type === 'item_rejected') return 'Item Rejeitado';
    if (n.type === 'new_solicitacao') return 'Nova Solicitação';
    return 'Notificação';
  };

  const getNotificationMessage = (n: Notificacao): string => {
    if (n.type === 'item_approved') return `Um item da solicitação ${n.solicitacaoId?.substring(0, 8)} foi aprovado`;
    if (n.type === 'item_rejected') return `Um item da solicitação ${n.solicitacaoId?.substring(0, 8)} foi rejeitado${n.motivoRejeicao ? `: ${n.motivoRejeicao}` : ''}`;
    if (n.type === 'new_solicitacao') return `Nova solicitação criada: ${n.solicitacaoId?.substring(0, 8)}`;
    return 'Nova notificação';
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data
      .filter(n => filter === 'all' ? true : filter === 'unread' ? !n.read : n.read)
      .filter(n => {
        if (!q) return true;
        const title = getNotificationTitle(n).toLowerCase();
        const message = getNotificationMessage(n).toLowerCase();
        return title.includes(q) || message.includes(q) || (n.solicitacaoId || '').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [data, filter, query]);

  useEffect(() => { setPage(1); }, [filter, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page]);

  const markRead = async (id: string, read: boolean) => {
    setSaving(s => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/notificacoes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar notificação');
      const json = await res.json();
      const notif = json.notificacao as Notificacao;
      setData(prev => prev.map(n => n.id === id ? { ...n, read: notif.read } : n));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  const markAllRead = async () => {
    const unread = data.filter(n => !n.read);
    for (const n of unread) {
      await markRead(n.id, true);
    }
  };

  const markAllUnread = async () => {
    const alreadyRead = data.filter(n => n.read);
    for (const n of alreadyRead) {
      await markRead(n.id, false);
    }
  };

  const iconFor = (t: Tipo) => {
    const cls = 'w-5 h-5';
    switch (t) {
      case 'item_approved':
      case 'success':
        return <CheckCircle2 className={`${cls} text-[#3B9797]`} />;
      case 'item_rejected':
      case 'error':
        return <XCircle className={`${cls} text-[#BF092F]`} />;
      case 'warning':
        return <AlertTriangle className={`${cls} text-amber-500`} />;
      case 'new_solicitacao':
      default:
        return <Info className={`${cls} text-[#16476A]`} />;
    }
  };

  const getBgColorForType = (t: Tipo): string => {
    switch (t) {
      case 'item_approved':
      case 'success':
        return 'from-green-100 to-green-50';
      case 'item_rejected':
      case 'error':
        return 'from-red-100 to-red-50';
      case 'warning':
        return 'from-amber-100 to-amber-50';
      case 'new_solicitacao':
      default:
        return 'from-blue-100 to-blue-50';
    }
  };

  const stats = useMemo(() => {
    const total = data.length;
    const unread = data.filter(n => !n.read).length;
    const read = data.filter(n => n.read).length;
    return { total, unread, read };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl relative">
                  <Bell className="w-10 h-10 text-white" />
                  {stats.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#BF092F] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{stats.unread > 9 ? '9+' : stats.unread}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Central de Notificações
                  </h1>
                  <p className="text-gray-200 text-base font-medium mt-2">
                    Gerencie e acompanhe todas as suas notificações do sistema
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8 -mt-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                  <Inbox className="w-6 h-6 text-[#16476A]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Total</p>
                  <p className="text-3xl font-bold text-[#16476A]">{stats.total}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#16476A] to-[#132440]" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-[#757575] mt-2">Todas as notificações</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
                  <Mail className="w-6 h-6 text-amber-500" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Não Lidas</p>
                  <p className="text-3xl font-bold text-amber-500">{stats.unread}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                  style={{ width: stats.total > 0 ? `${(stats.unread / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-[#757575] mt-2">
                {stats.total > 0 ? `${Math.round((stats.unread / stats.total) * 100)}%` : '0%'} pendentes
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                  <MailOpen className="w-6 h-6 text-[#3B9797]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Lidas</p>
                  <p className="text-3xl font-bold text-[#3B9797]">{stats.read}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3B9797] to-[#2c7a7a]"
                  style={{ width: stats.total > 0 ? `${(stats.read / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-[#757575] mt-2">
                {stats.total > 0 ? `${Math.round((stats.read / stats.total) * 100)}%` : '0%'} visualizadas
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Ações Rápidas
              </h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              <button
                onClick={markAllRead}
                disabled={data.every(n => n.read) || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#3B9797]/30 bg-gradient-to-br from-green-100 to-green-50 text-[#3B9797] font-bold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar Todas como Lidas
              </button>
              <button
                onClick={markAllUnread}
                disabled={data.every(n => !n.read) || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-100 to-amber-50 text-amber-500 font-bold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                <Eye className="w-4 h-4" />
                Marcar Todas como Não Lidas
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Buscar</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por título, mensagem ou ID..."
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">Filtrar por Status</label>
                  <div className="inline-flex rounded-xl border-2 border-[#E0E0E0] overflow-hidden shadow-md">
                    {(['all','unread','read'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-3 text-sm font-bold transition-all duration-300 ${
                          filter === f
                            ? 'bg-gradient-to-br from-[#16476A] to-[#132440] text-white shadow-lg'
                            : 'text-[#212121] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {f === 'all' ? 'Todas' : f === 'unread' ? 'Não Lidas' : 'Lidas'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden mb-6">
          {loading && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#132440] mb-6 animate-pulse">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
              <p className="text-xl font-bold text-[#212121]">Carregando notificações...</p>
              <p className="text-sm text-[#757575] mt-2">Buscando atualizações do sistema</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
              <p className="text-sm text-[#757575] mb-6">Não foi possível carregar as notificações</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 mb-6">
                <Bell className="w-8 h-8 text-[#757575]" />
              </div>
              <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma notificação encontrada</p>
              <p className="text-sm text-[#757575]">
                {query ? 'Tente ajustar os filtros de busca' : 'Você não possui notificações no momento'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="divide-y divide-[#E0E0E0]">
              {current.map((n) => {
                const title = getNotificationTitle(n);
                const message = getNotificationMessage(n);
                const link = n.solicitacaoId ? `/solicitacoes/${n.solicitacaoId}` : undefined;

                return (
                  <div
                    key={n.id}
                    className={`p-6 hover:bg-gradient-to-r ${
                      !n.read ? 'hover:from-[#E3EFFF] hover:to-[#F0F7FF] bg-gradient-to-r from-[#F8FAFF] to-white' : 'hover:from-[#F8F9FA] hover:to-[#F5F5F5]'
                    } transition-all duration-300 group relative`}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#16476A] to-[#132440]"></div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${getBgColorForType(n.type)} shadow-md group-hover:shadow-lg transition-all duration-300`}>
                          {iconFor(n.type)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-base font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                              {title}
                            </h3>
                            {!n.read && (
                              <span className="px-2 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold rounded-lg shadow-md">
                                NOVA
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-[#616161] mb-2 leading-relaxed">{message}</p>

                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="inline-flex items-center gap-1.5 text-xs text-[#9E9E9E] font-medium">
                              <Info className="w-3.5 h-3.5" />
                              {new Date(n.sentAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>

                            {link && (
                              <a
                                href={link}
                                className="inline-flex items-center gap-1.5 text-xs text-[#16476A] hover:text-[#132440] font-bold hover:underline transition-all group/link"
                              >
                                <LinkIcon className="w-3.5 h-3.5 group-hover/link:scale-110 transition-transform" />
                                Ver Solicitação
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id, true)}
                            disabled={!!saving[n.id]}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 border-[#3B9797]/30 text-[#3B9797] bg-green-100 hover:bg-[#3B9797] hover:text-white hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar Lida
                          </button>
                        )}
                        {n.read && (
                          <button
                            onClick={() => markRead(n.id, false)}
                            disabled={!!saving[n.id]}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 border-[#E0E0E0] text-[#757575] bg-white hover:bg-[#F5F5F5] hover:border-[#16476A] hover:text-[#16476A] hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Marcar Não Lida
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-[#757575] font-medium">
                <span className="font-bold text-[#16476A]">{filtered.length}</span> {filtered.length === 1 ? 'notificação encontrada' : 'notificações encontradas'} •
                Página <span className="font-bold text-[#16476A]">{page}</span> de <span className="font-bold text-[#16476A]">{totalPages}</span>
              </div>
              <div className="inline-flex items-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#E0E0E0] font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#132440] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:shadow-lg hover:scale-105"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#E0E0E0] font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#132440] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:shadow-lg hover:scale-105"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
