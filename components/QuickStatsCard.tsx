"use client";

import { LucideIcon } from 'lucide-react';

interface QuickStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    label: string;
  };
  color?: 'primary' | 'success' | 'warning' | 'accent' | 'info';
}

const colorClasses = {
  primary: 'from-[#1F53A2] to-[#5C94CC]',
  success: 'from-[#4CAF50] to-[#66BB6A]',
  warning: 'from-[#FF9800] to-[#FFB74D]',
  accent: 'from-[#E82129] to-[#EF5350]',
  info: 'from-[#5C94CC] to-[#90CAF9]',
};

export default function QuickStatsCard({ title, value, icon: Icon, change, color = 'primary' }: QuickStatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-[0_10px_26px_-12px_rgba(0,0,0,0.32)] hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.36)] hover:-translate-y-0.5 border border-[#E0E0E0] p-4 pb-5 transition-all duration-300 overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-[#757575] uppercase tracking-wide mb-1">{title}</p>
          <h4 className="text-2xl font-bold text-[#212121] mb-1">{value}</h4>
          {change && (
            <p className="text-xs text-[#757575]">
              <span className={change.value >= 0 ? 'text-[#4CAF50] font-semibold' : 'text-[#E82129] font-semibold'}>
                {change.value >= 0 ? '+' : ''}{change.value}%
              </span>{' '}
              {change.label}
            </p>
          )}
        </div>
        <div className={`bg-gradient-to-br ${colorClasses[color]} p-2.5 rounded-lg shadow-sm`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
