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
  Legend,
  Cell,
} from 'recharts';

interface StoreData {
  storeId: string;
  storeName: string;
  count: number;
}

type Period = 'week' | 'month' | 'quarter';

const colors = ['#1F53A2', '#4CAF50', '#5C94CC', '#9C27B0', '#FF9800', '#E82129', '#00BCD4', '#FFC107'];


export default function SolicitacoesPorLojaChart() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/charts/solicitacoes-por-loja?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching solicitacoes por loja chart data:', error);
        setData([]); // Clear data on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  const chartData = data.map((store, index) => ({
    name: store.storeName,
    value: store.count,
    color: colors[index % colors.length],
  }));

  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-[#212121]">Solicitações por Loja</h3>
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
          {(['week', 'month', 'quarter'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                period === p
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'bg-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Trimestre'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
         <div className="h-[300px] flex items-center justify-center text-[#757575]">
            <p>Carregando dados...</p>
         </div>
      ) : chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-[#757575]">
          <p>Nenhuma solicitação registrada para o período.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#757575' }}
              stroke="#BFC7C9"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#757575' }} stroke="#BFC7C9" />
            <Tooltip
              formatter={(value: any) => [value, 'Solicitações']}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                padding: '12px',
              }}
            />
            <Legend />
            <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
