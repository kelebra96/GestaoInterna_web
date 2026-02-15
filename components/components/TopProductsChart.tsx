"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package } from 'lucide-react';

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

const COLORS = ['#1F53A2', '#5C94CC', '#4CAF50', '#FF9800', '#E82129'];

export default function TopProductsChart({ products, limit = 10 }: TopProductsChartProps) {
  const topProducts = products.slice(0, limit);

  if (!topProducts || topProducts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-[#E0E0E0]">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-[#1F53A2]" />
          <h3 className="text-lg font-bold text-[#212121]">Top Produtos Mais Solicitados</h3>
        </div>
        <div className="text-center py-8 text-[#757575]">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum produto solicitado ainda</p>
        </div>
      </div>
    );
  }

  // Truncar nomes longos
  const chartData = topProducts.map((p) => ({
    ...p,
    displayName: p.productName.length > 20 ? p.productName.substring(0, 20) + '...' : p.productName,
  }));

  const maxCount = Math.max(...topProducts.map((p) => p.count));

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#1F53A2]" />
          <h3 className="text-lg font-bold text-[#212121]">Top {limit} Produtos Mais Solicitados</h3>
        </div>
        <div className="text-sm text-[#757575]">
          Últimos 30 dias
        </div>
      </div>

      <div className="h-80 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" stroke="#757575" />
            <YAxis
              type="category"
              dataKey="displayName"
              stroke="#757575"
              width={100}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-[#E0E0E0]">
                      <p className="font-semibold text-[#212121] mb-1">{data.productName}</p>
                      {data.ean && <p className="text-xs text-[#757575] mb-1">EAN: {data.ean}</p>}
                      <p className="text-sm text-[#1F53A2] font-bold">{data.count} solicitações</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {topProducts.slice(0, 5).map((product, index) => {
          const percentage = maxCount > 0 ? (product.count / maxCount) * 100 : 0;
          return (
            <div key={product.productId} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#F5F5F5] text-xs font-bold text-[#1F53A2]">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#212121] truncate">{product.productName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-[#F5F5F5] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#757575] w-12 text-right">
                    {product.count}x
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
