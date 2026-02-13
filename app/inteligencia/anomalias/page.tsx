'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle,
  Eye,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnomalies } from '@/hooks/usePrediction';
import { AnomalyStatus, AnomalySeverity, AnomalyType } from '@/lib/types/prediction';

// Traducoes para tipos
const translateEntityType = (type: string): string => {
  const translations: Record<string, string> = {
    'organization': 'Organizacao',
    'store': 'Loja',
    'product': 'Produto',
    'category': 'Categoria',
  };
  return translations[type] || type;
};

const translateMetricType = (type: string): string => {
  const translations: Record<string, string> = {
    'loss_rate': 'Taxa de Perda',
    'loss_value': 'Valor de Perda',
    'loss_quantity': 'Qtd. Perdida',
    'rupture_rate': 'Taxa de Ruptura',
    'expiry_rate': 'Taxa de Vencimento',
    'sales': 'Vendas',
    'demand': 'Demanda',
    'inventory': 'Estoque',
  };
  return translations[type] || type;
};

const translateAnomalyType = (type: string): string => {
  const translations: Record<string, string> = {
    'spike': 'Pico',
    'drop': 'Queda',
    'trend_change': 'Mudanca de Tendencia',
    'seasonality_break': 'Quebra Sazonal',
    'outlier': 'Valor Atipico',
  };
  return translations[type] || type;
};

export default function AnomaliasPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | undefined>('open');
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | undefined>();
  const { anomalies, summary, loading, error, fetchAnomalies, fetchSummary, updateStatus, detectAnomalies } = useAnomalies({ status: statusFilter, severity: severityFilter });
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      fetchAnomalies();
      fetchSummary();
    }
  }, [firebaseUser, fetchAnomalies, fetchSummary]);

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      await detectAnomalies('store', 'loss_rate', 3.0);
      fetchAnomalies();
      fetchSummary();
    } finally {
      setIsDetecting(false);
    }
  };

  const handleStatusChange = async (id: string, status: AnomalyStatus) => {
    await updateStatus(id, status);
  };

  const severityColors: Record<AnomalySeverity, string> = {
    critical: 'bg-[#BF092F] text-white',
    high: 'bg-[#FF9800] text-white',
    medium: 'bg-[#F57C00] text-white',
    low: 'bg-[#757575] text-white',
  };

  const severityLabels: Record<AnomalySeverity, string> = {
    critical: 'Critico',
    high: 'Alto',
    medium: 'Medio',
    low: 'Baixo',
  };

  const statusFilters: { value: AnomalyStatus | undefined; label: string }[] = [
    { value: 'open', label: 'Abertas' },
    { value: 'investigating', label: 'Investigando' },
    { value: 'resolved', label: 'Resolvidas' },
    { value: 'false_positive', label: 'Falsos Positivos' },
    { value: undefined, label: 'Todas' },
  ];

  const severityFilters: { value: AnomalySeverity | undefined; label: string }[] = [
    { value: undefined, label: 'Todas' },
    { value: 'critical', label: 'Criticas' },
    { value: 'high', label: 'Altas' },
    { value: 'medium', label: 'Medias' },
    { value: 'low', label: 'Baixas' },
  ];

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#BF092F] via-[#8B0000] to-[#8B0000] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/inteligencia')}
                className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 transition-all"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Anomalias
                </h1>
                <p className="text-[#FFCDD2] text-base font-medium mt-2">
                  Deteccao de padroes anormais e alertas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDetect}
                disabled={loading || isDetecting}
                className="inline-flex items-center gap-2 bg-white text-[#BF092F] px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <Search className={`w-5 h-5 ${isDetecting ? 'animate-pulse' : ''}`} />
                {isDetecting ? 'Detectando...' : 'Detectar Anomalias'}
              </button>
              <button
                onClick={() => { fetchAnomalies(); fetchSummary(); }}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        {/* Summary Cards */}
        {summary.length > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {summary.map((s) => (
              <div key={`${s.anomalyType}-${s.severity}`} className={`rounded-xl shadow-lg p-4 ${severityColors[s.severity]}`}>
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-6 h-6 opacity-80" />
                  <span className="text-3xl font-bold">{s.count}</span>
                </div>
                <p className="text-sm opacity-90">{severityLabels[s.severity]}</p>
                <p className="text-xs opacity-70">{translateAnomalyType(s.anomalyType)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <span className="flex items-center text-sm font-medium text-[#757575] mr-2">Status:</span>
            {statusFilters.map((filter) => (
              <button
                key={filter.label}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  statusFilter === filter.value
                    ? 'bg-gradient-to-r from-[#BF092F] to-[#8B0000] text-white shadow-lg'
                    : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="flex items-center text-sm font-medium text-[#757575] mr-2">Severidade:</span>
            {severityFilters.map((filter) => (
              <button
                key={filter.label}
                onClick={() => setSeverityFilter(filter.value)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  severityFilter === filter.value
                    ? 'bg-gradient-to-r from-[#BF092F] to-[#8B0000] text-white shadow-lg'
                    : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && anomalies.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#8B0000] mb-6 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Carregando anomalias...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
            <button
              onClick={() => fetchAnomalies()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#8B0000] text-white px-6 py-3 rounded-xl font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && anomalies.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4CAF50]/10 text-[#4CAF50] mb-6">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma anomalia encontrada</p>
            <p className="text-[#757575] mb-6">Execute a deteccao ou altere os filtros</p>
            <button
              onClick={handleDetect}
              disabled={isDetecting}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#BF092F] to-[#8B0000] text-white px-6 py-3 rounded-xl font-bold"
            >
              <Search className="w-5 h-5" />
              Detectar Anomalias
            </button>
          </div>
        )}

        {/* Anomalies List */}
        {!loading && !error && anomalies.length > 0 && (
          <div className="space-y-4">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg ${severityColors[anomaly.severity]}`}>
                          {severityLabels[anomaly.severity]}
                        </span>
                        <span className="px-3 py-1 text-xs font-bold rounded-lg bg-[#16476A]/10 text-[#16476A]">
                          {translateAnomalyType(anomaly.anomalyType)}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                          anomaly.status === 'resolved' ? 'bg-[#4CAF50]/10 text-[#4CAF50]' :
                          anomaly.status === 'investigating' ? 'bg-[#FF9800]/10 text-[#FF9800]' :
                          anomaly.status === 'false_positive' ? 'bg-[#757575]/10 text-[#757575]' :
                          'bg-[#BF092F]/10 text-[#BF092F]'
                        }`}>
                          {anomaly.status === 'resolved' ? 'Resolvida' :
                           anomaly.status === 'investigating' ? 'Investigando' :
                           anomaly.status === 'false_positive' ? 'Falso Positivo' : 'Aberta'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-[#212121] mb-2">
                        {anomaly.entityName || anomaly.entityId}
                      </h3>
                      <p className="text-[#757575] mb-3">
                        {translateEntityType(anomaly.entityType)} - {translateMetricType(anomaly.metricType)}
                      </p>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#757575]">Valor:</span>
                          <span className="text-lg font-bold text-[#BF092F]">{formatNumber(anomaly.actualValue)}</span>
                          {anomaly.actualValue > anomaly.expectedValue ? (
                            <TrendingUp className="w-4 h-4 text-[#BF092F]" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-[#4CAF50]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#757575]">Esperado:</span>
                          <span className="text-lg font-bold text-[#757575]">{formatNumber(anomaly.expectedValue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#757575]">Desvio:</span>
                          <span className="text-lg font-bold text-[#16476A]">{formatNumber(anomaly.deviation)}σ</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#757575] mt-2">
                        Detectado em {formatDate(anomaly.detectedAt)}
                      </p>
                    </div>

                    {anomaly.status === 'open' && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleStatusChange(anomaly.id, 'investigating')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#FF9800] text-white rounded-xl font-bold hover:bg-[#F57C00] transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          Investigar
                        </button>
                        <button
                          onClick={() => handleStatusChange(anomaly.id, 'false_positive')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#757575] text-white rounded-xl font-bold hover:bg-[#616161] transition-all"
                        >
                          <XCircle className="w-4 h-4" />
                          Falso Positivo
                        </button>
                      </div>
                    )}

                    {anomaly.status === 'investigating' && (
                      <button
                        onClick={() => handleStatusChange(anomaly.id, 'resolved')}
                        className="flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-xl font-bold hover:bg-[#388E3C] transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
