"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { useState } from 'react';
import { Clock, CheckCircle2, Archive } from 'lucide-react';

interface StatusChartProps {
  data: {
    pending: number;
    batched: number;
    closed: number;
  };
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pendentes',
    color: '#BF092F',
    lightBg: 'bg-error-50',
    lightBorder: 'border-error-100',
    textColor: 'text-error-700',
    icon: Clock,
    description: 'Aguardando processamento',
  },
  batched: {
    label: 'Agrupadas',
    color: '#3B9797',
    lightBg: 'bg-success-50',
    lightBorder: 'border-success-100',
    textColor: 'text-success-700',
    icon: CheckCircle2,
    description: 'Em lote para envio',
  },
  closed: {
    label: 'Fechadas',
    color: '#16476A',
    lightBg: 'bg-primary-50',
    lightBorder: 'border-primary-100',
    textColor: 'text-primary-700',
    icon: Archive,
    description: 'Finalizadas com sucesso',
  },
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.15} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 3} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function StatusChart({ data }: StatusChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const entries = Object.entries(data) as Array<[keyof typeof STATUS_CONFIG, number]>;
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  const chartData = entries.map(([key, value]) => ({
    name: STATUS_CONFIG[key].label,
    value,
    key,
    percent: total ? (value / total) * 100 : 0,
  }));

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Archive className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">Distribuição por Status</h3>
            <p className="text-xs text-text-tertiary mt-0.5">Visão geral das solicitações</p>
          </div>
        </div>
      </div>

      {/* Chart + Center label */}
      <div className="relative" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={STATUS_CONFIG[entry.key].color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                const cfg = STATUS_CONFIG[d.key as keyof typeof STATUS_CONFIG];
                return (
                  <div className="bg-white/95 backdrop-blur-xl p-3 rounded-xl shadow-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm font-bold text-text-primary">{cfg.label}</span>
                    </div>
                    <p className="text-lg font-extrabold text-text-primary">{d.value} <span className="text-xs font-medium text-text-tertiary">({d.percent.toFixed(0)}%)</span></p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-text-primary">{total}</div>
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Total</div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="px-6 pb-6 space-y-2.5">
        {chartData.map((item) => {
          const cfg = STATUS_CONFIG[item.key as keyof typeof STATUS_CONFIG];
          const Icon = cfg.icon;
          const widthPercent = item.percent > 0 ? Math.max(item.percent, 4) : 0;

          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-3 rounded-xl ${cfg.lightBg} border ${cfg.lightBorder} transition-all duration-200 hover:scale-[1.01]`}
            >
              <div className="p-2 rounded-lg bg-white/70 shadow-sm">
                <Icon className={`w-4 h-4 ${cfg.textColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
                  <span className="text-xs font-bold text-text-secondary">{item.percent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${widthPercent}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
              <span className="text-xl font-extrabold text-text-primary tabular-nums w-12 text-right">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
