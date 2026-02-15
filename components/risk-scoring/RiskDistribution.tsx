'use client';

import { ScoreDistribution, RISK_LEVEL_CONFIG, RiskLevel } from '@/lib/types/risk-scoring';

// ==========================================
// Gráfico de Distribuição de Risco
// ==========================================

interface RiskDistributionChartProps {
  distribution: ScoreDistribution;
  variant?: 'bar' | 'pie' | 'donut';
  showLegend?: boolean;
  height?: number;
}

export function RiskDistributionChart({
  distribution,
  variant = 'bar',
  showLegend = true,
  height = 200,
}: RiskDistributionChartProps) {
  const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

  if (variant === 'bar') {
    return (
      <div className="space-y-3">
        {levels.map((level) => {
          const config = RISK_LEVEL_CONFIG[level];
          const count = distribution[level];
          const percent = distribution.percentages[level];

          return (
            <div key={level} className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600 font-medium">
                {config.label}
              </div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: config.color,
                  }}
                />
              </div>
              <div className="w-16 text-right text-sm">
                <span className="font-semibold">{count}</span>
                <span className="text-gray-400 ml-1">({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'donut' || variant === 'pie') {
    const isDonut = variant === 'donut';
    const size = height;
    const center = size / 2;
    const radius = isDonut ? size * 0.35 : size * 0.4;
    const innerRadius = isDonut ? size * 0.2 : 0;

    let currentAngle = -90; // Start from top

    const segments = levels.map((level) => {
      const config = RISK_LEVEL_CONFIG[level];
      const percent = distribution.percentages[level] || 0;
      const angle = (percent / 100) * 360;

      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const start = polarToCartesian(center, center, radius, startAngle);
      const end = polarToCartesian(center, center, radius, endAngle);
      const innerStart = polarToCartesian(center, center, innerRadius, startAngle);
      const innerEnd = polarToCartesian(center, center, innerRadius, endAngle);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const d = isDonut
        ? `M ${start.x} ${start.y}
           A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}
           L ${innerEnd.x} ${innerEnd.y}
           A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}
           Z`
        : `M ${center} ${center}
           L ${start.x} ${start.y}
           A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}
           Z`;

      return {
        level,
        config,
        percent,
        d,
      };
    });

    return (
      <div className="flex items-center gap-6">
        <svg width={size} height={size} className="flex-shrink-0">
          {segments.map(({ level, config, d, percent }) => (
            percent > 0 && (
              <path
                key={level}
                d={d}
                fill={config.color}
                className="transition-all duration-300 hover:opacity-80"
              />
            )
          ))}
          {isDonut && (
            <text
              x={center}
              y={center}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-2xl font-bold fill-gray-900"
            >
              {distribution.total}
            </text>
          )}
        </svg>

        {showLegend && (
          <div className="space-y-2">
            {levels.map((level) => {
              const config = RISK_LEVEL_CONFIG[level];
              const count = distribution[level];
              const percent = distribution.percentages[level];

              return (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm text-gray-600">{config.label}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {count} ({percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Helper para converter coordenadas polares para cartesianas
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// ==========================================
// Cards de Resumo
// ==========================================

interface RiskSummaryCardsProps {
  distribution: ScoreDistribution;
  avgScore: number;
  worseningCount: number;
  improvingCount: number;
}

export function RiskSummaryCards({
  distribution,
  avgScore,
  worseningCount,
  improvingCount,
}: RiskSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard
        title="Score Médio"
        value={avgScore.toString()}
        subtitle="pontos"
        color={getScoreColor(avgScore)}
      />
      <SummaryCard
        title="Críticos"
        value={distribution.critical.toString()}
        subtitle={`${distribution.percentages.critical}%`}
        color={RISK_LEVEL_CONFIG.critical.color}
      />
      <SummaryCard
        title="Piorando"
        value={worseningCount.toString()}
        subtitle="entidades"
        color={RISK_LEVEL_CONFIG.high.color}
        icon="↑"
      />
      <SummaryCard
        title="Melhorando"
        value={improvingCount.toString()}
        subtitle="entidades"
        color={RISK_LEVEL_CONFIG.low.color}
        icon="↓"
      />
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon?: string;
}

function SummaryCard({ title, value, subtitle, color, icon }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-2xl font-bold" style={{ color }}>
          {value}
        </span>
        <span className="text-sm text-gray-400">{subtitle}</span>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score <= 25) return RISK_LEVEL_CONFIG.low.color;
  if (score <= 50) return RISK_LEVEL_CONFIG.medium.color;
  if (score <= 75) return RISK_LEVEL_CONFIG.high.color;
  return RISK_LEVEL_CONFIG.critical.color;
}

// ==========================================
// Alerta de Risco
// ==========================================

interface RiskAlertBannerProps {
  criticalCount: number;
  highCount: number;
  onViewAll?: () => void;
}

export function RiskAlertBanner({
  criticalCount,
  highCount,
  onViewAll,
}: RiskAlertBannerProps) {
  const totalConcerning = criticalCount + highCount;

  if (totalConcerning === 0) return null;

  const isCritical = criticalCount > 0;

  return (
    <div
      className={`
        flex items-center justify-between p-4 rounded-lg
        ${isCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${isCritical ? 'bg-red-100' : 'bg-amber-100'}
          `}
        >
          <svg
            className={`w-5 h-5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <p className={`font-medium ${isCritical ? 'text-red-900' : 'text-amber-900'}`}>
            {criticalCount > 0 && `${criticalCount} crítico${criticalCount > 1 ? 's' : ''}`}
            {criticalCount > 0 && highCount > 0 && ' e '}
            {highCount > 0 && `${highCount} alto${highCount > 1 ? 's' : ''}`}
          </p>
          <p className={`text-sm ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
            {totalConcerning} {totalConcerning === 1 ? 'entidade requer' : 'entidades requerem'} atenção imediata
          </p>
        </div>
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${isCritical
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-amber-600 text-white hover:bg-amber-700'
            }
          `}
        >
          Ver detalhes
        </button>
      )}
    </div>
  );
}
