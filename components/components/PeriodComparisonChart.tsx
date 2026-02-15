"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Calendar } from 'lucide-react';

interface PeriodData {
  date: string;
  current: number;
  previous: number;
}

interface PeriodComparisonChartProps {
  data: PeriodData[];
  title?: string;
  currentLabel?: string;
  previousLabel?: string;
}

export default function PeriodComparisonChart({
  data,
  title = 'Comparação de Períodos',
  currentLabel = 'Período Atual',
  previousLabel = 'Período Anterior',
}: PeriodComparisonChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-[#E0E0E0]">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#1F53A2]" />
          <h3 className="text-lg font-bold text-[#212121]">{title}</h3>
        </div>
        <div className="text-center py-8 text-[#757575]">
          <p>Sem dados para comparação</p>
        </div>
      </div>
    );
  }

  // Calcular totais
  const currentTotal = data.reduce((sum, d) => sum + d.current, 0);
  const previousTotal = data.reduce((sum, d) => sum + d.previous, 0);
  const difference = currentTotal - previousTotal;
  const percentChange = previousTotal > 0 ? ((difference / previousTotal) * 100).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#1F53A2]" />
          <h3 className="text-lg font-bold text-[#212121]">{title}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-[#757575]">{currentLabel}</p>
            <p className="text-lg font-bold text-[#1F53A2]">{currentTotal}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#757575]">{previousLabel}</p>
            <p className="text-lg font-bold text-[#757575]">{previousTotal}</p>
          </div>
          <div className={`px-3 py-1 rounded-lg ${difference >= 0 ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : 'bg-[#E82129]/10 text-[#E82129]'}`}>
            <p className="text-sm font-bold">
              {difference >= 0 ? '+' : ''}{percentChange}%
            </p>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1F53A2" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1F53A2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#BFC7C9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#BFC7C9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis
              dataKey="date"
              stroke="#757575"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis stroke="#757575" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('pt-BR');
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="previous"
              name={previousLabel}
              stroke="#BFC7C9"
              strokeWidth={2}
              fill="url(#colorPrevious)"
              strokeDasharray="5 5"
            />
            <Area
              type="monotone"
              dataKey="current"
              name={currentLabel}
              stroke="#1F53A2"
              strokeWidth={3}
              fill="url(#colorCurrent)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
