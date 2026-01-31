'use client';

import { useEffect, useState } from 'react';
import KPICard from '@/components/KPICard';
import QuickStatsCard from '@/components/QuickStatsCard';
import SolicitacoesChart from '@/components/SolicitacoesChart';
import StatusChart from '@/components/StatusChart';
import RecentSolicitacoes from '@/components/RecentSolicitacoes';
import StoresSolicitacoesChart from '@/components/StoresSolicitacoesChart';
import TopProductsChart from '@/components/TopProductsChart';
import PeriodComparisonChart from '@/components/PeriodComparisonChart';
import InsightsPanel from '@/components/InsightsPanel';
import RankingPanel from '@/components/RankingPanel';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
} from 'recharts';
import {
  FileText,
  Users,
  UserCheck,
  Store,
  Package,
  RefreshCw,
  TrendingUp,
  Calendar,
  CheckCircle,
  BarChart3,
  Target,
  DollarSign,
  PiggyBank,
  Percent,
  Clock,
  Zap,
  TrendingDown,
  BadgeCheck,
  BadgeX,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Timer,
  Calculator,
} from 'lucide-react';

interface DashboardData {
  kpis: {
    totalSolicitacoes: number;
    totalUsuarios: number;
    usuariosAtivos: number;
    totalLojas: number;
    totalItens: number;
    solicitacoesHoje: number;
    solicitacoesOntem: number;
    mediaItensPorSolicitacao: number;
    taxaConversao: number;
    solicitacoesUltimos7Dias: number;
    mudancaSemanal: number;
  };
  financeiro: {
    valorTotalSolicitado: number;
    valorTotalAprovado: number;
    valorTotalRejeitado: number;
    valorTotalPendente: number;
    itensAprovados: number;
    itensRejeitados: number;
    itensPendentes: number;
    taxaAprovacao: number;
    taxaRejeicao: number;
    mediaValorDiario: number;
    projecaoSemanal: number;
  };
  solicitacoesPorStatus: {
    pending: number;
    batched: number;
    closed: number;
  };
  solicitacoesPorLoja: Array<{
    storeId: string;
    storeName: string;
    count: number;
  }>;
  solicitacoesRecentes: any[];
  chartData: { date: string; count: number }[];
  topProdutos: Array<{
    productId: string;
    productName: string;
    count: number;
    ean?: string;
  }>;
  periodComparisonData: Array<{
    date: string;
    current: number;
    previous: number;
  }>;
  insights: Array<{
    type: 'success' | 'warning' | 'info' | 'alert';
    title: string;
    description: string;
    icon: 'trending-up' | 'trending-down' | 'alert' | 'check' | 'info' | 'zap';
  }>;
  rankingPorLoja: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  rankingPorComprador: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  rankingPorProduto: Array<{
    id: string;
    name: string;
    count: number;
    details?: string;
  }>;
  projecaoFinanceira: Array<{
    date: string;
    valor: number;
    projetado: boolean;
  }>;
  valorChartData: Array<{
    date: string;
    valor: number;
  }>;
  paretoFinanceiro: Array<{
    productId: string;
    productName: string;
    count: number;
    valor: number;
    ean?: string;
    percentualAcumulado: number;
  }>;
  lastUpdated: string;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Atualizar dados a cada 5 minutos
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#132440] to-[#16476A]">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-[#BF092F] to-[#3B9797] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <RefreshCw className="w-12 h-12 text-white animate-spin" />
          </div>
          <p className="text-white text-2xl font-bold mb-2">Carregando dashboard...</p>
          <p className="text-[#E0E7EF] text-base font-medium">Buscando dados do sistema</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-[#BF092F] rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-[#3B9797] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#132440] to-[#16476A]">
        <div className="text-center bg-white p-10 rounded-2xl shadow-2xl border-2 border-[#3B9797]/20 max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-[#BF092F]/15 to-[#3B9797]/15 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-[#BF092F]/40">
            <span className="text-5xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-[#132440] mb-2">Erro ao Carregar</h2>
          <p className="text-[#BF092F] font-semibold mb-6 text-lg">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#16476A] hover:from-[#132440] hover:to-[#3B9797] text-white px-8 py-4 rounded-xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const counts = data.chartData.map((d) => d.count);
  const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
  const prev7 = counts.slice(-14, -7).reduce((a, b) => a + b, 0);
  const pctTrend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;

  const mudancaHoje = data.kpis.solicitacoesOntem > 0
    ? Math.round(((data.kpis.solicitacoesHoje - data.kpis.solicitacoesOntem) / data.kpis.solicitacoesOntem) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header com gradiente e padrão SVG */}
      <header className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl">
                <TrendingUp className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-2xl">
                  Painel de Gestão
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2 drop-shadow-lg">
                  MyInventory - Gestão Interna · Sistema de Controle e Análise
                </p>
              </div>
            </div>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-4 rounded-xl transition-all duration-300 disabled:opacity-50 border border-white/30 font-bold shadow-xl hover:shadow-2xl hover:scale-105"
            >
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-12">
        {/* Hero Stats - Painel Principal Integrado */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          {/* Top Section - Métricas Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#E0E0E0]">
            {/* Solicitações Hoje */}
            <div className="p-8 bg-gradient-to-br from-[#E0E7EF] to-white relative overflow-hidden group hover:from-[#E0E7EF] transition-all duration-300">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-8">
                <Calendar className="w-40 h-40 text-[#16476A]" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl shadow-lg">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#757575] uppercase tracking-wide">Hoje</p>
                    <p className="text-xs text-[#BFC7C9]">Solicitações recebidas</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-5xl font-bold text-[#16476A] mb-2">{data.kpis.solicitacoesHoje}</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                      mudancaHoje >= 0
                        ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white'
                        : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white'
                    }`}>
                      <TrendingUp className={`w-3 h-3 ${mudancaHoje < 0 ? 'rotate-180' : ''}`} />
                      {mudancaHoje > 0 ? '+' : ''}{mudancaHoje}% vs ontem
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#757575]">{data.kpis.solicitacoesOntem}</p>
                    <p className="text-xs text-[#BFC7C9]">Ontem</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Última Semana */}
            <div className="p-8 bg-gradient-to-br from-[#E0E7EF] to-white relative overflow-hidden group hover:from-[#E0E7EF] transition-all duration-300">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-8">
                <TrendingUp className="w-40 h-40 text-[#132440]" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#132440] to-[#16476A] rounded-xl shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#757575] uppercase tracking-wide">Últimos 7 Dias</p>
                    <p className="text-xs text-[#BFC7C9]">Acumulado semanal</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-5xl font-bold text-[#132440] mb-2">{data.kpis.solicitacoesUltimos7Dias}</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                      data.kpis.mudancaSemanal >= 0
                        ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white'
                        : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white'
                    }`}>
                      <TrendingUp className={`w-3 h-3 ${data.kpis.mudancaSemanal < 0 ? 'rotate-180' : ''}`} />
                      {data.kpis.mudancaSemanal > 0 ? '+' : ''}{data.kpis.mudancaSemanal}% vs anterior
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#757575]">{(data.kpis.solicitacoesUltimos7Dias / 7).toFixed(1)}</p>
                    <p className="text-xs text-[#BFC7C9]">Média/dia</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Geral */}
            <div className="p-8 bg-gradient-to-br from-[#E0E7EF] to-white relative overflow-hidden group hover:from-[#E0E7EF] transition-all duration-300">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-8">
                <Target className="w-40 h-40 text-[#3B9797]" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-xl shadow-lg">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#757575] uppercase tracking-wide">Taxa de Conversão</p>
                    <p className="text-xs text-[#BFC7C9]">Processamento concluído</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-5xl font-bold text-[#3B9797] mb-2">{data.kpis.taxaConversao}%</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full transition-all duration-500"
                          style={{ width: `${data.kpis.taxaConversao}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#757575]">{data.kpis.mediaItensPorSolicitacao}</p>
                    <p className="text-xs text-[#BFC7C9]">Itens/média</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Status Pipeline */}
          <div className="grid grid-cols-3 divide-x divide-[#E0E0E0] bg-gradient-to-br from-[#F8F9FA] to-white">
            {/* Pendentes */}
            <div className="p-6 hover:bg-[#E9ECEF] transition-colors duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#757575] font-semibold uppercase">Pendentes</p>
                    <p className="text-2xl font-bold text-[#BF092F]">{data.solicitacoesPorStatus.pending}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#BFC7C9]">
                    {Math.round((data.solicitacoesPorStatus.pending / data.kpis.totalSolicitacoes) * 100)}%
                  </p>
                  <div className="w-16 h-1 bg-[#E0E0E0] rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#BF092F] to-[#BF092F]"
                      style={{ width: `${(data.solicitacoesPorStatus.pending / data.kpis.totalSolicitacoes) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Em Lote */}
            <div className="p-6 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#3B9797] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#757575] font-semibold uppercase">Em Lote</p>
                    <p className="text-2xl font-bold text-[#3B9797]">{data.solicitacoesPorStatus.batched}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#BFC7C9]">
                    {Math.round((data.solicitacoesPorStatus.batched / data.kpis.totalSolicitacoes) * 100)}%
                  </p>
                  <div className="w-16 h-1 bg-[#E0E0E0] rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#3B9797] to-[#3B9797]"
                      style={{ width: `${(data.solicitacoesPorStatus.batched / data.kpis.totalSolicitacoes) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Concluídas */}
            <div className="p-6 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#757575] font-semibold uppercase">Concluídas</p>
                    <p className="text-2xl font-bold text-[#3B9797]">{data.solicitacoesPorStatus.closed}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#BFC7C9]">
                    {Math.round((data.solicitacoesPorStatus.closed / data.kpis.totalSolicitacoes) * 100)}%
                  </p>
                  <div className="w-16 h-1 bg-[#E0E0E0] rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A]"
                      style={{ width: `${(data.solicitacoesPorStatus.closed / data.kpis.totalSolicitacoes) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas do Sistema - Compacto e Visual */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Solicitações */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#E0E0E0] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-lg group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                pctTrend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {pctTrend > 0 ? '+' : ''}{pctTrend}%
              </div>
            </div>
            <p className="text-2xl font-bold text-[#212121] mb-1">{data.kpis.totalSolicitacoes}</p>
            <p className="text-xs text-[#757575] font-semibold">Total Solicitações</p>
          </div>

          {/* Usuários */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#E0E0E0] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {Math.round((data.kpis.usuariosAtivos / data.kpis.totalUsuarios) * 100)}% ativos
              </div>
            </div>
            <p className="text-2xl font-bold text-[#212121] mb-1">{data.kpis.totalUsuarios}</p>
            <p className="text-xs text-[#757575] font-semibold">Total Usuários</p>
          </div>

          {/* Lojas */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#E0E0E0] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Store className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#212121] mb-1">{data.kpis.totalLojas}</p>
            <p className="text-xs text-[#757575] font-semibold">Total Lojas</p>
          </div>

          {/* Itens */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#E0E0E0] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-[#132440] to-[#16476A] rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#212121] mb-1">{data.kpis.totalItens}</p>
            <p className="text-xs text-[#757575] font-semibold">Total de Itens</p>
          </div>
        </div>

        {/* Insights Automáticos */}
        {data.insights && data.insights.length > 0 && (
          <div className="mb-8">
            <InsightsPanel insights={data.insights} />
          </div>
        )}

        {/* Painel Financeiro - 10 Novos Indicadores */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#3B9797] via-[#16476A] to-[#132440] px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Indicadores Financeiros de Rebaixa</h2>
                  <p className="text-[#E0E7EF] text-sm font-medium">Métricas de valor, aprovação e economia</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <p className="text-white font-bold text-sm">
                  R$ {((data.financeiro?.valorTotalSolicitado || 0) / 1000).toFixed(1)}k total
                </p>
              </div>
            </div>
          </div>

          {/* Grid Principal - 2 Cards Grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E0E0E0]">
            {/* Card 1: Total Solicitado */}
            <div className="p-8 bg-gradient-to-br from-[#E0E7EF] to-white relative overflow-hidden group hover:from-[#d0dbe8] transition-all duration-300">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-8">
                <Receipt className="w-40 h-40 text-[#16476A]" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-xl shadow-lg">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#757575] uppercase tracking-wide">Total Solicitado</p>
                    <p className="text-xs text-[#BFC7C9]">Valor em rebaixa</p>
                  </div>
                </div>
                <p className="text-4xl font-bold text-[#16476A] mb-2">
                  R$ {(data.financeiro?.valorTotalSolicitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex-1">
                    <p className="text-xs text-[#757575] mb-1">Pendente</p>
                    <p className="text-lg font-bold text-[#3B9797]">
                      R$ {(data.financeiro?.valorTotalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[#757575] mb-1">Rejeitado</p>
                    <p className="text-lg font-bold text-[#BF092F]">
                      R$ {(data.financeiro?.valorTotalRejeitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Economia Gerada */}
            <div className="p-8 bg-gradient-to-br from-[#E0E7EF] to-white relative overflow-hidden group hover:from-[#d0dbe8] transition-all duration-300">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-8">
                <PiggyBank className="w-40 h-40 text-[#3B9797]" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-xl shadow-lg">
                    <PiggyBank className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#757575] uppercase tracking-wide">Economia Gerada</p>
                    <p className="text-xs text-[#BFC7C9]">Produtos recuperados</p>
                  </div>
                </div>
                <p className="text-4xl font-bold text-[#3B9797] mb-2">
                  R$ {(data.financeiro?.valorTotalAprovado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${
                    (data.financeiro?.taxaAprovacao || 0) >= 70
                      ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white'
                      : 'bg-gradient-to-r from-[#BF092F] to-[#132440] text-white'
                  }`}>
                    {(data.financeiro?.taxaAprovacao || 0) >= 70 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {data.financeiro?.taxaAprovacao || 0}% aprovados
                  </div>
                  <span className="text-xs text-[#757575]">
                    ({data.financeiro?.itensAprovados || 0} itens)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de 5 KPIs Menores */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 divide-x divide-[#E0E0E0] bg-gradient-to-br from-[#F8F9FA] to-white">
            {/* Taxa de Aprovação */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Aprovação</p>
              </div>
              <p className="text-2xl font-bold text-[#3B9797]">{data.financeiro?.taxaAprovacao || 0}%</p>
              <p className="text-xs text-[#BFC7C9]">{data.financeiro?.itensAprovados || 0} itens</p>
            </div>

            {/* Taxa de Rejeição */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#132440] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <BadgeX className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Rejeição</p>
              </div>
              <p className="text-2xl font-bold text-[#BF092F]">{data.financeiro?.taxaRejeicao || 0}%</p>
              <p className="text-xs text-[#BFC7C9]">{data.financeiro?.itensRejeitados || 0} itens</p>
            </div>

            {/* Itens Pendentes */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Pendentes</p>
              </div>
              <p className="text-2xl font-bold text-[#16476A]">{data.financeiro?.itensPendentes || 0}</p>
              <p className="text-xs text-[#BFC7C9]">itens aguardando</p>
            </div>

            {/* Média Diária */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#132440] to-[#16476A] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Média/Dia</p>
              </div>
              <p className="text-2xl font-bold text-[#132440]">
                R$ {((data.financeiro?.mediaValorDiario || 0) / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-[#BFC7C9]">valor diário</p>
            </div>

            {/* Projeção Semanal */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#132440] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Projeção</p>
              </div>
              <p className="text-2xl font-bold text-[#3B9797]">
                R$ {((data.financeiro?.projecaoSemanal || 0) / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-[#BFC7C9]">próx. 7 dias</p>
            </div>
          </div>

          {/* Grid de 5 KPIs Adicionais */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 divide-x divide-[#E0E0E0] border-t border-[#E0E0E0]">
            {/* Ticket Médio */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Calculator className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Ticket Médio</p>
              </div>
              <p className="text-2xl font-bold text-[#16476A]">
                R$ {data.kpis.totalSolicitacoes > 0
                  ? ((data.financeiro?.valorTotalSolicitado || 0) / data.kpis.totalSolicitacoes).toFixed(2)
                  : '0.00'}
              </p>
              <p className="text-xs text-[#BFC7C9]">por solicitação</p>
            </div>

            {/* Eficiência Operacional */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Eficiência</p>
              </div>
              <p className="text-2xl font-bold text-[#3B9797]">
                {(((data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0)) /
                  ((data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0) + (data.financeiro?.itensPendentes || 1)) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-[#BFC7C9]">itens processados</p>
            </div>

            {/* Velocidade de Processamento */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#132440] to-[#3B9797] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Timer className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Velocidade</p>
              </div>
              <p className="text-2xl font-bold text-[#132440]">
                {data.chartData.length > 0
                  ? Math.round(data.kpis.totalItens / data.chartData.length)
                  : 0}
              </p>
              <p className="text-xs text-[#BFC7C9]">itens/dia</p>
            </div>

            {/* Valor por Item */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#BF092F] to-[#16476A] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Valor/Item</p>
              </div>
              <p className="text-2xl font-bold text-[#BF092F]">
                R$ {data.kpis.totalItens > 0
                  ? ((data.financeiro?.valorTotalSolicitado || 0) / data.kpis.totalItens).toFixed(2)
                  : '0.00'}
              </p>
              <p className="text-xs text-[#BFC7C9]">preço médio</p>
            </div>

            {/* ROI Potencial */}
            <div className="p-5 hover:bg-[#E0E7EF] transition-colors duration-300 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Recuperação</p>
              </div>
              <p className="text-2xl font-bold text-[#16476A]">
                {(data.financeiro?.valorTotalSolicitado || 0) > 0
                  ? (((data.financeiro?.valorTotalAprovado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100).toFixed(0)
                  : 0}%
              </p>
              <p className="text-xs text-[#BFC7C9]">do valor total</p>
            </div>
          </div>

          {/* Barra de Progresso Financeiro */}
          <div className="p-6 bg-gradient-to-r from-[#F8F9FA] to-white border-t border-[#E0E0E0]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#212121]">Distribuição Financeira por Status</p>
              <p className="text-xs text-[#757575]">
                Total: R$ {(data.financeiro?.valorTotalSolicitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A] transition-all duration-500"
                style={{
                  width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0
                    ? ((data.financeiro?.valorTotalAprovado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100
                    : 0}%`
                }}
                title="Aprovado"
              />
              <div
                className="h-full bg-gradient-to-r from-[#BF092F] to-[#132440] transition-all duration-500"
                style={{
                  width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0
                    ? ((data.financeiro?.valorTotalRejeitado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100
                    : 0}%`
                }}
                title="Rejeitado"
              />
              <div
                className="h-full bg-gradient-to-r from-[#16476A] to-[#3B9797] transition-all duration-500"
                style={{
                  width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0
                    ? ((data.financeiro?.valorTotalPendente || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100
                    : 0}%`
                }}
                title="Pendente"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#3B9797] to-[#16476A]" />
                  Aprovado ({(((data.financeiro?.valorTotalAprovado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100).toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#BF092F] to-[#132440]" />
                  Rejeitado ({(((data.financeiro?.valorTotalRejeitado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100).toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#16476A] to-[#3B9797]" />
                  Pendente ({(((data.financeiro?.valorTotalPendente || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Gráficos de Análise Financeira */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico 1: Evolução Financeira com Projeção */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#132440] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Evolução Financeira + Projeção</h3>
                  <p className="text-[#E0E7EF] text-xs">Últimos 30 dias + previsão 7 dias</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.projecaoFinanceira || []}>
                  <defs>
                    <linearGradient id="colorValorHome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16476A" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#16476A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#757575' }}
                    tickFormatter={(value) => {
                      const d = new Date(value);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#757575' }}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length && label) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-200">
                            <p className="text-sm font-bold text-gray-800">
                              {new Date(label).toLocaleDateString('pt-BR')}
                            </p>
                            <p className={`text-sm font-semibold ${item.projetado ? 'text-[#3B9797]' : 'text-[#16476A]'}`}>
                              {item.projetado ? 'Projeção: ' : 'Realizado: '}
                              R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="#16476A"
                    fill="url(#colorValorHome)"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.projetado) {
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#3B9797"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={3} fill="#16476A" />;
                    }}
                  />
                  <ReferenceLine
                    y={data.financeiro?.mediaValorDiario || 0}
                    stroke="#BF092F"
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#16476A]" />
                  Realizado
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#3B9797]" />
                  Projetado
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-[#BF092F]" style={{ borderStyle: 'dashed' }} />
                  Média
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico 2: Distribuição por Status (Donut) */}
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#3B9797] via-[#16476A] to-[#132440] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Distribuição por Status</h3>
                  <p className="text-[#E0E7EF] text-xs">Valores em R$</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Aprovado', value: data.financeiro?.valorTotalAprovado || 0, color: '#3B9797' },
                      { name: 'Pendente', value: data.financeiro?.valorTotalPendente || 0, color: '#16476A' },
                      { name: 'Rejeitado', value: data.financeiro?.valorTotalRejeitado || 0, color: '#BF092F' },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {[
                      { name: 'Aprovado', value: data.financeiro?.valorTotalAprovado || 0, color: '#3B9797' },
                      { name: 'Pendente', value: data.financeiro?.valorTotalPendente || 0, color: '#16476A' },
                      { name: 'Rejeitado', value: data.financeiro?.valorTotalRejeitado || 0, color: '#BF092F' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-200">
                            <p className="text-sm font-bold" style={{ color: item.color }}>{item.name}</p>
                            <p className="text-sm text-gray-600">
                              R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3B9797]" />
                    Aprovado
                  </span>
                  <span className="font-bold text-[#3B9797]">
                    R$ {((data.financeiro?.valorTotalAprovado || 0) / 1000).toFixed(1)}k
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#16476A]" />
                    Pendente
                  </span>
                  <span className="font-bold text-[#16476A]">
                    R$ {((data.financeiro?.valorTotalPendente || 0) / 1000).toFixed(1)}k
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#BF092F]" />
                    Rejeitado
                  </span>
                  <span className="font-bold text-[#BF092F]">
                    R$ {((data.financeiro?.valorTotalRejeitado || 0) / 1000).toFixed(1)}k
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 3: Análise de Pareto - Top Produtos por Valor */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#132440] via-[#16476A] to-[#3B9797] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Análise de Pareto (80/20)</h3>
                  <p className="text-[#E0E7EF] text-xs">Top 10 produtos por valor - Regra 80/20</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                <p className="text-white font-bold text-xs">
                  {(data.paretoFinanceiro || []).filter(p => p.percentualAcumulado <= 80).length} produtos = 80%
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={(data.paretoFinanceiro || []).slice(0, 10).map((p, index) => ({
                  ...p,
                  nome: p.productName.length > 15 ? p.productName.substring(0, 15) + '...' : p.productName,
                  index: index + 1,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 9, fill: '#757575' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#757575' }}
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#757575' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
                          <p className="text-sm font-bold text-gray-800 mb-1">{item.productName}</p>
                          <p className="text-xs text-gray-500 mb-2">EAN: {item.ean || 'N/A'}</p>
                          <div className="space-y-1">
                            <p className="text-sm">
                              <span className="text-gray-600">Valor:</span>{' '}
                              <span className="font-bold text-[#16476A]">
                                R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </p>
                            <p className="text-sm">
                              <span className="text-gray-600">Quantidade:</span>{' '}
                              <span className="font-bold text-[#212121]">{item.count} itens</span>
                            </p>
                            <p className="text-sm">
                              <span className="text-gray-600">Acumulado:</span>{' '}
                              <span className="font-bold text-[#3B9797]">{item.percentualAcumulado}%</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="valor"
                  fill="#16476A"
                  radius={[4, 4, 0, 0]}
                  name="Valor (R$)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="percentualAcumulado"
                  stroke="#3B9797"
                  strokeWidth={3}
                  dot={{ fill: '#3B9797', strokeWidth: 2, r: 5 }}
                  name="% Acumulado"
                />
                <ReferenceLine
                  yAxisId="right"
                  y={80}
                  stroke="#BF092F"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: '80%', position: 'right', fill: '#BF092F', fontSize: 12, fontWeight: 'bold' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <span className="flex items-center gap-2">
                <div className="w-4 h-3 rounded bg-[#16476A]" />
                Valor por Produto
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-1 rounded bg-[#3B9797]" />
                % Acumulado
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-[#BF092F]" style={{ borderStyle: 'dashed' }} />
                Linha 80%
              </span>
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-[#E0E7EF] to-white rounded-xl border border-[#BFC7C9]">
              <p className="text-xs text-[#757575]">
                <span className="font-bold text-[#16476A]">Insight Pareto:</span>{' '}
                {(data.paretoFinanceiro || []).filter(p => p.percentualAcumulado <= 80).length} produtos representam 80% do valor total.
                Foque nestes itens para maximizar o impacto da gestão de rebaixa.
              </p>
            </div>
          </div>
        </div>

        {/* Análise Temporal Integrada */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#3B9797] px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Análise Temporal</h2>
                <p className="text-[#E0E7EF] text-sm font-medium">Evolução e comparação de períodos</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            {/* Comparação de Períodos */}
            <div className="mb-6">
              <PeriodComparisonChart
                data={data.periodComparisonData}
                title="Comparação: Últimos 14 Dias"
                currentLabel="14 dias atuais"
                previousLabel="14 dias anteriores"
              />
            </div>
            {/* Evolução Temporal */}
            <div className="border-t-2 border-[#E0E0E0] pt-6">
              <SolicitacoesChart data={data.chartData} />
            </div>
          </div>
        </div>

        {/* Análise de Distribuição - Layout Horizontal Integrado */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#132440] via-[#16476A] to-[#132440] px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Distribuição por Status e Lojas</h2>
                <p className="text-[#E0E7EF] text-sm font-medium">Análise de concentração e dispersão</p>
              </div>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <StatusChart data={data.solicitacoesPorStatus} />
            </div>
            <div className="border-l-2 border-[#E0E0E0] pl-8">
              <StoresSolicitacoesChart />
            </div>
          </div>
        </div>

        {/* Top Produtos - Visual Destacado */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#BF092F] via-[#BF092F] to-[#BF092F] px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Top Produtos Mais Solicitados</h2>
                  <p className="text-[#E9ECEF] text-sm font-medium">Ranking dos 10 produtos mais requisitados</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <p className="text-white font-bold text-sm">Top 10</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <TopProductsChart products={data.topProdutos} limit={10} />
          </div>
        </div>

        {/* Ranking Top 50 - Visual Aprimorado */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#3B9797] via-[#16476A] to-[#132440] px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Rankings Top 50</h2>
                  <p className="text-[#E0E7EF] text-sm font-medium">Classificação por desempenho</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <p className="text-white font-bold text-sm">Top 50</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <RankingPanel
              rankingPorLoja={data.rankingPorLoja}
              rankingPorComprador={data.rankingPorComprador}
              rankingPorProduto={data.rankingPorProduto}
              limit={50}
            />
          </div>
        </div>

        {/* Solicitações Recentes - Visual Aprimorado */}
        <div className="mb-8 bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#3B9797] via-[#3B9797] to-[#132440] px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Solicitações Recentes</h2>
                <p className="text-[#E0E7EF] text-sm font-medium">Últimas movimentações do sistema</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <RecentSolicitacoes solicitacoes={data.solicitacoesRecentes} />
          </div>
        </div>

        {/* Footer - Informações do Sistema */}
        <div className="mt-8 bg-gradient-to-br from-white via-[#F8F9FA] to-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E0E0E0]">
            {/* Status do Sistema */}
            <div className="p-6 flex items-center justify-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-full animate-pulse shadow-lg"></div>
              <div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Status do Sistema</p>
                <p className="text-sm font-bold text-[#3B9797]">Operacional</p>
              </div>
            </div>

            {/* Última Atualização */}
            <div className="p-6 flex items-center justify-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-lg">
                <RefreshCw className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Última Atualização</p>
                <p className="text-sm font-bold text-[#212121]">
                  {new Date(data.lastUpdated).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Auto Refresh */}
            <div className="p-6 flex items-center justify-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#132440] to-[#16476A] rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-[#757575] font-semibold uppercase">Atualização Automática</p>
                <p className="text-sm font-bold text-[#212121]">A cada 5 minutos</p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-8 py-4 border-t-2 border-[#E0E0E0]">
            <p className="text-center text-xs text-[#757575] font-semibold">
              <span className="text-[#16476A] font-bold">MyInventory Dashboard</span> · Sistema de Gestão Interna · Versão 2.0
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
