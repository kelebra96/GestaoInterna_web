'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  Store,
  Filter,
  Info,
  Calendar,
  X,
  TrendingUp,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface RfeItem {
  lojaId: string;
  lojaNome: string;
  lojaCodigo: string;
  lojaCluster?: string;
  periodo: string;
  rfeScore: number;
  rfeRank: number;
  rfeNivel: 'critico' | 'alto' | 'medio' | 'baixo';
  componentes: {
    perdas: number;
    vendasPerdidas: number;
    capitalParado: number;
  };
  metricas: {
    perdaValorTotal: number;
    perdaSobreFaturamentoPct: number;
    vendasPerdidasValor: number;
    taxaDisponibilidade: number;
    capitalParado: number;
    faturamentoTotal: number;
  };
  principalProblema: 'Perdas' | 'Rupturas' | 'Capital Parado';
  calculadoEm: string;
}

interface RfeSummary {
  totalRfe: number;
  mediaRfe: number;
  distribuicao: {
    critico: number;
    alto: number;
    medio: number;
    baixo: number;
  };
  maiorRisco: RfeItem | null;
  menorRisco: RfeItem | null;
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

// Paleta de cores para níveis de risco RFE
const RISK_COLORS = {
  critico: COLORS.error,      // Error - Crítico
  alto: COLORS.warning,       // Warning - Alto
  medio: COLORS.primaryLight, // Primary Light - Médio
  baixo: COLORS.teal,         // Teal - Baixo
};

// Cores para componentes do RFE
const COMPONENT_COLORS = {
  perdas: COLORS.error,        // Vermelho para perdas
  vendasPerdidas: COLORS.teal, // Teal para vendas perdidas
  capitalParado: COLORS.warning, // Warning para capital parado
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function getNivelLabel(nivel: string): string {
  const labels: Record<string, string> = {
    critico: 'Crítico',
    alto: 'Alto',
    medio: 'Médio',
    baixo: 'Baixo',
  };
  return labels[nivel] || nivel;
}

export default function RfePage() {
  const router = useRouter();
  const [items, setItems] = useState<RfeItem[]>([]);
  const [summary, setSummary] = useState<RfeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nivelFilter, setNivelFilter] = useState<'all' | 'critico' | 'alto' | 'medio' | 'baixo'>('all');
  const [selectedLoja, setSelectedLoja] = useState<RfeItem | null>(null);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let url = `/api/varejo/rfe?periodo=${periodo}&limit=50`;
        if (nivelFilter !== 'all') url += `&nivel=${nivelFilter}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!json.success) throw new Error(json.error);

        setItems(json.data || []);
        setSummary(json.summary || null);
      } catch (err: any) {
        console.error('[RFE] Erro:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [periodo, nivelFilter]);

  const handleRefresh = () => {
    setLoading(true);
    let url = `/api/varejo/rfe?periodo=${periodo}&limit=50&_t=${Date.now()}`;
    if (nivelFilter !== 'all') url += `&nivel=${nivelFilter}`;

    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setItems(json.data || []);
          setSummary(json.summary || null);
        }
      })
      .finally(() => setLoading(false));
  };

  const distribuicaoData = summary
    ? [
        { name: 'Crítico', value: summary.distribuicao.critico, color: RISK_COLORS.critico },
        { name: 'Alto', value: summary.distribuicao.alto, color: RISK_COLORS.alto },
        { name: 'Médio', value: summary.distribuicao.medio, color: RISK_COLORS.medio },
        { name: 'Baixo', value: summary.distribuicao.baixo, color: RISK_COLORS.baixo },
      ].filter((d) => d.value > 0)
    : [];

  const rankingData = items.slice(0, 10).map((item) => ({
    name: item.lojaNome || item.lojaCodigo || item.lojaId.slice(0, 8),
    rfe: item.rfeScore,
    nivel: item.rfeNivel,
    color: RISK_COLORS[item.rfeNivel],
  }));

  const selectedLojaRadar = selectedLoja
    ? [
        { metric: 'Perdas', value: selectedLoja.componentes.perdas, fullMark: selectedLoja.rfeScore },
        { metric: 'Rupturas', value: selectedLoja.componentes.vendasPerdidas, fullMark: selectedLoja.rfeScore },
        { metric: 'Capital Parado', value: selectedLoja.componentes.capitalParado, fullMark: selectedLoja.rfeScore },
      ]
    : [];

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
            <h1 className="text-2xl font-bold text-text-primary">Risk Financial Exposure (RFE)</h1>
            <p className="text-text-secondary mt-1">Exposicao financeira ao risco por loja</p>
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

      {/* Info Banner */}
      <div
        className="rounded-xl p-4 flex items-start gap-3 border shadow-sm"
        style={{
          backgroundColor: `${COLORS.primary}08`,
          borderColor: `${COLORS.primary}20`,
        }}
      >
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.primary }} />
        <div>
          <h4 className="font-semibold" style={{ color: COLORS.primary }}>O que e RFE?</h4>
          <p className="text-sm text-text-secondary mt-1">
            Risk Financial Exposure e a soma do impacto financeiro de:{' '}
            <span className="font-semibold" style={{ color: COMPONENT_COLORS.perdas }}>Perdas</span> (valor perdido) +{' '}
            <span className="font-semibold" style={{ color: COMPONENT_COLORS.vendasPerdidas }}>Rupturas</span> (vendas perdidas) +{' '}
            <span className="font-semibold" style={{ color: COMPONENT_COLORS.capitalParado }}>Capital Parado</span> (custo de oportunidade).
            Quanto maior o RFE, maior a urgencia de acao.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="RFE Total"
          value={formatCurrency(summary?.totalRfe || 0)}
          icon={AlertTriangle}
          color="accent"
          description="Exposição total da rede"
        />
        <KPICard
          title="RFE Médio"
          value={formatCurrency(summary?.mediaRfe || 0)}
          icon={DollarSign}
          color="warning"
          description="Por loja"
        />
        <KPICard
          title="Lojas Críticas"
          value={`${summary?.distribuicao.critico || 0}`}
          icon={AlertTriangle}
          color="accent"
          description="Requerem ação imediata"
        />
        <KPICard
          title="Lojas Baixo Risco"
          value={`${summary?.distribuicao.baixo || 0}`}
          icon={Store}
          color="success"
          description="Operando bem"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
          <Filter className="w-4 h-4" />
          Filtrar por nivel:
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'critico', label: 'Crítico' },
            { key: 'alto', label: 'Alto' },
            { key: 'medio', label: 'Médio' },
            { key: 'baixo', label: 'Baixo' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setNivelFilter(key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                nivelFilter === key
                  ? 'text-white shadow-md'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover border border-border'
              }`}
              style={
                nivelFilter === key
                  ? { backgroundColor: key === 'all' ? COLORS.primary : RISK_COLORS[key as keyof typeof RISK_COLORS] }
                  : {}
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking RFE */}
        <div className="lg:col-span-2">
          <Card header={
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Ranking RFE - Top 10</h3>
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Info className="w-3.5 h-3.5" />
                <span>Clique para detalhes</span>
              </div>
            </div>
          }>
            <div className="h-[380px]">
              {rankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingData} layout="vertical" margin={{ left: 100, right: 20 }}>
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
                      width={95}
                      axisLine={{ stroke: '#E5E7EB' }}
                      onClick={(data) => {
                        const loja = items.find(
                          (i) => (i.lojaNome || i.lojaCodigo || i.lojaId.slice(0, 8)) === data.value
                        );
                        if (loja) setSelectedLoja(loja);
                      }}
                      style={{ cursor: 'pointer' }}
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
                                <span>RFE:</span>
                                <span className="font-bold" style={{ color: d.color }}>
                                  {formatCurrency(d.rfe)}
                                </span>
                              </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border">
                              <span
                                className="text-xs font-semibold px-2 py-1 rounded-md text-white"
                                style={{ backgroundColor: d.color }}
                              >
                                {getNivelLabel(d.nivel)}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="rfe"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={28}
                      onClick={(data) => {
                        const loja = items.find(
                          (i) => (i.lojaNome || i.lojaCodigo || i.lojaId.slice(0, 8)) === data.name
                        );
                        if (loja) setSelectedLoja(loja);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {rankingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                  <AlertTriangle className="w-10 h-10 opacity-40" />
                  <span>Sem dados disponíveis</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Distribuição por Nível */}
        <Card header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Distribuicao</h3>
            <span className="text-xs text-text-tertiary">{items.length} lojas</span>
          </div>
        }>
          <div className="h-[240px]">
            {distribuicaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {distribuicaoData.map((entry, index) => (
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
                <Store className="w-10 h-10 opacity-40" />
                <span>Sem dados</span>
              </div>
            )}
          </div>
          {/* Legenda customizada */}
          <div className="space-y-2 mt-2">
            {[
              { key: 'critico', label: 'Crítico', desc: 'Ação imediata' },
              { key: 'alto', label: 'Alto', desc: 'Prioridade alta' },
              { key: 'medio', label: 'Médio', desc: 'Monitorar' },
              { key: 'baixo', label: 'Baixo', desc: 'Saudável' },
            ].map(({ key, label, desc }) => {
              const count = summary?.distribuicao[key as keyof typeof summary.distribuicao] || 0;
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[key as keyof typeof RISK_COLORS] }}
                    />
                    <span className="text-text-primary font-medium">{label}</span>
                    <span className="text-text-tertiary text-xs">({desc})</span>
                  </div>
                  <span className="font-semibold text-text-primary">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Detail Panel */}
      {selectedLoja && (
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: RISK_COLORS[selectedLoja.rfeNivel] }}
                />
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{selectedLoja.lojaNome}</h3>
                  <span className="text-xs text-text-tertiary">Ranking #{selectedLoja.rfeRank}</span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-md text-white ml-2"
                  style={{ backgroundColor: RISK_COLORS[selectedLoja.rfeNivel] }}
                >
                  {getNivelLabel(selectedLoja.rfeNivel)}
                </span>
              </div>
              <button
                onClick={() => setSelectedLoja(null)}
                className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Composição */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Composicao do RFE
              </h4>
              <div className="space-y-4">
                {[
                  { label: 'Perdas', value: selectedLoja.componentes.perdas, color: COMPONENT_COLORS.perdas },
                  { label: 'Vendas Perdidas', value: selectedLoja.componentes.vendasPerdidas, color: COMPONENT_COLORS.vendasPerdidas },
                  { label: 'Capital Parado', value: selectedLoja.componentes.capitalParado, color: COMPONENT_COLORS.capitalParado },
                ].map((comp) => (
                  <div key={comp.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-text-secondary font-medium">{comp.label}</span>
                      <span className="font-semibold" style={{ color: comp.color }}>
                        {formatCurrency(comp.value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((comp.value / selectedLoja.rfeScore) * 100, 100)}%`,
                          backgroundColor: comp.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-text-primary">RFE Total</span>
                  <span className="text-2xl font-bold" style={{ color: RISK_COLORS[selectedLoja.rfeNivel] }}>
                    {formatCurrency(selectedLoja.rfeScore)}
                  </span>
                </div>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="h-[220px]">
              <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Distribuicao
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={selectedLojaRadar}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <PolarRadiusAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={(v) => formatCurrency(v)} />
                  <Radar
                    name="Composição"
                    dataKey="value"
                    stroke={COLORS.primary}
                    fill={COLORS.teal}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Métricas */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Metricas Detalhadas
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <span className="text-text-secondary">Faturamento</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(selectedLoja.metricas.faturamentoTotal)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <span className="text-text-secondary">% Perda s/ Fat.</span>
                  <span className="font-semibold" style={{ color: COLORS.error }}>
                    {selectedLoja.metricas.perdaSobreFaturamentoPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <span className="text-text-secondary">Taxa Disponibilidade</span>
                  <span className="font-semibold text-text-primary">
                    {(selectedLoja.metricas.taxaDisponibilidade * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-2 px-3 mt-2 rounded-lg border border-border bg-surface-hover">
                  <span className="text-text-secondary font-medium">Principal Problema</span>
                  <span
                    className="font-bold"
                    style={{
                      color: selectedLoja.principalProblema === 'Perdas'
                        ? COMPONENT_COLORS.perdas
                        : selectedLoja.principalProblema === 'Rupturas'
                        ? COMPONENT_COLORS.vendasPerdidas
                        : COMPONENT_COLORS.capitalParado
                    }}
                  >
                    {selectedLoja.principalProblema}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card header={
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Ranking Completo</h3>
          <span className="text-sm text-text-tertiary">{items.length} lojas</span>
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-center py-4 px-2 font-semibold text-text-secondary text-xs uppercase tracking-wider w-12">#</th>
                <th className="text-left py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Loja</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">RFE</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Nivel</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Perdas</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Vendas Perd.</th>
                <th className="text-right py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Capital Par.</th>
                <th className="text-center py-4 px-4 font-semibold text-text-secondary text-xs uppercase tracking-wider">Problema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.lojaId}
                  className={`cursor-pointer transition-colors duration-150 ${
                    selectedLoja?.lojaId === item.lojaId
                      ? 'bg-primary-50'
                      : 'hover:bg-surface-hover'
                  }`}
                  onClick={() => setSelectedLoja(item)}
                >
                  <td className="text-center py-4 px-2 text-text-tertiary font-medium">{item.rfeRank}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: RISK_COLORS[item.rfeNivel] }}
                      />
                      <div>
                        <div className="font-medium text-text-primary">{item.lojaNome}</div>
                        {item.lojaCodigo && <div className="text-xs text-text-tertiary">{item.lojaCodigo}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-bold text-text-primary">{formatCurrency(item.rfeScore)}</span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: RISK_COLORS[item.rfeNivel] }}
                    >
                      {getNivelLabel(item.rfeNivel)}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-medium" style={{ color: COMPONENT_COLORS.perdas }}>
                      {formatCurrency(item.componentes.perdas)}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-medium" style={{ color: COMPONENT_COLORS.vendasPerdidas }}>
                      {formatCurrency(item.componentes.vendasPerdidas)}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="font-medium" style={{ color: COMPONENT_COLORS.capitalParado }}>
                      {formatCurrency(item.componentes.capitalParado)}
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-md"
                      style={{
                        backgroundColor: item.principalProblema === 'Perdas'
                          ? `${COMPONENT_COLORS.perdas}15`
                          : item.principalProblema === 'Rupturas'
                          ? `${COMPONENT_COLORS.vendasPerdidas}15`
                          : `${COMPONENT_COLORS.capitalParado}15`,
                        color: item.principalProblema === 'Perdas'
                          ? COMPONENT_COLORS.perdas
                          : item.principalProblema === 'Rupturas'
                          ? COMPONENT_COLORS.vendasPerdidas
                          : COMPONENT_COLORS.capitalParado,
                      }}
                    >
                      {item.principalProblema}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {items.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <AlertTriangle className="w-12 h-12 opacity-40 mb-3" />
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
