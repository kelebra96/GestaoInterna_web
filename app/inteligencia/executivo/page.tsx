'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Package,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  Calendar,
  ChevronRight,
  Building2,
  Target,
  Percent,
  Lightbulb,
  Sparkles,
  Database,
  CheckCircle2,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import Card from '@/components/ui/Card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

interface DashboardData {
  periodo: string;
  tipoPeriodo: string;
  kpis: {
    faturamentoTotal: number;
    margemBrutaMedia: number;
    perdaValorTotal: number;
    perdaSobreFaturamentoPct: number;
    vendasPerdidasTotal: number;
    taxaDisponibilidadeMedia: number;
    rfeTotal: number;
  };
  composicaoPerdas: {
    vencimento: number;
    avaria: number;
    roubo: number;
    outros: number;
  };
  estoque: {
    valorTotal: number;
    giroMedio: number;
    capitalParado: number;
    estoqueMorto: number;
  };
  distribuicaoRisco: {
    critico: number;
    alto: number;
    medio: number;
    baixo: number;
    totalLojas: number;
  };
  percentis: {
    perdaP50: number;
    perdaP90: number;
    rfeP50: number;
    rfeP90: number;
  };
  calculadoEm: string;
}

// Paleta de cores consistente com a identidade visual
const RISK_COLORS = {
  critico: '#DC2626',      // Vermelho escuro
  alto: '#F97316',         // Laranja
  medio: '#FBBF24',        // Amarelo
  baixo: '#10B981',        // Verde esmeralda
};

const LOSS_COLORS = [
  '#16476A',  // Vencimento - Azul escuro (cor principal)
  '#3B9797',  // Avaria - Teal
  '#7C3AED',  // Roubo - Roxo
  '#9CA3AF',  // Outros - Cinza
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function DashboardExecutivoPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationMessage, setConsolidationMessage] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/varejo/dashboard-executivo?periodo=${periodo}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Erro ao carregar dados');
      }

      setData(json.data);
    } catch (err: any) {
      console.error('Erro ao carregar dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const consolidarDados = async () => {
    setConsolidating(true);
    setConsolidationMessage(null);

    try {
      // 1. Consolidar métricas da rede
      const resRede = await fetch('/api/varejo/consolidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'rede',
          periodo,
          tipoPeriodo: 'mensal',
        }),
      });
      const jsonRede = await resRede.json();

      if (!jsonRede.success) {
        const errorMsg = jsonRede.error || jsonRede.details || 'Erro ao consolidar rede';
        setConsolidationMessage(`Erro: ${errorMsg}`);
        return;
      }

      // 2. Atualizar views materializadas
      const resViews = await fetch('/api/varejo/consolidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'views' }),
      });
      const jsonViews = await resViews.json();

      if (!jsonViews.success) {
        console.warn('Aviso: Não foi possível atualizar views materializadas');
      }

      setConsolidationMessage('Dados consolidados com sucesso!');

      // Recarregar dashboard
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao consolidar:', err);
      setConsolidationMessage(`Erro: ${err.message}`);
    } finally {
      setConsolidating(false);
      setTimeout(() => setConsolidationMessage(null), 5000);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodo]);

  const composicaoPerdas = data
    ? [
        { name: 'Vencimento', value: data.composicaoPerdas.vencimento, color: LOSS_COLORS[0] },
        { name: 'Avaria', value: data.composicaoPerdas.avaria, color: LOSS_COLORS[1] },
        { name: 'Roubo', value: data.composicaoPerdas.roubo, color: LOSS_COLORS[2] },
        { name: 'Outros', value: data.composicaoPerdas.outros, color: LOSS_COLORS[3] },
      ].filter(d => d.value > 0)
    : [];

  const distribuicaoRisco = data
    ? [
        { name: 'Crítico', value: data.distribuicaoRisco.critico, color: RISK_COLORS.critico },
        { name: 'Alto', value: data.distribuicaoRisco.alto, color: RISK_COLORS.alto },
        { name: 'Médio', value: data.distribuicaoRisco.medio, color: RISK_COLORS.medio },
        { name: 'Baixo', value: data.distribuicaoRisco.baixo, color: RISK_COLORS.baixo },
      ]
    : [];

  // Verificar se os dados estão zerados (precisa consolidação)
  const needsConsolidation = data && (
    data.kpis.faturamentoTotal === 0 &&
    data.kpis.perdaValorTotal === 0 &&
    data.distribuicaoRisco.totalLojas === 0
  );

  if (loading && !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Executivo</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erro ao carregar dados</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-gray-500 mt-1">
            Visão consolidada da performance da rede
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={periodo.slice(0, 7)}
              onChange={(e) => setPeriodo(`${e.target.value}-01`)}
              className="border-0 focus:ring-0 text-sm"
            />
          </div>
          <button
            onClick={consolidarDados}
            disabled={consolidating}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            title="Consolidar métricas a partir dos dados importados"
          >
            <Database className={`w-4 h-4 ${consolidating ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{consolidating ? 'Consolidando...' : 'Consolidar'}</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Consolidation Status Message */}
      {consolidationMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          consolidationMessage.startsWith('Erro')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <CheckCircle2 className="w-5 h-5" />
          {consolidationMessage}
        </div>
      )}

      {/* Alert: Needs Consolidation */}
      {needsConsolidation && !consolidationMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Database className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Dados não consolidados</h3>
              <p className="text-amber-700 text-sm mt-1">
                Os dados importados precisam ser consolidados para aparecer no dashboard.
                Clique no botão <strong>"Consolidar"</strong> acima para processar as métricas.
              </p>
            </div>
            <button
              onClick={consolidarDados}
              disabled={consolidating}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Database className={`w-4 h-4 ${consolidating ? 'animate-pulse' : ''}`} />
              {consolidating ? 'Processando...' : 'Consolidar Agora'}
            </button>
          </div>
        </div>
      )}

      {/* KPIs Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Faturamento"
          value={formatCurrency(data?.kpis.faturamentoTotal || 0)}
          icon={DollarSign}
          color="primary"
          description="Total no período"
        />
        <KPICard
          title="Margem Bruta"
          value={formatPercent(data?.kpis.margemBrutaMedia || 0)}
          icon={Percent}
          color="success"
          description="Média da rede"
        />
        <KPICard
          title="Perdas"
          value={formatCurrency(data?.kpis.perdaValorTotal || 0)}
          icon={TrendingDown}
          color="accent"
          description={`${formatPercent(data?.kpis.perdaSobreFaturamentoPct || 0)} do faturamento`}
        />
        <KPICard
          title="RFE Total"
          value={formatCurrency(data?.kpis.rfeTotal || 0)}
          icon={AlertTriangle}
          color="warning"
          description="Risk Financial Exposure"
        />
      </div>

      {/* KPIs Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Valor em Estoque"
          value={formatCurrency(data?.estoque.valorTotal || 0)}
          icon={Package}
          color="secondary"
          description={`Giro: ${(data?.estoque.giroMedio || 0).toFixed(2)}x`}
        />
        <KPICard
          title="Capital Parado"
          value={formatCurrency(data?.estoque.capitalParado || 0)}
          icon={Package}
          color="warning"
          description="Estoque > 60 dias"
        />
        <KPICard
          title="Vendas Perdidas"
          value={formatCurrency(data?.kpis.vendasPerdidasTotal || 0)}
          icon={ShoppingCart}
          color="accent"
          description="Por ruptura de estoque"
        />
        <KPICard
          title="Disponibilidade"
          value={formatPercent((data?.kpis.taxaDisponibilidadeMedia || 0) * 100)}
          icon={Target}
          color="success"
          description="Taxa média da rede"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composição de Perdas */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Composição de Perdas</h3>
              <button
                onClick={() => router.push('/inteligencia/perdas')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver detalhes <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="h-[280px]">
            {composicaoPerdas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={composicaoPerdas}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {composicaoPerdas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Sem dados de perdas
              </div>
            )}
          </div>
        </Card>

        {/* Distribuição de Risco */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Distribuição de Risco (RFE)</h3>
              <button
                onClick={() => router.push('/inteligencia/rfe')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver ranking <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribuicaoRisco} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12 }}
                  width={50}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} lojas`, 'Quantidade']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {distribuicaoRisco.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Building2 className="w-4 h-4" />
            <span>Total: {data?.distribuicaoRisco.totalLojas || 0} lojas ativas</span>
          </div>
        </Card>
      </div>

      {/* AI Insights Banner */}
      <button
        onClick={() => router.push('/inteligencia/narrativa')}
        className="w-full rounded-xl p-5 text-white transition-all shadow-lg hover:shadow-xl group"
        style={{
          background: 'linear-gradient(135deg, #16476A 0%, #3B9797 100%)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Análise Narrativa IA
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">GPT-4</span>
            </h3>
            <p className="text-sm text-white/80 mt-1">
              Insights automáticos, tendências e recomendações geradas por inteligência artificial
            </p>
          </div>
          <ChevronRight className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </button>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Análise de Estoque', desc: 'Giro, cobertura e capital parado', href: '/inteligencia/estoque', icon: Package },
          { title: 'Pareto de Perdas', desc: 'Top produtos com maior perda', href: '/inteligencia/perdas', icon: TrendingDown },
          { title: 'Análise de Rupturas', desc: 'Vendas perdidas por indisponibilidade', href: '/inteligencia/rupturas', icon: ShoppingCart },
          { title: 'Ranking RFE', desc: 'Lojas por exposição financeira', href: '/inteligencia/rfe', icon: BarChart3 },
          { title: 'Motor de Ações', desc: 'Recomendações inteligentes', href: '/inteligencia/acoes', icon: Lightbulb },
        ].map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <link.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {link.title}
                </h4>
                <p className="text-sm text-gray-500 mt-0.5">{link.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </button>
        ))}
      </div>

      {/* Footer Info */}
      {data?.calculadoEm && (
        <div className="text-center text-sm text-gray-400">
          Última atualização: {new Date(data.calculadoEm).toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}
