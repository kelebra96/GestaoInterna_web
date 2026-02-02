'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Search,
  ArrowLeft,
  Store,
  Eye,
  Calendar,
  Trash2,
} from 'lucide-react';
import { PlanogramStore, PlanogramStatus } from '@prisma/client'; // Use Prisma types
import { useAuth } from '@/contexts/AuthContext';

const statusLabels: Record<PlanogramStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  em_revisao: 'Em Revisão',
  arquivado: 'Arquivado',
};

const statusColors: Record<PlanogramStatus, string> = {
  rascunho: 'bg-[#E0E7EF] text-[#16476A] border border-[#3B9797]/30',
  publicado: 'bg-[#16476A] text-white border border-[#3B9797]/40',
  em_revisao: 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white border border-[#3B9797]/50',
  arquivado: 'bg-[#E0E0E0] text-[#757575] border border-[#E0E0E0]',
};

export default function PlanogramStoresPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [planograms, setPlanograms] = useState<(PlanogramStore & { slots: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanogramStatus | 'all'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPlanograms = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
      };

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/planograms/store?${params}`, { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao carregar planogramas');
      }

      const data = await response.json();
      setPlanograms(data.planograms || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar planogramas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchPlanograms();
    }
  }, [statusFilter, firebaseUser]);

  const handleDeletePlanogram = async (planogramId: string) => {
    if (!firebaseUser) {
      alert('Usuário não autenticado');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este planograma?')) {
      return;
    }

    try {
      setDeletingId(planogramId);
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/planograms/store/${planogramId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao excluir planograma');
      }

      setPlanograms((current) => current.filter((p) => p.id !== planogramId));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao excluir planograma');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPlanograms = planograms.filter((planogram) => {
    const matchesSearch =
      planogram.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      planogram.storeId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const planogramsByStore: Record<string, (PlanogramStore & { slots: any[] })[]> = {};
  filteredPlanograms.forEach((planogram) => {
    const storeIdentifier = planogram.storeId;
    if (!planogramsByStore[storeIdentifier]) {
      planogramsByStore[storeIdentifier] = [];
    }
    planogramsByStore[storeIdentifier].push(planogram);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -left-10 w-48 h-48 bg-white/15 blur-3xl rounded-full animate-[pulse_10s_ease-in-out_infinite]" />
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-[#BF092F]/12 blur-3xl rounded-full animate-[pulse_9s_ease-in-out_infinite]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[#E3EFFF]">
              <button
                onClick={() => router.push('/planogramas')}
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Planogramas</span>
              </button>
              <span>/</span>
              <span className="text-white font-medium">Por Loja</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <Store className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Planogramas por Loja
                  </h1>
                  <p className="text-[#E3EFFF] text-base font-medium mt-2">
                    Planogramas específicos de cada loja
                  </p>
                </div>
              </div>

              <button
                onClick={fetchPlanograms}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#16476A] px-6 py-4 flex items-center gap-2 text-white">
            <Search className="w-5 h-5" />
            <h2 className="text-lg font-bold">Filtros e Busca</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                <Search className="w-5 h-5" />
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por loja ou template..."
                className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B9797] focus:border-[#3B9797] font-medium bg-[#F8F9FA] transition-all"
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              {(['all', 'publicado', 'rascunho'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-6 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                    statusFilter === status
                      ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white border-[#3B9797] shadow-lg scale-105'
                      : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#3B9797] hover:bg-[#E0E7EF] hover:scale-105'
                  }`}
                >
                  {status === 'all' ? 'Todos' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Planogramas por Loja */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-[#16476A] opacity-20 rounded-full animate-ping"></div>
              <RefreshCw className="w-16 h-16 animate-spin text-[#16476A] relative" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando planogramas...</h3>
            <p className="text-[#757575]">Por favor, aguarde enquanto buscamos os dados</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">!</span>
                Erro ao Carregar
              </h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-[#BF092F] mb-6 text-lg font-medium">{error}</p>
              <button
                onClick={fetchPlanograms}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#3B9797] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : Object.keys(planogramsByStore).length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
              <h3 className="text-xl font-bold text-[#212121] flex items-center gap-2">
                <Store className="w-6 h-6 text-[#16476A]" />
                Nenhum Planograma Encontrado
              </h3>
            </div>
            <div className="p-12 text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#E0E7EF] to-[#F8F9FA] rounded-3xl flex items-center justify-center">
                <Store className="w-16 h-16 text-[#16476A]" />
              </div>
              <p className="text-[#757575] text-lg mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? 'Nenhum planograma encontrado com os filtros aplicados'
                  : 'Ainda não há planogramas por loja cadastrados'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#3B9797] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(planogramsByStore).map(([storeIdentifier, storePlanograms]) => (
              <div key={storeIdentifier} className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                {/* Header da loja */}
                <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-5 border-b border-[#E0E0E0]">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-2xl shadow-lg border border-[#3B9797]/30">
                      <Store className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-[#212121]">{storeIdentifier}</h2>
                      <p className="text-sm text-[#757575] font-medium">
                        {storePlanograms.length} planograma(s)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Planogramas da loja */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {storePlanograms.map((planogram) => (
                      <div
                        key={planogram.id}
                        className="group border-2 border-[#E0E0E0] rounded-xl p-5 bg-gradient-to-br from-white to-[#F8F9FA] hover:border-[#3B9797] transition-all duration-300 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-[#212121] mb-1 group-hover:text-[#16476A] transition-colors">
                              {planogram.name}
                            </h3>
                          </div>
                          <span
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                              statusColors[planogram.status]
                            } shadow-md`}
                          >
                            {statusLabels[planogram.status]}
                          </span>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between p-3 bg-[#E0E7EF] rounded-lg border border-[#3B9797]/25">
                            <span className="text-sm font-bold text-[#16476A]">SKUs</span>
                            <span className="text-lg font-bold text-[#212121]">
                              {planogram.slots?.length || 0}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-[#E9ECEF] rounded-lg border border-[#E0E0E0]">
                            <span className="text-sm font-bold text-[#757575]">Ajustes</span>
                            <span className="text-lg font-bold text-[#212121]">
                              {(planogram.adjustments as any)?.length || 0}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg border border-[#E0E0E0]">
                            <Calendar className="w-4 h-4 text-[#16476A]" />
                            <span className="text-xs font-bold text-[#16476A]">
                              Atualizado em {new Date(planogram.updatedAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => router.push(`/planogramas/lojas/${planogram.id}`)}
                          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#3B9797] hover:to-[#16476A] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-300 hover:scale-105"
                        >
                          <Eye className="w-5 h-5" />
                          Ver Detalhes
                        </button>

                        <button
                          onClick={() => handleDeletePlanogram(planogram.id)}
                          disabled={deletingId === planogram.id}
                          className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-white border-2 border-[#E0E0E0] text-[#BF092F] hover:bg-[#FCECEF] hover:border-[#BF092F] px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition-all duration-300 disabled:opacity-50"
                        >
                          <Trash2 className="w-5 h-5" />
                          {deletingId === planogram.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
