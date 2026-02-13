'use client';

import { Prediction, PredictionAccuracy, PredictionType } from '@/lib/types/prediction';
import { TrendingUp, TrendingDown, Minus, Target, BarChart3, Calendar } from 'lucide-react';

interface PredictionChartProps {
  predictions: Prediction[];
  showConfidence?: boolean;
}

export function PredictionChart({ predictions, showConfidence = true }: PredictionChartProps) {
  if (predictions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>Nenhuma predição disponível</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(date));
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
    }).format(value);
  };

  // Find min/max for scaling
  const values = predictions.flatMap((p) => [
    p.predictedValue,
    p.confidenceLower || p.predictedValue,
    p.confidenceUpper || p.predictedValue,
    p.actualValue || p.predictedValue,
  ]);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.1;
  const range = maxValue - minValue;

  const getY = (value: number) => {
    return ((maxValue - value) / range) * 200;
  };

  // Create SVG path for predictions
  const predictionPath = predictions
    .map((p, i) => {
      const x = (i / (predictions.length - 1)) * 100;
      const y = getY(p.predictedValue);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Create confidence area
  const confidenceArea = showConfidence
    ? [
        ...predictions.map((p, i) => {
          const x = (i / (predictions.length - 1)) * 100;
          const y = getY(p.confidenceUpper || p.predictedValue);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }),
        ...predictions
          .slice()
          .reverse()
          .map((p, i) => {
            const x = ((predictions.length - 1 - i) / (predictions.length - 1)) * 100;
            const y = getY(p.confidenceLower || p.predictedValue);
            return `L ${x} ${y}`;
          }),
        'Z',
      ].join(' ')
    : '';

  // Create actual values path
  const actualPath = predictions
    .filter((p) => p.actualValue !== undefined)
    .map((p, i, arr) => {
      const origIndex = predictions.indexOf(p);
      const x = (origIndex / (predictions.length - 1)) * 100;
      const y = getY(p.actualValue!);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className="bg-white p-4 rounded-lg border">
      {/* Chart */}
      <div className="relative h-52 mb-4">
        <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          <g className="text-gray-200">
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={(y / 100) * 200}
                x2="100"
                y2={(y / 100) * 200}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Confidence area */}
          {showConfidence && confidenceArea && (
            <path d={confidenceArea} fill="rgba(59, 130, 246, 0.1)" />
          )}

          {/* Prediction line */}
          <path
            d={predictionPath}
            fill="none"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Actual values line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="rgb(16, 185, 129)"
              strokeWidth="2"
              strokeDasharray="4,4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Points */}
          {predictions.map((p, i) => {
            const x = (i / (predictions.length - 1)) * 100;
            const y = getY(p.predictedValue);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="rgb(59, 130, 246)"
                className="cursor-pointer hover:r-4"
              />
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 px-2">
        {predictions.filter((_, i) => i % Math.ceil(predictions.length / 5) === 0 || i === predictions.length - 1).map((p, i) => (
          <span key={i}>{formatDate(p.targetDate)}</span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span className="text-gray-600">Predição</span>
        </div>
        {showConfidence && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded" />
            <span className="text-gray-600">Intervalo de Confiança</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500 border-dashed" style={{ borderStyle: 'dashed' }} />
          <span className="text-gray-600">Valor Real</span>
        </div>
      </div>
    </div>
  );
}

// Accuracy metrics
interface AccuracyMetricsProps {
  accuracy: PredictionAccuracy[];
}

export function AccuracyMetrics({ accuracy }: AccuracyMetricsProps) {
  if (accuracy.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Sem dados de acurácia</p>
      </div>
    );
  }

  const latestAccuracy = accuracy[0];
  const avgAccuracy = accuracy.reduce((sum, a) => sum + (a.accuracyRate || 0), 0) / accuracy.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-600">Acurácia Atual</p>
        <p className="text-2xl font-bold text-blue-700">
          {latestAccuracy.accuracyRate
            ? `${(latestAccuracy.accuracyRate * 100).toFixed(1)}%`
            : 'N/A'}
        </p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-sm text-green-600">Média Histórica</p>
        <p className="text-2xl font-bold text-green-700">
          {avgAccuracy ? `${(avgAccuracy * 100).toFixed(1)}%` : 'N/A'}
        </p>
      </div>
      <div className="bg-yellow-50 p-4 rounded-lg">
        <p className="text-sm text-yellow-600">MAE</p>
        <p className="text-2xl font-bold text-yellow-700">
          {latestAccuracy.meanAbsoluteError?.toFixed(2) || 'N/A'}
        </p>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg">
        <p className="text-sm text-purple-600">Predições Avaliadas</p>
        <p className="text-2xl font-bold text-purple-700">
          {latestAccuracy.evaluatedPredictions}
        </p>
      </div>
    </div>
  );
}

// Prediction card for single entity
interface PredictionCardProps {
  prediction: Prediction;
  entityName?: string;
}

export function PredictionCard({ prediction, entityName }: PredictionCardProps) {
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const hasActual = prediction.actualValue !== undefined;
  const error = hasActual ? prediction.actualValue! - prediction.predictedValue : null;
  const errorPercent = hasActual
    ? (error! / prediction.predictedValue) * 100
    : null;

  const getTrendIcon = () => {
    if (!hasActual) return <Minus className="w-5 h-5 text-gray-400" />;
    if (error! > 0) return <TrendingUp className="w-5 h-5 text-red-500" />;
    if (error! < 0) return <TrendingDown className="w-5 h-5 text-green-500" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const predictionTypeLabels: Record<PredictionType, string> = {
    risk_score: 'Score de Risco',
    demand_quantity: 'Demanda',
    loss_amount: 'Perdas',
    loss_volume: 'Volume de Perdas',
    loss_value: 'Valor de Perdas',
    expiry_count: 'Vencimentos',
    expiry_risk: 'Risco de Vencimento',
    demand: 'Demanda',
    rupture_probability: 'Prob. Ruptura',
  };

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-gray-500">
            {predictionTypeLabels[prediction.predictionType]}
          </p>
          {entityName && (
            <p className="font-medium text-gray-900">{entityName}</p>
          )}
        </div>
        {getTrendIcon()}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-sm text-gray-500">Predição</p>
          <p className="text-xl font-bold text-blue-600">
            {formatValue(prediction.predictedValue)}
          </p>
        </div>
        {hasActual && (
          <div>
            <p className="text-sm text-gray-500">Real</p>
            <p className="text-xl font-bold text-green-600">
              {formatValue(prediction.actualValue!)}
            </p>
          </div>
        )}
      </div>

      {/* Confidence interval */}
      {prediction.confidenceLower !== undefined && prediction.confidenceUpper !== undefined && (
        <div className="text-sm text-gray-500 mb-3">
          Intervalo ({Math.round(prediction.confidenceLevel * 100)}%): {formatValue(prediction.confidenceLower)} - {formatValue(prediction.confidenceUpper)}
        </div>
      )}

      {/* Error info */}
      {hasActual && (
        <div
          className={`text-sm ${
            Math.abs(errorPercent!) <= 10
              ? 'text-green-600'
              : Math.abs(errorPercent!) <= 25
              ? 'text-yellow-600'
              : 'text-red-600'
          }`}
        >
          Erro: {errorPercent! > 0 ? '+' : ''}{errorPercent!.toFixed(1)}%
        </div>
      )}

      {/* Date info */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t text-sm text-gray-500">
        <Calendar className="w-4 h-4" />
        <span>Alvo: {formatDate(prediction.targetDate)}</span>
        <span className="text-gray-300 mx-1">|</span>
        <span>Horizonte: {prediction.horizonDays} dias</span>
      </div>
    </div>
  );
}

// Predictions list
interface PredictionsListProps {
  predictions: Prediction[];
  title?: string;
}

export function PredictionsList({ predictions, title = 'Próximas Predições' }: PredictionsListProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(date));
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(value);
  };

  const predictionTypeLabels: Record<PredictionType, string> = {
    risk_score: 'Risco',
    demand_quantity: 'Demanda',
    loss_amount: 'Perda',
    loss_volume: 'Vol. Perda',
    loss_value: 'Valor Perda',
    expiry_count: 'Vencimento',
    expiry_risk: 'Risco Venc.',
    demand: 'Demanda',
    rupture_probability: 'Ruptura',
  };

  if (predictions.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p className="text-sm">Nenhuma predição disponível</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-medium text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {predictions.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{formatDate(p.targetDate)}</span>
              <span className="text-sm font-medium text-gray-700">
                {predictionTypeLabels[p.predictionType]}
              </span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-blue-600">
                {formatValue(p.predictedValue)}
              </span>
              {p.confidenceLevel && (
                <span className="text-xs text-gray-500 ml-2">
                  ({Math.round(p.confidenceLevel * 100)}%)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
