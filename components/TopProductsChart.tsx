"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package, Crown } from 'lucide-react';

interface TopProduct {
  productId: string;
  productName: string;
  count: number;
  ean?: string;
}

interface TopProductsChartProps {
  products: TopProduct[];
  limit?: number;
}

const COLORS = ['#16476A', '#3B9797', '#132440', '#5AB5B5', '#2D7A7A'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[200px]">
      <p className="font-bold text-text-primary text-sm mb-1">{data.productName}</p>
      {data.ean && <p className="text-[11px] text-text-tertiary mb-2 font-mono">EAN: {data.ean}</p>}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold text-primary-600">{data.count}</span>
        <span className="text-xs text-text-tertiary">solicitações</span>
      </div>
    </div>
  );
};

export default function TopProductsChart({ products, limit = 10 }: TopProductsChartProps) {
  const topProducts = products.slice(0, limit);

  if (!topProducts || topProducts.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm p-8 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-primary-100 rounded-xl">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">Top Produtos Mais Solicitados</h3>
        </div>
        <div className="text-center py-12">
          <Package className="w-14 h-14 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-text-secondary">Nenhum produto solicitado ainda</p>
        </div>
      </div>
    );
  }

  const chartData = topProducts.map((p) => ({
    ...p,
    displayName: p.productName.length > 22 ? p.productName.substring(0, 22) + '…' : p.productName,
  }));

  const maxCount = Math.max(...topProducts.map((p) => p.count));

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Top {limit} Produtos</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Mais solicitados nos últimos 30 dias</p>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Bar Chart */}
      <div className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={chartData.length * 32}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" stroke="transparent" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} tickLine={false} />
            <YAxis type="category" dataKey="displayName" stroke="transparent" width={110} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 6 }} />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={600}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
