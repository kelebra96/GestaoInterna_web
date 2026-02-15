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
import { BarChart3, TrendingUp, Activity } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  count: number;
}

interface SolicitacoesChartProps {
  data: ChartDataPoint[];
}

const COLORS = {
  primary: '#16476A',
  primaryGlow: '#3B9797',
  error: '#BF092F',
  gray: '#757575',
  grayLight: '#F8F9FA',
  grayMid: '#E0E0E0',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const count = payload.find((p: any) => p.dataKey === 'count')?.value ?? 0;
  const ma7 = payload.find((p: any) => p.dataKey === 'ma7')?.value;

  return (
    <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[180px]">
      <p className="text-xs font-semibold text-text-tertiary mb-3 uppercase tracking-wider">
        {label}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16476A]" />
            <span className="text-sm text-text-secondary">Solicitações</span>
          </div>
          <span className="text-sm font-bold text-text-primary">{count}</span>
        </div>
        {ma7 !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B9797]" />
              <span className="text-sm text-text-secondary">Média 7d</span>
            </div>
            <span className="text-sm font-bold text-text-primary">{ma7.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function SolicitacoesChart({ data }: SolicitacoesChartProps) {
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
  const maxDay = formattedData.reduce((max, d) => d.count > max.count ? d : max, formattedData[0]);
  const minDay = formattedData.reduce((min, d) => d.count < min.count ? d : min, formattedData[0]);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Solicitações — 30 dias</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Volume diário e média móvel (7 dias)</p>
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-primary-50 rounded-xl px-4 py-3 border border-primary-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-primary-400" />
              <p className="text-[11px] font-semibold text-primary-400 uppercase tracking-wider">Total</p>
            </div>
            <p className="text-2xl font-extrabold text-primary-700">{total}</p>
          </div>
          <div className="bg-success-50 rounded-xl px-4 py-3 border border-success-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-success-400" />
              <p className="text-[11px] font-semibold text-success-400 uppercase tracking-wider">Pico</p>
            </div>
            <p className="text-2xl font-extrabold text-success-700">{maxDay?.count ?? 0}</p>
            <p className="text-[10px] text-success-500 font-medium mt-0.5">{maxDay?.dateFormatted}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Média/dia</p>
            <p className="text-2xl font-extrabold text-gray-600">{avg.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={withMA7} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSolicitacoes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.2} />
                <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
              stroke="transparent"
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} stroke="transparent" tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '12px' }}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span className="text-xs font-medium text-text-secondary">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={COLORS.primary}
              strokeWidth={2.5}
              fill="url(#gradSolicitacoes)"
              name="Solicitações"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: COLORS.primary }}
            />
            <Line
              type="monotone"
              dataKey="ma7"
              stroke={COLORS.primaryGlow}
              strokeWidth={2}
              name="Média móvel (7d)"
              dot={false}
              strokeDasharray="4 3"
            />
            <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="4 4" ifOverflow="extendDomain" />
            <Brush height={20} stroke="#cbd5e1" travellerWidth={8} fill="#f8fafc" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
