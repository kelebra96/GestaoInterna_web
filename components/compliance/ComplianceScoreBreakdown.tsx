'use client';

import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ComplianceScoreBreakdown,
  DimensionScore,
  DIMENSION_ICONS,
  getStatusColor,
  getProgressBarColor,
  getStatusLabel,
} from '@/lib/types/compliance-scoring';
import { useState } from 'react';

interface ComplianceScoreBreakdownProps {
  breakdown: ComplianceScoreBreakdown;
  showDetails?: boolean;
  onDimensionClick?: (dimension: DimensionScore) => void;
}

export default function ComplianceScoreBreakdownView({
  breakdown,
  showDetails = true,
  onDimensionClick,
}: ComplianceScoreBreakdownProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const handleDimensionClick = (dimension: DimensionScore) => {
    if (onDimensionClick) {
      onDimensionClick(dimension);
    }
    setExpandedDimension(expandedDimension === dimension.dimension ? null : dimension.dimension);
  };

  return (
    <div className="space-y-6">
      {/* Score Geral */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Conformidade Total
              </h3>
              <p className="text-sm text-gray-500">
                {breakdown.executedAt.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-gray-900">
                {breakdown.overallScore.toFixed(0)}
              </span>
              <span className="text-2xl text-gray-500">%</span>
            </div>
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold mt-2 ${getStatusColor(breakdown.overallStatus)}`}>
              {breakdown.overallStatus === 'excellent' && <CheckCircle className="w-4 h-4" />}
              {breakdown.overallStatus === 'critical' && <AlertCircle className="w-4 h-4" />}
              {(breakdown.overallStatus === 'good' || breakdown.overallStatus === 'warning') && <AlertTriangle className="w-4 h-4" />}
              {getStatusLabel(breakdown.overallStatus)}
            </div>
          </div>
        </div>

        {/* Tendência */}
        {breakdown.trend && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            breakdown.trend.improving ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {breakdown.trend.improving ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              breakdown.trend.improving ? 'text-green-700' : 'text-red-700'
            }`}>
              {breakdown.trend.improving ? '+' : ''}{breakdown.trend.change.toFixed(1)}%
              {' '}desde última execução ({breakdown.trend.previousScore.toFixed(0)}%)
            </span>
          </div>
        )}

        {/* Barra de Progresso Geral */}
        <div className="mt-4">
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressBarColor(breakdown.overallStatus)}`}
              style={{ width: `${Math.min(100, breakdown.overallScore)}%` }}
            />
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">
              {breakdown.summary.excellentDimensions}
            </p>
            <p className="text-xs text-green-600">Excelente</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-700">
              {breakdown.summary.problemDimensions}
            </p>
            <p className="text-xs text-yellow-600">Atenção</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-700">
              {breakdown.summary.criticalIssues}
            </p>
            <p className="text-xs text-red-600">Críticos</p>
          </div>
        </div>
      </div>

      {/* Breakdown por Dimensão */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Breakdown por Dimensão
        </h3>

        <div className="space-y-3">
          {breakdown.dimensions.map((dimension) => (
            <div
              key={dimension.dimension}
              className="border-2 border-gray-200 rounded-lg overflow-hidden transition-all hover:border-blue-300"
            >
              <button
                onClick={() => handleDimensionClick(dimension)}
                className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                {/* Ícone e Nome */}
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{DIMENSION_ICONS[dimension.dimension]}</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{dimension.label}</p>
                    <p className="text-xs text-gray-500">
                      {dimension.details.correct} / {dimension.details.total} corretos
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="flex-1 max-w-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {dimension.weight * 100}% do total
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getProgressBarColor(dimension.status)}`}
                      style={{ width: `${Math.min(100, dimension.score)}%` }}
                    />
                  </div>
                </div>

                {/* Score e Status */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {dimension.score.toFixed(0)}%
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(dimension.status)}`}>
                    {getStatusLabel(dimension.status)}
                  </span>
                </div>

                {/* Indicador de Expansão */}
                <ChevronRight
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedDimension === dimension.dimension ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Detalhes Expandidos */}
              {showDetails && expandedDimension === dimension.dimension && (
                <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
                  {/* Problemas */}
                  {dimension.issues.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Problemas Identificados ({dimension.issues.length}):
                      </p>
                      <div className="space-y-2">
                        {dimension.issues.slice(0, 5).map((issue, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-xs border ${
                              issue.type === 'error'
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : issue.type === 'warning'
                                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}
                          >
                            <p className="font-medium">{issue.message}</p>
                            {issue.productName && (
                              <p className="text-xs mt-1 opacity-75">
                                Produto: {issue.productName}
                              </p>
                            )}
                          </div>
                        ))}
                        {dimension.issues.length > 5 && (
                          <p className="text-xs text-gray-500 italic">
                            + {dimension.issues.length - 5} outros problemas
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sugestões */}
                  {dimension.suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Sugestões de Melhoria:
                      </p>
                      <ul className="space-y-1">
                        {dimension.suggestions.map((suggestion, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Estatísticas */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-500">Corretos</p>
                      <p className="text-lg font-bold text-green-600">
                        {dimension.details.correct}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-500">Incorretos</p>
                      <p className="text-lg font-bold text-red-600">
                        {dimension.details.incorrect}
                      </p>
                    </div>
                    {dimension.details.missing !== undefined && (
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-xs text-gray-500">Faltantes</p>
                        <p className="text-lg font-bold text-orange-600">
                          {dimension.details.missing}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Visualização em Árvore (Texto) */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Visualização em Árvore
        </h3>
        <pre className="font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
          <div className="text-gray-900">
            Conformidade Total: <span className="font-bold text-blue-600">{breakdown.overallScore.toFixed(1)}%</span>
            {breakdown.dimensions.map((dim, idx) => {
              const isLast = idx === breakdown.dimensions.length - 1;
              const prefix = isLast ? '└─' : '├─';
              const problemIndicator = dim.status === 'critical' || dim.status === 'warning' ? ' ← problema aqui!' : '';

              return (
                <div key={dim.dimension} className={dim.status === 'critical' || dim.status === 'warning' ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                  {prefix} {dim.label}: <span className="font-bold">{dim.score.toFixed(1)}%</span>{problemIndicator}
                </div>
              );
            })}
          </div>
        </pre>
      </div>
    </div>
  );
}
