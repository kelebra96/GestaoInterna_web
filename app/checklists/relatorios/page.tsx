'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckSquare,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  FileText,
  BarChart3,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateChecklistPDF } from '@/lib/utils/generateChecklistPDF';

interface ChecklistExecution {
  id: string;
  templateName: string;
  templateType: string;
  storeName: string;
  storeId: string;
  userName: string;
  status: string;
  progress: number;
  completedAt?: string;
  createdAt: string;
  answers: any[];
}

interface Loja {
  id: string;
  name: string;
}

export default function RelatoriosPage() {
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);

      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Buscar lojas
      const lojasRes = await fetch('/api/lojas', {
        cache: 'no-store',
        headers,
      });

      if (lojasRes.ok) {
        const data = await lojasRes.json();
        setLojas(data.lojas || []);
      }

      // Buscar execuções
      const params = new URLSearchParams();

      if (selectedStore !== 'all') {
        params.append('storeId', selectedStore);
      }

      const executionsRes = await fetch(`/api/checklist-executions?${params}`, {
        cache: 'no-store',
        headers,
      });

      if (!executionsRes.ok) throw new Error('Falha ao carregar execuções');

      const data = await executionsRes.json();
      setExecutions(data.executions || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchData();
    }
  }, [firebaseUser, selectedStore]);

  // Calcular período
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (selectedPeriod === 'custom') {
      return {
        startDate: customStartDate ? new Date(customStartDate) : null,
        endDate: customEndDate ? new Date(customEndDate) : null,
      };
    }

    if (selectedPeriod === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === 'week') {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    return { startDate: start, endDate: end };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Filtrar execuções
  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      // Filtro por tipo
      if (selectedType !== 'all' && exec.templateType !== selectedType) return false;

      // Filtro por período
      if (startDate || endDate) {
        const execDate = new Date(exec.completedAt || exec.createdAt);
        if (startDate && execDate < startDate) return false;
        if (endDate && execDate > endDate) return false;
      }

      return true;
    });
  }, [executions, selectedType, startDate, endDate]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = filteredExecutions.length;
    const completed = filteredExecutions.filter((e) => e.status === 'completed').length;
    const inProgress = filteredExecutions.filter((e) => e.status === 'in_progress').length;
    const pending = filteredExecutions.filter((e) => e.status === 'scheduled').length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Análise por tipo
    const byType: Record<string, number> = {};
    filteredExecutions.forEach((exec) => {
      byType[exec.templateType] = (byType[exec.templateType] || 0) + 1;
    });

    // Análise por loja
    const byStore: Record<string, number> = {};
    filteredExecutions.forEach((exec) => {
      byStore[exec.storeName] = (byStore[exec.storeName] || 0) + 1;
    });

    return {
      total,
      completed,
      inProgress,
      pending,
      completionRate,
      byType,
      byStore,
    };
  }, [filteredExecutions]);

  const handleGenerateReport = () => {
    // Obter nome da loja selecionada
    const storeName = selectedStore === 'all'
      ? undefined
      : lojas.find(l => l.id === selectedStore)?.name || selectedStore;

    // Label do período
    let periodLabel = '';
    if (selectedPeriod === 'today') periodLabel = 'Hoje';
    else if (selectedPeriod === 'week') periodLabel = 'Esta Semana';
    else if (selectedPeriod === 'month') periodLabel = 'Este Mês';
    else if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate).toLocaleDateString('pt-BR');
        const end = new Date(customEndDate).toLocaleDateString('pt-BR');
        periodLabel = `${start} - ${end}`;
      } else {
        periodLabel = 'Período Personalizado';
      }
    }

    // Gerar PDF
    generateChecklistPDF({
      executions: filteredExecutions,
      stats,
      storeName,
      periodLabel,
      typeFilter: selectedType !== 'all' ? selectedType : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Relatórios e Análises
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Análise detalhada de execuções de checklist por loja
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateReport}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
              >
                <Download className="w-5 h-5" />
                Gerar Relatório PDF
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                <Filter className="w-5 h-5 text-[#16476A]" />
              </div>
              <h2 className="text-lg font-bold text-[#212121]">Filtros</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro por Loja */}
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  <Store className="w-4 h-4 inline mr-1" />
                  Loja
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-[#E0E0E0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] font-semibold text-[#212121]"
                >
                  <option value="all">Todas as Lojas</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Tipo */}
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Tipo de Checklist
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-[#E0E0E0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] font-semibold text-[#212121]"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="opening">Abertura</option>
                  <option value="closing">Fechamento</option>
                  <option value="haccp">HACCP</option>
                  <option value="cleaning">Limpeza</option>
                  <option value="merchandising">Merchandising</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="audit">Auditoria</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {/* Filtro por Período */}
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Período
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-[#E0E0E0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] font-semibold text-[#212121]"
                >
                  <option value="today">Hoje</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mês</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
            </div>

            {/* Datas personalizadas */}
            {selectedPeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-[#757575] mb-1">Data Início</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#757575] mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] p-6 hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                <CheckSquare className="w-6 h-6 text-[#16476A]" />
              </div>
              <span className="text-3xl font-bold text-[#16476A]">{stats.total}</span>
            </div>
            <h3 className="text-sm font-bold text-[#757575] uppercase tracking-wide">Total de Execuções</h3>
          </div>

          {/* Concluídos */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] p-6 hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                <TrendingUp className="w-6 h-6 text-[#3B9797]" />
              </div>
              <span className="text-3xl font-bold text-[#3B9797]">{stats.completed}</span>
            </div>
            <h3 className="text-sm font-bold text-[#757575] uppercase tracking-wide">Concluídos</h3>
            <div className="mt-2">
              <div className="w-full bg-[#E0E0E0] rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#3B9797] to-[#16476A] h-2 rounded-full transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-[#757575] mt-1">{stats.completionRate}% de conclusão</p>
            </div>
          </div>

          {/* Em Progresso */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] p-6 hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                <RefreshCw className="w-6 h-6 text-[#BF092F]" />
              </div>
              <span className="text-3xl font-bold text-[#BF092F]">{stats.inProgress}</span>
            </div>
            <h3 className="text-sm font-bold text-[#757575] uppercase tracking-wide">Em Progresso</h3>
          </div>

          {/* Pendentes */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] p-6 hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                <AlertCircle className="w-6 h-6 text-[#BF092F]" />
              </div>
              <span className="text-3xl font-bold text-[#BF092F]">{stats.pending}</span>
            </div>
            <h3 className="text-sm font-bold text-[#757575] uppercase tracking-wide">Pendentes</h3>
          </div>
        </div>

        {/* Lista de Execuções */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold text-[#212121]">Carregando execuções...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#BF092F] p-8">
            <AlertCircle className="w-12 h-12 text-[#BF092F] mx-auto mb-4" />
            <p className="text-center text-[#BF092F] font-bold">{error}</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <CheckSquare className="w-16 h-16 text-[#757575] opacity-50 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#212121] mb-2">Nenhuma Execução Encontrada</h3>
            <p className="text-[#757575]">Ajuste os filtros para ver mais resultados</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
              <h2 className="text-lg font-bold text-[#212121]">
                Execuções Encontradas ({filteredExecutions.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Template
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Loja
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Responsável
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Progresso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#757575] uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E0E0E0]">
                  {filteredExecutions.map((execution) => (
                    <tr
                      key={execution.id}
                      className="hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      onClick={() => router.push(`/checklists/execucoes/${execution.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-[#212121]">{execution.templateName}</div>
                        <div className="text-xs text-[#757575]">{execution.templateType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#212121]">
                        {execution.storeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#212121]">
                        {execution.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {execution.status === 'completed' && (
                          <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-[#3B9797]/10 text-[#3B9797] border border-[#3B9797]/30">
                            Concluído
                          </span>
                        )}
                        {execution.status === 'in_progress' && (
                          <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-[#BF092F]/10 text-[#BF092F] border border-[#BF092F]/30">
                            Em Progresso
                          </span>
                        )}
                        {execution.status === 'scheduled' && (
                          <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-[#757575]/10 text-[#757575] border border-[#757575]/30">
                            Agendado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#E0E0E0] rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-[#16476A] to-[#3B9797] h-2 rounded-full"
                              style={{ width: `${execution.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-[#757575]">{execution.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#757575]">
                        {new Date(execution.completedAt || execution.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
