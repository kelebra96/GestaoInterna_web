'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  TrendingDown,
  Target,
  Store,
  Filter,
  Info,
  Calendar,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import Card from '@/components/ui/Card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface MetricasLoja {
  id: string;
  lojaId: string;
  lojaNome?: string;
  lojaCodigo?: string;
  rupturas: {
    vendasPerdidas: number;
    quantidadePerdida: number;
    vendaPotencial: number;
    taxaDisponibilidade: number;
    produtosRecorrentes: number;
    impactoMargem: number;
  };
  vendas: {
    faturamentoTotal: number;
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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

// Paleta de cores para Taxa de Disponibilidade
const DISP_COLORS = {
  excelente: COLORS.teal,       // Teal - Excelente
  bom: COLORS.primary,          // Primary Blue - Bom
  alerta: COLORS.warning,       // Warning - Alerta
  critico: COLORS.error,        // Error - Crítico
};

function getDispColor(taxa: number): string {
  if (taxa >= 0.98) return DISP_COLORS.excelente;
  if (taxa >= 0.95) return DISP_COLORS.bom;
  if (taxa >= 0.90) return DISP_COLORS.alerta;
  return DISP_COLORS.critico;
}

function getDispLabel(taxa: number): string {
  if (taxa >= 0.98) return 'Excelente';
  if (taxa >= 0.95) return 'Bom';
  if (taxa >= 0.90) return 'Alerta';
  return 'Crítico';
}

export default function RupturasPage() {
  const router = useRouter();
  const [lojas, setLojas] = useState<MetricasLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<'vendas_perdidas' | 'taxa_disp' | 'recorrentes'>('vendas_perdidas');
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const fieldMap: Record<string, string> = {
    vendas_perdidas: 'vendas_perdidas_valor',
    taxa_disp: 'taxa_disponibilidade',
    recorrentes: 'ruptura_recorrente_qtd',
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/varejo/metricas-loja?periodo=${periodo}&orderBy=${fieldMap[orderBy]}&order=${orderBy === 'taxa_disp' ? 'asc' : 'desc'}&limit=20`;
        const res = await fetch(url);
        const json = await res.json();

        if (!json.success) throw new Error(json.error);

        setLojas(json.data || []);
      } catch (err: any) {
        console.error('[Rupturas] Erro:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [periodo, orderBy]);

  const handleRefresh = () => {
    setLoading(true);
    const url = `/api/varejo/metricas-loja?periodo=${periodo}&orderBy=${fieldMap[orderBy]}&order=${orderBy === 'taxa_disp' ? 'asc' : 'desc'}&limit=20&_t=${Date.now()}`;
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (json.success) setLojas(json.data || []);
      })
      .finally(() => setLoading(false));
  };

  const summary = lojas.reduce(
    (acc, loja) => ({
      totalVendasPerdidas: acc.totalVendasPerdidas + loja.rupturas.vendasPerdidas,
      totalImpactoMargem: acc.totalImpactoMargem + loja.rupturas.impactoMargem,
      totalProdutosRecorrentes: acc.totalProdutosRecorrentes + loja.rupturas.produtosRecorrentes,
      taxaDisponibilidadeMedia: acc.taxaDisponibilidadeMedia + loja.rupturas.taxaDisponibilidade,
      vendaPotencialTotal: acc.vendaPotencialTotal + loja.rupturas.vendaPotencial,
    }),
    {
      totalVendasPerdidas: 0,
      totalImpactoMargem: 0,
      totalProdutosRecorrentes: 0,
      taxaDisponibilidadeMedia: 0,
      vendaPotencialTotal: 0,
    }
  );

  if (lojas.length > 0) {
    summary.taxaDisponibilidadeMedia /= lojas.length;
  }

  const vendasPerdidasData = lojas
    .filter((l) => l.rupturas.vendasPerdidas > 0)
    .map((l) => ({
      name: l.lojaNome || l.lojaCodigo || l.lojaId.slice(0, 8),
      vendasPerdidas: l.rupturas.vendasPerdidas,
      taxaDisp: l.rupturas.taxaDisponibilidade,
      color: getDispColor(l.rupturas.taxaDisponibilidade),
    }))
    .slice(0, 10);

  const disponibilidadeDistribuicao = [
    {
      name: 'Excelente (>98%)',
      value: lojas.filter((l) => l.rupturas.taxaDisponibilidade >= 0.98).length,
      color: DISP_COLORS.excelente,
    },
    {
      name: 'Bom (95-98%)',
      value: lojas.filter((l) => l.rupturas.taxaDisponibilidade >= 0.95 && l.rupturas.taxaDisponibilidade < 0.98).length,
      color: DISP_COLORS.bom,
    },
    {
      name: 'Alerta (90-95%)',
      value: lojas.filter((l) => l.rupturas.taxaDisponibilidade >= 0.90 && l.rupturas.taxaDisponibilidade < 0.95).length,
      color: DISP_COLORS.alerta,
    },
    {
      name: 'Crítico (<90%)',
      value: lojas.filter((l) => l.rupturas.taxaDisponibilidade < 0.90).length,
      color: DISP_COLORS.critico,
    },
  ].filter((d) => d.value > 0);

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
            <h1 className="text-2xl font-bold text-text-primary">Analise de Rupturas</h1>
            <p className="text-text-secondary mt-1">Vendas perdidas por indisponibilidade de estoque</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface px-4 py-2.5 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <input
              type="month"
              value={periodo.slice(0, 7)}
              onChange={(e) => setPeriodo(`${e.target.value}-01`)}
              className="border-0 focus:ring-0 text-sm bg-transparent text-text-primary"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 text-white rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: COLORS.primary }}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Vendas Perdidas"
          value={formatCurrency(summary.totalVendasPerdidas)}
          icon={ShoppingCart}
          color="accent"
          description="Por ruptura de estoque"
        />
        <KPICard
          title="Impacto na Margem"
          value={formatCurrency(summary.totalImpactoMargem)}
          icon={TrendingDown}
          color="warning"
          description="Margem não realizada"
        />
        <KPICard
          title="Taxa Disponibilidade"
          value={formatPercent(summary.taxaDisponibilidadeMedia)}
          icon={Target}
          color={summary.taxaDisponibilidadeMedia >= 0.95 ? 'success' : 'warning'}
          description="Média da rede"
        />
        <KPICard
          title="Produtos Recorrentes"
          value={`${summary.totalProdutosRecorrentes}`}
          icon={AlertTriangle}
          color="accent"
          description="Com ruptura frequente"
        />
      </div>

      {/* Alert Banner */}
      {summary.taxaDisponibilidadeMedia < 0.95 && (
        <div
          className="rounded-xl p-4 flex items-start gap-3 border shadow-sm"
          style={{
            backgroundColor: `${COLORS.warning}10`,
            borderColor: `${COLORS.warning}30`,
          }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.warning }} />
          <div>
            <h4 className="font-semibold" style={{ color: COLORS.warningDark }}>
              Atencao: Taxa de disponibilidade abaixo da meta
            </h4>
            <p className="text-sm mt-1" style={{ color: COLORS.warningDark }}>
              A rede esta operando com {formatPercent(summary.taxaDisponibilidadeMedia)} de disponibilidade.
              Meta recomendada: 95%. Isso representa{' '}
              <span className="font-semibold">{formatCurrency(summary.totalVendasPerdidas)}</span> em vendas perdidas.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
          <Filter className="w-4 h-4" />
          Ordenar por:
        </div>
        <div className="flex gap-2">
          {[
            { key: 'vendas_perdidas', label: 'Vendas Perdidas' },
            { key: 'taxa_disp', label: 'Menor Disponibilidade' },
            { key: 'recorrentes', label: 'Produtos Recorrentes' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setOrderBy(opt.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                orderBy === opt.key
                  ? 'text-white shadow-md'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover border border-border hover:border-primary-300'
              }`}
              style={orderBy === opt.key ? { backgroundColor: COLORS.primary } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendas Perdidas por Loja */}
        <div className="lg:col-span-2">
          <Card header={
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Vendas Perdidas por Loja</h3>
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Info className="w-3.5 h-3.5" />
                <span>Top 10 lojas</span>
              </div>
            </div>
          }>
            <div className="h-[320px]">
              {vendasPerdidasData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendasPerdidasData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <defs>
                      <linearGradient id="vendasPerdidasGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={COLORS.error} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={COLORS.error} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      tickFormatter={(v) => formatCurrency(v)}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11, fill: '#374151' }}
                      width={75}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-surface p-4 rounded-xl shadow-lg border border-border text-sm">
                            <p className="font-semibold text-text-primary mb-2">{d.name}</p>
                            <div className="space-y-1 text-text-secondary">
                              <p className="flex justify-between gap-4">
                                <span>Vendas Perdidas:</span>
                                <span className="font-semibold" style={{ color: COLORS.error }}>
                                  {formatCurrency(d.vendasPerdidas)}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span>Taxa Disp:</span>
                                <span className="font-medium" style={{ color: d.color }}>
                                  {formatPercent(d.taxaDisp)}
                                </span>
                              </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border">
                              <span
                                className="text-xs font-medium px-2 py-1 rounded-md"
                                style={{
                                  backgroundColor: `${d.color}15`,
                                  color: d.color
                                }}
                              >
                                {getDispLabel(d.taxaDisp)}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="vendasPerdidas" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {vendasPerdidasData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                  <ShoppingCart className="w-10 h-10 opacity-40" />
                  <span>Sem dados de rupturas</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Distribuição de Disponibilidade */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Disponibilidade</h3>
            <span className="text-xs text-text-tertiary">{lojas.length} lojas</span>
          </div>
        }>
          <div className="h-[240px]">
            {disponibilidadeDistribuicao.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={disponibilidadeDistribuicao}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {disponibilidadeDistribuicao.map((entry, index) => (
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
                            <span className="font-bold" style={{ color: d.color }}>{d.value}</span> lojas
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <Target className="w-10 h-10 opacity-40" />
                <span>Sem dados</span>
              </div>
            )}
          </div>
          {/* Legenda customizada */}
          <div className="space-y-2 mt-2">
            {[
              { key: 'excelente', label: 'Excelente', sublabel: '>98%' },
              { key: 'bom', label: 'Bom', sublabel: '95-98%' },
              { key: 'alerta', label: 'Alerta', sublabel: '90-95%' },
              { key: 'critico', label: 'Crítico', sublabel: '<90%' },
            ].map(({ key, label, sublabel }) => {
              const item = disponibilidadeDistribuicao.find(d => d.name.toLowerCase().includes(key));
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: DISP_COLORS[key as keyof typeof DISP_COLORS] }}
                    />
                    <span className="text-text-primary">{label}</span>
                    <span className="text-text-tertiary text-xs">({sublabel})</span>
                  </div>
                  <span className="font-semibold text-text-primary">{item?.value || 0}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card header={
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Detalhamento por Loja</h3>
          <span className="text-sm text-text-tertiary">{lojas.length} lojas</span>
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Loja</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Venda Potencial</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Vendas Perdidas</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Impacto Margem</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Disponibilidade</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Recorrentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lojas.map((loja) => (
                <tr
                  key={loja.id}
                  className="hover:bg-surface-hover transition-colors duration-150"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: getDispColor(loja.rupturas.taxaDisponibilidade) }}
                      />
                      <div>
                        <div className="font-medium text-text-primary">
                          {loja.lojaNome || loja.lojaCodigo || loja.lojaId.slice(0, 8)}
                        </div>
                        {loja.lojaCodigo && (
                          <div className="text-xs text-text-tertiary">{loja.lojaCodigo}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-4 px-4 text-text-secondary">
                    {formatCurrency(loja.rupturas.vendaPotencial)}
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-semibold" style={{ color: COLORS.error }}>
                      {formatCurrency(loja.rupturas.vendasPerdidas)}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-medium" style={{ color: COLORS.warning }}>
                      {formatCurrency(loja.rupturas.impactoMargem)}
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: `${getDispColor(loja.rupturas.taxaDisponibilidade)}15`,
                        color: getDispColor(loja.rupturas.taxaDisponibilidade),
                      }}
                    >
                      {formatPercent(loja.rupturas.taxaDisponibilidade)}
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    {loja.rupturas.produtosRecorrentes > 0 ? (
                      <span
                        className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: COLORS.warning }}
                      >
                        {loja.rupturas.produtosRecorrentes}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {lojas.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <ShoppingCart className="w-12 h-12 opacity-40 mb-3" />
              <p className="font-medium">Nenhuma loja encontrada</p>
              <p className="text-sm mt-1">Tente ajustar o período ou os filtros</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-text-secondary">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Carregando dados...</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
