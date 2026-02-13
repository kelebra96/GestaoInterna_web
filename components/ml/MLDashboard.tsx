'use client';

import { useEffect } from 'react';
import { useMLDashboard } from '@/hooks/usePrediction';
import { RecommendationList, RecommendationSummary } from './RecommendationCard';
import { AnomalyList, AnomalySummaryCards } from './AnomalyCard';
import { ClusterSummaryView } from './ClusterVisualization';
import { PredictionsList, AccuracyMetrics } from './PredictionChart';
import {
  Brain,
  Lightbulb,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  Settings,
} from 'lucide-react';

interface MLDashboardProps {
  onNavigate?: (section: string) => void;
}

export function MLDashboard({ onNavigate }: MLDashboardProps) {
  const { dashboard, loading, error, fetchDashboard } = useMLDashboard();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  const pendingRecCount = dashboard.recommendations.pending.reduce(
    (sum, p) => sum + p.count,
    0
  );
  const potentialSavings = dashboard.recommendations.pending.reduce(
    (sum, p) => sum + (p.totalPotentialSavings || 0),
    0
  );
  const openAnomalies = dashboard.anomalies.open.reduce(
    (sum, a) => sum + a.count,
    0
  );
  const criticalAnomalies = dashboard.anomalies.open
    .filter((a) => a.severity === 'critical')
    .reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inteligência & Predição
            </h1>
            <p className="text-gray-500">
              Insights automáticos e recomendações baseadas em ML
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => onNavigate?.('settings')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard
          icon={<Lightbulb className="w-5 h-5 text-yellow-600" />}
          label="Recomendações Pendentes"
          value={pendingRecCount}
          bgColor="bg-yellow-50"
          onClick={() => onNavigate?.('recommendations')}
        />
        <QuickStatCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          label="Economia Potencial"
          value={formatCurrency(potentialSavings)}
          bgColor="bg-green-50"
        />
        <QuickStatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="Anomalias Abertas"
          value={openAnomalies}
          subValue={criticalAnomalies > 0 ? `${criticalAnomalies} críticas` : undefined}
          bgColor="bg-red-50"
          onClick={() => onNavigate?.('anomalies')}
        />
        <QuickStatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Clusters Ativos"
          value={
            dashboard.clusters.stores.length +
            dashboard.clusters.products.length
          }
          bgColor="bg-blue-50"
          onClick={() => onNavigate?.('clusters')}
        />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recommendations section */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h2 className="font-semibold text-gray-900">Recomendações</h2>
            </div>
            <button
              onClick={() => onNavigate?.('recommendations')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todas
            </button>
          </div>
          <RecommendationList
            recommendations={dashboard.recommendations.recent.slice(0, 3)}
            emptyMessage="Nenhuma recomendação recente"
          />
        </div>

        {/* Anomalies section */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-gray-900">Anomalias Recentes</h2>
            </div>
            <button
              onClick={() => onNavigate?.('anomalies')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todas
            </button>
          </div>
          <AnomalyList
            anomalies={dashboard.anomalies.recent.slice(0, 3)}
            emptyMessage="Nenhuma anomalia detectada"
          />
        </div>
      </div>

      {/* Clusters section */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Clusters</h2>
          </div>
          <button
            onClick={() => onNavigate?.('clusters')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Ver detalhes
          </button>
        </div>
        <ClusterSummaryView
          storeClusters={dashboard.clusters.stores}
          productClusters={dashboard.clusters.products}
          onViewDetails={(type) => onNavigate?.(`clusters/${type}`)}
        />
      </div>

      {/* Predictions and Events grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Predictions section */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Predições</h2>
            </div>
            <button
              onClick={() => onNavigate?.('predictions')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todas
            </button>
          </div>
          <PredictionsList predictions={dashboard.predictions.upcoming} />
          {dashboard.predictions.accuracy.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Acurácia dos Modelos</p>
              <AccuracyMetrics accuracy={dashboard.predictions.accuracy.slice(0, 1)} />
            </div>
          )}
        </div>

        {/* Events section */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-900">Próximos Eventos</h2>
            </div>
            <button
              onClick={() => onNavigate?.('seasonality')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver calendário
            </button>
          </div>
          <EventsList events={dashboard.seasonality.upcomingEvents} />
        </div>
      </div>

      {/* Seasonal patterns */}
      {dashboard.seasonality.activePatterns.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            <h2 className="font-semibold text-gray-900">
              Padrões Sazonais Detectados
            </h2>
          </div>
          <PatternsList patterns={dashboard.seasonality.activePatterns} />
        </div>
      )}
    </div>
  );
}

// Quick stat card
interface QuickStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  bgColor: string;
  onClick?: () => void;
}

function QuickStatCard({
  icon,
  label,
  value,
  subValue,
  bgColor,
  onClick,
}: QuickStatCardProps) {
  return (
    <div
      className={`${bgColor} p-4 rounded-lg ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subValue && <p className="text-sm text-gray-500">{subValue}</p>}
    </div>
  );
}

// Events list
interface EventsListProps {
  events: Array<{
    id: string;
    eventName: string;
    eventType: string;
    eventDate?: Date;
    impactFactor: number;
  }>;
}

function EventsList({ events }: EventsListProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(date));
  };

  const typeColors: Record<string, string> = {
    holiday: 'bg-red-100 text-red-700',
    promotion: 'bg-green-100 text-green-700',
    season: 'bg-blue-100 text-blue-700',
    custom: 'bg-gray-100 text-gray-700',
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p className="text-sm">Nenhum evento próximo</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.slice(0, 5).map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            {event.eventDate && (
              <span className="text-sm text-gray-500">
                {formatDate(event.eventDate)}
              </span>
            )}
            <span className="font-medium text-gray-700">{event.eventName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                typeColors[event.eventType] || typeColors.custom
              }`}
            >
              {event.eventType}
            </span>
            {event.impactFactor !== 1 && (
              <span className="text-sm text-gray-500">
                x{event.impactFactor.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Patterns list
interface PatternsListProps {
  patterns: Array<{
    id: string;
    patternType: string;
    entityType: string;
    metricType: string;
    strength: number;
  }>;
}

function PatternsList({ patterns }: PatternsListProps) {
  const patternLabels: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual',
    holiday: 'Feriado',
    event: 'Evento',
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {patterns.slice(0, 6).map((pattern) => (
        <div key={pattern.id} className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {patternLabels[pattern.patternType] || pattern.patternType}
            </span>
            <span className="text-sm text-gray-500">
              {(pattern.strength * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {pattern.entityType} - {pattern.metricType}
          </p>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${pattern.strength * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper function
function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
}
