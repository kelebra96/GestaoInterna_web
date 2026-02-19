'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Calendar,
  ArrowLeft,
  Clock,
  Filter,
  Info,
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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

interface MetricasLoja {
  id: string;
  lojaId: string;
  lojaNome?: string;
  lojaCodigo?: string;
  estoque: {
    valorTotal: number;
    quantidadeSkus: number;
    giro: number;
    coberturaDias: number;
    capitalParado: number;
    capitalParadoPct: number;
    estoqueMortoValor: number;
    estoqueMortoQtd: number;
    skusRuptura: number;
  };
}

interface SummaryData {
  totalValorEstoque: number;
  totalCapitalParado: number;
  totalEstoqueMorto: number;
  giroMedio: number;
  coberturaDiasMedia: number;
  totalSkusRuptura: number;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
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

// Paleta de cores para Giro de Estoque
const GIRO_COLORS = {
  alto: COLORS.teal,        // Teal - Excelente
  medio: COLORS.primary,    // Primary Blue - Bom
  baixo: COLORS.warning,    // Warning - Atenção
  critico: COLORS.error,    // Error - Crítico
};

function getGiroColor(giro: number): string {
  if (giro >= 4) return GIRO_COLORS.alto;
  if (giro >= 2) return GIRO_COLORS.medio;
  if (giro >= 1) return GIRO_COLORS.baixo;
  return GIRO_COLORS.critico;
}

function getGiroLabel(giro: number): string {
  if (giro >= 4) return 'Excelente';
  if (giro >= 2) return 'Bom';
  if (giro >= 1) return 'Atenção';
  return 'Crítico';
}

export default function EstoquePage() {
  const router = useRouter();
  const [lojas, setLojas] = useState<MetricasLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<'giro' | 'capital_parado' | 'estoque_morto'>('capital_parado');
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const fieldMap: Record<string, string> = {
    giro: 'giro_estoque',
    capital_parado: 'capital_parado',
    estoque_morto: 'estoque_morto_valor',
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/varejo/metricas-loja?periodo=${periodo}&orderBy=${fieldMap[orderBy]}&order=desc&limit=20`;
        console.log('[Estoque] Fetching:', url);

        const res = await fetch(url);
        const json = await res.json();

        console.log('[Estoque] Response:', { success: json.success, query: json.query, count: json.data?.length });

        if (!json.success) throw new Error(json.error);

        setLojas(json.data || []);
      } catch (err: any) {
        console.error('[Estoque] Erro:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [periodo, orderBy]);

  const handleRefresh = () => {
    // Force re-fetch by toggling a dummy state or using key
    setLoading(true);
    const url = `/api/varejo/metricas-loja?periodo=${periodo}&orderBy=${fieldMap[orderBy]}&order=desc&limit=20&_t=${Date.now()}`;
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (json.success) setLojas(json.data || []);
      })
      .finally(() => setLoading(false));
  };

  const summary: SummaryData = lojas.reduce(
    (acc, loja) => ({
      totalValorEstoque: acc.totalValorEstoque + loja.estoque.valorTotal,
      totalCapitalParado: acc.totalCapitalParado + loja.estoque.capitalParado,
      totalEstoqueMorto: acc.totalEstoqueMorto + loja.estoque.estoqueMortoValor,
      giroMedio: acc.giroMedio + loja.estoque.giro,
      coberturaDiasMedia: acc.coberturaDiasMedia + loja.estoque.coberturaDias,
      totalSkusRuptura: acc.totalSkusRuptura + loja.estoque.skusRuptura,
    }),
    {
      totalValorEstoque: 0,
      totalCapitalParado: 0,
      totalEstoqueMorto: 0,
      giroMedio: 0,
      coberturaDiasMedia: 0,
      totalSkusRuptura: 0,
    }
  );

  if (lojas.length > 0) {
    summary.giroMedio /= lojas.length;
    summary.coberturaDiasMedia /= lojas.length;
  }

  const capitalParadoData = lojas
    .map((l) => ({
      name: l.lojaNome || l.lojaCodigo || l.lojaId.slice(0, 8),
      capitalParado: l.estoque.capitalParado,
      pct: l.estoque.capitalParadoPct,
    }))
    .slice(0, 10);

  const giroData = lojas.map((l) => ({
    name: l.lojaNome || l.lojaCodigo || l.lojaId.slice(0, 8),
    giro: l.estoque.giro,
    cobertura: l.estoque.coberturaDias,
    valor: l.estoque.valorTotal,
    color: getGiroColor(l.estoque.giro),
  }));

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
            <h1 className="text-2xl font-bold text-text-primary">Analise de Estoque</h1>
            <p className="text-text-secondary mt-1">Giro, cobertura e capital parado</p>
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
          title="Valor em Estoque"
          value={formatCurrency(summary.totalValorEstoque)}
          icon={Package}
          color="primary"
          description="Total da rede"
        />
        <KPICard
          title="Capital Parado"
          value={formatCurrency(summary.totalCapitalParado)}
          icon={Clock}
          color="warning"
          description="Estoque > 60 dias"
        />
        <KPICard
          title="Estoque Morto"
          value={formatCurrency(summary.totalEstoqueMorto)}
          icon={AlertTriangle}
          color="accent"
          description="Sem venda > 90 dias"
        />
        <KPICard
          title="Giro Médio"
          value={summary.giroMedio.toFixed(2)}
          valueSuffix="x"
          icon={TrendingUp}
          color="success"
          description={`Cobertura: ${summary.coberturaDiasMedia.toFixed(0)} dias`}
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
          <Filter className="w-4 h-4" />
          Ordenar por:
        </div>
        <div className="flex gap-2">
          {[
            { key: 'capital_parado', label: 'Capital Parado' },
            { key: 'giro', label: 'Giro' },
            { key: 'estoque_morto', label: 'Estoque Morto' },
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital Parado por Loja */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Capital Parado por Loja</h3>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Info className="w-3.5 h-3.5" />
              <span>Top 10 lojas</span>
            </div>
          </div>
        }>
          <div className="h-[320px]">
            {capitalParadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capitalParadoData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <defs>
                    <linearGradient id="capitalParadoGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={COLORS.warning} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={COLORS.warningDark} stopOpacity={1} />
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
                    formatter={(value: any) => [
                      formatCurrency(Number(value)),
                      'Capital Parado',
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey="capitalParado"
                    fill="url(#capitalParadoGradient)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <Package className="w-10 h-10 opacity-40" />
                <span>Sem dados disponíveis</span>
              </div>
            )}
          </div>
        </Card>

        {/* Giro vs Cobertura Scatter */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Giro vs Cobertura por Loja</h3>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Info className="w-3.5 h-3.5" />
              <span>Tamanho = Valor</span>
            </div>
          </div>
        }>
          <div className="h-[280px]">
            {giroData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    type="number"
                    dataKey="cobertura"
                    name="Cobertura"
                    unit=" dias"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    label={{ value: 'Cobertura (dias)', position: 'bottom', offset: 0, fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="giro"
                    name="Giro"
                    unit="x"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    label={{ value: 'Giro', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <ZAxis type="number" dataKey="valor" range={[60, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: COLORS.primary }}
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-surface p-4 rounded-xl shadow-lg border border-border text-sm">
                          <p className="font-semibold text-text-primary mb-2">{d.name}</p>
                          <div className="space-y-1 text-text-secondary">
                            <p className="flex justify-between gap-4">
                              <span>Giro:</span>
                              <span className="font-medium" style={{ color: d.color }}>{d.giro.toFixed(2)}x</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span>Cobertura:</span>
                              <span className="font-medium">{d.cobertura.toFixed(0)} dias</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span>Valor:</span>
                              <span className="font-medium">{formatCurrency(d.valor)}</span>
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
                              {getGiroLabel(d.giro)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Lojas" data={giroData}>
                    {giroData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        fillOpacity={0.85}
                        stroke={entry.color}
                        strokeWidth={2}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <TrendingUp className="w-10 h-10 opacity-40" />
                <span>Sem dados disponíveis</span>
              </div>
            )}
          </div>
          {/* Legenda melhorada */}
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border">
            {[
              { key: 'alto', label: 'Excelente', sublabel: '≥4x' },
              { key: 'medio', label: 'Bom', sublabel: '2-4x' },
              { key: 'baixo', label: 'Atenção', sublabel: '1-2x' },
              { key: 'critico', label: 'Crítico', sublabel: '<1x' },
            ].map(({ key, label, sublabel }) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: GIRO_COLORS[key as keyof typeof GIRO_COLORS] }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-text-primary">{label}</span>
                  <span className="text-[10px] text-text-tertiary">{sublabel}</span>
                </div>
              </div>
            ))}
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
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Valor Estoque</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Giro</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Cobertura</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Capital Parado</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">% Parado</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Est. Morto</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">SKUs Ruptura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lojas.map((loja, index) => (
                <tr
                  key={loja.id}
                  className="hover:bg-surface-hover transition-colors duration-150"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: getGiroColor(loja.estoque.giro) }}
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
                  <td className="text-right py-4 px-4 font-medium text-text-primary">
                    {formatCurrency(loja.estoque.valorTotal)}
                  </td>
                  <td className="text-center py-4 px-4">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: `${getGiroColor(loja.estoque.giro)}15`,
                        color: getGiroColor(loja.estoque.giro),
                      }}
                    >
                      {loja.estoque.giro.toFixed(2)}x
                    </span>
                  </td>
                  <td className="text-right py-4 px-4 text-text-secondary">
                    {loja.estoque.coberturaDias.toFixed(0)} dias
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-semibold" style={{ color: COLORS.warning }}>
                      {formatCurrency(loja.estoque.capitalParado)}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(loja.estoque.capitalParadoPct, 100)}%`,
                            backgroundColor: loja.estoque.capitalParadoPct > 30 ? COLORS.error : COLORS.warning,
                          }}
                        />
                      </div>
                      <span className="text-text-secondary text-xs w-10 text-right">
                        {loja.estoque.capitalParadoPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span style={{ color: COLORS.error }} className="font-medium">
                      {formatCurrency(loja.estoque.estoqueMortoValor)}
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    {loja.estoque.skusRuptura > 0 ? (
                      <span
                        className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: COLORS.error }}
                      >
                        {loja.estoque.skusRuptura}
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
              <Package className="w-12 h-12 opacity-40 mb-3" />
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
