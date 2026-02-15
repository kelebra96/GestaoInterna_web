"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

const COLORS = {
  primary: '#16476A',
  primaryLight: '#3B9797',
  gray: '#757575',
  grayLight: '#F8F9FA',
  grayMid: '#E0E0E0',
  success: '#3B9797',
  error: '#BF092F',
};

const CustomTooltip = ({ active, payload, label, currentLabel, previousLabel }: any) => {
  if (!active || !payload || !payload.length) return null;
  const date = new Date(label);
  const current = payload.find((p: any) => p.dataKey === 'current')?.value ?? 0;
  const previous = payload.find((p: any) => p.dataKey === 'previous')?.value ?? 0;
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(1) : '—';

  return (
    <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[200px]">
      <p className="text-xs font-semibold text-text-tertiary mb-3 uppercase tracking-wider">
        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16476A]" />
            <span className="text-sm text-text-secondary">{currentLabel}</span>
          </div>
          <span className="text-sm font-bold text-text-primary">{current}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
            <span className="text-sm text-text-secondary">{previousLabel}</span>
          </div>
          <span className="text-sm font-bold text-text-primary">{previous}</span>
        </div>
        <div className="pt-2 mt-2 border-t border-gray-100">
          <div className={`flex items-center gap-1 text-xs font-bold ${diff >= 0 ? 'text-success-600' : 'text-error-600'}`}>
            {diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {diff >= 0 ? '+' : ''}{pct}% vs período anterior
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PeriodComparisonChart({
  data,
  title = 'Análise Temporal',
  currentLabel = 'Período Atual',
  previousLabel = 'Período Anterior',
}: PeriodComparisonChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm p-8 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-primary-100 rounded-xl">
            <Calendar className="w-5 h-5 text-primary-600" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        </div>
        <div className="text-center py-12 text-text-secondary">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Sem dados para comparação</p>
        </div>
      </div>
    );
  }

  const currentTotal = data.reduce((sum, d) => sum + d.current, 0);
  const previousTotal = data.reduce((sum, d) => sum + d.previous, 0);
  const difference = currentTotal - previousTotal;
  const percentChange = previousTotal > 0 ? ((difference / previousTotal) * 100).toFixed(1) : '0';
  const isPositive = difference >= 0;

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden group">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">{title}</h3>
              <p className="text-xs text-text-tertiary mt-0.5">Comparação entre períodos</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-primary-50 rounded-xl px-4 py-3 border border-primary-100">
            <p className="text-[11px] font-semibold text-primary-400 uppercase tracking-wider">{currentLabel}</p>
            <p className="text-2xl font-extrabold text-primary-700 mt-1">{currentTotal}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{previousLabel}</p>
            <p className="text-2xl font-extrabold text-gray-600 mt-1">{previousTotal}</p>
          </div>
          <div className={`rounded-xl px-4 py-3 border ${isPositive ? 'bg-success-50 border-success-100' : 'bg-error-50 border-error-100'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${isPositive ? 'text-success-400' : 'text-error-400'}`}>Variação</p>
            <div className="flex items-center gap-1 mt-1">
              {isPositive
                ? <TrendingUp className="w-5 h-5 text-success-600" />
                : <TrendingDown className="w-5 h-5 text-error-600" />
              }
              <p className={`text-2xl font-extrabold ${isPositive ? 'text-success-700' : 'text-error-700'}`}>
                {isPositive ? '+' : ''}{percentChange}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.grayMid} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS.grayMid} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="transparent"
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
              tickLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis stroke="transparent" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip currentLabel={currentLabel} previousLabel={previousLabel} />} />
            <Area type="monotone" dataKey="previous" name={previousLabel} stroke={COLORS.grayMid} strokeWidth={2} fill="url(#gradPrevious)" strokeDasharray="6 4" dot={false} />
            <Area type="monotone" dataKey="current" name={currentLabel} stroke={COLORS.primary} strokeWidth={2.5} fill="url(#gradCurrent)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: COLORS.primary }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
