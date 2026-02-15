"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  ReferenceLine,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChartDataPoint {
  date: string;
  count: number;
}

interface SolicitacoesChartProps {
  data: ChartDataPoint[];
}

export default function SolicitacoesChart({ data }: SolicitacoesChartProps) {
  // Formatar dados e calcular média móvel de 7 dias
  const formattedData = data.map((item) => ({
    ...item,
    dateFormatted: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
  }));

  const withMA7 = formattedData.map((d, idx, arr) => {
    const start = Math.max(0, idx - 6);
    const slice = arr.slice(start, idx + 1);
    const ma7 = slice.reduce((acc, it) => acc + it.count, 0) / slice.length;
    return { ...d, ma7 };
  });

  const total = formattedData.reduce((acc, it) => acc + it.count, 0);
  const avg = formattedData.length ? total / formattedData.length : 0;

  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-[#212121]">Solicitações nos últimos 30 dias</h3>
          <p className="text-sm text-[#757575] mt-1">Volume diário e média móvel (7 dias)</p>
        </div>
        <div className="bg-[#E3EFFF] px-4 py-2 rounded-lg">
          <span className="text-sm font-semibold text-[#1F53A2]">Total: {total}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={withMA7}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1F53A2" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1F53A2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: '#757575' }}
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="#BFC7C9"
          />
          <YAxis tick={{ fontSize: 12, fill: '#757575' }} stroke="#BFC7C9" />
          <Tooltip
            labelFormatter={(value) => `Data: ${value}`}
            formatter={(value: any, name: any) => {
              if (String(name).toLowerCase().includes('média')) return [`${value.toFixed(1)}`, 'Média móvel'];
              return [`${value} solicitações`, 'Total'];
            }}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              padding: '12px',
            }}
            labelStyle={{ color: '#212121', fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#1F53A2"
            strokeWidth={3}
            fill="url(#colorCount)"
            name="Solicitações"
            dot={{ fill: '#1F53A2', r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#FFFFFF', fill: '#E82129' }}
          />
          <Line
            type="monotone"
            dataKey="ma7"
            stroke="#5C94CC"
            strokeWidth={2}
            name="Média móvel (7d)"
            dot={false}
          />
          <ReferenceLine y={avg} stroke="#BFC7C9" strokeDasharray="4 4" ifOverflow="extendDomain" />
          <Brush height={24} stroke="#BFC7C9" travellerWidth={8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

