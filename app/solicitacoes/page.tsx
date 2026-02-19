'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSolicitacoesRealtime } from '@/hooks/useSolicitacoesRealtime';
import { RealtimeIndicator } from '@/components/ui/RealtimeIndicator';
import {
  MdSearch,
  MdRefresh,
  MdCheckCircle,
  MdAccessTime,
  MdArchive,
  MdPerson,
  MdStore,
  MdBusiness,
  MdShoppingCart,
  MdAttachMoney,
  MdCalendarToday,
  MdFilterList,
  MdChevronLeft,
  MdChevronRight,
  MdError,
  MdClose,
  MdTrendingUp,
  MdViewList,
  MdWifi,
  MdWifiOff
} from 'react-icons/md';
import { FaFileAlt, FaBoxOpen } from 'react-icons/fa';
import { IoMdRefresh } from 'react-icons/io';
import { Solicitacao as SolicitacaoType } from '@/lib/types/business';

type Status = 'pending' | 'batched' | 'closed';

type Solicitacao = Omit<SolicitacaoType, 'userId' | 'storeId'> & {
  userId?: string | null;
  userName: string;
  storeId?: string | null;
  storeName: string;
  companyName?: string;
  items?: number;
  total?: number;
  productBuyer?: string;
};

const statusLabels: Record<Status, string> = {
  pending: 'Pendente',
  batched: 'Agrupada',
  closed: 'Fechada',
};

const statusStyles: Record<Status, string> = {
  pending: 'bg-[#BF092F]/10 text-[#BF092F] border-2 border-[#BF092F]/40',
  batched: 'bg-[#3B9797]/10 text-[#3B9797] border-2 border-[#3B9797]/40',
  closed: 'bg-[#132440]/10 text-[#132440] border-2 border-[#132440]/40',
};

const statusIcon: Record<Status, ReactElement> = {
  pending: <MdAccessTime className="w-5 h-5" />,
  batched: <MdCheckCircle className="w-5 h-5" />,
  closed: <MdArchive className="w-5 h-5" />,
};

export default function SolicitacoesPage() {
  const router = useRouter();
  const { firebaseUser, user } = useAuth();
  const [data, setData] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Supabase Realtime subscription
  const {
    solicitacoes: realtimeSolicitacoes,
    isConnected: realtimeConnected,
    lastUpdate: realtimeLastUpdate,
    refresh: realtimeRefresh,
  } = useSolicitacoesRealtime({
    companyId: user?.companyId,
    enabled: !!user?.companyId,
  });

  // Merge realtime data with local data
  useEffect(() => {
    if (realtimeSolicitacoes.length > 0) {
      setData((prevData) => {
        // Create a map of existing items by ID
        const existingMap = new Map(prevData.map((s) => [s.id, s]));

        // Update or add realtime items
        realtimeSolicitacoes.forEach((rs) => {
          const existing = existingMap.get(rs.id);
          if (existing) {
            // Update existing item
            existingMap.set(rs.id, {
              ...existing,
              status: rs.status as Status,
              itemCount: rs.itemCount,
              updatedAt: rs.updatedAt,
            });
          } else {
            // Add new item from realtime
            existingMap.set(rs.id, {
              id: rs.id,
              storeId: rs.storeId,
              storeName: rs.storeName || '',
              userId: rs.createdBy,
              userName: rs.userName || '',
              companyName: rs.companyName,
              status: rs.status as Status,
              dayKey: rs.dayKey,
              itemCount: rs.itemCount,
              createdAt: rs.createdAt,
              updatedAt: rs.updatedAt,
            } as Solicitacao);
          }
        });

        return Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }
  }, [realtimeSolicitacoes]);

  // Data for filters
  const [buyers, setBuyers] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  // UI state
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('30');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchStores = async () => {
    try {
      if (!firebaseUser) return;

      const token = await firebaseUser.getIdToken(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const storesRes = await fetch('/api/lojas', { headers });

      if (storesRes.ok) {
        const storesJson = await storesRes.json();
        const storesList = (storesJson.lojas || [])
          .filter((s: any) => s.active !== false)
          .map((s: any) => ({ id: s.id, name: s.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));
        setStores(storesList);
      }
    } catch (e) {
      console.error('Erro ao carregar lojas:', e);
    }
  };

  // Extract buyers from solicitacoes data (product buyers)
  useEffect(() => {
    if (data.length > 0) {
      console.log('📊 [Solicitações] Extraindo compradores de produtos dos dados:', data.map(s => ({ productBuyer: s.productBuyer })));

      const buyersMap = new Map<string, string>();
      data.forEach((s) => {
        if (s.productBuyer && !buyersMap.has(s.productBuyer)) {
          buyersMap.set(s.productBuyer, s.productBuyer);
        }
      });
      const extractedBuyers = Array.from(buyersMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      console.log('👥 [Solicitações] Compradores de produtos extraídos:', extractedBuyers);
      setBuyers(extractedBuyers);
    }
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);

      console.log('🔄 [Solicitações] Filtros atuais:', {
        status,
        period,
        query
      });

      // Obter token de autenticação
      if (!firebaseUser) {
        throw new Error('Usu rio nÆo autenticado. Fa‡a login novamente.');
      }

      const token = await firebaseUser.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/solicitacoes', {
        cache: 'no-store',
        headers,
      });

      console.log('📡 [Solicitações Page] Response status:', res.status);

      if (!res.ok) {
        const responseText = await res.text();
        console.error('❌ [Solicitações Page] Erro da API:', {
          status: res.status,
          statusText: res.statusText,
          responseText: responseText,
        });

        let errorData: any = {};
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Erro desconhecido' };
        }

        throw new Error(errorData?.error || `Erro ${res.status}: Falha ao carregar solicitações`);
      }

      const json = await res.json();

      console.log('📦 [Solicitações Page] Dados recebidos:', {
        solicitacoes: json.solicitacoes?.length || 0,
        buyers: json.buyers?.length || 0,
      });

      setData(json.solicitacoes || []);

      // Se a API retornou a lista de compradores, usar diretamente
      if (json.buyers && json.buyers.length > 0) {
        console.log('👥 [Solicitações] Compradores da API:', json.buyers);
        setBuyers(json.buyers);
      }

      setError(null);
    } catch (e: any) {
      console.error('❌ [Solicitações Page] Erro ao carregar:', e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, next: Status) => {
    setUpdating((u) => ({ ...u, [id]: true }));
    setUpdateError(null);
    try {
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: next }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData?.error || `Erro ${res.status}: Falha ao atualizar status`;
        throw new Error(errorMessage);
      }

      const json = await res.json();
      const updated = json?.solicitacao;
      if (updated) {
        setData((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      } else {
        await fetchData();
      }
    } catch (e: any) {
      console.error('Erro ao atualizar solicitação:', e);
      setUpdateError(e?.message || 'Erro ao atualizar solicitação. Tente novamente.');
    } finally {
      setUpdating((u) => ({ ...u, [id]: false }));
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchData();
      fetchStores();
    }
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();

    const periodDaysMap = {
      '7': 7,
      '30': 30,
      '90': 90,
      'all': null,
    } as const;
    const days = periodDaysMap[period];
    const threshold = days != null ? now - days * 24 * 60 * 60 * 1000 : null;

    return data
      .filter((s) => (status === 'all' ? true : s.status === status))
      .filter((s) => (selectedBuyer === 'all' ? true : s.productBuyer === selectedBuyer))
      .filter((s) => (selectedStore === 'all' ? true : s.storeId === selectedStore))
      .filter((s) => {
        if (!q) return true;
        return (
          (s.id || '').toLowerCase().includes(q) ||
          (s.userName || '').toLowerCase().includes(q) ||
          (s.storeName || '').toLowerCase().includes(q) ||
          (s.companyName || '').toLowerCase().includes(q)
        );
      })
      .filter((s) => {
        if (threshold == null) return true; // 'all'
        const date = new Date(s.createdAt);
        const ts = date.getTime();
        if (Number.isNaN(ts)) return false; // inválido fora do período
        return ts >= threshold;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
  }, [data, query, status, period, selectedBuyer, selectedStore]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  // Calculate stats
  const stats = useMemo(() => {
    const pendingCount = filtered.filter(s => s.status === 'pending').length;
    const batchedCount = filtered.filter(s => s.status === 'batched').length;
    const closedCount = filtered.filter(s => s.status === 'closed').length;
    const totalItems = filtered.reduce((sum, s) => sum + (s.items || 0), 0);
    const totalValue = filtered.reduce((sum, s) => sum + (s.total || 0), 0);

    console.log('📊 [Solicitações] Estatísticas:', {
      total: filtered.length,
      pending: pendingCount,
      batched: batchedCount,
      closed: closedCount,
    });

    return {
      total: filtered.length,
      pending: pendingCount,
      batched: batchedCount,
      closed: closedCount,
      items: totalItems,
      value: totalValue,
    };
  }, [filtered]);

  useEffect(() => {
    // reset page when filters change
    setPage(1);
  }, [query, status, period, selectedBuyer, selectedStore]);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#132440] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <FaFileAlt className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-lg">Solicitações</h1>
                <p className="text-[#E0E7EF] text-sm font-medium mt-1">Gerencie e acompanhe todas as solicitações</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Realtime Status Indicator */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm border ${
                  realtimeConnected
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100'
                    : 'bg-amber-500/20 border-amber-400/30 text-amber-100'
                }`}
              >
                {realtimeConnected ? (
                  <>
                    <MdWifi className="w-4 h-4" />
                    <span className="text-xs font-medium">Tempo Real</span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
                    </span>
                  </>
                ) : (
                  <>
                    <MdWifiOff className="w-4 h-4" />
                    <span className="text-xs font-medium">Offline</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <MdViewList className="w-5 h-5 text-white" />
                <span className="text-white font-bold">{filtered.length}</span>
                <span className="text-[#E0E7EF] text-sm">resultados</span>
              </div>

              <button
                onClick={() => { fetchData(); realtimeRefresh(); }}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <IoMdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Alerta de erro de atualização */}
        {updateError && (
          <div className="mb-6 bg-[#BF092F]/10 border-l-4 border-[#BF092F] rounded-xl p-5 flex items-start gap-4 shadow-lg animate-fade-in">
            <MdError className="w-6 h-6 text-[#BF092F] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[#BF092F] font-bold text-base">Erro ao atualizar solicitação</p>
              <p className="text-[#BF092F]/80 text-sm mt-1">{updateError}</p>
            </div>
            <button
              onClick={() => setUpdateError(null)}
              className="text-[#BF092F] hover:bg-[#BF092F]/10 rounded-lg p-2 transition-colors"
              aria-label="Fechar alerta"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-[#F5F5F5] to-white px-6 py-4 border-b border-[#E0E0E0]">
            <div className="flex items-center gap-3">
              <MdFilterList className="w-6 h-6 text-[#16476A]" />
              <h2 className="text-lg font-bold text-[#212121]">Filtros e Busca</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col gap-4">
              {/* First Row: Search, Buyer, Store */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <label className="block text-sm font-bold text-[#212121] mb-2">Buscar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                      <MdSearch className="w-5 h-5" />
                    </span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="ID, usuário, loja ou empresa..."
                      className="w-full pl-12 pr-4 py-3 border-2 border-[#BFC7C9] rounded-xl bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797]"
                    />
                  </div>
                </div>

                {/* Buyer Filter */}
                <div className="lg:w-64">
                  <label className="block text-sm font-bold text-[#212121] mb-2">Comprador</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                      <MdPerson className="w-5 h-5" />
                    </span>
                    <select
                      value={selectedBuyer}
                      onChange={(e) => setSelectedBuyer(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-[#BFC7C9] rounded-xl bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] appearance-none cursor-pointer"
                    >
                      <option value="all">Todos os compradores</option>
                      {buyers.map((buyer) => (
                        <option key={buyer.id} value={buyer.id}>
                          {buyer.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] pointer-events-none">
                      <MdFilterList className="w-5 h-5" />
                    </span>
                  </div>
                </div>

                {/* Store Filter */}
                <div className="lg:w-64">
                  <label className="block text-sm font-bold text-[#212121] mb-2">Loja</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                      <MdStore className="w-5 h-5" />
                    </span>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-[#BFC7C9] rounded-xl bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] appearance-none cursor-pointer"
                    >
                      <option value="all">Todas as lojas</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] pointer-events-none">
                      <MdFilterList className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Second Row: Status and Period */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-bold text-[#212121] mb-2">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'pending', 'batched', 'closed'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          console.log('🔘 [Solicitações] Status clicado:', st);
                          setStatus(st as any);
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                          (status === st)
                            ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white border-[#16476A] shadow-lg scale-105'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:bg-[#E0E7EF] hover:border-[#3B9797]/30'
                        }`}
                        title={st === 'all' ? 'Todos' : statusLabels[st as Status]}
                      >
                        {st !== 'all' && statusIcon[st as Status]}
                        {st === 'all' ? 'Todos' : statusLabels[st as Status]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Period Filter */}
                <div>
                  <label className="block text-sm font-bold text-[#212121] mb-2">Período</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['7', '30', '90', 'all'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          console.log('🔘 [Solicitações] Período clicado:', p);
                          setPeriod(p);
                        }}
                        className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                          (period === p)
                            ? 'bg-[#16476A] text-white border-[#16476A] shadow-lg'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:bg-[#F5F5F5] hover:border-[#3B9797]/30'
                        }`}
                      >
                        {p === 'all' ? 'Tudo' : `${p}d`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Solicitações */}
        <div className="space-y-4">
          {loading && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-[#E0E0E0]">
              <IoMdRefresh className="w-12 h-12 animate-spin text-[#16476A] mx-auto mb-4" />
              <p className="text-[#757575] font-medium">Carregando solicitações...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-[#E0E0E0]">
              <MdError className="w-16 h-16 text-[#BF092F] mx-auto mb-4" />
              <p className="text-[#BF092F] font-bold text-lg">{error}</p>
            </div>
          )}

          {!loading && !error && current.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-[#E0E0E0]">
              <FaBoxOpen className="w-16 h-16 text-[#757575] mx-auto mb-4 opacity-50" />
              <p className="text-[#757575] font-bold text-lg">Nenhuma solicitação encontrada</p>
              <p className="text-[#757575] text-sm mt-2">Tente ajustar os filtros de busca</p>
            </div>
          )}

          {!loading && !error && current.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/solicitacoes/${encodeURIComponent(s.id || '')}`)}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-[#E0E0E0] hover:border-[#3B9797]/50 overflow-hidden cursor-pointer transform hover:-translate-y-1"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left Section - User & Store Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-md">
                        <MdPerson className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#212121]">{s.userName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MdStore className="w-4 h-4 text-[#757575]" />
                          <p className="text-xs text-[#757575]">{s.storeName}</p>
                        </div>
                      </div>
                    </div>

                    {s.companyName && (
                      <div className="flex items-center gap-2 pl-12">
                        <MdBusiness className="w-4 h-4 text-[#757575]" />
                        <p className="text-xs text-[#757575]">{s.companyName}</p>
                      </div>
                    )}
                  </div>

                  {/* Middle Section - Stats */}
                  <div className="flex gap-4">
                    {s.items && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#E0E7EF] rounded-xl">
                        <MdShoppingCart className="w-5 h-5 text-[#16476A]" />
                        <div>
                          <p className="text-xs text-[#757575] font-medium">Itens</p>
                          <p className="text-base font-bold text-[#16476A]">{s.items}</p>
                        </div>
                      </div>
                    )}

                    {s.total && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#3B9797]/10 rounded-xl">
                        <MdAttachMoney className="w-5 h-5 text-[#3B9797]" />
                        <div>
                          <p className="text-xs text-[#757575] font-medium">Total</p>
                          <p className="text-base font-bold text-[#3B9797]">
                            {s.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Section - Status & Date */}
                  <div className="flex flex-col gap-3 lg:items-end">
                    <span className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl shadow-md ${statusStyles[s.status]}`}>
                      {statusIcon[s.status]}
                      {statusLabels[s.status]}
                    </span>

                    <div className="flex items-center gap-2 text-xs text-[#757575]">
                      <MdCalendarToday className="w-4 h-4" />
                      {(() => {
                        const date = new Date(s.createdAt);
                        return date.toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hover Effect Bar */}
              <div className="h-1 bg-gradient-to-r from-[#16476A] to-[#3B9797] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            </div>
          ))}
        </div>

        {/* Paginação */}
        {!loading && !error && current.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg border border-[#E0E0E0] p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E0E7EF] rounded-lg">
                  <MdViewList className="w-5 h-5 text-[#16476A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#212121]">
                    {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
                  </p>
                  <p className="text-xs text-[#757575]">
                    Página {page} de {totalPages}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E0E7EF] hover:border-[#3B9797]/30 transition-all duration-300 font-bold text-sm"
                  aria-label="Página anterior"
                >
                  <MdChevronLeft className="w-5 h-5" />
                  Anterior
                </button>

                <div className="hidden md:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all duration-300 ${
                          page === pageNum
                            ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white shadow-lg scale-110'
                            : 'bg-white border-2 border-[#E0E0E0] text-[#212121] hover:bg-[#E0E7EF] hover:border-[#3B9797]/30'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E0E7EF] hover:border-[#3B9797]/30 transition-all duration-300 font-bold text-sm"
                  aria-label="Próxima página"
                >
                  Próxima
                  <MdChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

