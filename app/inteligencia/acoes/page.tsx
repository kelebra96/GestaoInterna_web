'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  TrendingDown,
  ShoppingCart,
  Package,
  DollarSign,
  Lightbulb,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Store,
  BarChart3,
  Search,
  Info,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import Card from '@/components/ui/Card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

// Types
interface RetailRecommendation {
  id: string;
  categoria: 'perda' | 'ruptura' | 'estoque' | 'rfe' | 'oportunidade' | 'processo';
  prioridade: 'critica' | 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  justificativa: string;
  acaoSugerida: string;
  lojaId?: string;
  lojaNome?: string;
  produtoId?: string;
  produtoNome?: string;
  fornecedor?: string;
  valorImpacto: number;
  roiEstimado?: number;
  economiaEstimada?: number;
  metricas: Record<string, number | string>;
  confianca: number;
  prazoAcao?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';
  geradoEm: string;
  expiraEm?: string;
}

interface RecommendationSummary {
  total: number;
  porCategoria: Record<string, number>;
  porPrioridade: Record<string, number>;
  economiaTotal: number;
  topLojas: Array<{
    lojaId: string;
    lojaNome: string;
    qtdRecomendacoes: number;
    impactoTotal: number;
  }>;
}

// Design System Colors - Paleta consistente com globals.css
const COLORS = {
  primary: '#16476A',      // Deep Blue (Primary)
  primaryLight: '#3B7FAD', // Primary 400
  teal: '#3B9797',         // Accent Teal (Success)
  tealLight: '#5AB5B5',    // Teal Light
  warning: '#F59E0B',      // Warning
  warningDark: '#D97706',  // Warning 600
  error: '#BF092F',        // Error
  errorLight: '#DC2626',   // Error Light
};

// Paleta de cores para prioridades
const PRIORITY_CONFIG = {
  critica: { label: 'Crítica', color: COLORS.error },
  alta: { label: 'Alta', color: COLORS.warning },
  media: { label: 'Média', color: COLORS.primaryLight },
  baixa: { label: 'Baixa', color: COLORS.teal },
};

// Paleta de cores para categorias
const CATEGORY_CONFIG = {
  rfe: { label: 'RFE', icon: AlertTriangle, color: COLORS.error },
  perda: { label: 'Perdas', icon: TrendingDown, color: COLORS.primary },
  ruptura: { label: 'Rupturas', icon: ShoppingCart, color: COLORS.teal },
  estoque: { label: 'Estoque', icon: Package, color: COLORS.primaryLight },
  oportunidade: { label: 'Oportunidades', icon: Lightbulb, color: COLORS.teal },
  processo: { label: 'Processos', icon: Target, color: COLORS.primary },
};

const PRAZO_LABELS: Record<string, string> = {
  imediato: 'Imediato',
  '7_dias': '7 dias',
  '30_dias': '30 dias',
  '90_dias': '90 dias',
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

// Recommendation Card Component
function RecommendationCard({
  rec,
  onAction,
}: {
  rec: RetailRecommendation;
  onAction: (id: string, action: 'accept' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[rec.categoria];
  const prioConfig = PRIORITY_CONFIG[rec.prioridade];
  const IconComponent = config.icon;

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="p-2.5 rounded-xl flex-shrink-0"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <IconComponent className="w-5 h-5" style={{ color: config.color }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-white"
                style={{ backgroundColor: prioConfig.color }}
              >
                {prioConfig.label}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${config.color}15`, color: config.color }}
              >
                {config.label}
              </span>
              {rec.prazoAcao && (
                <span className="text-xs text-text-tertiary flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {PRAZO_LABELS[rec.prazoAcao] || rec.prazoAcao}
                </span>
              )}
            </div>
            <h3 className="font-medium text-text-primary line-clamp-2">{rec.titulo}</h3>
            {rec.lojaNome && (
              <p className="text-sm text-text-secondary flex items-center gap-1 mt-1">
                <Store className="w-3 h-3" />
                {rec.lojaNome}
              </p>
            )}
          </div>

          {/* Impact & Expand */}
          <div className="text-right flex-shrink-0">
            {rec.valorImpacto > 0 && (
              <p className="text-sm font-bold" style={{ color: COLORS.error }}>
                {formatCurrency(rec.valorImpacto)}
              </p>
            )}
            {rec.economiaEstimada && rec.economiaEstimada > 0 && (
              <p className="text-xs font-medium" style={{ color: COLORS.teal }}>
                +{formatCurrency(rec.economiaEstimada)}
              </p>
            )}
            <div className="mt-2 text-text-tertiary">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border bg-background">
          {/* Description */}
          <div className="py-4">
            <p className="text-sm text-text-secondary leading-relaxed">{rec.descricao}</p>
            {rec.justificativa && (
              <p
                className="mt-3 text-sm italic p-3 rounded-lg border-l-4"
                style={{
                  backgroundColor: `${COLORS.primary}08`,
                  borderColor: COLORS.primary,
                  color: COLORS.primary,
                }}
              >
                {rec.justificativa}
              </p>
            )}
          </div>

          {/* Suggested Action */}
          <div className="py-4 border-t border-border">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Acao Sugerida
            </h4>
            <p
              className="text-sm p-4 rounded-xl border"
              style={{
                backgroundColor: `${COLORS.teal}08`,
                borderColor: `${COLORS.teal}30`,
                color: COLORS.primary,
              }}
            >
              {rec.acaoSugerida}
            </p>
          </div>

          {/* Metrics */}
          {Object.keys(rec.metricas).length > 0 && (
            <div className="py-4 border-t border-border">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Metricas
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(rec.metricas).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center px-3 py-1.5 bg-surface rounded-lg text-xs border border-border"
                  >
                    <span className="text-text-tertiary mr-1.5">{key}:</span>
                    <span className="font-semibold text-text-primary">{value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ROI & Confidence */}
          <div className="py-4 border-t border-border flex flex-wrap gap-4 text-sm">
            {rec.roiEstimado && (
              <div className="flex items-center gap-1.5 font-medium" style={{ color: COLORS.teal }}>
                <Target className="w-4 h-4" />
                ROI Estimado: {rec.roiEstimado}%
              </div>
            )}
            <div className="flex items-center gap-1.5 text-text-secondary">
              <BarChart3 className="w-4 h-4" />
              Confianca: {Math.round(rec.confianca * 100)}%
            </div>
          </div>

          {/* Actions */}
          {rec.status === 'pending' && (
            <div className="pt-4 border-t border-border flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(rec.id, 'accept');
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                style={{ backgroundColor: COLORS.teal }}
              >
                <CheckCircle className="w-4 h-4" />
                Aceitar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(rec.id, 'reject');
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-text-secondary bg-surface border border-border rounded-xl hover:bg-surface-hover transition-all duration-200"
              >
                <XCircle className="w-4 h-4" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Page Component
export default function AcoesPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<RetailRecommendation[]>([]);
  const [summary, setSummary] = useState<RecommendationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/varejo/recomendacoes?limit=100');
        const json = await res.json();

        if (!json.success) throw new Error(json.error);

        setRecommendations(json.data?.recomendacoes || []);
        setSummary(json.data?.resumoGeral || null);
      } catch (err: any) {
        console.error('[Acoes] Erro:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetch(`/api/varejo/recomendacoes?limit=100&_t=${Date.now()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setRecommendations(json.data?.recomendacoes || []);
          setSummary(json.data?.resumoGeral || null);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleAction = async (id: string, action: 'accept' | 'reject') => {
    try {
      await fetch('/api/varejo/recomendacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: action === 'accept' ? 'accepted' : 'rejected',
        }),
      });

      // Update local state
      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' } : r
        )
      );
    } catch (err) {
      console.error('Erro ao atualizar:', err);
    }
  };

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      if (categoriaFilter !== 'all' && r.categoria !== categoriaFilter) return false;
      if (prioridadeFilter !== 'all' && r.prioridade !== prioridadeFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          r.titulo.toLowerCase().includes(search) ||
          r.descricao.toLowerCase().includes(search) ||
          r.lojaNome?.toLowerCase().includes(search) ||
          r.produtoNome?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [recommendations, categoriaFilter, prioridadeFilter, searchTerm]);

  // Stats for filtered
  const pendingCount = filteredRecs.filter((r) => r.status === 'pending').length;
  const acceptedCount = filteredRecs.filter((r) => r.status === 'accepted').length;
  const criticaCount = filteredRecs.filter((r) => r.prioridade === 'critica' && r.status === 'pending').length;

  // Charts data
  const categoriaChartData = Object.entries(summary?.porCategoria || {})
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: CATEGORY_CONFIG[key as keyof typeof CATEGORY_CONFIG]?.label || key,
      value,
      color: CATEGORY_CONFIG[key as keyof typeof CATEGORY_CONFIG]?.color || '#6B7280',
    }));

  const prioridadeChartData = Object.entries(summary?.porPrioridade || {})
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG]?.label || key,
      value,
      color: PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG]?.color || '#6B7280',
    }));

  if (loading && recommendations.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Motor de Recomendacoes</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface rounded-xl p-6 border border-border animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/inteligencia/executivo')}
            className="p-2 hover:bg-surface-hover rounded-xl transition-all duration-200 border border-transparent hover:border-border"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Motor de Recomendacoes</h1>
            <p className="text-text-secondary mt-1">Acoes inteligentes baseadas em analise de dados</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
          style={{ backgroundColor: COLORS.primary }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Recomendações Pendentes"
          value={pendingCount}
          icon={Clock}
          color="warning"
          description={`${criticaCount} críticas`}
        />
        <KPICard
          title="Economia Potencial"
          value={formatCurrency(summary?.economiaTotal || 0)}
          icon={DollarSign}
          color="success"
          description="Se todas aceitas"
        />
        <KPICard
          title="Ações Críticas"
          value={criticaCount}
          icon={Zap}
          color="accent"
          description="Requerem ação imediata"
        />
        <KPICard
          title="Aceitas"
          value={acceptedCount}
          icon={CheckCircle}
          color="primary"
          description="Neste período"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Categoria */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Por Categoria</h3>
            <span className="text-xs text-text-tertiary">{summary?.total || 0} total</span>
          </div>
        }>
          <div className="h-[220px]">
            {categoriaChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriaChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoriaChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-surface p-3 rounded-xl shadow-lg border border-border text-sm">
                          <p className="font-semibold text-text-primary">{d.name}</p>
                          <p className="text-text-secondary mt-1">
                            <span className="font-bold" style={{ color: d.color }}>{d.value}</span> recomendacoes
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <Lightbulb className="w-10 h-10 opacity-40" />
                <span>Sem dados</span>
              </div>
            )}
          </div>
          {/* Legenda customizada */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {categoriaChartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm px-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-text-secondary">{item.name}</span>
                </div>
                <span className="font-semibold text-text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Por Prioridade */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Por Prioridade</h3>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Info className="w-3.5 h-3.5" />
              <span>Distribuicao</span>
            </div>
          </div>
        }>
          <div className="h-[280px]">
            {prioridadeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prioridadeChartData} layout="vertical" margin={{ left: 70, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal stroke="#E5E7EB" vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={65}
                    tick={{ fontSize: 12, fill: '#374151' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-surface p-3 rounded-xl shadow-lg border border-border text-sm">
                          <p className="font-semibold" style={{ color: d.color }}>{d.name}</p>
                          <p className="text-text-secondary mt-1">
                            <span className="font-bold">{d.value}</span> recomendacoes
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={32}>
                    {prioridadeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <BarChart3 className="w-10 h-10 opacity-40" />
                <span>Sem dados</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
          <Filter className="w-4 h-4" />
          Filtros:
        </div>

        {/* Categoria */}
        <select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-colors"
        >
          <option value="all">Todas categorias</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>

        {/* Prioridade */}
        <select
          value={prioridadeFilter}
          onChange={(e) => setPrioridadeFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-colors"
        >
          <option value="all">Todas prioridades</option>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-colors"
          />
        </div>

        <span className="text-sm text-text-tertiary font-medium">
          {filteredRecs.length} de {recommendations.length}
        </span>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecs.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <Lightbulb className="w-12 h-12 text-text-tertiary opacity-40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary">Nenhuma recomendacao encontrada</h3>
            <p className="text-text-secondary mt-2">Tente ajustar os filtros ou aguarde a analise dos dados</p>
          </div>
        ) : (
          filteredRecs.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} onAction={handleAction} />
          ))
        )}
      </div>

      {/* Top Lojas */}
      {summary?.topLojas && summary.topLojas.length > 0 && (
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Lojas com Mais Recomendacoes</h3>
            <span className="text-sm text-text-tertiary">{summary.topLojas.length} lojas</span>
          </div>
        }>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Loja</th>
                  <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Recomendacoes</th>
                  <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Impacto Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.topLojas.map((loja, i) => (
                  <tr key={loja.lojaId} className="hover:bg-surface-hover transition-colors duration-150">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: i === 0 ? COLORS.error : i === 1 ? COLORS.warning : COLORS.primaryLight }}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium text-text-primary">{loja.lojaNome}</span>
                      </div>
                    </td>
                    <td className="text-center py-4 px-4">
                      <span
                        className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: COLORS.primary }}
                      >
                        {loja.qtdRecomendacoes}
                      </span>
                    </td>
                    <td className="text-right py-4 px-4">
                      <span className="font-bold" style={{ color: COLORS.error }}>
                        {formatCurrency(loja.impactoTotal)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
