'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Package,
  Factory,
  Filter,
  Download,
  BarChart3,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import Card from '@/components/ui/Card';
import ParetoChart from '@/components/charts/ParetoChart';
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

interface ParetoItem {
  ranking: number;
  produtoId: string;
  codigo: string;
  nome: string;
  categoria: string;
  comprador?: string;
  perdaTotal: number;
  perdaTotalFormatada: string;
  participacaoPct: number;
  participacaoAcumuladaPct: number;
  curvaAbc: 'A' | 'B' | 'C';
  barWidth: number;
  isTop20: boolean;
}

interface ParetoSummary {
  totalPerdas: number;
  totalProdutos: number;
  curvaA: { produtos: number; valor: number; participacaoPct: number };
  curvaB: { produtos: number; valor: number; participacaoPct: number };
  curvaC: { produtos: number; valor: number; participacaoPct: number };
  top5Categorias: Array<{ categoria: string; valor: number; pct: number }>;
  top5Compradores: Array<{ comprador: string; valor: number; pct: number }>;
}

// Paleta de cores consistente com a identidade visual da aplicação
const ABC_COLORS = {
  A: '#16476A',  // Azul escuro - Crítico (80%)
  B: '#3B9797',  // Teal - Importante (15%)
  C: '#10B981',  // Verde - Normal (5%)
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export default function PerdasPage() {
  const router = useRouter();
  const [items, setItems] = useState<ParetoItem[]>([]);
  const [summary, setSummary] = useState<ParetoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [curvaFilter, setCurvaFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/varejo/pareto-perdas?limit=50';
      if (curvaFilter !== 'all') url += `&curva=${curvaFilter}`;
      if (categoriaFilter) url += `&categoria=${encodeURIComponent(categoriaFilter)}`;

      const res = await fetch(url);
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      setItems(json.data?.items || []);
      setSummary(json.data?.summary || null);
    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [curvaFilter, categoriaFilter]);

  const paretoData = items.slice(0, 15).map((item) => ({
    productName: item.nome,
    ean: item.codigo,
    valor: item.perdaTotal,
    count: 1,
    percentualAcumulado: item.participacaoAcumuladaPct,
  }));

  const curvaAbcData = summary
    ? [
        { name: 'Curva A', value: summary.curvaA.produtos, color: ABC_COLORS.A, label: `${summary.curvaA.participacaoPct.toFixed(0)}%` },
        { name: 'Curva B', value: summary.curvaB.produtos, color: ABC_COLORS.B, label: `${summary.curvaB.participacaoPct.toFixed(0)}%` },
        { name: 'Curva C', value: summary.curvaC.produtos, color: ABC_COLORS.C, label: `${summary.curvaC.participacaoPct.toFixed(0)}%` },
      ]
    : [];

  const categoriasData = (summary?.top5Categorias || []).map((c) => ({
    name: c.categoria.length > 15 ? c.categoria.slice(0, 15) + '...' : c.categoria,
    value: c.valor,
  }));

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/inteligencia/executivo')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Análise de Pareto - Perdas</h1>
            <p className="text-gray-500 mt-1">Identificação dos principais ofensores (80/20)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total de Perdas"
          value={formatCurrency(summary?.totalPerdas || 0)}
          icon={TrendingDown}
          color="accent"
          description={`${summary?.totalProdutos || 0} produtos`}
        />
        <KPICard
          title="Curva A (80%)"
          value={`${summary?.curvaA.produtos || 0}`}
          valueSuffix=" produtos"
          icon={AlertTriangle}
          color="accent"
          description={formatCurrency(summary?.curvaA.valor || 0)}
        />
        <KPICard
          title="Curva B (15%)"
          value={`${summary?.curvaB.produtos || 0}`}
          valueSuffix=" produtos"
          icon={Package}
          color="warning"
          description={formatCurrency(summary?.curvaB.valor || 0)}
        />
        <KPICard
          title="Curva C (5%)"
          value={`${summary?.curvaC.produtos || 0}`}
          valueSuffix=" produtos"
          icon={Package}
          color="success"
          description={formatCurrency(summary?.curvaC.valor || 0)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          Filtrar por curva:
        </div>
        <div className="flex gap-2">
          {['all', 'A', 'B', 'C'].map((curva) => (
            <button
              key={curva}
              onClick={() => setCurvaFilter(curva as any)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                curvaFilter === curva
                  ? curva === 'all'
                    ? 'bg-blue-600 text-white'
                    : `text-white`
                  : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
              style={
                curvaFilter === curva && curva !== 'all'
                  ? { backgroundColor: ABC_COLORS[curva as 'A' | 'B' | 'C'] }
                  : {}
              }
            >
              {curva === 'all' ? 'Todas' : `Curva ${curva}`}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pareto Chart */}
        <div className="lg:col-span-2">
          <Card header={<h3 className="text-lg font-semibold">Pareto de Perdas - Top 15</h3>}>
            <ParetoChart data={paretoData} />
          </Card>
        </div>

        {/* Distribuição ABC */}
        <Card header={<h3 className="text-lg font-semibold">Distribuição ABC</h3>}>
          <div className="h-[280px]">
            {curvaAbcData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={curvaAbcData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, payload }: any) => `${name}: ${payload?.label || ''}`}
                    labelLine={{ stroke: '#94a3b8' }}
                  >
                    {curvaAbcData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} produtos`, 'Quantidade']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Sem dados
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top Categorias e Compradores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categorias */}
        <Card header={<h3 className="text-lg font-semibold">Top 5 Categorias com Perda</h3>}>
          <div className="h-[250px]">
            {categoriasData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoriasData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={95} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="value" fill="#16476A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Sem dados
              </div>
            )}
          </div>
        </Card>

        {/* Top Compradores */}
        <Card header={<h3 className="text-lg font-semibold">Top 5 Compradores com Perda</h3>}>
          <div className="space-y-3">
            {(summary?.top5Compradores || []).map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#16476A20' }}>
                  <Factory className="w-4 h-4" style={{ color: '#16476A' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{f.comprador}</span>
                    <span className="text-sm font-semibold" style={{ color: '#16476A' }}>
                      {formatCurrency(f.valor)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.pct}%`, backgroundColor: '#16476A' }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-12 text-right">{f.pct.toFixed(1)}%</span>
              </div>
            ))}
            {(!summary?.top5Compradores || summary.top5Compradores.length === 0) && (
              <div className="text-center text-gray-400 py-8">Sem dados de compradores</div>
            )}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Detalhamento de Produtos</h3>
            <span className="text-sm text-gray-400">{items.length} produtos</span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-center py-3 px-2 font-medium text-gray-600 w-12">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Produto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Categoria</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Perda</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">% Individual</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">% Acumulado</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Curva</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((item) => (
                <tr
                  key={item.produtoId}
                  className={`border-b hover:bg-gray-50 ${item.isTop20 ? 'bg-red-50/30' : ''}`}
                >
                  <td className="text-center py-3 px-2 text-gray-400">{item.ranking}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 line-clamp-1">{item.nome}</div>
                    <div className="text-xs text-gray-400">{item.codigo}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{item.categoria}</td>
                  <td className="text-right py-3 px-4 font-semibold text-red-600">
                    {item.perdaTotalFormatada}
                  </td>
                  <td className="text-right py-3 px-4">{item.participacaoPct.toFixed(2)}%</td>
                  <td className="text-right py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-100 h-1.5 rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(item.participacaoAcumuladaPct, 100)}%`,
                            backgroundColor: item.participacaoAcumuladaPct <= 80
                              ? '#16476A'  // Azul escuro - Curva A
                              : item.participacaoAcumuladaPct <= 95
                              ? '#3B9797'  // Teal - Curva B
                              : '#10B981'  // Verde - Curva C
                          }}
                        />
                      </div>
                      <span>{item.participacaoAcumuladaPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: ABC_COLORS[item.curvaAbc] }}
                    >
                      {item.curvaAbc}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
