'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Plus,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  BarChart3,
  PieChart,
  Users,
  Store,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { ChecklistExecution, ExecutionStatus } from '@/lib/types/checklist';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const statusLabels: Record<ExecutionStatus, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
};

const statusColors: Record<ExecutionStatus, string> = {
  scheduled: 'bg-[#3B9797] text-white',
  in_progress: 'bg-[#BF092F] text-white',
  completed: 'bg-[#3B9797] text-white',
  overdue: 'bg-[#BF092F] text-white',
  cancelled: 'bg-[#757575] text-white',
};

const CHART_COLORS = ['#16476A', '#3B9797', '#BF092F', '#BF092F', '#3B9797', '#132440', '#BF092F'];

export default function ChecklistsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/checklist-executions?${params}`, {
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
      execution.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Calcular KPIs e Métricas
  const totalExecutions = executions.length;
  const completedExecutions = executions.filter((e) => e.status === 'completed').length;
  const inProgressExecutions = executions.filter((e) => e.status === 'in_progress').length;
  const overdueExecutions = executions.filter((e) => e.status === 'overdue').length;
  const scheduledExecutions = executions.filter((e) => e.status === 'scheduled').length;
  const completionRate =
    totalExecutions > 0 ? Math.round((completedExecutions / totalExecutions) * 100) : 0;

  // Média de progresso
  const avgProgress =
    executions.length > 0
      ? Math.round(executions.reduce((sum, e) => sum + e.progress, 0) / executions.length)
      : 0;

  // Calcular métricas de pontuação e conformidade
  const executionsWithScore = executions.filter(e => e.score && e.score.totalPoints > 0);
  const avgScore = executionsWithScore.length > 0
    ? Math.round(executionsWithScore.reduce((sum, e) => sum + (e.score?.percentage || 0), 0) / executionsWithScore.length)
    : 0;

  const executionsWithConformity = executions.filter(e => e.conformity && e.conformity.totalChecks > 0);
  const avgConformity = executionsWithConformity.length > 0
    ? Math.round(executionsWithConformity.reduce((sum, e) => sum + (e.conformity?.percentage || 0), 0) / executionsWithConformity.length)
    : 0;

  const totalNonConformities = executionsWithConformity.reduce(
    (sum, e) => sum + (e.conformity?.nonConformChecks || 0), 0
  );

  // Dados para gráfico de status (Pizza)
  const statusData = [
    { name: 'Concluídos', value: completedExecutions, color: '#3B9797' },
    { name: 'Em Andamento', value: inProgressExecutions, color: '#BF092F' },
    { name: 'Agendados', value: scheduledExecutions, color: '#3B9797' },
    { name: 'Atrasados', value: overdueExecutions, color: '#BF092F' },
  ].filter((item) => item.value > 0);

  // Dados para gráfico de execuções por tipo
  const executionsByType: Record<string, number> = {};
  executions.forEach((e) => {
    const typeName = e.templateName;
    executionsByType[typeName] = (executionsByType[typeName] || 0) + 1;
  });

  const typeChartData = Object.entries(executionsByType)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Ranking de lojas
  const storeStats: Record<string, { completed: number; total: number; avgProgress: number; label: string }> = {};
  executions.forEach((e) => {
    const key = e.storeId || e.storeName || 'loja_desconhecida';
    const label = e.storeName || e.storeId || 'Loja Desconhecida';
    if (!storeStats[key]) {
      storeStats[key] = { completed: 0, total: 0, avgProgress: 0, label };
    }
    storeStats[key].total += 1;
    if (e.status === 'completed') {
      storeStats[key].completed += 1;
    }
  });

  Object.keys(storeStats).forEach((storeName) => {
    const store = storeStats[storeName];
    const storeExecutions = executions.filter((e) => e.storeName === storeName);
    store.avgProgress =
      storeExecutions.length > 0
        ? Math.round(storeExecutions.reduce((sum, e) => sum + e.progress, 0) / storeExecutions.length)
        : 0;
  });

  const topStores = Object.entries(storeStats)
    .map(([_, stats]) => ({
      name: stats.label,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      total: stats.total,
      avgProgress: stats.avgProgress,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  // Ranking de usuários
  const userStats: Record<string, { completed: number; total: number }> = {};
  executions.forEach((e) => {
    if (!userStats[e.userName]) {
      userStats[e.userName] = { completed: 0, total: 0 };
    }
    userStats[e.userName].total += 1;
    if (e.status === 'completed') {
      userStats[e.userName].completed += 1;
    }
  });

  const topUsers = Object.entries(userStats)
    .map(([name, stats]) => ({
      name,
      completed: stats.completed,
      total: stats.total,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  // Insights automáticos
  const insights = [];

  if (overdueExecutions > 0) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Checklists Atrasados',
      description: `Existem ${overdueExecutions} checklist(s) atrasado(s) que precisam de atenção imediata.`,
    });
  }

  if (completionRate < 50 && totalExecutions > 5) {
    insights.push({
      type: 'warning',
      icon: TrendingDown,
      title: 'Taxa de Conclusão Baixa',
      description: `A taxa de conclusão está em ${completionRate}%. Considere revisar os processos.`,
    });
  } else if (completionRate >= 80) {
    insights.push({
      type: 'success',
      icon: TrendingUp,
      title: 'Excelente Desempenho',
      description: `Taxa de conclusão em ${completionRate}%. Continue assim!`,
    });
  }

  if (inProgressExecutions > completedExecutions && totalExecutions > 5) {
    insights.push({
      type: 'info',
      icon: Lightbulb,
      title: 'Muitos Checklists em Andamento',
      description: 'Há mais checklists em andamento do que concluídos. Foque em finalizar as tarefas.',
    });
  }

  if (topStores.length > 0 && topStores[0].completionRate === 100) {
    insights.push({
      type: 'success',
      icon: Award,
      title: 'Loja Destaque',
      description: `${topStores[0].name} possui 100% de conclusão!`,
    });
  }

  if (avgConformity > 0 && avgConformity < 70 && executionsWithConformity.length > 3) {
    insights.push({
      type: 'warning',
      icon: AlertCircle,
      title: 'Conformidade Baixa',
      description: `Taxa de conformidade em ${avgConformity}%. Identifique e corrija as não conformidades.`,
    });
  } else if (avgConformity >= 90 && executionsWithConformity.length > 0) {
    insights.push({
      type: 'success',
      icon: CheckCircle,
      title: 'Excelente Conformidade',
      description: `Taxa de conformidade em ${avgConformity}%. Padrão de qualidade mantido!`,
    });
  }

  if (totalNonConformities > 5 && executionsWithConformity.length > 0) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Não Conformidades Identificadas',
      description: `${totalNonConformities} não conformidade(s) detectada(s). Revise os processos operacionais.`,
    });
  }

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Dashboard de Checklists
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Análise completa e insights operacionais em tempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/checklists/templates')}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Templates
              </button>
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

        {/* KPIs Principais - Redesenhados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#16476A]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Total de Execuções</span>
                <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                  <Calendar className="w-6 h-6 text-[#16476A]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#212121] mb-3">{totalExecutions}</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                <BarChart3 className="w-4 h-4" />
                <span>Todas as execuções registradas</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#3B9797]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Concluídos</span>
                <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                  <CheckCircle className="w-6 h-6 text-[#3B9797]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#3B9797] mb-3">{completedExecutions}</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                <Target className="w-4 h-4" />
                <span className="font-semibold text-[#3B9797]">{completionRate}%</span>
                <span>de conclusão</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#BF092F]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Em Andamento</span>
                <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                  <Clock className="w-6 h-6 text-[#BF092F]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#BF092F] mb-3">{inProgressExecutions}</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                <TrendingUp className="w-4 h-4" />
                <span className="font-semibold text-[#BF092F]">{avgProgress}%</span>
                <span>de progresso médio</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#BF092F]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Atrasados</span>
                <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                  <AlertCircle className="w-6 h-6 text-[#BF092F]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#BF092F] mb-3">{overdueExecutions}</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                <AlertTriangle className="w-4 h-4 text-[#BF092F]" />
                <span className="font-semibold text-[#BF092F]">Atenção urgente</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#132440]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Pontuação Média</span>
                <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                  <Target className="w-6 h-6 text-[#132440]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#132440] mb-3">{avgScore}%</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                <Award className="w-4 h-4" />
                <span>{executionsWithScore.length} avaliações</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#3B9797]/10 to-transparent rounded-bl-full"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Conformidade</span>
                <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                  <CheckCircle className="w-6 h-6 text-[#3B9797]" />
                </div>
              </div>
              <p className="text-5xl font-bold text-[#3B9797] mb-3">{avgConformity}%</p>
              <div className="flex items-center gap-2 text-sm text-[#757575]">
                {totalNonConformities > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-[#BF092F]" />
                    <span className="font-semibold text-[#BF092F]">{totalNonConformities} NC</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#3B9797]" />
                    <span className="font-semibold text-[#3B9797]">Sem NC</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Insights Inteligentes - Redesenhados */}
        {insights.length > 0 && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 sm:px-8 py-5 border-b border-[#E0E0E0]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                    <Lightbulb className="w-6 h-6 text-[#BF092F]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#212121]">Insights Inteligentes</h2>
                    <p className="text-sm text-[#757575] mt-1">Análises automatizadas do seu desempenho</p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {insights.map((insight, index) => {
                    const Icon = insight.icon;
                    const styles =
                      insight.type === 'warning'
                        ? {
                            bg: 'bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF]',
                            border: 'border-[#BF092F]',
                            iconBg: 'bg-[#BF092F]/10',
                            iconColor: 'text-[#BF092F]',
                            textColor: 'text-[#856404]'
                          }
                        : insight.type === 'success'
                        ? {
                            bg: 'bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF]',
                            border: 'border-[#3B9797]',
                            iconBg: 'bg-[#3B9797]/10',
                            iconColor: 'text-[#3B9797]',
                            textColor: 'text-[#16476A]'
                          }
                        : {
                            bg: 'bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF]',
                            border: 'border-[#3B9797]',
                            iconBg: 'bg-[#3B9797]/10',
                            iconColor: 'text-[#3B9797]',
                            textColor: 'text-[#3B9797]'
                          };

                    return (
                      <div
                        key={index}
                        className={`${styles.bg} border-l-4 ${styles.border} rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`${styles.iconBg} p-3 rounded-xl flex-shrink-0`}>
                            <Icon className={`w-6 h-6 ${styles.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-bold text-lg ${styles.textColor} mb-2`}>{insight.title}</h3>
                            <p className="text-sm text-[#757575] leading-relaxed">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos - Redesenhados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Gráfico de Barras - Execuções por Tipo */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                  <BarChart3 className="w-5 h-5 text-[#16476A]" />
                </div>
                <h2 className="text-lg font-bold text-[#212121]">Execuções por Template</h2>
              </div>
            </div>
            <div className="p-6">
              {typeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={typeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E0E0E0',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#16476A" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[#757575]">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                    <p className="font-medium">Sem dados disponíveis</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gráfico de Pizza - Status */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                  <PieChart className="w-5 h-5 text-[#16476A]" />
                </div>
                <h2 className="text-lg font-bold text-[#212121]">Distribuição por Status</h2>
              </div>
            </div>
            <div className="p-6">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#3B9797"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[#757575]">
                  <div className="text-center">
                    <PieChart className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                    <p className="font-medium">Sem dados disponíveis</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rankings - Redesenhados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ranking de Lojas */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                  <Store className="w-5 h-5 text-[#16476A]" />
                </div>
                <h2 className="text-lg font-bold text-[#212121]">Top 5 Lojas por Conclusão</h2>
              </div>
            </div>
            <div className="p-6">
              {topStores.length > 0 ? (
                <div className="space-y-4">
                  {topStores.map((store, index) => (
                    <div
                      key={store.name}
                      className="group flex items-center gap-4 p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-lg ${
                          index === 0
                            ? 'bg-gradient-to-br from-[#BF092F] to-[#BF092F]'
                            : index === 1
                            ? 'bg-gradient-to-br from-[#C0C0C0] to-[#132440]'
                            : index === 2
                            ? 'bg-gradient-to-br from-[#16476A] to-[#132440]'
                            : 'bg-gradient-to-br from-[#757575] to-[#132440]'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#212121] text-base">{store.name}</p>
                        <div className="flex items-center gap-3 text-xs text-[#757575] mt-1">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {store.total} execuções
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {store.avgProgress}% progresso
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-[#3B9797]">{store.completionRate}%</p>
                        <p className="text-xs text-[#757575]">conclusão</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#757575] py-12">
                  <Store className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                  <p className="font-medium">Sem dados disponíveis</p>
                </div>
              )}
            </div>
          </div>

          {/* Ranking de Usuários */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                  <Users className="w-5 h-5 text-[#16476A]" />
                </div>
                <h2 className="text-lg font-bold text-[#212121]">Top 5 Usuários mais Produtivos</h2>
              </div>
            </div>
            <div className="p-6">
              {topUsers.length > 0 ? (
                <div className="space-y-4">
                  {topUsers.map((user, index) => (
                    <div
                      key={user.name}
                      className="group flex items-center gap-4 p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-lg ${
                          index === 0
                            ? 'bg-gradient-to-br from-[#BF092F] to-[#BF092F]'
                            : index === 1
                            ? 'bg-gradient-to-br from-[#C0C0C0] to-[#132440]'
                            : index === 2
                            ? 'bg-gradient-to-br from-[#16476A] to-[#132440]'
                            : 'bg-gradient-to-br from-[#757575] to-[#132440]'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#212121] text-base">{user.name}</p>
                        <div className="flex items-center gap-2 text-xs text-[#757575] mt-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>
                            {user.completed} de {user.total} concluídos
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-[#3B9797]">{user.completionRate}%</p>
                        <p className="text-xs text-[#757575]">conclusão</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#757575] py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                  <p className="font-medium">Sem dados disponíveis</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filtros - Redesenhados */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                <Search className="w-5 h-5 text-[#16476A]" />
              </div>
              <h2 className="text-lg font-bold text-[#212121]">Filtros e Busca</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <label className="block text-sm font-bold text-[#212121] mb-2">Buscar Execuções</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Template, loja ou responsável..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'scheduled', 'in_progress', 'completed', 'overdue'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                        statusFilter === status
                          ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white border-[#16476A] shadow-lg scale-105'
                          : 'bg-white text-[#212121] border-[#E0E0E0] hover:bg-[#E0E7EF] hover:border-[#3B9797]/30'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Execuções - Redesenhada */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-full mb-6">
              <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando Execuções</h3>
            <p className="text-[#757575]">Aguarde enquanto buscamos os dados...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#BF092F]">
            <div className="bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] px-6 py-5 border-b border-[#BF092F]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#BF092F] rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#BF092F]">Erro ao Carregar</h3>
                  <p className="text-[#BF092F]/80 text-sm">Não foi possível buscar as execuções</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#757575] mb-4">{error}</p>
              <button
                onClick={fetchExecutions}
                className="px-5 py-2.5 bg-[#BF092F] text-white rounded-xl font-semibold hover:bg-[#BF092F] transition-all inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="w-24 h-24 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-12 h-12 text-[#757575]" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Nenhuma Execução Encontrada</h3>
            <p className="text-[#757575] mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Não há execuções de checklist registradas'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="px-5 py-2.5 bg-[#16476A] text-white rounded-xl font-semibold hover:bg-[#132440] transition-all inline-flex items-center gap-2"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExecutions.map((execution) => (
              <div
                key={execution.id}
                onClick={() => router.push(`/checklists/execucoes/${execution.id}`)}
                className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-[#E0E0E0] hover:border-[#16476A] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                            {execution.templateName}
                          </h3>
                          {execution.sector && (
                            <p className="text-sm text-[#757575] mt-1">{execution.sector}</p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl ${statusColors[execution.status]}`}
                        >
                          {statusLabels[execution.status]}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#757575]" />
                          <div>
                            <p className="text-xs text-[#757575]">Loja</p>
                            <p className="text-sm font-semibold text-[#212121]">{execution.storeName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#757575]" />
                          <div>
                            <p className="text-xs text-[#757575]">Responsável</p>
                            <p className="text-sm font-semibold text-[#212121]">{execution.userName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#757575]" />
                          <div>
                            <p className="text-xs text-[#757575]">Data/Hora</p>
                            <p className="text-sm font-semibold text-[#212121]">
                              {new Date(execution.scheduledDate).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Indicador de Tempo */}
                      {(execution.status === 'in_progress' || execution.status === 'overdue') &&
                       execution.startedAt &&
                       execution.estimatedDuration && (
                        <div className="mb-4 p-3 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#757575]" />
                              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                                Tempo de Execução
                              </span>
                            </div>
                            {(() => {
                              const startedAt = new Date(execution.startedAt);
                              const now = new Date();
                              const elapsedMinutes = Math.round((now.getTime() - startedAt.getTime()) / (1000 * 60));
                              const estimatedDuration = execution.estimatedDuration;
                              const isOverdue = elapsedMinutes > estimatedDuration;
                              const percentElapsed = Math.min((elapsedMinutes / estimatedDuration) * 100, 100);

                              return (
                                <>
                                  <span className={`text-sm font-bold ${isOverdue ? 'text-[#BF092F]' : 'text-[#BF092F]'}`}>
                                    {elapsedMinutes} / {estimatedDuration} min
                                  </span>
                                  <div className="hidden">
                                    <div className="w-full bg-[#E0E0E0] rounded-full h-2 overflow-hidden mt-2">
                                      <div
                                        className={`h-full transition-all duration-500 rounded-full ${
                                          isOverdue
                                            ? 'bg-gradient-to-r from-[#BF092F] to-[#BF092F]'
                                            : percentElapsed > 80
                                            ? 'bg-gradient-to-r from-[#BF092F] to-[#BF092F]'
                                            : 'bg-gradient-to-r from-[#3B9797] to-[#16476A]'
                                        }`}
                                        style={{ width: `${percentElapsed}%` }}
                                      />
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          {(() => {
                            const startedAt = new Date(execution.startedAt!);
                            const now = new Date();
                            const elapsedMinutes = Math.round((now.getTime() - startedAt.getTime()) / (1000 * 60));
                            const estimatedDuration = execution.estimatedDuration!;
                            const remainingMinutes = estimatedDuration - elapsedMinutes;
                            const isOverdue = elapsedMinutes > estimatedDuration;

                            return (
                              <div className={`text-xs ${isOverdue ? 'text-[#BF092F]' : 'text-[#757575]'} flex items-center gap-1`}>
                                <AlertTriangle className={`w-3 h-3 ${isOverdue ? 'animate-pulse' : ''}`} />
                                {isOverdue ? (
                                  <span className="font-semibold">
                                    Atrasado em {Math.abs(remainingMinutes)} minuto{Math.abs(remainingMinutes) !== 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span>
                                    Restam {remainingMinutes} minuto{remainingMinutes !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Progresso</span>
                          <span className="text-sm font-bold text-[#16476A]">{execution.progress}%</span>
                        </div>
                        <div className="w-full bg-[#E0E0E0] rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#16476A] to-[#3B9797] h-full transition-all duration-500 rounded-full"
                            style={{ width: `${execution.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Score e Conformidade */}
                      {(execution.score || execution.conformity) && (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {execution.score && execution.score.totalPoints > 0 && (
                            <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-white rounded-xl border border-[#E0E0E0]">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-[#132440]" />
                                <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Pontuação</span>
                              </div>
                              <p className="text-2xl font-bold text-[#132440]">{execution.score.percentage}%</p>
                              <p className="text-xs text-[#757575] mt-1">
                                {execution.score.pointsAwarded}/{execution.score.totalPoints} pontos
                              </p>
                            </div>
                          )}

                          {execution.conformity && execution.conformity.totalChecks > 0 && (
                            <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-white rounded-xl border border-[#E0E0E0]">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="w-4 h-4 text-[#3B9797]" />
                                <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Conformidade</span>
                              </div>
                              <p className={`text-2xl font-bold ${execution.conformity.percentage >= 80 ? 'text-[#3B9797]' : execution.conformity.percentage >= 60 ? 'text-[#BF092F]' : 'text-[#BF092F]'}`}>
                                {execution.conformity.percentage}%
                              </p>
                              <p className="text-xs text-[#757575] mt-1">
                                {execution.conformity.nonConformChecks > 0 && (
                                  <span className="text-[#BF092F] font-semibold">{execution.conformity.nonConformChecks} NC</span>
                                )}
                                {execution.conformity.nonConformChecks === 0 && (
                                  <span className="text-[#3B9797] font-semibold">Sem NC</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover Effect Bar */}
                <div className="h-1 bg-gradient-to-r from-[#16476A] to-[#3B9797] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
