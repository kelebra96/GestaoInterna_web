"use client";

import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info, Zap, Sparkles } from 'lucide-react';

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
  'alert': AlertCircle,
  'check': CheckCircle,
  'info': Info,
  'zap': Zap,
};

const colorClasses = {
  success: {
    gradient: 'from-[#3B9797] to-[#16476A]',
    bgGradient: 'from-[#E0E7EF] via-[#E9ECEF] to-[#F8F9FA]',
    text: 'text-[#16476A]',
    border: 'border-[#3B9797]',
    shadow: 'shadow-[#3B9797]/20',
    glow: 'bg-[#3B9797]',
    badge: 'bg-[#3B9797]',
  },
  warning: {
    gradient: 'from-[#BF092F] to-[#16476A]',
    bgGradient: 'from-[#E9ECEF] via-[#E0E7EF] to-[#F8F9FA]',
    text: 'text-[#BF092F]',
    border: 'border-[#BF092F]',
    shadow: 'shadow-[#BF092F]/20',
    glow: 'bg-[#BF092F]',
    badge: 'bg-[#BF092F]',
  },
  info: {
    gradient: 'from-[#16476A] to-[#3B9797]',
    bgGradient: 'from-[#E0E7EF] via-[#E9ECEF] to-[#F8F9FA]',
    text: 'text-[#16476A]',
    border: 'border-[#3B9797]',
    shadow: 'shadow-[#3B9797]/20',
    glow: 'bg-[#3B9797]',
    badge: 'bg-[#3B9797]',
  },
  alert: {
    gradient: 'from-[#BF092F] to-[#132440]',
    bgGradient: 'from-[#E9ECEF] via-[#E0E7EF] to-[#F8F9FA]',
    text: 'text-[#BF092F]',
    border: 'border-[#BF092F]',
    shadow: 'shadow-[#BF092F]/20',
    glow: 'bg-[#BF092F]',
    badge: 'bg-[#BF092F]',
  },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#E0E0E0] overflow-hidden">
      {/* Header com gradiente animado */}
      <div className="relative bg-gradient-to-r from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 blur-xl rounded-full animate-pulse"></div>
                <div className="relative p-4 bg-white/20 backdrop-blur-md rounded-2xl border-2 border-white/40 shadow-2xl">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">
                  Insights Automáticos
                </h2>
                <p className="text-[#E0E7EF] text-sm font-medium mt-1 drop-shadow-md">
                  Análises inteligentes e recomendações do sistema
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border-2 border-white/40">
                <p className="text-white font-bold text-sm">{insights.length} insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Insights */}
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
          {insights.map((insight, index) => {
            const Icon = iconMap[insight.icon];
            const colors = colorClasses[insight.type];

            return (
              <div
                key={index}
                className="group relative flex"
              >
                {/* Glow effect */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${colors.gradient} rounded-2xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500`}></div>

                {/* Card principal */}
                <div
                  className={`relative bg-gradient-to-br ${colors.bgGradient} rounded-2xl border-2 ${colors.border} shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden hover:scale-[1.02] flex-1 flex flex-col`}
                >
                  {/* Efeito de brilho no hover */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl transform translate-x-20 -translate-y-20 group-hover:translate-x-10 group-hover:-translate-y-10 transition-transform duration-700"></div>

                  {/* Conteúdo */}
                  <div className="relative p-6 flex-1 flex flex-col">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Ícone grande e animado */}
                      <div className="relative flex-shrink-0">
                        <div className={`absolute inset-0 ${colors.glow} blur-xl opacity-50 rounded-2xl group-hover:opacity-70 transition-opacity duration-500`}></div>
                        <div className={`relative p-4 bg-gradient-to-br ${colors.gradient} rounded-2xl shadow-2xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                          <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                        </div>

                        {/* Badge de prioridade */}
                        {insight.type === 'alert' && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-[#BF092F] to-[#132440] rounded-full flex items-center justify-center border-3 border-white shadow-lg animate-pulse">
                            <span className="text-white text-xs font-bold">!</span>
                          </div>
                        )}
                      </div>

                      {/* Texto */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold ${colors.text} text-base leading-tight mb-2`}>
                          {insight.title}
                        </h4>

                        <p className={`text-sm ${colors.text} font-medium leading-relaxed line-clamp-3`}>
                          {insight.description}
                        </p>

                        {/* Indicador de tipo */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${colors.badge} rounded-full text-xs font-bold text-white shadow-lg`}>
                            {insight.type === 'success' && '✓ Positivo'}
                            {insight.type === 'warning' && '⚠ Atenção'}
                            {insight.type === 'info' && 'ℹ Informação'}
                            {insight.type === 'alert' && '⚡ Crítico'}
                          </span>

                          {/* Pulso animado para alertas */}
                          {insight.type === 'alert' && (
                            <div className="flex gap-1">
                              <div className={`w-1.5 h-1.5 ${colors.glow} rounded-full animate-pulse`}></div>
                              <div className={`w-1.5 h-1.5 ${colors.glow} rounded-full animate-pulse`} style={{ animationDelay: '0.2s' }}></div>
                              <div className={`w-1.5 h-1.5 ${colors.glow} rounded-full animate-pulse`} style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Canto decorativo */}
                  <div className={`absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl ${colors.gradient} opacity-10 rounded-tl-full`}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer com estatísticas */}
      <div className="border-t-2 border-[#E0E0E0] bg-gradient-to-r from-[#F8F9FA] to-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {Object.entries(
              insights.reduce((acc, insight) => {
                acc[insight.type] = (acc[insight.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => {
              const colors = colorClasses[type as keyof typeof colorClasses];
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${colors.glow}`}></div>
                  <span className="text-xs font-bold text-[#757575]">
                    {type === 'success' && 'Positivo'}
                    {type === 'warning' && 'Atenção'}
                    {type === 'info' && 'Info'}
                    {type === 'alert' && 'Crítico'}
                    : <span className={colors.text}>{count}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#757575] font-semibold">
            <div className="w-2 h-2 bg-[#3B9797] rounded-full animate-pulse"></div>
            Atualizado em tempo real
          </div>
        </div>
      </div>
    </div>
  );
}
