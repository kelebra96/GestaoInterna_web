"use client";

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Building2, Loader2 } from 'lucide-react';

interface StoreData {
  storeId: string;
  storeName: string;
  count: number;
}

type Period = 'week' | 'month' | 'quarter';

const BAR_COLORS = ['#16476A', '#3B9797', '#5AB5B5', '#132440', '#BF092F', '#E0E7EF', '#2D7A7A', '#9AB8D1'];

const periodLabels: Record<Period, string> = {
  week: 'Semana',
  month: 'Mês',
  quarter: 'Trimestre',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[160px]">
      <p className="text-sm font-bold text-text-primary mb-1">{data.name}</p>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="text-2xl font-extrabold text-text-primary">{data.value}</span>
        <span className="text-xs text-text-tertiary">solicitações</span>
      </div>
    </div>
  );
};

export default function SolicitacoesPorLojaChart() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/charts/solicitacoes-por-loja?period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch chart data');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching solicitacoes por loja chart data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  const chartData = data.map((store, index) => ({
    name: store.storeName,
    value: store.count,
    color: BAR_COLORS[index % BAR_COLORS.length],
  }));

  const totalSolicitacoes = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Solicitações por Loja</h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                {totalSolicitacoes > 0 ? `${totalSolicitacoes} solicitações • ${chartData.length} lojas` : 'Distribuição por unidade'}
              </p>
            </div>
          </div>

          {/* Period Switcher */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl">
            {(['week', 'month', 'quarter'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  period === p
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-5">
        {loading ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-text-tertiary font-medium">Carregando dados...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <Building2 className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-text-tertiary font-medium">Nenhuma solicitação neste período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                stroke="transparent"
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                stroke="transparent"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 8 }} />
              <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]} animationDuration={600}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
