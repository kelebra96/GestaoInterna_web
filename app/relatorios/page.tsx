'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  FileDown,
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Package,
  Store,
  Users,
  Target,
  Zap,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  LayoutGrid,
  DollarSign,
  Percent,
  TrendingUp as TrendUp,
  BadgeCheck,
  BadgeX,
  Wallet,
  PiggyBank,
  Receipt,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

type Status = 'pending' | 'batched' | 'closed';

interface Dashboard {
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
  solicitacoesRecentes: Array<{
    id: string;
    status: Status;
    createdAt: string;
    userName: string;
    storeName: string;
    storeId?: string;
  }>;
  chartData: Array<{ date: string; count: number }>;
  topProdutos: Array<{
    productId: string;
    productName: string;
    count: number;
    ean?: string;
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
  itensStatusChartData: Array<{
    date: string;
    aprovados: number;
    rejeitados: number;
    pendentes: number;
  }>;
  paretoFinanceiro: Array<{
    productId: string;
    productName: string;
    count: number;
    valor: number;
    ean?: string;
    percentualAcumulado: number;
  }>;
  valorChartData: Array<{
    date: string;
    valor: number;
  }>;
  lastUpdated: string;
}

type ReportType = 'solicitacoes' | 'produtos' | 'lojas' | 'usuarios' | 'performance' | 'tendencias' | 'financeiro';
type PeriodType = '7d' | '15d' | '30d' | '60d' | '90d' | '6m' | '1y' | 'custom';

const COLORS = {
  primary: '#16476A',
  secondary: '#132440',
  success: '#3B9797',
  warning: '#F59E0B',
  danger: '#BF092F',
  gray: '#757575',
  lightGray: '#E0E0E0',
};

const CHART_COLORS = ['#16476A', '#3B9797', '#F59E0B', '#BF092F', '#132440', '#6366F1', '#EC4899', '#14B8A6'];

export default function RelatoriosPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType>('solicitacoes');
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    kpis: true,
    graficos: true,
    detalhes: true,
    analise: true,
    comparativo: true,
    pareto: true,
  });
  const [formattedLastUpdated, setFormattedLastUpdated] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error('Falha ao carregar dados');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (data?.lastUpdated) {
      setFormattedLastUpdated(
        new Date(data.lastUpdated).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }
  }, [data?.lastUpdated]);

  // Cálculos e análises
  const analytics = useMemo(() => {
    if (!data) return null;

    const totalSolicitacoes = data.kpis.totalSolicitacoes;
    const mediaItensDia = data.chartData.length > 0
      ? Math.round(data.chartData.reduce((sum, d) => sum + d.count, 0) / data.chartData.length)
      : 0;

    // Análise por dia da semana
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const solicitacoesPorDiaSemana = data.chartData.reduce((acc, d) => {
      const day = new Date(d.date).getDay();
      const dayName = dayNames[day];
      acc[dayName] = (acc[dayName] || 0) + d.count;
      return acc;
    }, {} as Record<string, number>);

    const diasSemanaChart = dayNames.map(dia => ({
      dia,
      quantidade: solicitacoesPorDiaSemana[dia] || 0,
    }));

    // Crescimento percentual
    const crescimentoPercentual = data.chartData.length >= 14
      ? (() => {
          const primeirosSeteDias = data.chartData.slice(0, 7).reduce((sum, d) => sum + d.count, 0);
          const ultimosSeteDias = data.chartData.slice(-7).reduce((sum, d) => sum + d.count, 0);
          return primeirosSeteDias > 0
            ? Math.round(((ultimosSeteDias - primeirosSeteDias) / primeirosSeteDias) * 100)
            : 0;
        })()
      : 0;

    // Taxas
    const taxaPendencia = totalSolicitacoes > 0
      ? Math.round((data.solicitacoesPorStatus.pending / totalSolicitacoes) * 100)
      : 0;

    const taxaConclusao = totalSolicitacoes > 0
      ? Math.round((data.solicitacoesPorStatus.closed / totalSolicitacoes) * 100)
      : 0;

    const taxaAgrupamento = totalSolicitacoes > 0
      ? Math.round((data.solicitacoesPorStatus.batched / totalSolicitacoes) * 100)
      : 0;

    // Dados para gráfico de pizza de status
    const statusPieData = [
      { name: 'Pendentes', value: data.solicitacoesPorStatus.pending, color: COLORS.warning },
      { name: 'Agrupadas', value: data.solicitacoesPorStatus.batched, color: COLORS.success },
      { name: 'Concluídas', value: data.solicitacoesPorStatus.closed, color: COLORS.primary },
    ];

    // Dados para gráfico de evolução temporal
    const evolutionChart = data.chartData.map((d, idx) => {
      const date = new Date(d.date);
      return {
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        quantidade: d.count,
        media: mediaItensDia,
        tendencia: idx > 0 ? Math.round((d.count + (data.chartData[idx - 1]?.count || 0)) / 2) : d.count,
      };
    });

    // Análise de Pareto (80/20) - Top produtos
    const totalProdutos = data.topProdutos.reduce((sum, p) => sum + p.count, 0);
    let acumulado = 0;
    const paretoData = data.topProdutos.slice(0, 10).map((p, idx) => {
      acumulado += p.count;
      const percentualAcumulado = totalProdutos > 0 ? Math.round((acumulado / totalProdutos) * 100) : 0;
      return {
        nome: p.productName.length > 15 ? p.productName.substring(0, 15) + '...' : p.productName,
        quantidade: p.count,
        percentualAcumulado,
        ean: p.ean,
      };
    });

    // Análise de concentração de lojas
    const totalLojasCount = data.solicitacoesPorLoja.reduce((sum, l) => sum + l.count, 0);
    let acumuladoLojas = 0;
    const paretoLojas = data.solicitacoesPorLoja.slice(0, 10).map((l) => {
      acumuladoLojas += l.count;
      const percentualAcumulado = totalLojasCount > 0 ? Math.round((acumuladoLojas / totalLojasCount) * 100) : 0;
      return {
        nome: l.storeName.length > 20 ? l.storeName.substring(0, 20) + '...' : l.storeName,
        quantidade: l.count,
        percentualAcumulado,
      };
    });

    // Métricas de eficiência
    const eficienciaOperacional = taxaConclusao;
    const velocidadeProcessamento = mediaItensDia;
    const taxaAtividade = data.kpis.usuariosAtivos > 0
      ? Math.round((totalSolicitacoes / data.kpis.usuariosAtivos))
      : 0;

    // Previsão simples (média móvel)
    const ultimosDados = data.chartData.slice(-7);
    const mediaUltimos7 = ultimosDados.length > 0
      ? Math.round(ultimosDados.reduce((sum, d) => sum + d.count, 0) / ultimosDados.length)
      : 0;
    const previsaoProximos7 = Math.round(mediaUltimos7 * (1 + (crescimentoPercentual / 100)));

    // Comparativo lojas
    const lojasChart = data.solicitacoesPorLoja.slice(0, 8).map(l => ({
      nome: l.storeName.length > 12 ? l.storeName.substring(0, 12) + '...' : l.storeName,
      quantidade: l.count,
    }));

    // Comparativo compradores
    const compradoresChart = data.rankingPorComprador.slice(0, 8).map(c => ({
      nome: c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name,
      quantidade: c.count,
    }));

    return {
      totalSolicitacoes,
      mediaItensDia,
      solicitacoesPorDiaSemana,
      diasSemanaChart,
      crescimentoPercentual,
      taxaPendencia,
      taxaConclusao,
      taxaAgrupamento,
      statusPieData,
      evolutionChart,
      paretoData,
      paretoLojas,
      eficienciaOperacional,
      velocidadeProcessamento,
      taxaAtividade,
      mediaUltimos7,
      previsaoProximos7,
      lojasChart,
      compradoresChart,
    };
  }, [data]);

  const exportCsv = (rows: Array<Record<string, any>>, filename: string) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = [headers.join(',')]
      .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const reports = [
    { id: 'solicitacoes', label: 'Solicitações', icon: FileText, color: COLORS.primary },
    { id: 'produtos', label: 'Produtos', icon: Package, color: COLORS.success },
    { id: 'lojas', label: 'Lojas', icon: Store, color: COLORS.warning },
    { id: 'usuarios', label: 'Usuários', icon: Users, color: COLORS.secondary },
    { id: 'performance', label: 'Performance', icon: Target, color: COLORS.danger },
    { id: 'tendencias', label: 'Tendências', icon: TrendingUp, color: COLORS.primary },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, color: '#059669' },
  ];

  const periods = [
    { id: '7d', label: '7 dias' },
    { id: '15d', label: '15 dias' },
    { id: '30d', label: '30 dias' },
    { id: '60d', label: '60 dias' },
    { id: '90d', label: '90 dias' },
    { id: '6m', label: '6 meses' },
    { id: '1y', label: '1 ano' },
  ];

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#132440] mb-6 animate-pulse">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-xl font-bold text-[#212121]">Gerando relatórios...</p>
          <p className="text-sm text-[#757575] mt-2">Processando dados analíticos</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-[#E0E0E0]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
          <p className="text-sm text-[#757575] mb-6">Não foi possível carregar os dados dos relatórios</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#16476A] hover:to-[#132440] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || !analytics) return null;

  // Componente de Card KPI reutilizável
  const KPICard = ({ title, value, subtitle, icon: Icon, color, trend, trendValue }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
  }) => (
    <div className={`p-5 rounded-xl bg-gradient-to-br from-white to-gray-50 border-2 border-[${color}]/20 shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-[#757575]">{title}</span>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-[#757575]">{subtitle}</p>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs font-bold ${
            trend === 'up' ? 'text-[#3B9797]' : trend === 'down' ? 'text-[#BF092F]' : 'text-[#757575]'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );

  // Componente de Card de Seção
  const SectionCard = ({ title, icon: Icon, color, children, sectionKey, actions }: {
    title: string;
    icon: any;
    color: string;
    children: React.ReactNode;
    sectionKey: string;
    actions?: React.ReactNode;
  }) => (
    <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
      <div
        className="w-full px-6 py-4 flex items-center justify-between transition-all"
        style={{ background: `linear-gradient(to right, ${color}, ${COLORS.secondary})` }}
      >
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </h2>
        </button>
        <div className="flex items-center gap-3">
          {actions}
          <button
            onClick={() => toggleSection(sectionKey)}
            className="p-1 hover:bg-white/10 rounded transition-all"
          >
            {expandedSections[sectionKey] ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
      {expandedSections[sectionKey] && (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  );

  // Tooltip customizado para os gráficos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-[#E0E0E0]">
          <p className="text-sm font-bold text-[#212121]">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString('pt-BR')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Renderizar conteúdo baseado no tipo de relatório
  const renderReportContent = () => {
    switch (selectedReport) {
      case 'solicitacoes':
        return (
          <>
            {/* Grid de 2 colunas para KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs Principais */}
              <SectionCard title="Indicadores Principais" icon={Activity} color={COLORS.primary} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Total de Solicitações"
                    value={analytics.totalSolicitacoes}
                    subtitle="No período selecionado"
                    icon={FileText}
                    color={COLORS.primary}
                  />
                  <KPICard
                    title="Média Diária"
                    value={analytics.mediaItensDia}
                    subtitle="Solicitações por dia"
                    icon={Calendar}
                    color={COLORS.success}
                  />
                  <KPICard
                    title="Taxa de Conclusão"
                    value={`${analytics.taxaConclusao}%`}
                    subtitle={`${data.solicitacoesPorStatus.closed} concluídas`}
                    icon={CheckCircle2}
                    color={COLORS.warning}
                    trend={analytics.taxaConclusao >= 70 ? 'up' : 'down'}
                    trendValue={analytics.taxaConclusao >= 70 ? 'Bom' : 'Atenção'}
                  />
                  <KPICard
                    title="Crescimento"
                    value={`${analytics.crescimentoPercentual >= 0 ? '+' : ''}${analytics.crescimentoPercentual}%`}
                    subtitle="Últimos 7 dias vs anteriores"
                    icon={TrendingUp}
                    color={analytics.crescimentoPercentual >= 0 ? COLORS.success : COLORS.danger}
                    trend={analytics.crescimentoPercentual >= 0 ? 'up' : 'down'}
                    trendValue={analytics.crescimentoPercentual >= 0 ? 'Crescendo' : 'Caindo'}
                  />
                </div>
              </SectionCard>

              {/* Distribuição por Status - Gráfico de Pizza */}
              <SectionCard title="Distribuição por Status" icon={PieChartIcon} color={COLORS.success} sectionKey="graficos">
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analytics.statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {analytics.statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {analytics.statusPieData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-[#757575]">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* Gráfico de Evolução Temporal - Full Width */}
            <div className="mb-6">
              <SectionCard
                title="Evolução Temporal de Solicitações"
                icon={BarChart3}
                color={COLORS.secondary}
                sectionKey="detalhes"
                actions={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportCsv(analytics.evolutionChart, 'evolucao_temporal.csv');
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                }
              >
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={analytics.evolutionChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#757575' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine y={analytics.mediaItensDia} stroke={COLORS.warning} strokeDasharray="5 5" label={{ value: 'Média', position: 'right', fill: COLORS.warning, fontSize: 12 }} />
                    <Area type="monotone" dataKey="quantidade" fill={`${COLORS.primary}20`} stroke={COLORS.primary} strokeWidth={2} name="Solicitações" />
                    <Line type="monotone" dataKey="tendencia" stroke={COLORS.success} strokeWidth={2} strokeDasharray="5 5" name="Tendência" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Grid de 2 colunas para Análises */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Análise por Dia da Semana */}
              <SectionCard title="Análise por Dia da Semana" icon={Calendar} color={COLORS.primary} sectionKey="analise">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.diasSemanaChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#757575' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantidade" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Solicitações">
                      {analytics.diasSemanaChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.quantidade === Math.max(...analytics.diasSemanaChart.map(d => d.quantidade)) ? COLORS.success : COLORS.primary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-[#F8F9FA] rounded-lg">
                  <p className="text-xs text-[#757575]">
                    <strong className="text-[#16476A]">Dia mais ativo:</strong>{' '}
                    {Object.entries(analytics.solicitacoesPorDiaSemana).reduce((max, curr) => curr[1] > max[1] ? curr : max, ['', 0])[0]}
                  </p>
                </div>
              </SectionCard>

              {/* Análise Comparativa de Status */}
              <SectionCard title="Análise Comparativa de Status" icon={Layers} color={COLORS.danger} sectionKey="comparativo">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/30 text-center">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                    <p className="text-3xl font-bold text-amber-500">{data.solicitacoesPorStatus.pending}</p>
                    <p className="text-xs text-[#757575] mt-1">Pendentes</p>
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-amber-500" style={{ width: `${analytics.taxaPendencia}%` }} />
                    </div>
                    <p className="text-sm font-bold text-amber-500 mt-1">{analytics.taxaPendencia}%</p>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/30 text-center">
                    <Layers className="w-6 h-6 mx-auto mb-2 text-[#3B9797]" />
                    <p className="text-3xl font-bold text-[#3B9797]">{data.solicitacoesPorStatus.batched}</p>
                    <p className="text-xs text-[#757575] mt-1">Agrupadas</p>
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[#3B9797]" style={{ width: `${analytics.taxaAgrupamento}%` }} />
                    </div>
                    <p className="text-sm font-bold text-[#3B9797] mt-1">{analytics.taxaAgrupamento}%</p>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/30 text-center">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#16476A]" />
                    <p className="text-3xl font-bold text-[#16476A]">{data.solicitacoesPorStatus.closed}</p>
                    <p className="text-xs text-[#757575] mt-1">Concluídas</p>
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[#16476A]" style={{ width: `${analytics.taxaConclusao}%` }} />
                    </div>
                    <p className="text-sm font-bold text-[#16476A] mt-1">{analytics.taxaConclusao}%</p>
                  </div>
                </div>

                {/* Insights */}
                <div className="mt-4 p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <h4 className="text-xs font-bold text-[#757575] mb-2 uppercase">Insights Automáticos</h4>
                  <div className="space-y-2">
                    {analytics.taxaPendencia > 30 && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[#757575]">
                          <strong className="text-amber-500">Atenção:</strong> {analytics.taxaPendencia}% pendentes - considere revisar o fluxo de aprovação.
                        </p>
                      </div>
                    )}
                    {analytics.taxaConclusao >= 70 && (
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-[#3B9797] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[#757575]">
                          <strong className="text-[#3B9797]">Excelente:</strong> Taxa de conclusão de {analytics.taxaConclusao}% indica alta eficiência.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        );

      case 'produtos':
        return (
          <>
            {/* Grid de 2 colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs de Produtos */}
              <SectionCard title="Indicadores de Produtos" icon={Package} color={COLORS.success} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Produtos Únicos"
                    value={data.topProdutos.length}
                    subtitle="Produtos solicitados"
                    icon={Package}
                    color={COLORS.success}
                  />
                  <KPICard
                    title="Média por Produto"
                    value={data.topProdutos.length > 0 ? Math.round(data.topProdutos.reduce((sum, p) => sum + p.count, 0) / data.topProdutos.length) : 0}
                    subtitle="Solicitações/produto"
                    icon={BarChart3}
                    color={COLORS.primary}
                  />
                  <KPICard
                    title="Top Produto"
                    value={data.topProdutos[0]?.count || 0}
                    subtitle={data.topProdutos[0]?.productName?.substring(0, 20) || '-'}
                    icon={TrendingUp}
                    color={COLORS.warning}
                  />
                  <KPICard
                    title="Total de Itens"
                    value={data.kpis.totalItens}
                    subtitle="Itens solicitados"
                    icon={Layers}
                    color={COLORS.secondary}
                  />
                </div>
              </SectionCard>

              {/* Análise de Pareto - Produtos */}
              <SectionCard title="Análise de Pareto (80/20)" icon={PieChartIcon} color={COLORS.primary} sectionKey="pareto">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={analytics.paretoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#757575' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#757575' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="quantidade" fill={COLORS.success} name="Quantidade" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="percentualAcumulado" stroke={COLORS.danger} strokeWidth={2} name="% Acumulado" dot />
                    <ReferenceLine yAxisId="right" y={80} stroke={COLORS.danger} strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-2 p-2 bg-[#F8F9FA] rounded-lg">
                  <p className="text-xs text-[#757575]">
                    <strong className="text-[#BF092F]">Regra 80/20:</strong> Identifique os produtos que geram 80% da demanda.
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Tabela Top 20 Produtos */}
            <SectionCard
              title="Top 20 Produtos Mais Solicitados"
              icon={BarChart3}
              color={COLORS.success}
              sectionKey="detalhes"
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportCsv(
                      data.topProdutos.slice(0, 20).map((p, i) => ({
                        posicao: i + 1,
                        produto: p.productName,
                        ean: p.ean || '-',
                        quantidade: p.count,
                      })),
                      'top_20_produtos.csv'
                    );
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E0E0E0]">
                  <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#16476A] uppercase w-16">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#16476A] uppercase">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#16476A] uppercase">EAN</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-[#16476A] uppercase">Qtd</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-[#16476A] uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E0E0E0]">
                    {data.topProdutos.slice(0, 20).map((produto, index) => {
                      const totalProdutos = data.topProdutos.reduce((sum, p) => sum + p.count, 0);
                      const percentage = totalProdutos > 0 ? (produto.count / totalProdutos) * 100 : 0;
                      return (
                        <tr key={produto.productId} className="hover:bg-green-50 transition-all">
                          <td className="px-4 py-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                              index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                              'bg-[#F5F5F5] text-[#757575]'
                            }`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-[#212121]">{produto.productName}</td>
                          <td className="px-4 py-3 text-sm font-mono text-[#757575]">{produto.ean || '-'}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-[#3B9797]">{produto.count.toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3 text-right text-sm text-[#757575]">{percentage.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );

      case 'lojas':
        return (
          <>
            {/* Grid de 2 colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs de Lojas */}
              <SectionCard title="Indicadores de Lojas" icon={Store} color={COLORS.warning} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Total de Lojas"
                    value={data.kpis.totalLojas}
                    subtitle="Lojas ativas"
                    icon={Store}
                    color={COLORS.warning}
                  />
                  <KPICard
                    title="Média por Loja"
                    value={data.kpis.totalLojas > 0 ? Math.round(analytics.totalSolicitacoes / data.kpis.totalLojas) : 0}
                    subtitle="Solicitações/loja"
                    icon={BarChart3}
                    color={COLORS.primary}
                  />
                  <KPICard
                    title="Loja Top"
                    value={data.solicitacoesPorLoja[0]?.count || 0}
                    subtitle={data.solicitacoesPorLoja[0]?.storeName?.substring(0, 20) || '-'}
                    icon={TrendingUp}
                    color={COLORS.success}
                  />
                  <KPICard
                    title="Lojas Ativas"
                    value={data.solicitacoesPorLoja.filter(l => l.count > 0).length}
                    subtitle="Com solicitações"
                    icon={Activity}
                    color={COLORS.secondary}
                  />
                </div>
              </SectionCard>

              {/* Gráfico Comparativo de Lojas */}
              <SectionCard title="Top 8 Lojas - Comparativo" icon={BarChart3} color={COLORS.warning} sectionKey="graficos">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.lojasChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: '#757575' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantidade" fill={COLORS.warning} radius={[0, 4, 4, 0]} name="Solicitações">
                      {analytics.lojasChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Análise de Concentração de Lojas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SectionCard title="Análise de Pareto - Lojas" icon={PieChartIcon} color={COLORS.secondary} sectionKey="pareto">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={analytics.paretoLojas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#757575' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#757575' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="quantidade" fill={COLORS.warning} name="Quantidade" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="percentualAcumulado" stroke={COLORS.danger} strokeWidth={2} name="% Acumulado" dot />
                    <ReferenceLine yAxisId="right" y={80} stroke={COLORS.danger} strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Distribuição Regional */}
              <SectionCard title="Distribuição por Loja" icon={LayoutGrid} color={COLORS.primary} sectionKey="detalhes">
                <div className="space-y-3">
                  {data.solicitacoesPorLoja.slice(0, 6).map((loja, index) => {
                    const totalLojas = data.solicitacoesPorLoja.reduce((sum, l) => sum + l.count, 0);
                    const percentage = totalLojas > 0 ? (loja.count / totalLojas) * 100 : 0;
                    return (
                      <div key={loja.storeId} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                          'bg-[#F5F5F5] text-[#757575]'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[#212121]">{loja.storeName}</span>
                            <span className="text-sm font-bold text-[#F59E0B]">{loja.count}</span>
                          </div>
                          <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-[#757575] w-12 text-right">{percentage.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          </>
        );

      case 'usuarios':
        return (
          <>
            {/* Grid de 2 colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs de Usuários */}
              <SectionCard title="Indicadores de Usuários" icon={Users} color={COLORS.secondary} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Total de Usuários"
                    value={data.kpis.totalUsuarios}
                    subtitle="Usuários cadastrados"
                    icon={Users}
                    color={COLORS.secondary}
                  />
                  <KPICard
                    title="Usuários Ativos"
                    value={data.kpis.usuariosAtivos}
                    subtitle={`${Math.round((data.kpis.usuariosAtivos / data.kpis.totalUsuarios) * 100)}% do total`}
                    icon={Activity}
                    color={COLORS.success}
                    trend="up"
                    trendValue="Online"
                  />
                  <KPICard
                    title="Média por Usuário"
                    value={data.kpis.totalUsuarios > 0 ? Math.round(analytics.totalSolicitacoes / data.kpis.totalUsuarios) : 0}
                    subtitle="Solicitações/usuário"
                    icon={BarChart3}
                    color={COLORS.primary}
                  />
                  <KPICard
                    title="Top Comprador"
                    value={data.rankingPorComprador[0]?.count || 0}
                    subtitle={data.rankingPorComprador[0]?.name?.substring(0, 20) || '-'}
                    icon={TrendingUp}
                    color={COLORS.warning}
                  />
                </div>
              </SectionCard>

              {/* Gráfico de Compradores */}
              <SectionCard title="Top 8 Compradores" icon={BarChart3} color={COLORS.secondary} sectionKey="graficos">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.compradoresChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: '#757575' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantidade" fill={COLORS.secondary} radius={[0, 4, 4, 0]} name="Solicitações">
                      {analytics.compradoresChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Tabela de Compradores */}
            <SectionCard
              title="Ranking de Compradores"
              icon={Users}
              color={COLORS.secondary}
              sectionKey="detalhes"
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportCsv(
                      data.rankingPorComprador.slice(0, 20).map((c, i) => ({
                        posicao: i + 1,
                        comprador: c.name,
                        quantidade: c.count,
                      })),
                      'ranking_compradores.csv'
                    );
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.rankingPorComprador.slice(0, 10).map((comprador, index) => {
                  const total = data.rankingPorComprador.reduce((sum, c) => sum + c.count, 0);
                  const percentage = total > 0 ? (comprador.count / total) * 100 : 0;
                  return (
                    <div key={comprador.id} className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-lg hover:bg-gray-100 transition-all">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                        'bg-white text-[#757575] border border-[#E0E0E0]'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#212121] truncate">{comprador.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#E0E0E0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#132440] to-[#16476A]"
                              style={{ width: `${Math.min(100, percentage * 5)}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#757575]">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-[#132440]">{comprador.count}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </>
        );

      case 'performance':
        return (
          <>
            {/* Grid de 2 colunas para Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs de Performance */}
              <SectionCard title="Métricas de Performance" icon={Target} color={COLORS.danger} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Taxa de Conversão"
                    value={`${data.kpis.taxaConversao}%`}
                    subtitle="Solicitações processadas"
                    icon={Target}
                    color={COLORS.primary}
                    trend={data.kpis.taxaConversao >= 70 ? 'up' : 'down'}
                    trendValue={data.kpis.taxaConversao >= 70 ? 'Bom' : 'Atenção'}
                  />
                  <KPICard
                    title="Média de Itens"
                    value={data.kpis.mediaItensPorSolicitacao}
                    subtitle="Itens por solicitação"
                    icon={Package}
                    color={COLORS.success}
                  />
                  <KPICard
                    title="Taxa de Pendência"
                    value={`${analytics.taxaPendencia}%`}
                    subtitle="Solicitações pendentes"
                    icon={Clock}
                    color={COLORS.warning}
                    trend={analytics.taxaPendencia > 30 ? 'down' : 'up'}
                    trendValue={analytics.taxaPendencia > 30 ? 'Alto' : 'Normal'}
                  />
                  <KPICard
                    title="Eficiência"
                    value={`${analytics.eficienciaOperacional}%`}
                    subtitle="Taxa de conclusão"
                    icon={Zap}
                    color={analytics.eficienciaOperacional >= 70 ? COLORS.success : COLORS.danger}
                    trend={analytics.eficienciaOperacional >= 70 ? 'up' : 'down'}
                    trendValue={analytics.eficienciaOperacional >= 70 ? 'Ótimo' : 'Melhorar'}
                  />
                </div>
              </SectionCard>

              {/* Gráfico de Gauge / Eficiência */}
              <SectionCard title="Visão Geral de Eficiência" icon={Activity} color={COLORS.danger} sectionKey="graficos">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <div className="relative w-20 h-20 mx-auto mb-3">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="#E0E0E0" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="35"
                          stroke={COLORS.primary}
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${(analytics.taxaConclusao / 100) * 220} 220`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#16476A]">
                        {analytics.taxaConclusao}%
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#757575]">Conclusão</p>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                    <div className="relative w-20 h-20 mx-auto mb-3">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="#E0E0E0" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="35"
                          stroke={COLORS.warning}
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${(analytics.taxaPendencia / 100) * 220} 220`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#F59E0B]">
                        {analytics.taxaPendencia}%
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#757575]">Pendência</p>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                    <div className="relative w-20 h-20 mx-auto mb-3">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="#E0E0E0" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="35"
                          stroke={COLORS.success}
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${(data.kpis.taxaConversao / 100) * 220} 220`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#3B9797]">
                        {data.kpis.taxaConversao}%
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#757575]">Conversão</p>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Insights de Performance */}
            <SectionCard title="Insights de Performance" icon={Zap} color={COLORS.secondary} sectionKey="detalhes">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-6 h-6 text-[#16476A]" />
                    <h4 className="font-bold text-[#212121]">Eficiência Operacional</h4>
                  </div>
                  <p className="text-sm text-[#757575]">
                    Sistema processando média de <strong className="text-[#16476A]">{analytics.mediaItensDia}</strong> solicitações por dia
                    com <strong className="text-[#16476A]">{data.kpis.mediaItensPorSolicitacao}</strong> itens cada.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  analytics.taxaConclusao >= 70
                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                    : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    {analytics.taxaConclusao >= 70
                      ? <TrendingUp className="w-6 h-6 text-[#3B9797]" />
                      : <AlertCircle className="w-6 h-6 text-[#F59E0B]" />
                    }
                    <h4 className="font-bold text-[#212121]">
                      {analytics.taxaConclusao >= 70 ? 'Alta Performance' : 'Oportunidade de Melhoria'}
                    </h4>
                  </div>
                  <p className="text-sm text-[#757575]">
                    {analytics.taxaConclusao >= 70
                      ? `Taxa de conclusão de ${analytics.taxaConclusao}% indica excelente eficiência no processamento.`
                      : `Taxa de conclusão de ${analytics.taxaConclusao}% pode ser melhorada. Revise os processos de aprovação.`
                    }
                  </p>
                </div>

                {analytics.taxaPendencia > 30 && (
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="w-6 h-6 text-[#BF092F]" />
                      <h4 className="font-bold text-[#212121]">Atenção Necessária</h4>
                    </div>
                    <p className="text-sm text-[#757575]">
                      <strong className="text-[#BF092F]">{analytics.taxaPendencia}%</strong> de pendência pode indicar gargalos no fluxo.
                      Considere revisar processos de aprovação.
                    </p>
                  </div>
                )}

                {analytics.crescimentoPercentual > 20 && (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                      <h4 className="font-bold text-[#212121]">Crescimento Acelerado</h4>
                    </div>
                    <p className="text-sm text-[#757575]">
                      Crescimento de <strong className="text-purple-600">{analytics.crescimentoPercentual}%</strong> nas últimas semanas.
                      Verifique capacidade operacional.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          </>
        );

      case 'tendencias':
        return (
          <>
            {/* Grid de 2 colunas para Tendências */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* KPIs Temporais */}
              <SectionCard title="Indicadores Temporais" icon={Calendar} color={COLORS.primary} sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Hoje"
                    value={data.kpis.solicitacoesHoje}
                    subtitle="Solicitações hoje"
                    icon={Calendar}
                    color={COLORS.primary}
                  />
                  <KPICard
                    title="Últimos 7 Dias"
                    value={data.kpis.solicitacoesUltimos7Dias}
                    subtitle="Solicitações na semana"
                    icon={BarChart3}
                    color={COLORS.success}
                  />
                  <KPICard
                    title="Mudança Semanal"
                    value={`${data.kpis.mudancaSemanal >= 0 ? '+' : ''}${data.kpis.mudancaSemanal}%`}
                    subtitle="vs semana anterior"
                    icon={TrendingUp}
                    color={data.kpis.mudancaSemanal >= 0 ? COLORS.success : COLORS.danger}
                    trend={data.kpis.mudancaSemanal >= 0 ? 'up' : 'down'}
                    trendValue={data.kpis.mudancaSemanal >= 0 ? 'Crescendo' : 'Caindo'}
                  />
                  <KPICard
                    title="Previsão 7 Dias"
                    value={analytics.previsaoProximos7}
                    subtitle="Estimativa próxima semana"
                    icon={Activity}
                    color={COLORS.secondary}
                  />
                </div>
              </SectionCard>

              {/* Gráfico de Área - Tendência */}
              <SectionCard title="Tendência de Crescimento" icon={TrendingUp} color={COLORS.success} sectionKey="graficos">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={analytics.evolutionChart}>
                    <defs>
                      <linearGradient id="colorQuantidade" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#757575' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#757575' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="quantidade"
                      stroke={COLORS.primary}
                      fillOpacity={1}
                      fill="url(#colorQuantidade)"
                      strokeWidth={2}
                      name="Solicitações"
                    />
                    <ReferenceLine y={analytics.mediaItensDia} stroke={COLORS.warning} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Análise Temporal Full Width */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Distribuição por Dia da Semana */}
              <SectionCard title="Distribuição Semanal" icon={Calendar} color={COLORS.secondary} sectionKey="detalhes">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.diasSemanaChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#757575' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantidade" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Solicitações">
                      {analytics.diasSemanaChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.quantidade === Math.max(...analytics.diasSemanaChart.map(d => d.quantidade)) ? COLORS.success : COLORS.primary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Insights Temporais */}
              <SectionCard title="Insights Temporais" icon={Zap} color={COLORS.primary} sectionKey="analise">
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-[#16476A]" />
                      <h4 className="font-bold text-[#212121]">Padrão Diário</h4>
                    </div>
                    <p className="text-sm text-[#757575]">
                      Média de <strong className="text-[#16476A]">{analytics.mediaItensDia}</strong> solicitações por dia,
                      com picos em dias úteis da semana.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3 mb-2">
                      <BarChart3 className="w-5 h-5 text-[#3B9797]" />
                      <h4 className="font-bold text-[#212121]">Dia Mais Ativo</h4>
                    </div>
                    <p className="text-sm text-[#757575]">
                      <strong className="text-[#3B9797]">
                        {Object.entries(analytics.solicitacoesPorDiaSemana).reduce((max, curr) => curr[1] > max[1] ? curr : max, ['', 0])[0]}
                      </strong> é o dia com maior volume de solicitações.
                    </p>
                  </div>

                  {data.kpis.mudancaSemanal > 10 && (
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
                        <h4 className="font-bold text-[#212121]">Crescimento Semanal</h4>
                      </div>
                      <p className="text-sm text-[#757575]">
                        Aumento de <strong className="text-[#F59E0B]">{data.kpis.mudancaSemanal}%</strong> em relação à semana anterior indica demanda crescente.
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-purple-600" />
                      <h4 className="font-bold text-[#212121]">Previsão</h4>
                    </div>
                    <p className="text-sm text-[#757575]">
                      Baseado na tendência atual, estimamos <strong className="text-purple-600">{analytics.previsaoProximos7}</strong> solicitações nos próximos 7 dias.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        );

      case 'financeiro':
        return (
          <>
            {/* KPIs Financeiros Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SectionCard title="Indicadores Financeiros de Rebaixa" icon={DollarSign} color="#059669" sectionKey="kpis">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard
                    title="Total Solicitado"
                    value={`R$ ${(data.financeiro?.valorTotalSolicitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle="Valor total em rebaixa"
                    icon={Receipt}
                    color="#059669"
                  />
                  <KPICard
                    title="Economia Gerada"
                    value={`R$ ${(data.financeiro?.valorTotalAprovado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle="Produtos aprovados/recuperados"
                    icon={PiggyBank}
                    color={COLORS.success}
                    trend="up"
                    trendValue="Aprovado"
                  />
                  <KPICard
                    title="Valor Pendente"
                    value={`R$ ${(data.financeiro?.valorTotalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle="Aguardando análise"
                    icon={Clock}
                    color={COLORS.warning}
                  />
                  <KPICard
                    title="Valor Rejeitado"
                    value={`R$ ${(data.financeiro?.valorTotalRejeitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle="Não aprovado para rebaixa"
                    icon={XCircle}
                    color={COLORS.danger}
                  />
                </div>
              </SectionCard>

              {/* Taxa de Aprovação/Rejeição */}
              <SectionCard title="Taxa de Aprovação de Itens" icon={Percent} color={COLORS.primary} sectionKey="graficos">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                    <BadgeCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p className="text-3xl font-bold text-green-600">{data.financeiro?.itensAprovados || 0}</p>
                    <p className="text-xs text-[#757575] mt-1">Aprovados</p>
                    <div className="mt-2 px-2 py-1 bg-green-200 rounded-full">
                      <span className="text-xs font-bold text-green-700">{data.financeiro?.taxaAprovacao || 0}%</span>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-2 border-amber-200">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-3xl font-bold text-amber-600">{data.financeiro?.itensPendentes || 0}</p>
                    <p className="text-xs text-[#757575] mt-1">Pendentes</p>
                    <div className="mt-2 px-2 py-1 bg-amber-200 rounded-full">
                      <span className="text-xs font-bold text-amber-700">
                        {((data.financeiro?.itensPendentes || 0) / ((data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0) + (data.financeiro?.itensPendentes || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-200">
                    <BadgeX className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <p className="text-3xl font-bold text-red-600">{data.financeiro?.itensRejeitados || 0}</p>
                    <p className="text-xs text-[#757575] mt-1">Rejeitados</p>
                    <div className="mt-2 px-2 py-1 bg-red-200 rounded-full">
                      <span className="text-xs font-bold text-red-700">{data.financeiro?.taxaRejeicao || 0}%</span>
                    </div>
                  </div>
                </div>

                {/* Barra de progresso geral */}
                <div className="p-4 bg-[#F8F9FA] rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[#212121]">Distribuição de Itens</span>
                    <span className="text-xs text-[#757575]">Total: {(data.financeiro?.itensAprovados || 0) + (data.financeiro?.itensRejeitados || 0) + (data.financeiro?.itensPendentes || 0)}</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${data.financeiro?.taxaAprovacao || 0}%` }}
                      title={`Aprovados: ${data.financeiro?.taxaAprovacao || 0}%`}
                    />
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{ width: `${data.financeiro?.taxaRejeicao || 0}%` }}
                      title={`Rejeitados: ${data.financeiro?.taxaRejeicao || 0}%`}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${100 - (data.financeiro?.taxaAprovacao || 0) - (data.financeiro?.taxaRejeicao || 0)}%` }}
                      title="Pendentes"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-[#757575]">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />Aprovados</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />Pendentes</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Rejeitados</span>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Gráfico de Projeção Financeira */}
            <div className="mb-6">
              <SectionCard
                title="Projeção de Evolução Financeira"
                icon={TrendingUp}
                color="#059669"
                sectionKey="detalhes"
                actions={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (data.projecaoFinanceira) {
                        exportCsv(
                          data.projecaoFinanceira.map(p => ({
                            data: p.date,
                            valor: p.valor,
                            tipo: p.projetado ? 'Projeção' : 'Realizado',
                          })),
                          'projecao_financeira.csv'
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                }
              >
                <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#757575]">Média Diária</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        R$ {(data.financeiro?.mediaValorDiario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#757575]">Projeção Semanal</p>
                      <p className="text-2xl font-bold text-teal-600">
                        R$ {(data.financeiro?.projecaoSemanal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={data.projecaoFinanceira || []}>
                    <defs>
                      <linearGradient id="colorValorReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorValorProjetado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0891B2" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0891B2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#757575' }}
                      tickFormatter={(value) => {
                        const d = new Date(value);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#757575' }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-[#E0E0E0]">
                              <p className="text-sm font-bold text-[#212121]">
                                {new Date(label).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-sm" style={{ color: item.projetado ? '#0891B2' : '#059669' }}>
                                {item.projetado ? 'Projeção: ' : 'Realizado: '}
                                R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#059669"
                      fill="url(#colorValorReal)"
                      strokeWidth={2}
                      name="Valor (R$)"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.projetado) {
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill="#0891B2"
                              stroke="#fff"
                              strokeWidth={2}
                            />
                          );
                        }
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill="#059669"
                          />
                        );
                      }}
                    />
                    <ReferenceLine
                      y={data.financeiro?.mediaValorDiario || 0}
                      stroke="#F59E0B"
                      strokeDasharray="5 5"
                      label={{ value: 'Média', position: 'right', fill: '#F59E0B', fontSize: 12 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    Valores Realizados
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-500" />
                    Valores Projetados
                  </span>
                </div>
              </SectionCard>
            </div>

            {/* Análise de Pareto Financeiro */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SectionCard title="Regra de Pareto (80/20) - Por Valor" icon={PieChartIcon} color={COLORS.danger} sectionKey="pareto">
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={(data.paretoFinanceiro || []).slice(0, 10).map(p => ({
                    ...p,
                    nome: p.productName.length > 12 ? p.productName.substring(0, 12) + '...' : p.productName,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 9, fill: '#757575' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#757575' }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#757575' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-[#E0E0E0]">
                              <p className="text-sm font-bold text-[#212121]">{item.productName}</p>
                              <p className="text-xs text-[#757575]">EAN: {item.ean || '-'}</p>
                              <p className="text-sm text-emerald-600">
                                Valor: R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-sm text-[#BF092F]">Acumulado: {item.percentualAcumulado}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar yAxisId="left" dataKey="valor" fill="#059669" name="Valor (R$)" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="percentualAcumulado" stroke={COLORS.danger} strokeWidth={2} name="% Acumulado" dot />
                    <ReferenceLine yAxisId="right" y={80} stroke={COLORS.danger} strokeDasharray="5 5" label={{ value: '80%', position: 'right', fill: COLORS.danger, fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-2 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                  <p className="text-xs text-[#757575]">
                    <strong className="text-[#BF092F]">Insight Pareto:</strong> Os produtos acima da linha de 80% representam a maior parte do valor solicitado. Foque nestes para maior impacto.
                  </p>
                </div>
              </SectionCard>

              {/* Resumo de Economia */}
              <SectionCard title="Resumo de Economia Gerada" icon={PiggyBank} color={COLORS.success} sectionKey="analise">
                <div className="space-y-4">
                  {/* Card principal de economia */}
                  <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <PiggyBank className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm opacity-80">Economia Total Gerada</p>
                        <p className="text-3xl font-bold">
                          R$ {(data.financeiro?.valorTotalAprovado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                      <div>
                        <p className="text-xs opacity-70">Itens Recuperados</p>
                        <p className="text-xl font-bold">{data.financeiro?.itensAprovados || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Taxa de Sucesso</p>
                        <p className="text-xl font-bold">{data.financeiro?.taxaAprovacao || 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Comparativo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <Wallet className="w-5 h-5 text-amber-600 mb-2" />
                      <p className="text-xs text-[#757575]">Valor em Análise</p>
                      <p className="text-lg font-bold text-amber-600">
                        R$ {(data.financeiro?.valorTotalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200">
                      <XCircle className="w-5 h-5 text-red-600 mb-2" />
                      <p className="text-xs text-[#757575]">Não Recuperado</p>
                      <p className="text-lg font-bold text-red-600">
                        R$ {(data.financeiro?.valorTotalRejeitado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                    <h4 className="text-xs font-bold text-[#757575] mb-2 uppercase">Insights Financeiros</h4>
                    <div className="space-y-2">
                      {(data.financeiro?.taxaAprovacao || 0) >= 70 && (
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-[#757575]">
                            <strong className="text-emerald-600">Excelente!</strong> Taxa de aprovação de {data.financeiro?.taxaAprovacao}% indica alta eficiência na recuperação de produtos.
                          </p>
                        </div>
                      )}
                      {(data.financeiro?.taxaAprovacao || 0) < 50 && (
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-[#757575]">
                            <strong className="text-amber-600">Atenção:</strong> Taxa de aprovação abaixo de 50% pode indicar problemas na seleção de produtos para rebaixa.
                          </p>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Activity className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[#757575]">
                          <strong className="text-blue-600">Projeção:</strong> Com base na tendência atual, estima-se
                          <strong className="text-emerald-600"> R$ {(data.financeiro?.projecaoSemanal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> em solicitações nos próximos 7 dias.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Tabela Pareto Detalhada */}
            <SectionCard
              title="Top 20 Produtos por Valor (Pareto Detalhado)"
              icon={BarChart3}
              color="#059669"
              sectionKey="comparativo"
              actions={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (data.paretoFinanceiro) {
                      exportCsv(
                        data.paretoFinanceiro.map((p, i) => ({
                          posicao: i + 1,
                          produto: p.productName,
                          ean: p.ean || '-',
                          quantidade: p.count,
                          valor: p.valor,
                          percentual_acumulado: p.percentualAcumulado,
                        })),
                        'pareto_financeiro.csv'
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E0E0E0]">
                  <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-emerald-700 uppercase w-16">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-emerald-700 uppercase">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-emerald-700 uppercase">EAN</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-emerald-700 uppercase">Qtd</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-emerald-700 uppercase">Valor</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-emerald-700 uppercase">% Acum.</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-emerald-700 uppercase">Pareto</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E0E0E0]">
                    {(data.paretoFinanceiro || []).slice(0, 20).map((produto, index) => (
                      <tr key={produto.productId} className={`hover:bg-emerald-50 transition-all ${produto.percentualAcumulado <= 80 ? 'bg-emerald-50/50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                            'bg-[#F5F5F5] text-[#757575]'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#212121]">{produto.productName}</td>
                        <td className="px-4 py-3 text-sm font-mono text-[#757575]">{produto.ean || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm text-[#757575]">{produto.count}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">
                          R$ {produto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-[#757575]">{produto.percentualAcumulado}%</td>
                        <td className="px-4 py-3 text-center">
                          {produto.percentualAcumulado <= 80 ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">80%</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">20%</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <FileDown className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Central de Relatórios
                  </h1>
                  <p className="text-gray-200 text-base font-medium mt-2">
                    Análises avançadas, relatórios detalhados e exportações personalizadas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-8 -mt-6">

        {/* Seletor de Tipo de Relatório - Grid 2 Colunas */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Configuração do Relatório
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tipo de Relatório */}
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-3">Tipo de Relatório</label>
                  <div className="grid grid-cols-3 gap-3">
                    {reports.map((report) => {
                      const Icon = report.icon;
                      return (
                        <button
                          key={report.id}
                          onClick={() => setSelectedReport(report.id as ReportType)}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                            selectedReport === report.id
                              ? 'border-[#16476A] bg-blue-100 shadow-lg'
                              : 'border-[#E0E0E0] bg-white hover:border-[#16476A] hover:bg-[#F8F9FA]'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${selectedReport === report.id ? 'text-[#16476A]' : 'text-[#757575]'}`} />
                          <p className={`text-sm font-bold text-center ${selectedReport === report.id ? 'text-[#16476A]' : 'text-[#757575]'}`}>
                            {report.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Período de Análise */}
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-3">Período de Análise</label>
                  <div className="flex gap-2 flex-wrap">
                    {periods.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPeriod(p.id as PeriodType)}
                        className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-300 hover:scale-105 ${
                          period === p.id
                            ? 'bg-gradient-to-r from-[#16476A] to-[#132440] text-white border-[#16476A] shadow-lg'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Renderizar conteúdo dinâmico baseado no tipo de relatório */}
        {renderReportContent()}

        {/* Footer */}
        <div className="mt-8 text-center p-6 bg-white rounded-2xl shadow-xl border border-[#E0E0E0]">
          <p className="text-sm text-[#757575]">
            <span className="font-semibold text-[#16476A]">Relatório gerado em:</span>{' '}
            {formattedLastUpdated}
          </p>
          <p className="text-xs text-[#BFC7C9] mt-2">
            MyInventory Professional Reports · Período: {periods.find(p => p.id === period)?.label} · Tipo: {reports.find(r => r.id === selectedReport)?.label}
          </p>
        </div>
      </main>
    </div>
  );
}
