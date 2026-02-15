'use client';

import {
  RiskLevel,
  RiskTrend,
  RISK_LEVEL_CONFIG,
  RISK_TREND_CONFIG,
} from '@/lib/types/risk-scoring';

interface RiskScoreCardProps {
  score: number;
  level: RiskLevel;
  trend?: RiskTrend;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export function RiskScoreCard({
  score,
  level,
  trend,
  title,
  subtitle,
  size = 'md',
  showDetails = true,
  onClick,
}: RiskScoreCardProps) {
  const levelConfig = RISK_LEVEL_CONFIG[level];
  const trendConfig = trend ? RISK_TREND_CONFIG[trend] : null;

  const sizes = {
    sm: { container: 'p-3', score: 'text-2xl', label: 'text-xs' },
    md: { container: 'p-4', score: 'text-4xl', label: 'text-sm' },
    lg: { container: 'p-6', score: 'text-5xl', label: 'text-base' },
  };

  const sizeClasses = sizes[size];

  return (
    <div
      className={`
        bg-white rounded-xl border-2 shadow-sm transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${sizeClasses.container}
      `}
      style={{ borderColor: levelConfig.color }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          {title && (
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          )}
          {subtitle && (
            <p className="text-gray-500 text-sm">{subtitle}</p>
          )}
        </div>

        {trend && trendConfig && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${trendConfig.color}15`, color: trendConfig.color }}
          >
            <span>{trendConfig.arrow}</span>
            <span>{trendConfig.label}</span>
          </div>
        )}
      </div>

      <div className="flex items-end gap-3 mt-3">
        <div
          className={`font-bold ${sizeClasses.score}`}
          style={{ color: levelConfig.color }}
        >
          {score}
        </div>
        <div className="pb-1">
          <span
            className={`px-2 py-0.5 rounded font-medium ${sizeClasses.label}`}
            style={{
              backgroundColor: levelConfig.bgColor,
              color: levelConfig.color,
            }}
          >
            {levelConfig.label}
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${score}%`,
                backgroundColor: levelConfig.color,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Componente de Badge de Risco
// ==========================================

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
}

export function RiskBadge({ level, size = 'sm', showIcon = false }: RiskBadgeProps) {
  const config = RISK_LEVEL_CONFIG[level];

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizes[size]}`}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {showIcon && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      )}
      {config.label}
    </span>
  );
}

// ==========================================
// Componente de Trend
// ==========================================

interface RiskTrendIndicatorProps {
  trend: RiskTrend;
  change?: number;
  size?: 'sm' | 'md';
}

export function RiskTrendIndicator({ trend, change, size = 'sm' }: RiskTrendIndicatorProps) {
  const config = RISK_TREND_CONFIG[trend];

  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <div
      className={`flex items-center gap-1 font-medium ${sizes[size]}`}
      style={{ color: config.color }}
    >
      <span className="text-lg">{config.arrow}</span>
      {change !== undefined && (
        <span>{change > 0 ? '+' : ''}{change}</span>
      )}
      <span className="opacity-75">{config.label}</span>
    </div>
  );
}

// ==========================================
// Componente de Score Circular
// ==========================================

interface CircularScoreProps {
  score: number;
  level: RiskLevel;
  size?: number;
  strokeWidth?: number;
}

export function CircularScore({
  score,
  level,
  size = 120,
  strokeWidth = 10,
}: CircularScoreProps) {
  const config = RISK_LEVEL_CONFIG[level];
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold"
          style={{ color: config.color }}
        >
          {score}
        </span>
        <span className="text-xs text-gray-500">{config.label}</span>
      </div>
    </div>
  );
}

// ==========================================
// Componente de Score Mini
// ==========================================

interface MiniScoreProps {
  score: number;
  level: RiskLevel;
}

export function MiniScore({ score, level }: MiniScoreProps) {
  const config = RISK_LEVEL_CONFIG[level];

  return (
    <div
      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {score}
    </div>
  );
}
