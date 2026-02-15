'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Search,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Calendar,
  Store,
  User,
} from 'lucide-react';
import { ComplianceExecution } from '@/lib/types/planogram';

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  atrasado: 'Atrasado',
  nao_conforme: 'Não Conforme',
};

const statusColors: Record<string, string> = {
  pendente: 'bg-[#2196F3] text-white',
  em_andamento: 'bg-[#FF9800] text-white',
  concluido: 'bg-[#4CAF50] text-white',
  atrasado: 'bg-[#E82129] text-white',
  nao_conforme: 'bg-[#FF5722] text-white',
};

export default function PlanogramExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<ComplianceExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/compliance/executions?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Falha ao carregar execuções');

      const data = await response.json();
      setExecutions(data.executions || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar execuções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [statusFilter]);

  const filteredExecutions = executions.filter((execution) => {
    const matchesSearch =
      execution.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.executedByName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#4CAF50]';
    if (score >= 60) return 'text-[#FF9800]';
    return 'text-[#E82129]';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-[#4CAF50]';
    if (score >= 60) return 'bg-[#FF9800]';
    return 'bg-[#E82129]';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#1F53A2] via-[#2E67C3] to-[#5C94CC] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
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
              <span className="text-white font-medium">Execuções</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Execuções de Planograma
                  </h1>
                  <p className="text-[#E3EFFF] text-base font-medium mt-2">
                    Visualize o histórico de conformidade
                  </p>
                </div>
              </div>

              <button
                onClick={fetchExecutions}
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
          <div className="bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              Filtros e Busca
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                  <Search className="w-5 h-5" />
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por loja ou responsável..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium transition-all"
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                {(['all', 'concluido', 'nao_conforme'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-6 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                      statusFilter === status
                        ? 'bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] text-white border-[#1F53A2] shadow-lg scale-105'
                        : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#1F53A2] hover:bg-[#F8F9FA] hover:scale-105'
                    }`}
                  >
                    {status === 'all' ? 'Todos' : statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Execuções */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-[#1F53A2] opacity-20 rounded-full animate-ping"></div>
              <RefreshCw className="w-16 h-16 animate-spin text-[#1F53A2] relative" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando execuções...</h3>
            <p className="text-[#757575]">Por favor, aguarde enquanto buscamos os dados</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#E82129] to-[#C62828] px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Erro ao Carregar
              </h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-[#E82129] mb-6 text-lg font-medium">{error}</p>
              <button
                onClick={fetchExecutions}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] hover:from-[#153D7A] hover:to-[#1F53A2] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 py-4 border-b border-[#E0E0E0]">
              <h3 className="text-xl font-bold text-[#212121] flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-[#1F53A2]" />
                Nenhuma Execução Encontrada
              </h3>
            </div>
            <div className="p-12 text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#E3EFFF] to-[#C8DDFF] rounded-3xl flex items-center justify-center">
                <Calendar className="w-16 h-16 text-[#1F53A2]" />
              </div>
              <p className="text-[#757575] text-lg mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? 'Nenhuma execução encontrada com os filtros aplicados'
                  : 'Ainda não há execuções de planograma registradas'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] hover:from-[#153D7A] hover:to-[#1F53A2] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredExecutions.map((execution) => (
              <div
                key={execution.id}
                className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row gap-6 p-6">
                  {/* Score Circle */}
                  <div className="flex-shrink-0 flex justify-center md:justify-start">
                    <div className="relative">
                      <div
                        className={`w-28 h-28 rounded-full ${getScoreBg(
                          execution.complianceScore
                        )} flex items-center justify-center shadow-2xl`}
                      >
                        <div className="text-center">
                          <div className="text-4xl font-bold text-white">
                            {execution.complianceScore}
                          </div>
                          <div className="text-sm text-white opacity-90 font-bold">%</div>
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-lg">
                        {execution.complianceScore >= 80 ? (
                          <CheckCircle className="w-6 h-6 text-[#4CAF50]" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-[#E82129]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-[#212121] mb-2">
                          Planograma #{execution.id.substring(0, 8)}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`px-3 py-1.5 text-sm font-bold rounded-lg ${
                              statusColors[execution.status]
                            } shadow-md`}
                          >
                            {statusLabels[execution.status]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Informações Básicas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="flex items-center gap-3 p-3 bg-[#E3EFFF] rounded-lg border border-[#B3D7FF]">
                        <Store className="w-5 h-5 text-[#1F53A2]" />
                        <div>
                          <p className="text-xs font-bold text-[#1F53A2]">Loja</p>
                          <p className="text-sm font-bold text-[#212121]">{execution.storeName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-[#E8F5E9] rounded-lg border border-[#C8E6C9]">
                        <User className="w-5 h-5 text-[#2E7D32]" />
                        <div>
                          <p className="text-xs font-bold text-[#2E7D32]">Executado por</p>
                          <p className="text-sm font-bold text-[#212121]">{execution.executedByName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
                        <Calendar className="w-5 h-5 text-[#E65100]" />
                        <div>
                          <p className="text-xs font-bold text-[#E65100]">Data</p>
                          <p className="text-sm font-bold text-[#212121]">
                            {new Date(execution.executedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Métricas de IA */}
                    {execution.aiAnalysis && (
                      <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] rounded-xl p-4 border border-[#E0E0E0]">
                        <h4 className="text-sm font-bold text-[#212121] mb-3 flex items-center gap-2">
                          <span className="text-lg">🤖</span>
                          Análise por IA
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-white rounded-lg border border-[#81C784] shadow-sm">
                            <div className="text-xs font-bold text-[#2E7D32] mb-1">Detectados</div>
                            <div className="text-2xl font-bold text-[#4CAF50]">
                              {execution.aiAnalysis.productsDetected}
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-[#E57373] shadow-sm">
                            <div className="text-xs font-bold text-[#C62828] mb-1">Faltando</div>
                            <div className="text-2xl font-bold text-[#E82129]">
                              {execution.aiAnalysis.productsMissing}
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-[#FFB74D] shadow-sm">
                            <div className="text-xs font-bold text-[#E65100] mb-1">Fora de Posição</div>
                            <div className="text-2xl font-bold text-[#FF9800]">
                              {execution.aiAnalysis.productsWrongPosition}
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-[#64B5F6] shadow-sm">
                            <div className="text-xs font-bold text-[#0D47A1] mb-1">Gaps</div>
                            <div className="text-2xl font-bold text-[#2196F3]">
                              {execution.aiAnalysis.gaps}
                            </div>
                          </div>
                        </div>

                        {execution.aiAnalysis.issues && execution.aiAnalysis.issues.length > 0 && (
                          <div className="mt-3 p-3 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
                            <p className="text-sm font-bold text-[#E65100]">
                              ⚠️ {execution.aiAnalysis.issues.length} problema(s) detectado(s)
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fotos */}
                    {execution.photos && execution.photos.length > 0 && (
                      <div className="mt-4 p-3 bg-[#E3F2FD] rounded-lg border border-[#B3E5FC] flex items-center gap-2">
                        <Eye className="w-5 h-5 text-[#2196F3]" />
                        <p className="text-sm font-bold text-[#0D47A1]">
                          {execution.photos.length} foto(s) capturada(s)
                        </p>
                      </div>
                    )}
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
