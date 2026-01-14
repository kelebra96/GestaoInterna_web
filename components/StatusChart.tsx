"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusChartProps {
  data: {
    pending: number;
    batched: number;
    closed: number;
  };
}

const COLORS = {
  pending: '#FF9800', // Laranja - pendentes
  batched: '#4CAF50', // Verde - agrupadas
  closed: '#647CAC', // Azul médio - fechadas
};

const STATUS_LABELS = {
  pending: 'Pendentes',
  batched: 'Agrupadas',
  closed: 'Fechadas',
} as const;

export default function StatusChart({ data }: StatusChartProps) {
  const entries = Object.entries(data) as Array<[keyof typeof STATUS_LABELS, number]>;
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  const chartData = entries.map(([key, value]) => ({
    name: STATUS_LABELS[key],
    value,
    key,
    percent: total ? (value / total) * 100 : 0,
  }));

  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <h3 className="text-lg font-bold text-[#212121] mb-4">Solicitações por Status</h3>
      <div className="relative" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.key]} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const pct = props && props.payload ? props.payload.percent : 0;
                return [`${value} (${pct.toFixed(0)}%)`, name];
              }}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: '8px',
                padding: '12px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro do donut */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#212121]">{total}</div>
            <div className="text-xs text-[#757575]">Total</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {chartData.map((item) => (
          <div key={item.key} className="flex items-center bg-[#F5F5F5] p-3 rounded-lg">
            <div
              className="w-4 h-4 rounded-full mr-3 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: (COLORS as any)[item.key] }}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-[#212121] block">{item.name}</span>
              <span className="text-xs text-[#757575]">{item.value} ({item.percent.toFixed(0)}%)</span>
            </div>
            <span className="text-lg font-bold text-[#1F53A2]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
