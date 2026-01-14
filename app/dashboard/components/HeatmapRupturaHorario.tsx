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
  Cell,
} from 'recharts';
import { HeatmapCell } from '@/lib/types/analytics';

interface HeatmapRupturaHorarioProps {
  data: HeatmapCell[];
}

const COLORS = ['#4CAF50', '#FFC107', '#FF9800', '#F44336'];

const getPath = (x: number, y: number, width: number, height: number) => {
  return `M${x},${y} h${width} v${height} h-${width} Z`;
};

const TriangleBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  return <path d={getPath(x, y, width, height)} stroke="none" fill={fill} />;
};

export function HeatmapRupturaHorario({ data }: HeatmapRupturaHorarioProps) {
  // This is a simplified heatmap using a BarChart.
  // A more advanced implementation would use a custom SVG component.
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="eixoX" />
        <YAxis dataKey="eixoY" type="category" />
        <Tooltip />
        <Legend />
        <Bar dataKey="valor" fill="#8884d8" shape={<TriangleBar />} label={{ position: 'top' }}>
          {data.map((entry, index) => {
            const colorIndex = Math.floor((entry.valor / 100) * (COLORS.length - 1));
            return <Cell key={`cell-${index}`} fill={COLORS[colorIndex]} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
