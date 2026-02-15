'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ParetoItem } from '@/lib/types/analytics';

interface ParetoReceitaPerdidaChartProps {
  data: ParetoItem[];
}

export function ParetoReceitaPerdidaChart({ data }: ParetoReceitaPerdidaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="valor" name="Receita Perdida" fill="#8884d8" />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="percentualAcumulado"
          name="% Acumulado"
          stroke="#82ca9d"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
