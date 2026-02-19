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
import FinancialEvolutionChart from '@/components/charts/FinancialEvolutionChart';
import StatusBarChart from '@/components/charts/StatusBarChart';
import ParetoChart from '@/components/charts/ParetoChart';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Skeleton, { CardSkeleton } from '@/components/ui/Skeleton';
// Custom chart components replaced recharts
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

// ============================================================================
// CHART COLORS — Checklists Palette
// ============================================================================
const COLORS = {
  primary: '#16476A',
  primaryDark: '#132440',
  primaryLight: '#3B9797',
  success: '#3B9797',
  error: '#BF092F',
  warning: '#BF092F',
  info: '#16476A',
  gray: '#757575',
  grayLight: '#E0E0E0',
  teal: '#3B9797',
  navy: '#132440',
};

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

// ============================================================================
// SKELETON LOADING
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] px-3 sm:px-5 lg:px-6 py-6">
        <div className="w-full flex items-center gap-4">
          <Skeleton width={56} height={56} rounded="xl" className="!bg-white/20" />
          <div className="space-y-2">
            <Skeleton width={280} height={32} className="!bg-white/20" />
            <Skeleton width={200} height={14} className="!bg-white/10" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="w-full px-3 sm:px-5 lg:px-6 py-5">
        {/* Hero stats */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        {/* Metrics */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

function SectionHeader({ icon: Icon, title, subtitle, badge }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#3B9797] px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {subtitle && <p className="text-white/70 text-xs">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

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
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // SKELETON LOADING STATE
  // ──────────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  // ──────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ──────────────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md text-center" padding="lg">
          <div className="w-16 h-16 bg-error-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-error-200">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Erro ao Carregar</h2>
          <p className="text-error-500 font-semibold mb-6">{error}</p>
          <Button
            variant="primary"
            size="lg"
            icon={RefreshCw}
            onClick={fetchDashboardData}
            fullWidth
          >
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // ──────────────────────────────────────────────────────────────────────
  // COMPUTED DATA
  // ──────────────────────────────────────────────────────────────────────
  const counts = data.chartData.map((d) => d.count);
  const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
  const prev7 = counts.slice(-14, -7).reduce((a, b) => a + b, 0);
  const pctTrend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;

  const mudancaHoje = data.kpis.solicitacoesOntem > 0
    ? Math.round(((data.kpis.solicitacoesHoje - data.kpis.solicitacoesOntem) / data.kpis.solicitacoesOntem) * 100)
    : 0;

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <PageHeader
        title="Painel de Gestão"
        subtitle="MyInventory · Sistema de Controle e Análise"
        icon={TrendingUp}
        actions={
          <Button
            variant="ghost"
            icon={RefreshCw}
            loading={loading}
            onClick={fetchDashboardData}
            className="!bg-white/15 !text-white hover:!bg-white/25 border border-white/20"
          >
            Atualizar
          </Button>
        }
      />

      {/* Main Content */}
      <main className="w-full px-3 sm:px-5 lg:px-6 py-5 lg:py-6">

        {/* ════════════════════════════════════════════════════════════════
            HERO STATS — Painel Principal (3 cols)
           ════════════════════════════════════════════════════════════════ */}
        <Card className="mb-8 !p-0" padding="none" bordered>
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-divider">
            {/* Solicitações Hoje */}
            <div className="p-7 bg-gradient-to-br from-primary-50 to-card relative overflow-hidden group hover:from-primary-100/50 transition-all">
              <div className="absolute top-0 right-0 opacity-[0.06] transform translate-x-8 -translate-y-8">
                <Calendar className="w-36 h-36 text-primary-600" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-md">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Hoje</p>
                    <p className="text-[11px] text-text-tertiary">Solicitações recebidas</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-primary-700 mb-2">{data.kpis.solicitacoesHoje}</p>
                    <Badge variant={mudancaHoje >= 0 ? 'success' : 'error'} size="md" dot>
                      {mudancaHoje > 0 ? '+' : ''}{mudancaHoje}% vs ontem
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-text-secondary">{data.kpis.solicitacoesOntem}</p>
                    <p className="text-xs text-text-tertiary">Ontem</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Última Semana */}
            <div className="p-7 bg-gradient-to-br from-primary-50 to-card relative overflow-hidden group hover:from-primary-100/50 transition-all">
              <div className="absolute top-0 right-0 opacity-[0.06] transform translate-x-8 -translate-y-8">
                <TrendingUp className="w-36 h-36 text-primary-700" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl shadow-md">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Últimos 7 Dias</p>
                    <p className="text-[11px] text-text-tertiary">Acumulado semanal</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-primary-800 mb-2">{data.kpis.solicitacoesUltimos7Dias}</p>
                    <Badge variant={data.kpis.mudancaSemanal >= 0 ? 'success' : 'error'} size="md" dot>
                      {data.kpis.mudancaSemanal > 0 ? '+' : ''}{data.kpis.mudancaSemanal}% vs anterior
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-text-secondary">{(data.kpis.solicitacoesUltimos7Dias / 7).toFixed(1)}</p>
                    <p className="text-xs text-text-tertiary">Média/dia</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Taxa de Conversão */}
            <div className="p-7 bg-gradient-to-br from-success-50 to-card relative overflow-hidden group hover:from-success-100/50 transition-all">
              <div className="absolute top-0 right-0 opacity-[0.06] transform translate-x-8 -translate-y-8">
                <Target className="w-36 h-36 text-success-600" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-success-500 to-success-700 rounded-xl shadow-md">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Taxa de Conversão</p>
                    <p className="text-[11px] text-text-tertiary">Processamento concluído</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-success-600 mb-2">{data.kpis.taxaConversao}%</p>
                    <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-success-500 to-success-600 rounded-full transition-all duration-500"
                        style={{ width: `${data.kpis.taxaConversao}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-text-secondary">{data.kpis.mediaItensPorSolicitacao}</p>
                    <p className="text-xs text-text-tertiary">Itens/média</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Pipeline */}
          <div className="grid grid-cols-3 divide-x divide-divider bg-surface-hover/30 border-t border-divider">
            {[
              { label: 'Pendentes', value: data.solicitacoesPorStatus.pending, icon: FileText, color: 'error' as const },
              { label: 'Em Lote', value: data.solicitacoesPorStatus.batched, icon: Package, color: 'warning' as const },
              { label: 'Concluídas', value: data.solicitacoesPorStatus.closed, icon: CheckCircle, color: 'success' as const },
            ].map(({ label, value, icon: Icon, color }) => {
              const pct = Math.round((value / data.kpis.totalSolicitacoes) * 100);
              return (
                <div key={label} className="p-5 hover:bg-surface-hover transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 bg-${color}-100 rounded-lg group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-4 h-4 text-${color}-600`} />
                      </div>
                      <div>
                        <p className="text-[11px] text-text-secondary font-semibold uppercase">{label}</p>
                        <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-tertiary">{pct}%</p>
                      <div className="w-14 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            SYSTEM METRICS (4 cols)
           ════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Solicitações', value: data.kpis.totalSolicitacoes, icon: FileText, badge: `${pctTrend > 0 ? '+' : ''}${pctTrend}%`, badgeColor: pctTrend >= 0 ? 'success' as const : 'error' as const },
            { label: 'Total Usuários', value: data.kpis.totalUsuarios, icon: Users, badge: `${Math.round((data.kpis.usuariosAtivos / data.kpis.totalUsuarios) * 100)}% ativos`, badgeColor: 'info' as const },
            { label: 'Total Lojas', value: data.kpis.totalLojas, icon: Store },
            { label: 'Total de Itens', value: data.kpis.totalItens, icon: Package },
          ].map(({ label, value, icon: Icon, badge: badgeText, badgeColor }) => (
            <Card key={label} hoverable className="!p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Icon className="w-4 h-4 text-primary-600" />
                </div>
                {badgeText && <Badge variant={badgeColor || 'neutral'} size="sm">{badgeText}</Badge>}
              </div>
              <p className="text-2xl font-bold text-text-primary mb-0.5">{value}</p>
              <p className="text-xs text-text-secondary font-medium">{label}</p>
            </Card>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            INSIGHTS
           ════════════════════════════════════════════════════════════════ */}
        {data.insights && data.insights.length > 0 && (
          <div className="mb-8">
            <InsightsPanel insights={data.insights} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            FINANCIAL PANEL
           ════════════════════════════════════════════════════════════════ */}
        <Card className="mb-8 !p-0" padding="none" bordered>
          <SectionHeader
            icon={DollarSign}
            title="Indicadores Financeiros de Rebaixa"
            subtitle="Métricas de valor, aprovação e economia"
            badge={
              <div className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                <p className="text-white font-bold text-xs">
                  R$ {((data.financeiro?.valorTotalSolicitado || 0) / 1000).toFixed(1)}k total
                </p>
              </div>
            }
          />

          {/* 2 Large Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-divider">
            {/* Total Solicitado */}
            <div className="p-7 bg-gradient-to-br from-primary-50/50 to-card relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-[0.05] transform translate-x-8 -translate-y-8">
                <Receipt className="w-36 h-36 text-primary-600" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl shadow-md">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Total Solicitado</p>
                    <p className="text-[11px] text-text-tertiary">Valor em rebaixa</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-primary-700 mb-3">
                  R$ {(data.financeiro?.valorTotalSolicitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[11px] text-text-tertiary mb-0.5">Pendente</p>
                    <p className="text-base font-bold text-warning-600">
                      R$ {(data.financeiro?.valorTotalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-tertiary mb-0.5">Rejeitado</p>
                    <p className="text-base font-bold text-error-500">
                      R$ {(data.financeiro?.valorTotalRejeitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Economia Gerada */}
            <div className="p-7 bg-gradient-to-br from-success-50/50 to-card relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-[0.05] transform translate-x-8 -translate-y-8">
                <PiggyBank className="w-36 h-36 text-success-600" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-success-500 to-success-700 rounded-xl shadow-md">
                    <PiggyBank className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Economia Gerada</p>
                    <p className="text-[11px] text-text-tertiary">Produtos recuperados</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-success-600 mb-3">
                  R$ {(data.financeiro?.valorTotalAprovado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <Badge
                  variant={(data.financeiro?.taxaAprovacao || 0) >= 70 ? 'success' : 'error'}
                  size="md"
                  dot
                >
                  {data.financeiro?.taxaAprovacao || 0}% aprovados ({data.financeiro?.itensAprovados || 0} itens)
                </Badge>
              </div>
            </div>
          </div>

          {/* 5 Small KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 divide-x divide-divider bg-surface-hover/30 border-t border-divider">
            {[
              { label: 'Aprovação', value: `${data.financeiro?.taxaAprovacao || 0}%`, sub: `${data.financeiro?.itensAprovados || 0} itens`, icon: BadgeCheck, color: 'success' },
              { label: 'Rejeição', value: `${data.financeiro?.taxaRejeicao || 0}%`, sub: `${data.financeiro?.itensRejeitados || 0} itens`, icon: BadgeX, color: 'error' },
              { label: 'Pendentes', value: `${data.financeiro?.itensPendentes || 0}`, sub: 'itens aguardando', icon: Clock, color: 'warning' },
              { label: 'Média/Dia', value: `R$ ${((data.financeiro?.mediaValorDiario || 0) / 1000).toFixed(1)}k`, sub: 'valor diário', icon: Activity, color: 'info' },
              { label: 'Projeção', value: `R$ ${((data.financeiro?.projecaoSemanal || 0) / 1000).toFixed(1)}k`, sub: 'próx. 7 dias', icon: TrendingUp, color: 'success' },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="p-4 hover:bg-surface-hover transition-colors group">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 bg-${color}-100 rounded-lg group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-3.5 h-3.5 text-${color}-600`} />
                  </div>
                  <p className="text-[11px] text-text-secondary font-semibold uppercase">{label}</p>
                </div>
                <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
                <p className="text-[11px] text-text-tertiary">{sub}</p>
              </div>
            ))}
          </div>

          {/* Additional KPIs row */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 divide-x divide-divider border-t border-divider">
            {[
              { label: 'Ticket Médio', value: `R$ ${data.kpis.totalSolicitacoes > 0 ? ((data.financeiro?.valorTotalSolicitado || 0) / data.kpis.totalSolicitacoes).toFixed(2) : '0.00'}`, sub: 'por solicitação', icon: Calculator },
              { label: 'Eficiência', value: `${(((data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0)) / ((data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0) + (data.financeiro?.itensPendentes || 1)) * 100).toFixed(0)}%`, sub: 'itens processados', icon: Zap },
              { label: 'Velocidade', value: `${data.chartData.length > 0 ? Math.round(data.kpis.totalItens / data.chartData.length) : 0}`, sub: 'itens/dia', icon: Timer },
              { label: 'Valor/Item', value: `R$ ${data.kpis.totalItens > 0 ? ((data.financeiro?.valorTotalSolicitado || 0) / data.kpis.totalItens).toFixed(2) : '0.00'}`, sub: 'preço médio', icon: Wallet },
              { label: 'Recuperação', value: `${(data.financeiro?.valorTotalSolicitado || 0) > 0 ? (((data.financeiro?.valorTotalAprovado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100).toFixed(0) : 0}%`, sub: 'do valor total', icon: Target },
            ].map(({ label, value, sub, icon: Icon }) => (
              <div key={label} className="p-4 hover:bg-surface-hover transition-colors group">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-primary-100 rounded-lg group-hover:scale-110 transition-transform">
                    <Icon className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <p className="text-[11px] text-text-secondary font-semibold uppercase">{label}</p>
                </div>
                <p className="text-xl font-bold text-text-primary">{value}</p>
                <p className="text-[11px] text-text-tertiary">{sub}</p>
              </div>
            ))}
          </div>

          {/* Financial Progress Bar */}
          <div className="p-5 bg-surface-hover/30 border-t border-divider">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-bold text-text-primary">Distribuição Financeira por Status</p>
              <p className="text-xs text-text-secondary">
                Total: R$ {(data.financeiro?.valorTotalSolicitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-success-500 transition-all duration-500"
                style={{ width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0 ? ((data.financeiro?.valorTotalAprovado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100 : 0}%` }}
                title="Aprovado"
              />
              <div
                className="h-full bg-error-500 transition-all duration-500"
                style={{ width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0 ? ((data.financeiro?.valorTotalRejeitado || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100 : 0}%` }}
                title="Rejeitado"
              />
              <div
                className="h-full bg-warning-500 transition-all duration-500"
                style={{ width: `${(data.financeiro?.valorTotalSolicitado || 0) > 0 ? ((data.financeiro?.valorTotalPendente || 0) / (data.financeiro?.valorTotalSolicitado || 1)) * 100 : 0}%` }}
                title="Pendente"
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success-500" /> Aprovado</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-error-500" /> Rejeitado</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning-500" /> Pendente</span>
            </div>
          </div>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            FINANCIAL CHARTS (2+1 cols)
           ════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Financial Evolution */}
          <div className="lg:col-span-2 bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
            {/* Header */}
            <div
              className="relative px-6 py-5 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #4878be, #305087)' }}
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                    <DollarSign className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Evolução Financeira + Projeção</h3>
                    <p className="text-white/50 text-sm mt-0.5">Últimos 30 dias + previsão 7 dias</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                    <span className="text-xs font-semibold text-white">Real</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.success }} />
                    <span className="text-xs font-semibold text-white">Projeção</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 divide-x divide-divider border-b border-divider">
              {[
                {
                  label: 'Total Realizado',
                  value: `R$ ${((data.financeiro?.valorTotalSolicitado || 0) / 1000).toFixed(1)}k`,
                  icon: DollarSign,
                  bg: 'bg-primary-50',
                  text: 'text-primary-700',
                  iconBg: 'bg-primary-100',
                  iconColor: 'text-primary-600',
                },
                {
                  label: 'Média Diária',
                  value: `R$ ${((data.financeiro?.mediaValorDiario || 0) / 1000).toFixed(1)}k`,
                  icon: Activity,
                  bg: 'bg-gray-50',
                  text: 'text-text-primary',
                  iconBg: 'bg-gray-100',
                  iconColor: 'text-gray-500',
                },
                {
                  label: 'Projeção 7d',
                  value: `R$ ${((data.financeiro?.projecaoSemanal || 0) / 1000).toFixed(1)}k`,
                  icon: TrendingUp,
                  bg: 'bg-success-50',
                  text: 'text-success-700',
                  iconBg: 'bg-success-100',
                  iconColor: 'text-success-600',
                },
              ].map(({ label, value, icon: Icon, bg, text, iconBg, iconColor }) => (
                <div key={label} className={`p-4 ${bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1 ${iconBg} rounded-md`}>
                      <Icon className={`w-3 h-3 ${iconColor}`} />
                    </div>
                    <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</p>
                  </div>
                  <p className={`text-xl font-extrabold ${text}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="px-4 pt-4 pb-2">
              <FinancialEvolutionChart
                data={data.projecaoFinanceira || []}
                mediaValorDiario={data.financeiro?.mediaValorDiario || 0}
                primaryColor={COLORS.primary}
                successColor={COLORS.success}
              />
            </div>

            {/* Footer Legend */}
            <div className="px-6 py-3 border-t border-divider bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-5 text-xs text-text-secondary font-medium">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full" style={{ backgroundColor: COLORS.primary }} /> Realizado
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: COLORS.success, backgroundColor: COLORS.success }} /> Projetado
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 border-t border-dashed border-gray-400" /> Média diária
                </span>
              </div>
              <span className="text-[11px] text-text-tertiary">
                {(data.projecaoFinanceira || []).filter((p: any) => p.projetado).length} dias projetados
              </span>
            </div>
          </div>

          {/* Chart 2: Distribution Donut */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div
              className="relative px-6 py-5 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #4878be, #305087)' }}
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')]" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Distribuição por Status</h3>
                  <p className="text-white/50 text-sm mt-0.5">Valores em R$</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <StatusBarChart
                data={[
                  { name: 'Aprovado', value: data.financeiro?.valorTotalAprovado || 0, color: COLORS.success },
                  { name: 'Pendente', value: data.financeiro?.valorTotalPendente || 0, color: COLORS.primary },
                  { name: 'Rejeitado', value: data.financeiro?.valorTotalRejeitado || 0, color: COLORS.error },
                ]}
              />
            </div>
          </div>
        </div>

        {/* ================================================================
            ROW: PARETO (2/3) + TOP PRODUCTS (1/3)
           ================================================================ */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pareto */}
          <div className="lg:col-span-2 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div
              className="relative px-5 py-4 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #4878be, #305087)' }}
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                    <BarChart3 className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Pareto (80/20)</h3>
                    <p className="text-white/50 text-xs">Top 10 por valor</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-white/80 px-2 py-0.5 bg-white/10 rounded-md">
                  {(data.paretoFinanceiro || []).filter(p => p.percentualAcumulado <= 80).length} = 80%
                </span>
              </div>
            </div>
            <div className="px-3 pt-3 pb-3">
              <ParetoChart
                data={data.paretoFinanceiro || []}
                primaryColor={COLORS.primary}
                successColor={COLORS.success}
              />
            </div>
          </div>

          {/* Top Products */}
          <TopProductsChart products={data.topProdutos} limit={10} />
        </div>

        {/* ================================================================
            ROW: TEMPORAL — side by side
           ================================================================ */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PeriodComparisonChart
            data={data.periodComparisonData}
            title="Comparativo 14 Dias"
            currentLabel="14 dias atuais"
            previousLabel="14 dias anteriores"
          />
          <SolicitacoesChart data={data.chartData} />
        </div>

        {/* ================================================================
            ROW: DISTRIBUTION — side by side
           ================================================================ */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusChart data={data.solicitacoesPorStatus} />
          <StoresSolicitacoesChart />
        </div>

        {/* ================================================================
            ROW: RANKINGS + RECENT — side by side
           ================================================================ */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RankingPanel
            rankingPorLoja={data.rankingPorLoja}
            rankingPorComprador={data.rankingPorComprador}
            rankingPorProduto={data.rankingPorProduto}
            limit={50}
          />
          <RecentSolicitacoes solicitacoes={data.solicitacoesRecentes} />
        </div>

        {/* ================================================================
            FOOTER
           ================================================================ */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-divider">
            <div className="p-4 flex items-center justify-center gap-2.5">
              <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
              <div>
                <p className="text-[10px] text-text-secondary font-semibold uppercase">Sistema</p>
                <p className="text-xs font-bold text-success-600">Operacional</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center gap-2.5">
              <RefreshCw className="w-3.5 h-3.5 text-primary-500" />
              <div>
                <p className="text-[10px] text-text-secondary font-semibold uppercase">Atualizado</p>
                <p className="text-xs font-bold text-text-primary">
                  {new Date(data.lastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center gap-2.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
              <div>
                <p className="text-[10px] text-text-secondary font-semibold uppercase">Refresh</p>
                <p className="text-xs font-bold text-text-primary">5 min</p>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

