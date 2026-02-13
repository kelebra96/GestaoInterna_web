'use client';

import { useState } from 'react';
import {
  Anomaly,
  AnomalyStatus,
  ANOMALY_TYPE_CONFIG,
  SEVERITY_CONFIG,
} from '@/lib/types/prediction';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
  FileQuestion,
  Unlink,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
  FileQuestion,
  Unlink,
};

interface AnomalyCardProps {
  anomaly: Anomaly;
  onUpdateStatus?: (id: string, status: AnomalyStatus, notes?: string) => Promise<boolean>;
  expanded?: boolean;
}

export function AnomalyCard({
  anomaly,
  onUpdateStatus,
  expanded: initialExpanded = false,
}: AnomalyCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const typeConfig = ANOMALY_TYPE_CONFIG[anomaly.anomalyType];
  const severityConfig = SEVERITY_CONFIG[anomaly.severity];
  const IconComponent = ICON_MAP[typeConfig.icon] || AlertTriangle;

  const handleStatusUpdate = async (status: AnomalyStatus) => {
    if (!onUpdateStatus) return;
    setLoading(true);
    await onUpdateStatus(anomaly.id, status, notes);
    setLoading(false);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const deviation = anomaly.expectedValue
    ? ((anomaly.detectedValue - anomaly.expectedValue) / anomaly.expectedValue) * 100
    : 0;

  const isActionable = ['open', 'investigating'].includes(anomaly.status);

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Severity indicator */}
          <div
            className={`p-2 rounded-lg ${severityConfig.bgColor}`}
          >
            <IconComponent className={`w-5 h-5 ${severityConfig.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${severityConfig.bgColor} ${severityConfig.color}`}
              >
                {severityConfig.label}
              </span>
              <span className="text-xs text-gray-500">{typeConfig.label}</span>
            </div>
            <h3 className="font-medium text-gray-900">
              {typeConfig.description}
            </h3>
            {anomaly.entityName && (
              <p className="text-sm text-gray-500">
                {anomaly.entityType}: {anomaly.entityName}
              </p>
            )}
          </div>

          {/* Deviation */}
          <div className="text-right">
            <p className={`text-lg font-bold ${deviation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {deviation >= 0 ? '+' : ''}{formatNumber(deviation)}%
            </p>
            <p className="text-xs text-gray-500">
              Z-score: {formatNumber(anomaly.deviationScore || 0)}
            </p>
          </div>

          {/* Expand icon */}
          <div className="text-gray-400">
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          {/* Values comparison */}
          <div className="py-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Valor Detectado</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(anomaly.detectedValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor Esperado</p>
              <p className="text-lg font-semibold text-gray-900">
                {anomaly.expectedValue ? formatNumber(anomaly.expectedValue) : '-'}
              </p>
            </div>
            {anomaly.expectedRangeLower !== undefined && anomaly.expectedRangeUpper !== undefined && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Intervalo Esperado</p>
                <p className="text-sm text-gray-700">
                  {formatNumber(anomaly.expectedRangeLower)} - {formatNumber(anomaly.expectedRangeUpper)}
                </p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 py-3 border-t text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Detectado em {formatDate(anomaly.detectedAt)}</span>
            </div>
            <div>
              <span>Métrica: {anomaly.metricType}</span>
            </div>
            {anomaly.detectionMethod && (
              <div>
                <span>Método: {anomaly.detectionMethod}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {isActionable && onUpdateStatus && (
            <div className="pt-3 border-t">
              <div className="flex flex-wrap gap-2">
                {anomaly.status === 'open' && (
                  <button
                    onClick={() => handleStatusUpdate('investigating')}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                    Investigar
                  </button>
                )}
                <button
                  onClick={() => handleStatusUpdate('resolved')}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Resolver
                </button>
                <button
                  onClick={() => handleStatusUpdate('false_positive')}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Falso Positivo
                </button>
              </div>

              {/* Notes */}
              <div className="mt-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicionar notas de resolução..."
                  className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Resolution info */}
          {!isActionable && anomaly.resolutionNotes && (
            <div className="pt-3 border-t">
              <p className="text-sm text-gray-500">Notas de resolução:</p>
              <p className="text-sm text-gray-700">{anomaly.resolutionNotes}</p>
            </div>
          )}

          {/* Status badge */}
          {!isActionable && (
            <div className="pt-3 border-t">
              <AnomalyStatusBadge status={anomaly.status} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnomalyStatusBadge({ status }: { status: AnomalyStatus }) {
  const config: Record<AnomalyStatus, { label: string; className: string }> = {
    open: { label: 'Aberto', className: 'bg-red-100 text-red-800' },
    investigating: { label: 'Investigando', className: 'bg-yellow-100 text-yellow-800' },
    resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-800' },
    false_positive: { label: 'Falso Positivo', className: 'bg-gray-100 text-gray-600' },
  };

  const { label, className } = config[status];

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}

// List component
interface AnomalyListProps {
  anomalies: Anomaly[];
  onUpdateStatus?: (id: string, status: AnomalyStatus, notes?: string) => Promise<boolean>;
  emptyMessage?: string;
}

export function AnomalyList({
  anomalies,
  onUpdateStatus,
  emptyMessage = 'Nenhuma anomalia encontrada',
}: AnomalyListProps) {
  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => (
        <AnomalyCard
          key={anomaly.id}
          anomaly={anomaly}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
}

// Summary component
interface AnomalySummaryCardsProps {
  open: number;
  investigating: number;
  critical: number;
  resolvedToday: number;
}

export function AnomalySummaryCards({
  open,
  investigating,
  critical,
  resolvedToday,
}: AnomalySummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-red-50 p-4 rounded-lg">
        <p className="text-sm text-red-600">Abertas</p>
        <p className="text-2xl font-bold text-red-700">{open}</p>
      </div>
      <div className="bg-yellow-50 p-4 rounded-lg">
        <p className="text-sm text-yellow-600">Em Investigação</p>
        <p className="text-2xl font-bold text-yellow-700">{investigating}</p>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg">
        <p className="text-sm text-purple-600">Críticas</p>
        <p className="text-2xl font-bold text-purple-700">{critical}</p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-sm text-green-600">Resolvidas Hoje</p>
        <p className="text-2xl font-bold text-green-700">{resolvedToday}</p>
      </div>
    </div>
  );
}
