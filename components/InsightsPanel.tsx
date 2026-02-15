"use client";

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  Sparkles,
  ArrowRight,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';

interface Insight {
  type: 'success' | 'warning' | 'info' | 'alert';
  title: string;
  description: string;
  icon: 'trending-up' | 'trending-down' | 'alert' | 'check' | 'info' | 'zap';
}

interface InsightsPanelProps {
  insights: Insight[];
}

const iconMap = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'alert': AlertTriangle,
  'check': CheckCircle2,
  'info': Info,
  'zap': Zap,
};

const typeConfig = {
  success: {
    label: 'Positivo',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-800',
    tagBg: 'bg-emerald-100',
    tagText: 'text-emerald-700',
    tagBorder: 'border-emerald-200',
    dot: 'bg-emerald-500',
    accentBorder: 'border-l-emerald-500',
    priority: 2,
  },
  info: {
    label: 'Informação',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    titleColor: 'text-sky-800',
    tagBg: 'bg-sky-100',
    tagText: 'text-sky-700',
    tagBorder: 'border-sky-200',
    dot: 'bg-sky-500',
    accentBorder: 'border-l-sky-500',
    priority: 3,
  },
  warning: {
    label: 'Atenção',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-800',
    tagBg: 'bg-amber-100',
    tagText: 'text-amber-700',
    tagBorder: 'border-amber-200',
    dot: 'bg-amber-500',
    accentBorder: 'border-l-amber-500',
    priority: 1,
  },
  alert: {
    label: 'Crítico',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-800',
    tagBg: 'bg-rose-100',
    tagText: 'text-rose-700',
    tagBorder: 'border-rose-200',
    dot: 'bg-rose-500',
    accentBorder: 'border-l-rose-500',
    priority: 0,
  },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  // Sort: critical first, then warning, success, info
  const sorted = [...insights].sort(
    (a, b) => typeConfig[a.type].priority - typeConfig[b.type].priority
  );

  const counts = insights.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasAlerts = (counts['alert'] || 0) > 0;
  const hasWarnings = (counts['warning'] || 0) > 0;

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div
        className="relative px-6 py-5 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4878be, #305087)' }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22white%22%20fill-opacity%3D%220.06%22%2F%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
              <Lightbulb className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Insights Automáticos</h3>
              <p className="text-white/50 text-sm mt-0.5">
                {hasAlerts
                  ? `${counts['alert']} alerta${(counts['alert'] || 0) > 1 ? 's' : ''} requer${(counts['alert'] || 0) > 1 ? 'em' : ''} atenção`
                  : 'Análises inteligentes do sistema'}
              </p>
            </div>
          </div>

          {/* Category pills */}
          <div className="hidden sm:flex items-center gap-2">
            {Object.entries(counts).map(([type, count]) => {
              const cfg = typeConfig[type as keyof typeof typeConfig];
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10"
                >
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs font-semibold text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((insight, index) => {
            const Icon = iconMap[insight.icon];
            const cfg = typeConfig[insight.type];

            return (
              <div
                key={index}
                className={`relative flex gap-4 p-4 rounded-xl border-l-4 ${cfg.accentBorder} ${cfg.bg} border border-transparent hover:border-${insight.type === 'alert' ? 'rose' : insight.type === 'warning' ? 'amber' : insight.type === 'success' ? 'emerald' : 'sky'}-200 transition-all duration-200 group hover:shadow-md`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 p-2.5 ${cfg.iconBg} rounded-lg h-fit group-hover:scale-105 transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${cfg.iconColor}`} strokeWidth={2} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`font-semibold text-sm leading-snug ${cfg.titleColor}`}>
                      {insight.title}
                    </h4>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${cfg.tagBg} ${cfg.tagText} border ${cfg.tagBorder}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-2">
                    {insight.description}
                  </p>
                </div>

                {/* Urgency indicator for alerts */}
                {insight.type === 'alert' && (
                  <div className="absolute top-2.5 right-2.5">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                      <div className="absolute inset-0 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping opacity-75" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-divider bg-gray-50/80 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(hasAlerts || hasWarnings) ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{(counts['alert'] || 0) + (counts['warning'] || 0)} item(s) requer(em) ação</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tudo sob controle</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-medium">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Atualizado em tempo real
          </div>
        </div>
      </div>
    </div>
  );
}
