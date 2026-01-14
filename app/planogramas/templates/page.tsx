'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  Eye,
  LayoutGrid,
  ArrowLeft,
} from 'lucide-react';
import { PlanogramBase } from '@/lib/types/planogram';
import { useAuth } from '@/contexts/AuthContext';

export default function PlanogramTemplatesPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [planograms, setPlanograms] = useState<PlanogramBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'rascunho' | 'publicado'>('all');

  const fetchPlanograms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filter !== 'all') {
        params.append('status', filter);
      }

      // Obter token de autenticação
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base?${params}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Falha ao carregar templates');

      const data = await response.json();
      setPlanograms(data.planograms || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só buscar planogramas se o usuário estiver autenticado
    if (firebaseUser) {
      fetchPlanograms();
    }
  }, [filter, firebaseUser]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja arquivar este template?')) return;

    try {
      // Obter token de autenticação
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao arquivar template');
      }

      alert('Template arquivado com sucesso!');
      fetchPlanograms();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const statusColors: Record<string, string> = {
    rascunho: 'bg-[#BF092F] text-white',
    publicado: 'bg-[#3B9797] text-white',
    em_revisao: 'bg-[#3B9797] text-white',
    arquivado: 'bg-[#757575] text-white',
  };

  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho',
    publicado: 'Publicado',
    em_revisao: 'Em Revisão',
    arquivado: 'Arquivado',
  };

  const typeLabels: Record<string, string> = {
    normal: 'Normal',
    promocional: 'Promocional',
    sazonal: 'Sazonal',
    evento: 'Evento',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header com gradiente e padrão */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[#E0E7EF]">
              <button
                onClick={() => router.push('/planogramas')}
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Planogramas</span>
              </button>
              <span>/</span>
              <span className="text-white font-medium">Templates</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <LayoutGrid className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Templates de Planograma
                  </h1>
                  <p className="text-[#E0E7EF] text-base font-medium mt-2">
                    Gerencie os modelos base de planograma
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/planogramas/templates/novo')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Novo Template
                </button>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" />
              Filtrar por Status
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              {(['all', 'rascunho', 'publicado'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-6 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                    filter === status
                      ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white border-[#16476A] shadow-lg scale-105'
                      : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA] hover:scale-105'
                  }`}
                >
                  {status === 'all' ? 'Todos' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Templates */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-[#16476A] opacity-20 rounded-full animate-ping"></div>
              <RefreshCw className="w-16 h-16 animate-spin text-[#16476A] relative" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando templates...</h3>
            <p className="text-[#757575]">Por favor, aguarde enquanto buscamos os dados</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Erro ao Carregar
              </h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-[#BF092F] mb-6 text-lg font-medium">{error}</p>
              <button
                onClick={fetchPlanograms}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : planograms.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
              <h3 className="text-xl font-bold text-[#212121] flex items-center gap-2">
                <LayoutGrid className="w-6 h-6 text-[#16476A]" />
                Nenhum Template Encontrado
              </h3>
            </div>
            <div className="p-12 text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-3xl flex items-center justify-center">
                <LayoutGrid className="w-16 h-16 text-[#16476A]" />
              </div>
              <p className="text-[#757575] text-lg mb-6">
                {filter !== 'all'
                  ? `Não há templates com o status "${statusLabels[filter]}"`
                  : 'Ainda não há templates cadastrados. Crie seu primeiro template para começar!'}
              </p>
              <button
                onClick={() => router.push('/planogramas/templates/novo')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Template
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planograms.map((planogram) => (
              <div
                key={planogram.id}
                className="group bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Card Header com Status */}
                <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[#212121] mb-1 group-hover:text-[#16476A] transition-colors">
                        {planogram.name}
                      </h3>
                      <p className="text-sm text-[#757575] line-clamp-2">
                        {planogram.description || 'Sem descrição'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                        statusColors[planogram.status]
                      } shadow-md`}
                    >
                      {statusLabels[planogram.status]}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  {/* Info Boxes */}
                  <div className="space-y-3 mb-6">
                    {/* Tipo e Categoria */}
                    <div className="flex items-center gap-3 p-3 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                      <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-lg">
                        <LayoutGrid className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-[#16476A] font-medium mb-0.5">Tipo</p>
                        <p className="text-sm font-bold text-[#212121]">
                          {typeLabels[planogram.type]}
                        </p>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-xs text-[#16476A] font-medium mb-0.5">Categoria</p>
                        <p className="text-sm font-bold text-[#212121]">{planogram.category}</p>
                      </div>
                    </div>

                    {/* SKUs e Módulos */}
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center gap-2 p-3 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                        <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-lg">
                          <Copy className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-[#16476A] font-medium mb-0.5">SKUs</p>
                          <p className="text-lg font-bold text-[#212121]">{planogram.totalSKUs || 0}</p>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center gap-2 p-3 bg-[#E9ECEF] rounded-xl border border-[#E0E7EF]">
                        <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-lg">
                          <LayoutGrid className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-[#BF092F] font-medium mb-0.5">Módulos</p>
                          <p className="text-lg font-bold text-[#212121]">
                            {planogram.modules?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Versão */}
                    <div className="flex items-center gap-3 p-3 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                      <div className="p-2 bg-gradient-to-br from-[#132440] to-[#16476A] rounded-lg">
                        <RefreshCw className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-[#16476A] font-medium mb-0.5">Versão</p>
                        <p className="text-sm font-bold text-[#212121]">v{planogram.version}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/planogramas/templates/${planogram.id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-300 hover:scale-105"
                    >
                      <Eye className="w-4 h-4" />
                      Visualizar
                    </button>
                    <button
                      onClick={() => handleDelete(planogram.id)}
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#BF092F] hover:from-[#BF092F] hover:to-[#BF092F] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                      disabled={planogram.status === 'arquivado'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
