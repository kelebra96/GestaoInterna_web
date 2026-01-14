"use client";

import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'accent';
  sparkline?: number[];
  valuePrefix?: string;
  valueSuffix?: string;
}

const colorClasses = {
  primary: 'bg-[#1F53A2]',
  secondary: 'bg-[#5C94CC]',
  success: 'bg-[#4CAF50]',
  warning: 'bg-[#FF9800]',
  accent: 'bg-[#E82129]',
};

const colorRings = {
  primary: 'ring-[#1F53A2]/20',
  secondary: 'ring-[#5C94CC]/20',
  success: 'ring-[#4CAF50]/20',
  warning: 'ring-[#FF9800]/20',
  accent: 'ring-[#E82129]/20',
};

const colorHex = {
  primary: '#1F53A2',
  secondary: '#5C94CC',
  success: '#4CAF50',
  warning: '#FF9800',
  accent: '#E82129',
};

export default function KPICard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = 'primary',
  sparkline,
  valuePrefix,
  valueSuffix,
}: KPICardProps) {
  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.38)] hover:-translate-y-0.5 transition-all duration-300 border border-[#E0E0E0] hover:border-[#1F53A2]/30 relative overflow-hidden p-6 pb-8">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#757575] mb-2 uppercase tracking-wide">{title}</p>
          <h3 className="text-4xl font-bold text-[#212121] mb-1">
            {valuePrefix}
            {value}
            {valueSuffix}
          </h3>
          {description && (
            <p className="text-sm text-[#757575] mt-1">{description}</p>
          )}
          {trend && (
            <div className="flex items-center mt-3">
              <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-md ${trend.isPositive ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : 'bg-[#E82129]/10 text-[#E82129]'}`}>
                {trend.isPositive ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-[#757575] ml-2">vs período anterior</span>
            </div>
          )}
        </div>
        <div className={`${colorClasses[color]} ${colorRings[color]} p-4 rounded-2xl ring-4 shadow-lg`}>
          <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-14 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`kpi-${color}-spark`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorHex[color]} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={colorHex[color]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#E0E0E0" strokeWidth={1.5} fill={`url(#kpi-${color}-spark)`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
