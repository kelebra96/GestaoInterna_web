'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Lightbulb,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  Settings,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Upload,
  Package,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMLDashboard } from '@/hooks/usePrediction';

// Design System Colors
const COLORS = {
  primary: '#16476A',
  primaryLight: '#3B7FAD',
  teal: '#3B9797',
  warning: '#F59E0B',
  warningDark: '#D97706',
  error: '#BF092F',
  errorDark: '#9A0726',
  success: '#3B9797',
  successDark: '#2D7575',
  text: {
    primary: '#212121',
    secondary: '#757575',
    muted: '#9E9E9E',
  },
  background: {
    primary: '#F8F9FA',
    secondary: '#E9ECEF',
    card: '#FFFFFF',
  },
  border: '#E0E0E0',
};

export default function InteligenciaPage() {
  const router = useRouter();
  const { firebaseUser, user } = useAuth();
  const { dashboard, loading, error, fetchDashboard } = useMLDashboard();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Executar análise ML manualmente
  const runAnalysis = async () => {
    if (!firebaseUser) return;

    setIsAnalyzing(true);
    try {
      const token = await firebaseUser.getIdToken(true);
      const userRecord = user as unknown as Record<string, unknown>;
      const userPayload = {
        userId: firebaseUser.uid,
        orgId: userRecord?.companyId || userRecord?.storeId || '',
        role: userRecord?.role || 'store_user',
        storeIds: [],
      };

      const response = await fetch('/api/ml/analyze', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-payload': JSON.stringify(userPayload),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          type: 'success',
          message: `Análise concluída: ${data.data.recommendationsCreated} recomendações, ${data.data.anomaliesDetected} anomalias`,
        });
        // Recarregar dashboard
        fetchDashboard();
      } else {
        setToast({
          type: 'error',
          message: data.error || 'Erro ao executar análise',
        });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao executar análise',
      });
    } finally {
      setIsAnalyzing(false);
    }

    // Limpar toast após 5s
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchDashboard();
    }
  }, [firebaseUser, fetchDashboard]);

  const handleNavigate = (section: string) => {
    router.push(`/inteligencia/${section}`);
  };

  // Calculated values
  const pendingRecCount = dashboard?.recommendations?.pending?.reduce(
    (sum, p) => sum + p.count,
    0
  ) || 0;
  const potentialSavings = dashboard?.recommendations?.pending?.reduce(
    (sum, p) => sum + (p.totalPotentialSavings || 0),
    0
  ) || 0;
  const openAnomalies = dashboard?.anomalies?.open?.reduce(
    (sum, a) => sum + a.count,
    0
  ) || 0;
  const criticalAnomalies = dashboard?.anomalies?.open
    ?.filter((a) => a.severity === 'critical')
    ?.reduce((sum, a) => sum + a.count, 0) || 0;
  const totalClusters = (dashboard?.clusters?.stores?.length || 0) +
    (dashboard?.clusters?.products?.length || 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(date));
  };

  const translatePredictionType = (type: string): string => {
    const translations: Record<string, string> = {
      'loss_amount': 'Valor de Perdas',
      'loss_volume': 'Volume de Perdas',
      'risk_score': 'Score de Risco',
      'demand_quantity': 'Demanda',
      'expiry_count': 'Vencimentos',
      'rupture_probability': 'Prob. Ruptura',
      'expiry_risk': 'Risco Vencimento',
      'demand': 'Demanda',
    };
    return translations[type] || type;
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-gradient-to-r from-[#3B9797] to-[#2D7575]' : 'bg-gradient-to-r from-[#BF092F] to-[#9A0726]'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <Brain className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Inteligencia & ML
                  </h1>
                  <p className="text-[#E0E7EF] text-base font-medium mt-2">
                    Insights automaticos e recomendacoes baseadas em Machine Learning
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => handleNavigate('produtos')}
                  className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#16476A] px-5 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <Package className="w-5 h-5" />
                  Analise Produtos
                </button>
                <button
                  onClick={() => handleNavigate('importar')}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
                >
                  <Upload className="w-5 h-5" />
                  Importar
                </button>
                <button
                  onClick={() => handleNavigate('importar-varejo')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#2D7575] hover:from-[#2D7575] hover:to-[#1F5555] text-white px-5 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <FileText className="w-5 h-5" />
                  Importar Varejo
                </button>
                <button
                  onClick={runAnalysis}
                  disabled={isAnalyzing || loading}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
                >
                  <Brain className={`w-5 h-5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                  {isAnalyzing ? 'Analisando...' : 'Gerar Analise'}
                </button>
                <button
                  onClick={() => handleNavigate('configuracoes')}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
                >
                  <Settings className="w-5 h-5" />
                  Configurar
                </button>
                <button
                  onClick={fetchDashboard}
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        {/* Loading State */}
        {loading && !dashboard && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Carregando dados de ML...</p>
            <p className="text-sm text-[#757575] mt-2">Aguarde enquanto processamos os insights</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#BF092F] mb-6">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
            <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar os dados</p>
            <button
              onClick={fetchDashboard}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && !error && dashboard && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Lightbulb className="w-6 h-6 text-white" />}
                label="Recomendacoes Pendentes"
                value={pendingRecCount}
                bgGradient="from-[#F59E0B] to-[#D97706]"
                onClick={() => handleNavigate('recomendacoes')}
              />
              <StatCard
                icon={<TrendingUp className="w-6 h-6 text-white" />}
                label="Economia Potencial"
                value={formatCurrency(potentialSavings)}
                bgGradient="from-[#3B9797] to-[#2D7575]"
              />
              <StatCard
                icon={<AlertTriangle className="w-6 h-6 text-white" />}
                label="Anomalias Abertas"
                value={openAnomalies}
                subValue={criticalAnomalies > 0 ? `${criticalAnomalies} criticas` : undefined}
                bgGradient="from-[#BF092F] to-[#9A0726]"
                onClick={() => handleNavigate('anomalias')}
              />
              <StatCard
                icon={<Users className="w-6 h-6 text-white" />}
                label="Clusters Ativos"
                value={totalClusters}
                bgGradient="from-[#16476A] to-[#3B7FAD]"
                onClick={() => handleNavigate('clusters')}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recommendations */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Recomendacoes
                    </h2>
                    <button
                      onClick={() => handleNavigate('recomendacoes')}
                      className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      Ver todas <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {dashboard.recommendations.recent.length === 0 ? (
                    <EmptyState message="Nenhuma recomendacao recente" icon={<Lightbulb />} />
                  ) : (
                    <div className="space-y-3">
                      {dashboard.recommendations.recent.slice(0, 3).map((rec) => (
                        <div key={rec.id} className="group p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:border-[#F59E0B]/30 hover:shadow-md transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">{rec.title}</p>
                              <p className="text-sm text-[#757575] mt-1 line-clamp-2">{rec.description}</p>
                            </div>
                            <span className={`ml-3 px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${
                              rec.priority === 'critical' ? 'bg-[#BF092F]/10 text-[#BF092F]' :
                              rec.priority === 'high' ? 'bg-[#F59E0B]/10 text-[#D97706]' :
                              rec.priority === 'medium' ? 'bg-[#3B9797]/10 text-[#3B9797]' :
                              'bg-[#757575]/10 text-[#757575]'
                            }`}>
                              {rec.priority === 'critical' ? 'Critico' :
                               rec.priority === 'high' ? 'Alto' :
                               rec.priority === 'medium' ? 'Medio' : 'Baixo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Anomalies */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#BF092F] to-[#9A0726] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Anomalias Recentes
                    </h2>
                    <button
                      onClick={() => handleNavigate('anomalias')}
                      className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      Ver todas <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {dashboard.anomalies.recent.length === 0 ? (
                    <EmptyState message="Nenhuma anomalia detectada" icon={<AlertTriangle />} />
                  ) : (
                    <div className="space-y-3">
                      {dashboard.anomalies.recent.slice(0, 3).map((anomaly) => (
                        <div key={anomaly.id} className="group p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:border-[#BF092F]/30 hover:shadow-md transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">{anomaly.entityName || 'Anomalia'}</p>
                              <p className="text-sm text-[#757575] mt-1">{translateMetricType(anomaly.metricType)} - {translateAnomalyType(anomaly.anomalyType)}</p>
                            </div>
                            <span className={`ml-3 px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${
                              anomaly.severity === 'critical' ? 'bg-[#BF092F]/10 text-[#BF092F]' :
                              anomaly.severity === 'high' ? 'bg-[#F59E0B]/10 text-[#D97706]' :
                              anomaly.severity === 'medium' ? 'bg-[#3B7FAD]/10 text-[#3B7FAD]' :
                              'bg-[#757575]/10 text-[#757575]'
                            }`}>
                              {anomaly.severity === 'critical' ? 'Critico' :
                               anomaly.severity === 'high' ? 'Alto' :
                               anomaly.severity === 'medium' ? 'Medio' : 'Baixo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clusters */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#16476A] to-[#3B7FAD] px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Clusters
                  </h2>
                  <button
                    onClick={() => handleNavigate('clusters')}
                    className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
                  >
                    Ver detalhes <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <ClusterCard
                    title="Clusters de Lojas"
                    count={dashboard.clusters.stores.length}
                    icon={<Users className="w-6 h-6" />}
                    color={COLORS.primary}
                  />
                  <ClusterCard
                    title="Clusters de Produtos"
                    count={dashboard.clusters.products.length}
                    icon={<TrendingUp className="w-6 h-6" />}
                    color={COLORS.teal}
                  />
                </div>
              </div>
            </div>

            {/* Predictions and Events */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Predictions */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#16476A] to-[#3B7FAD] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Predicoes
                    </h2>
                    <button
                      onClick={() => handleNavigate('predicoes')}
                      className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      Ver todas <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {dashboard.predictions.upcoming.length === 0 ? (
                    <EmptyState message="Nenhuma predicao disponivel" icon={<TrendingUp />} />
                  ) : (
                    <div className="space-y-3">
                      {dashboard.predictions.upcoming.slice(0, 4).map((pred) => (
                        <div key={pred.id} className="group flex items-center justify-between p-3 bg-[#F8F9FA] rounded-xl hover:bg-[#16476A]/5 transition-colors">
                          <div className="flex items-center gap-3">
                            {pred.targetDate && (
                              <span className="text-sm font-bold text-[#16476A] bg-[#16476A]/10 px-2 py-1 rounded-lg">
                                {formatDate(new Date(pred.targetDate))}
                              </span>
                            )}
                            <div>
                              <p className="font-medium text-[#212121] group-hover:text-[#16476A] transition-colors">
                                {translatePredictionType(pred.predictionType)}
                              </p>
                              <p className="text-xs text-[#757575]">
                                {translateEntityType(pred.entityType)}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-[#16476A]">
                            {pred.predictionType.includes('amount') || pred.predictionType.includes('value')
                              ? formatCurrency(pred.predictedValue)
                              : pred.predictedValue.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Events */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#3B9797] to-[#2D7575] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Proximos Eventos
                    </h2>
                    <button
                      onClick={() => handleNavigate('sazonalidade')}
                      className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      Ver calendario <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {dashboard.seasonality.upcomingEvents.length === 0 ? (
                    <EmptyState message="Nenhum evento proximo" icon={<Calendar />} />
                  ) : (
                    <div className="space-y-3">
                      {dashboard.seasonality.upcomingEvents.slice(0, 5).map((event) => (
                        <div key={event.id} className="group flex items-center justify-between p-3 bg-[#F8F9FA] rounded-xl hover:bg-[#3B9797]/5 transition-colors">
                          <div className="flex items-center gap-3">
                            {event.eventDate && (
                              <span className="text-sm font-bold text-[#3B9797] bg-[#3B9797]/10 px-2 py-1 rounded-lg">
                                {formatDate(event.eventDate)}
                              </span>
                            )}
                            <span className="font-medium text-[#212121] group-hover:text-[#16476A] transition-colors">{event.eventName}</span>
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold rounded-lg ${
                            event.eventType === 'holiday' ? 'bg-[#BF092F]/10 text-[#BF092F]' :
                            event.eventType === 'promotion' ? 'bg-[#3B9797]/10 text-[#3B9797]' :
                            event.eventType === 'season' ? 'bg-[#16476A]/10 text-[#16476A]' :
                            'bg-[#757575]/10 text-[#757575]'
                          }`}>
                            {event.eventType === 'holiday' ? 'Feriado' :
                             event.eventType === 'promotion' ? 'Promocao' :
                             event.eventType === 'season' ? 'Estacao' : event.eventType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seasonal Patterns */}
            {dashboard.seasonality.activePatterns.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#3B9797] to-[#3B7FAD] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Padroes Sazonais Detectados
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard.seasonality.activePatterns.slice(0, 6).map((pattern) => (
                      <div key={pattern.id} className="group p-4 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:border-[#3B9797]/30 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                            {pattern.patternType === 'daily' ? 'Diario' :
                             pattern.patternType === 'weekly' ? 'Semanal' :
                             pattern.patternType === 'monthly' ? 'Mensal' :
                             pattern.patternType === 'yearly' ? 'Anual' :
                             pattern.patternType}
                          </span>
                          <span className="text-sm font-bold text-[#3B9797] bg-[#3B9797]/10 px-2 py-0.5 rounded-lg">
                            {(pattern.strength * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-[#757575]">
                          {translateEntityType(pattern.entityType)} - {translateMetricType(pattern.metricType)}
                        </p>
                        <div className="mt-3 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A] rounded-full transition-all group-hover:from-[#16476A] group-hover:to-[#3B7FAD]"
                            style={{ width: `${pattern.strength * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  bgGradient: string;
  onClick?: () => void;
}

function StatCard({ icon, label, value, subValue, bgGradient, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${bgGradient} p-6 rounded-2xl shadow-xl relative overflow-hidden group ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition-all duration-300' : ''
      }`}
    >
      {/* Background pattern for depth */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
            {icon}
          </div>
        </div>
        <p className="text-white/80 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold text-white mt-1 tracking-tight">{value}</p>
        {subValue && (
          <p className="text-white/70 text-sm mt-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60" />
            {subValue}
          </p>
        )}
        {onClick && (
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="w-5 h-5 text-white/80" />
          </div>
        )}
      </div>
    </div>
  );
}

// Cluster Card Component
interface ClusterCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

function ClusterCard({ title, count, icon, color }: ClusterCardProps) {
  return (
    <div
      className="group flex items-center gap-4 p-5 bg-gradient-to-r from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:shadow-md transition-all cursor-pointer"
      style={{ borderLeftWidth: '4px', borderLeftColor: color }}
    >
      <div
        className="p-3 rounded-xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1">
        <p className="text-sm text-[#757575] font-medium">{title}</p>
        <p className="text-2xl font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">{count}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-[#757575] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  message: string;
  icon: React.ReactNode;
}

function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] text-[#9E9E9E] mb-4 shadow-inner">
        {icon}
      </div>
      <p className="text-[#757575] font-medium">{message}</p>
      <p className="text-sm text-[#9E9E9E] mt-1">Os dados serao exibidos aqui quando disponiveis</p>
    </div>
  );
}
