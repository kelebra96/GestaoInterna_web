'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { ReceitaTimeSeriesPoint } from '@/lib/types/analytics';

interface ReceitaTimeSeriesChartProps {
  data: ReceitaTimeSeriesPoint[];
}

export function ReceitaTimeSeriesChart({ data }: ReceitaTimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area
          type="monotone"
          dataKey="receitaReal"
          name="Receita Real"
          stroke="#4CAF50"
          fill="#4CAF50"
          fillOpacity={0.3}
        />
        <Line
          type="monotone"
          dataKey="receitaPotencial"
          name="Receita Potencial"
          stroke="#2196F3"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
