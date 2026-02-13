'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Package, Plus, CheckCircle2, XCircle, Clock, PlayCircle, Pause } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Inventory, InventoryStatus, INVENTORY_STATUS } from '@/lib/types/inventory';

interface InventoryWithDetails extends Inventory {
  storeName?: string;
  companyName?: string;
}

export default function InventarioPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<InventoryWithDetails[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtros
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchData = async () => {
    try {
      setLoading(true);

      // Force token refresh to get updated custom claims
      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Construir URL com filtros
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (storeFilter !== 'all') {
        params.append('storeId', storeFilter);
      }

      const [inventariosRes, lojasRes, empresasRes] = await Promise.all([
        fetch(`/api/inventario?${params.toString()}`, { cache: 'no-store', headers }),
        fetch('/api/lojas', { cache: 'no-store', headers }),
        fetch('/api/empresas', { cache: 'no-store', headers }),
      ]);

      if (!inventariosRes.ok) throw new Error('Falha ao carregar inventários');
      if (!lojasRes.ok) throw new Error('Falha ao carregar lojas');
      if (!empresasRes.ok) throw new Error('Falha ao carregar empresas');

      const inventariosJson = await inventariosRes.json();
      const lojasJson = await lojasRes.json();
      const empresasJson = await empresasRes.json();

      setStores(lojasJson.lojas || []);
      setCompanies(empresasJson.empresas || []);

      const inventoriesWithDetails: InventoryWithDetails[] = (inventariosJson.inventarios || []).map((inv: Inventory) => {
        const store = (lojasJson.lojas || []).find((s: any) => s.id === inv.storeId);
        const company = (empresasJson.empresas || []).find((c: any) => c.id === inv.companyId);

        return {
          ...inv,
          storeName: store?.name,
          companyName: company?.name,
        };
      });

      setData(inventoriesWithDetails);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchData();
    }
  }, [firebaseUser, statusFilter, storeFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data
      .filter((inv) => {
        if (!q) return true;
        return (
          inv.name.toLowerCase().includes(q) ||
          (inv.storeName || '').toLowerCase().includes(q) ||
          (inv.companyName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : (a.createdAt as any).toDate?.() || new Date(0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : (b.createdAt as any).toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [query, statusFilter, storeFilter]);

  const getStatusIcon = (status: InventoryStatus) => {
    switch (status) {
      case 'preparation': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <PlayCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: InventoryStatus) => {
    const colors = {
      preparation: 'from-[#9E9E9E]/10 to-[#757575]/10 text-[#757575] border-[#9E9E9E]/30',
      in_progress: 'from-[#3B9797]/10 to-[#16476A]/10 text-[#16476A] border-[#3B9797]/30',
      completed: 'from-[#4CAF50]/10 to-[#2E7D32]/10 text-[#2E7D32] border-[#4CAF50]/30',
      cancelled: 'from-[#BF092F]/10 to-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30',
    };
    return colors[status];
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32]' : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F]'}`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {toast.message}
            </div>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                    <Package className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                      Inventários
                    </h1>
                    <p className="text-[#E0E7EF] text-base font-medium mt-2">
                      Gerencie inventários de estoque das lojas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/inventario/novo')}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Inventário
                  </button>
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
          {/* Filtros */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros e Busca
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, loja ou empresa..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                  />
                </div>

                <div className="flex-1">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white transition-all"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="preparation">Preparação</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div className="flex-1">
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white transition-all"
                  >
                    <option value="all">Todas as Lojas</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            {loading && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#212121]">Carregando inventários...</p>
                <p className="text-sm text-[#757575] mt-2">Aguarde enquanto buscamos os dados</p>
              </div>
            )}

            {!loading && error && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#BF092F] mb-6">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
                <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar os inventários</p>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className="w-5 h-5" />
                  Tentar Novamente
                </button>
              </div>
            )}

            {!loading && !error && current.length === 0 && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#FF9800] to-[#F57C00] mb-6">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#212121] mb-2">Nenhum inventário encontrado</p>
                <p className="text-sm text-[#757575] mb-6">
                  {filtered.length === 0 && data.length > 0
                    ? 'Tente ajustar os filtros para ver mais resultados'
                    : 'Comece criando um novo inventário'}
                </p>
                <button
                  onClick={() => router.push('/inventario/novo')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Criar Primeiro Inventário
                </button>
              </div>
            )}

            {!loading && !error && current.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E0E0E0]">
                    <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Inventário</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Loja</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Progresso</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E0E0E0]">
                      {current.map((inv) => {
                        const progress = inv.totalItemsExpected > 0
                          ? Math.round((inv.totalItemsCounted / inv.totalItemsExpected) * 100)
                          : 0;

                        return (
                          <tr
                            key={inv.id}
                            onClick={() => router.push(`/inventario/${inv.id}`)}
                            className="hover:bg-gradient-to-r hover:from-[#E0E7EF] hover:to-white transition-all duration-300 cursor-pointer group hover:shadow-md"
                          >
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-lg">
                                  <Package className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-sm font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                                  {inv.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="text-sm font-medium text-[#212121] bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E0E0E0]">
                                {inv.storeName || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className={`px-3 py-2 inline-flex items-center gap-2 text-xs font-bold rounded-xl border bg-gradient-to-r ${getStatusColor(inv.status)} shadow-sm`}>
                                {getStatusIcon(inv.status)}
                                {INVENTORY_STATUS[inv.status].name}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-[#E0E0E0] rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-bold text-[#212121] min-w-[3rem] text-right">
                                  {progress}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="text-sm font-medium text-[#212121]">
                                {(() => {
                                  const date = inv.createdAt instanceof Date ? inv.createdAt : (inv.createdAt as any).toDate?.() || new Date(0);
                                  return date.toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                  });
                                })()}
                              </div>
                              <div className="text-xs text-[#757575] mt-1">
                                {(() => {
                                  const date = inv.createdAt instanceof Date ? inv.createdAt : (inv.createdAt as any).toDate?.() || new Date(0);
                                  return date.toLocaleTimeString('pt-BR', {
                                    hour: '2-digit', minute: '2-digit'
                                  });
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] border-t-2 border-[#E0E0E0] px-6 py-5">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                        <span className="text-sm font-bold text-[#16476A]">{filtered.length}</span>
                        <span className="text-sm text-[#757575] ml-1">
                          {filtered.length === 1 ? 'resultado' : 'resultados'}
                        </span>
                      </div>
                      <div className="px-4 py-2 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                        <span className="text-sm text-[#757575]">Página </span>
                        <span className="text-sm font-bold text-[#16476A]">{page}</span>
                        <span className="text-sm text-[#757575]"> de </span>
                        <span className="text-sm font-bold text-[#16476A]">{totalPages}</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
                      >
                        « Anterior
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
                      >
                        Próxima »
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
