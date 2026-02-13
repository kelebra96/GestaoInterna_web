'use client';

import { useState } from 'react';
import {
  Recommendation,
  RecommendationStatus,
  RECOMMENDATION_TYPE_CONFIG,
  PRIORITY_CONFIG,
} from '@/lib/types/prediction';
import {
  Package,
  Tag,
  ArrowLeftRight,
  Search,
  Settings,
  Truck,
  Box,
  GraduationCap,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Package,
  Tag,
  ArrowLeftRight,
  Search,
  Settings,
  Truck,
  Box,
  GraduationCap,
  ClipboardCheck,
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  onUpdateStatus?: (id: string, status: RecommendationStatus, notes?: string) => Promise<boolean>;
  onFeedback?: (id: string, type: 'helpful' | 'not_helpful') => Promise<boolean>;
  expanded?: boolean;
}

export function RecommendationCard({
  recommendation,
  onUpdateStatus,
  onFeedback,
  expanded: initialExpanded = false,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const typeConfig = RECOMMENDATION_TYPE_CONFIG[recommendation.recommendationType];
  const priorityConfig = PRIORITY_CONFIG[recommendation.priority];
  const IconComponent = ICON_MAP[typeConfig.icon] || AlertCircle;

  const handleStatusUpdate = async (status: RecommendationStatus) => {
    if (!onUpdateStatus) return;
    setLoading(true);
    await onUpdateStatus(recommendation.id, status, notes);
    setLoading(false);
  };

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (!onFeedback) return;
    await onFeedback(recommendation.id, type);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  };

  const isActionable = ['pending', 'viewed'].includes(recommendation.status);

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`p-2 rounded-lg bg-${typeConfig.color}-100`}
            style={{ backgroundColor: `var(--${typeConfig.color}-100, #f0f9ff)` }}
          >
            <IconComponent className={`w-5 h-5 text-${typeConfig.color}-600`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityConfig.bgColor} ${priorityConfig.color}`}
              >
                {priorityConfig.label}
              </span>
              <span className="text-xs text-gray-500">{typeConfig.label}</span>
            </div>
            <h3 className="font-medium text-gray-900 truncate">
              {recommendation.title}
            </h3>
            {recommendation.entityName && (
              <p className="text-sm text-gray-500">{recommendation.entityName}</p>
            )}
          </div>

          {/* Impact */}
          <div className="text-right">
            {recommendation.estimatedSavings && (
              <p className="text-sm font-medium text-green-600">
                {formatCurrency(recommendation.estimatedSavings)}
              </p>
            )}
            {recommendation.confidenceScore && (
              <p className="text-xs text-gray-500">
                {Math.round(recommendation.confidenceScore * 100)}% confiança
              </p>
            )}
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
          {/* Description */}
          <div className="py-3">
            <p className="text-sm text-gray-700">{recommendation.description}</p>
            {recommendation.rationale && (
              <p className="mt-2 text-sm text-gray-600 italic">
                {recommendation.rationale}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 py-3 border-t text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Criado em {formatDate(recommendation.createdAt)}</span>
            </div>
            {recommendation.actionDeadline && (
              <div className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span>Prazo: {formatDate(recommendation.actionDeadline)}</span>
              </div>
            )}
            {recommendation.estimatedLossReduction && (
              <div>
                <span className="text-green-600">
                  -{recommendation.estimatedLossReduction}% perdas
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {isActionable && onUpdateStatus && (
            <div className="pt-3 border-t">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStatusUpdate('accepted')}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aceitar
                </button>
                <button
                  onClick={() => handleStatusUpdate('rejected')}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </button>
                {recommendation.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate('viewed')}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    Marcar como visto
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="mt-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicionar observações..."
                  className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Feedback */}
          {!isActionable && onFeedback && (
            <div className="pt-3 border-t">
              <p className="text-sm text-gray-600 mb-2">Esta recomendação foi útil?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback('helpful')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Sim
                </button>
                <button
                  onClick={() => handleFeedback('not_helpful')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Não
                </button>
              </div>
            </div>
          )}

          {/* Status badge */}
          {!isActionable && (
            <div className="pt-3 border-t">
              <StatusBadge status={recommendation.status} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: RecommendationStatus }) {
  const config: Record<RecommendationStatus, { label: string; className: string }> = {
    pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    viewed: { label: 'Visualizado', className: 'bg-blue-100 text-blue-800' },
    accepted: { label: 'Aceito', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejeitado', className: 'bg-red-100 text-red-800' },
    completed: { label: 'Concluído', className: 'bg-gray-100 text-gray-800' },
    expired: { label: 'Expirado', className: 'bg-gray-100 text-gray-500' },
  };

  const { label, className } = config[status];

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}

// List component
interface RecommendationListProps {
  recommendations: Recommendation[];
  onUpdateStatus?: (id: string, status: RecommendationStatus, notes?: string) => Promise<boolean>;
  onFeedback?: (id: string, type: 'helpful' | 'not_helpful') => Promise<boolean>;
  emptyMessage?: string;
}

export function RecommendationList({
  recommendations,
  onUpdateStatus,
  onFeedback,
  emptyMessage = 'Nenhuma recomendação encontrada',
}: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          onUpdateStatus={onUpdateStatus}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
}

// Summary cards
interface RecommendationSummaryProps {
  pending: number;
  potentialSavings: number;
  acceptedThisWeek: number;
  completedThisMonth: number;
}

export function RecommendationSummary({
  pending,
  potentialSavings,
  acceptedThisWeek,
  completedThisMonth,
}: RecommendationSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-yellow-50 p-4 rounded-lg">
        <p className="text-sm text-yellow-600">Pendentes</p>
        <p className="text-2xl font-bold text-yellow-700">{pending}</p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-sm text-green-600">Economia Potencial</p>
        <p className="text-2xl font-bold text-green-700">
          {formatCurrency(potentialSavings)}
        </p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-600">Aceitas (semana)</p>
        <p className="text-2xl font-bold text-blue-700">{acceptedThisWeek}</p>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg">
        <p className="text-sm text-purple-600">Concluídas (mês)</p>
        <p className="text-2xl font-bold text-purple-700">{completedThisMonth}</p>
      </div>
    </div>
  );
}
