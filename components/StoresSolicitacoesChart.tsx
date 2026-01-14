"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface StoresSolicitacoesChartProps {
  stores: Array<{
    storeId: string;
    storeName: string;
    count: number;
  }>;
}

export default function StoresSolicitacoesChart({ stores }: StoresSolicitacoesChartProps) {
  // Definir cores para diferentes lojas
  const colors = ['#1F53A2', '#4CAF50', '#5C94CC', '#9C27B0', '#FF9800', '#E82129', '#00BCD4', '#FFC107'];

  const data = stores.map((store, index) => ({
    name: store.storeName,
    value: store.count,
    color: colors[index % colors.length],
  }));

  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <h3 className="text-lg font-bold text-[#212121] mb-4">Solicitações por Loja</h3>
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-[#757575]">
          <p>Nenhuma solicitação registrada</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#757575' }}
              stroke="#BFC7C9"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#757575' }} stroke="#BFC7C9" />
            <Tooltip
              formatter={(value: number) => [value, 'Solicitações']}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                padding: '12px',
              }}
            />
            <Legend />
            <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
