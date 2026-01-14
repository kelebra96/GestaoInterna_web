'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { WaterfallStep } from '@/lib/types/analytics';

interface MargemWaterfallChartProps {
  data: WaterfallStep[];
}

export function MargemWaterfallChart({ data }: MargemWaterfallChartProps) {
  // This is a simplified waterfall chart using a BarChart.
  // A more advanced implementation would use a custom SVG component.
  const processedData = data.map((entry, index) => {
    if (entry.type === 'delta') {
      const prevValue = data[index - 1].value;
      return { ...entry, range: [prevValue + entry.value, prevValue] };
    }
    return { ...entry, range: [entry.value, 0] };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={processedData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="range" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
