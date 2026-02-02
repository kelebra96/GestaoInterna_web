'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  RefreshCw,
  Store,
  Package,
  Layers,
  Calendar,
  User,
  AlertCircle,
  Eye,
  Zap,
  X,
  ShoppingCart,
  Brain,
} from 'lucide-react';
import { PlanogramBase } from '@/lib/types/planogram';
import { useAuth } from '@/contexts/AuthContext';

interface StoreOption {
  id: string;
  name: string;
  code?: string;
}

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  em_revisao: 'Em Revisão',
  expirado: 'Expirado',
  arquivado: 'Arquivado',
};

const statusColors: Record<string, string> = {
  rascunho: 'bg-[#BF092F] text-white',
  publicado: 'bg-[#3B9797] text-white',
  em_revisao: 'bg-[#3B9797] text-white',
  expirado: 'bg-[#757575] text-white',
  arquivado: 'bg-[#132440] text-white',
};

const typeLabels: Record<string, string> = {
  normal: 'Normal',
  promocional: 'Promocional',
  sazonal: 'Sazonal',
  evento: 'Evento',
};

export default function PlanogramTemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [planogram, setPlanogram] = useState<PlanogramBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const fetchPlanogram = async () => {
    try {
      setLoading(true);

      // Obter token de autenticação
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base/${id}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Template não encontrado');
        }
        if (response.status === 403) {
          throw new Error('Você não tem permissão para visualizar este template');
        }
        throw new Error('Falha ao carregar template');
      }

      const data = await response.json();
      setPlanogram(data.planogram);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && firebaseUser) {
      fetchPlanogram();
    }
  }, [id, firebaseUser]);

  const handleDelete = async () => {
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
      router.push('/planogramas/templates');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Deseja publicar este template?')) return;

    try {
      // Obter token de autenticação
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'publicado' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao publicar template');
      }

      alert('Template publicado com sucesso!');
      fetchPlanogram();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const fetchStores = async () => {
    try {
      if (!firebaseUser) {
        console.error('Usuário não autenticado');
        return;
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch('/api/lojas', {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || data.lojas || []);
      }
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
    }
  };

  const handleOpenGenerateModal = async () => {
    if (planogram?.status !== 'publicado') {
      alert('O template precisa estar publicado antes de gerar para lojas');
      return;
    }
    await fetchStores();
    setShowGenerateModal(true);
  };

  const handleGenerateForStores = async () => {
    if (selectedStores.length === 0) {
      alert('Selecione pelo menos uma loja');
      return;
    }

    if (!firebaseUser) {
      alert('Usuário não autenticado');
      return;
    }

    try {
      setGenerating(true);
      let successCount = 0;
      let errorCount = 0;

      // Obter token uma vez antes do loop
      const token = await firebaseUser.getIdToken();

      for (const storeId of selectedStores) {
        try {
          const response = await fetch('/api/planograms/store', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              basePlanogramId: id,
              storeId,
              autoGenerate: true,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            let errorData: any = null;
            try {
              errorData = await response.json();
            } catch {
              try {
                const text = await response.text();
                errorData = text ? { error: text } : null;
              } catch {
                errorData = null;
              }
            }
            console.error(`Erro ao gerar para loja ${storeId}:`, {
              status: response.status,
              statusText: response.statusText,
              body: errorData,
            });
            errorCount++;
          }
        } catch (error) {
          console.error(`Erro ao gerar para loja ${storeId}:`, error);
          errorCount++;
        }
      }

      setShowGenerateModal(false);
      setSelectedStores([]);

      if (errorCount === 0) {
        alert(`Planogramas gerados com sucesso para ${successCount} loja(s)!`);
      } else {
        alert(
          `Geração concluída:\n✓ ${successCount} sucesso(s)\n✗ ${errorCount} erro(s)`
        );
      }

      router.push('/planogramas/lojas');
    } catch (error: any) {
      alert('Erro ao gerar planogramas: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleStoreSelection = (storeId: string) => {
    if (selectedStores.includes(storeId)) {
      setSelectedStores(selectedStores.filter((id) => id !== storeId));
    } else {
      setSelectedStores([...selectedStores, storeId]);
    }
  };

  const selectAllStores = () => {
    if (selectedStores.length === stores.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(stores.map((s) => s.id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-12 text-center max-w-md w-full">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-[#16476A] opacity-20 rounded-full animate-ping"></div>
            <RefreshCw className="w-16 h-16 animate-spin text-[#16476A] relative" />
          </div>
          <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando template...</h3>
          <p className="text-[#757575]">Por favor, aguarde enquanto buscamos os dados</p>
        </div>
      </div>
    );
  }

  if (error || !planogram) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] px-6 py-5">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertCircle className="w-6 h-6" />
                </div>
                Erro ao Carregar Template
              </h3>
            </div>
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-3xl flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-[#BF092F]" />
              </div>
              <p className="text-[#BF092F] mb-8 text-lg font-medium">{error || 'Template não encontrado'}</p>
              <button
                onClick={() => router.push('/planogramas/templates')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar para Templates
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
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
                className="hover:text-white transition-colors"
              >
                Planogramas
              </button>
              <span>/</span>
              <button
                onClick={() => router.push('/planogramas/templates')}
                className="hover:text-white transition-colors"
              >
                Templates
              </button>
              <span>/</span>
              <span className="text-white font-medium">{planogram.name}</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <Layers className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                      {planogram.name}
                    </h1>
                    <span className={`px-3 py-1.5 text-sm font-bold rounded-lg ${statusColors[planogram.status]} shadow-md`}>
                      {statusLabels[planogram.status]}
                    </span>
                  </div>
                  {planogram.description && (
                    <p className="text-[#E0E7EF] text-base font-medium mt-2">
                      {planogram.description}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push('/planogramas/templates')}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Ações */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Ações Disponíveis
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Ação Principal - Publicar/Gerar */}
              {planogram.status === 'rascunho' && (
                <button
                  onClick={handlePublish}
                  className="col-span-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-6 py-4 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <CheckCircle className="w-5 h-5" />
                  Publicar Template
                </button>
              )}
              {planogram.status === 'publicado' && (
                <button
                  onClick={handleOpenGenerateModal}
                  className="col-span-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#BF092F] hover:from-[#BF092F] hover:to-[#BF092F] text-white px-6 py-4 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <Zap className="w-5 h-5" />
                  Gerar para Lojas
                </button>
              )}

              {/* Ações Secundárias */}
              <button
                onClick={() => router.push(`/planogramas/templates/${id}/planejamento`)}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#132440] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Brain className="w-5 h-5" />
                <span className="hidden md:inline">Planejamento de Categoria</span>
                <span className="md:hidden">Planejamento</span>
              </button>
              <button
                onClick={() => router.push(`/planogramas/templates/${id}/produtos`)}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#132440] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="hidden md:inline">Produtos ({planogram.totalSKUs || 0})</span>
                <span className="md:hidden">Produtos</span>
              </button>
              <button
                onClick={() => router.push(`/planogramas/templates/${id}/editar`)}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Edit className="w-5 h-5" />
                Editar
              </button>

              {/* Ações de Utilidade */}
              <button
                onClick={fetchPlanogram}
                className="inline-flex items-center justify-center gap-2 bg-white border-2 border-[#E0E0E0] text-[#212121] hover:bg-[#F8F9FA] hover:border-[#16476A] px-4 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Atualizar
              </button>

              {planogram.status !== 'arquivado' && (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#BF092F] hover:from-[#BF092F] hover:to-[#BF092F] text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <Trash2 className="w-5 h-5" />
                  Arquivar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações Básicas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
                <h2 className="text-xl font-bold text-[#212121] flex items-center gap-2">
                  <Package className="w-6 h-6 text-[#16476A]" />
                  Informações Básicas
                </h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#16476A] mb-2">
                      Tipo
                    </label>
                    <p className="text-lg font-bold text-[#212121]">{typeLabels[planogram.type]}</p>
                  </div>

                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#16476A] mb-2">
                      Categoria
                    </label>
                    <p className="text-lg font-bold text-[#212121]">{planogram.category}</p>
                  </div>

                  {planogram.subcategory && (
                    <div className="p-4 bg-[#E9ECEF] rounded-xl border border-[#E0E7EF]">
                      <label className="block text-sm font-bold text-[#BF092F] mb-2">
                        Subcategoria
                      </label>
                      <p className="text-lg font-bold text-[#212121]">{planogram.subcategory}</p>
                    </div>
                  )}

                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#16476A] mb-2">
                      Versão
                    </label>
                    <p className="text-lg font-bold text-[#212121]">v{planogram.version}</p>
                  </div>

                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#3B9797] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Duração Estimada
                    </label>
                    <p className="text-lg font-bold text-[#212121]">
                      {planogram.estimatedDuration || 0} minutos
                    </p>
                  </div>

                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#16476A] mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Criado por
                    </label>
                    <p className="text-lg font-bold text-[#212121]">
                      {planogram.createdByName || 'Sistema'}
                    </p>
                  </div>

                  <div className="p-4 bg-[#E9ECEF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#BF092F] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Criado em
                    </label>
                    <p className="text-lg font-bold text-[#212121]">
                      {new Date(planogram.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="p-4 bg-[#E0E7EF] rounded-xl border border-[#E0E7EF]">
                    <label className="block text-sm font-bold text-[#16476A] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Atualizado em
                    </label>
                    <p className="text-lg font-bold text-[#212121]">
                      {new Date(planogram.updatedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Requisitos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <CheckCircle className="w-6 h-6 text-[#3B9797]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#132440]">Requer Foto</p>
                      <p className="text-xl font-bold text-[#212121]">
                        {planogram.requiresPhoto ? 'Sim' : 'Não'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <Edit className="w-6 h-6 text-[#3B9797]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#132440]">Requer Assinatura</p>
                      <p className="text-xl font-bold text-[#212121]">
                        {planogram.requiresSignature ? 'Sim' : 'Não'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Módulos */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
                <h2 className="text-xl font-bold text-[#212121] flex items-center gap-2">
                  <Layers className="w-6 h-6 text-[#BF092F]" />
                  Módulos da Gôndola
                </h2>
              </div>

              <div className="p-6">
                {planogram.modules && planogram.modules.length > 0 ? (
                  <div className="space-y-4">
                    {planogram.modules.map((module, index) => (
                      <div
                        key={module.id}
                        className="border-2 border-[#E0E0E0] rounded-xl p-5 bg-gradient-to-br from-white to-[#F8F9FA] hover:border-[#BF092F] transition-all duration-300 hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-lg">
                              <Layers className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-[#212121]">
                              {module.name || `Módulo ${index + 1}`}
                            </h3>
                          </div>
                          <span className="px-3 py-1 bg-[#E9ECEF] border border-[#E0E7EF] text-[#BF092F] text-sm font-bold rounded-lg">
                            Ordem: {module.order}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="p-3 bg-[#E0E7EF] rounded-lg border border-[#E0E7EF]">
                            <span className="text-xs font-bold text-[#16476A] block mb-1">Largura</span>
                            <p className="text-lg font-bold text-[#212121]">{module.width} cm</p>
                          </div>
                          <div className="p-3 bg-[#E0E7EF] rounded-lg border border-[#E0E7EF]">
                            <span className="text-xs font-bold text-[#16476A] block mb-1">Altura</span>
                            <p className="text-lg font-bold text-[#212121]">{module.height} cm</p>
                          </div>
                          <div className="p-3 bg-[#E9ECEF] rounded-lg border border-[#E0E7EF]">
                            <span className="text-xs font-bold text-[#BF092F] block mb-1">Profundidade</span>
                            <p className="text-lg font-bold text-[#212121]">{module.depth} cm</p>
                          </div>
                          <div className="p-3 bg-[#E0E7EF] rounded-lg border border-[#E0E7EF]">
                            <span className="text-xs font-bold text-[#16476A] block mb-1">Prateleiras</span>
                            <p className="text-lg font-bold text-[#212121]">
                              {module.shelves?.length || 0}
                            </p>
                          </div>
                        </div>

                        {module.corridor && (
                          <div className="p-3 bg-[#E0E7EF] rounded-lg border border-[#E0E7EF]">
                            <span className="text-xs font-bold text-[#3B9797] block mb-1">Corredor/Seção</span>
                            <span className="text-sm font-bold text-[#212121]">{module.corridor}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-2xl flex items-center justify-center">
                      <Layers className="w-10 h-10 text-[#BF092F]" />
                    </div>
                    <p className="text-[#757575] text-lg">Nenhum módulo configurado</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Métricas */}
          <div className="space-y-6">
            {/* KPIs */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
                <h2 className="text-xl font-bold text-[#212121]">Métricas</h2>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Package className="w-6 h-6 text-[#3B9797]" />
                    </div>
                    <p className="text-sm font-bold text-[#132440]">Total de SKUs</p>
                  </div>
                  <p className="text-3xl font-bold text-[#212121] ml-14">
                    {planogram.totalSKUs || 0}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Eye className="w-6 h-6 text-[#3B9797]" />
                    </div>
                    <p className="text-sm font-bold text-[#132440]">Total de Frentes</p>
                  </div>
                  <p className="text-3xl font-bold text-[#212121] ml-14">
                    {planogram.totalFacings || 0}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Layers className="w-6 h-6 text-[#BF092F]" />
                    </div>
                    <p className="text-sm font-bold text-[#BF092F]">Módulos</p>
                  </div>
                  <p className="text-3xl font-bold text-[#212121] ml-14">
                    {planogram.modules?.length || 0}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#E0E7EF] shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Store className="w-6 h-6 text-[#132440]" />
                    </div>
                    <p className="text-sm font-bold text-[#132440]">Utilização de Espaço</p>
                  </div>
                  <p className="text-3xl font-bold text-[#212121] ml-14">
                    {planogram.spaceUtilization || 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Nota informativa */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#3B9797] to-[#3B9797] px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Próximos Passos
                </h3>
              </div>
              <div className="p-6">
                <p className="text-[#212121] leading-relaxed">
                  Este template pode ser usado para gerar planogramas específicos para cada loja, adaptando automaticamente para produtos em estoque.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Gerar para Lojas */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-slideUp">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white px-6 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Zap className="w-6 h-6" />
                      </div>
                      Gerar Planogramas para Lojas
                    </h2>
                    <p className="text-sm text-white/90 mt-2">
                      Selecione as lojas para gerar planogramas automaticamente
                    </p>
                  </div>
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="text-white hover:bg-white/20 p-2 rounded-lg transition-all hover:scale-110"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {stores.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-2xl flex items-center justify-center">
                      <Store className="w-10 h-10 text-[#BF092F]" />
                    </div>
                    <p className="text-[#757575] text-lg">Nenhuma loja encontrada</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 pb-4 border-b-2 border-[#E0E0E0] flex items-center justify-between">
                      <button
                        onClick={selectAllStores}
                        className="inline-flex items-center gap-2 text-sm text-white bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] font-bold px-4 py-2 rounded-lg transition-all hover:scale-105"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {selectedStores.length === stores.length
                          ? 'Desmarcar todas'
                          : 'Selecionar todas'}
                      </button>
                      <div className="px-4 py-2 bg-[#E0E7EF] border border-[#E0E7EF] rounded-lg">
                        <span className="text-sm font-bold text-[#16476A]">
                          {selectedStores.length} de {stores.length} selecionada(s)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {stores.map((store) => (
                        <label
                          key={store.id}
                          className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                            selectedStores.includes(store.id)
                              ? 'border-[#BF092F] bg-gradient-to-r from-[#E9ECEF] to-white shadow-md'
                              : 'border-[#E0E0E0] hover:border-[#BF092F] hover:bg-[#F8F9FA]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStores.includes(store.id)}
                            onChange={() => toggleStoreSelection(store.id)}
                            className="w-5 h-5 text-[#BF092F] border-2 border-[#E0E0E0] rounded focus:ring-[#BF092F] focus:ring-2"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-lg">
                              <Store className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-[#212121]">{store.name}</p>
                              {store.code && (
                                <p className="text-sm text-[#757575]">Código: {store.code}</p>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-5 border-t-2 border-[#E0E0E0]">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] flex-1">
                    <p className="text-sm font-bold text-[#212121] mb-1">
                      <strong className="text-[#BF092F]">Modo:</strong> Geração Automática
                    </p>
                    <p className="text-xs text-[#757575]">
                      O sistema ajustará automaticamente baseado no estoque de cada loja
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    disabled={generating}
                    className="flex-1 px-6 py-3 border-2 border-[#E0E0E0] text-[#212121] hover:bg-white hover:border-[#16476A] rounded-xl font-bold transition-all disabled:opacity-50 hover:scale-105"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerateForStores}
                    disabled={generating || selectedStores.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#BF092F] hover:from-[#BF092F] hover:to-[#BF092F] text-white px-6 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Gerar Planogramas ({selectedStores.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
