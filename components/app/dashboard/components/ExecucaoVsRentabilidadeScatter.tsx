'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ScatterPoint } from '@/lib/types/analytics';

interface ExecucaoVsRentabilidadeScatterProps {
  data: ScatterPoint[];
}

export function ExecucaoVsRentabilidadeScatter({ data }: ExecucaoVsRentabilidadeScatterProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="Ruptura Média (%)" />
        <YAxis type="number" dataKey="y" name="Margem (%)" />
        <ZAxis type="number" dataKey="size" range={[100, 1000]} name="Receita Perdida" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Legend />
        <Scatter name="SKUs" data={data} fill="#8884d8" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
