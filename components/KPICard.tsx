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

// Design System Colors - Alinhado com globals.css
const colorClasses = {
  primary: 'bg-[#16476A]',    // Deep Blue - Primary 500
  secondary: 'bg-[#3B7FAD]',  // Primary 400
  success: 'bg-[#3B9797]',    // Teal - Success
  warning: 'bg-[#F59E0B]',    // Warning 500
  accent: 'bg-[#BF092F]',     // Error 500
};

const colorRings = {
  primary: 'ring-[#16476A]/20',
  secondary: 'ring-[#3B7FAD]/20',
  success: 'ring-[#3B9797]/20',
  warning: 'ring-[#F59E0B]/20',
  accent: 'ring-[#BF092F]/20',
};

const colorHex = {
  primary: '#16476A',
  secondary: '#3B7FAD',
  success: '#3B9797',
  warning: '#F59E0B',
  accent: '#BF092F',
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
    <div className="bg-surface rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-border hover:border-primary-300 relative overflow-hidden p-6 pb-8">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">{title}</p>
          <h3 className="text-4xl font-bold text-text-primary mb-1">
            {valuePrefix}
            {value}
            {valueSuffix}
          </h3>
          {description && (
            <p className="text-sm text-text-secondary mt-1">{description}</p>
          )}
          {trend && (
            <div className="flex items-center mt-3">
              <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-md ${trend.isPositive ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'}`}>
                {trend.isPositive ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-text-tertiary ml-2">vs período anterior</span>
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
              <Area type="monotone" dataKey="v" stroke={colorHex[color]} strokeWidth={1.5} strokeOpacity={0.4} fill={`url(#kpi-${color}-spark)`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
