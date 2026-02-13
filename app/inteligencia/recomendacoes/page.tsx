'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRecommendations } from '@/hooks/usePrediction';
import { RecommendationStatus, RecommendationPriority } from '@/lib/types/prediction';

// Traducoes para tipos de recomendacao
const translateRecommendationType = (type: string): string => {
  const translations: Record<string, string> = {
    'reduce_order': 'Reduzir Pedido',
    'increase_order': 'Aumentar Pedido',
    'reposition_product': 'Reposicionar Produto',
    'review_expiry': 'Revisar Vencimentos',
    'adjust_display': 'Ajustar Exposicao',
    'change_pricing': 'Ajustar Precos',
    'promotional': 'Promocional',
    'storage': 'Armazenamento',
    'transfer': 'Transferencia',
    'markdown': 'Remarcacao',
  };
  return translations[type] || type;
};

export default function RecomendacoesPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | undefined>('pending');
  const { recommendations, summary, loading, error, fetchRecommendations, fetchSummary, updateStatus, addFeedback, generateRecommendations } = useRecommendations({ status: statusFilter });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      fetchRecommendations();
      fetchSummary();
    }
  }, [firebaseUser, fetchRecommendations, fetchSummary]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateRecommendations();
      fetchRecommendations();
      fetchSummary();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: RecommendationStatus) => {
    await updateStatus(id, status);
  };

  const handleFeedback = async (id: string, type: 'helpful' | 'not_helpful') => {
    await addFeedback(id, type);
  };

  const priorityColors: Record<RecommendationPriority, string> = {
    critical: 'bg-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/20',
    high: 'bg-[#FF9800]/10 text-[#FF9800] border-[#FF9800]/20',
    medium: 'bg-[#3B9797]/10 text-[#3B9797] border-[#3B9797]/20',
    low: 'bg-[#757575]/10 text-[#757575] border-[#757575]/20',
  };

  const priorityLabels: Record<RecommendationPriority, string> = {
    critical: 'Critico',
    high: 'Alto',
    medium: 'Medio',
    low: 'Baixo',
  };

  const statusFilters: { value: RecommendationStatus | undefined; label: string }[] = [
    { value: 'pending', label: 'Pendentes' },
    { value: 'accepted', label: 'Aceitas' },
    { value: 'rejected', label: 'Rejeitadas' },
    { value: 'completed', label: 'Implementadas' },
    { value: undefined, label: 'Todas' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#FF9800] via-[#F57C00] to-[#F57C00] overflow-hidden">
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
                <Lightbulb className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Recomendacoes
                </h1>
                <p className="text-[#FFF3E0] text-base font-medium mt-2">
                  Sugestoes inteligentes para reduzir perdas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading || isGenerating}
                className="inline-flex items-center gap-2 bg-white text-[#FF9800] px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
                {isGenerating ? 'Gerando...' : 'Gerar Novas'}
              </button>
              <button
                onClick={() => { fetchRecommendations(); fetchSummary(); }}
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
              <div key={`${s.recommendationType}-${s.priority}`} className="bg-white rounded-xl shadow-lg border border-[#E0E0E0] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${priorityColors[s.priority]}`}>
                    {priorityLabels[s.priority]}
                  </span>
                  <span className="text-2xl font-bold text-[#212121]">{s.count}</span>
                </div>
                <p className="text-sm text-[#757575]">{translateRecommendationType(s.recommendationType)}</p>
                {(s.totalPotentialSavings ?? 0) > 0 && (
                  <p className="text-sm font-bold text-[#4CAF50] mt-1">
                    {formatCurrency(s.totalPotentialSavings!)} economia
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {statusFilters.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-5 py-3 rounded-xl font-bold transition-all ${
                statusFilter === filter.value
                  ? 'bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white shadow-lg'
                  : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && recommendations.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#FF9800] to-[#F57C00] mb-6 animate-pulse">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Carregando recomendacoes...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
            <button
              onClick={() => fetchRecommendations()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white px-6 py-3 rounded-xl font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && recommendations.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F8F9FA] text-[#757575] mb-6">
              <Lightbulb className="w-8 h-8" />
            </div>
            <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma recomendacao encontrada</p>
            <p className="text-[#757575] mb-6">Gere novas recomendacoes ou altere o filtro</p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white px-6 py-3 rounded-xl font-bold"
            >
              <Sparkles className="w-5 h-5" />
              Gerar Recomendacoes
            </button>
          </div>
        )}

        {/* Recommendations List */}
        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${priorityColors[rec.priority]}`}>
                          {priorityLabels[rec.priority]}
                        </span>
                        <span className="px-3 py-1 text-xs font-bold rounded-lg bg-[#16476A]/10 text-[#16476A]">
                          {translateRecommendationType(rec.recommendationType)}
                        </span>
                        {rec.status !== 'pending' && (
                          <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                            rec.status === 'completed' ? 'bg-[#4CAF50]/10 text-[#4CAF50]' :
                            rec.status === 'accepted' ? 'bg-[#3B9797]/10 text-[#3B9797]' :
                            'bg-[#757575]/10 text-[#757575]'
                          }`}>
                            {rec.status === 'completed' ? 'Implementada' :
                             rec.status === 'accepted' ? 'Aceita' :
                             rec.status === 'rejected' ? 'Rejeitada' : rec.status}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-[#212121] mb-2">{rec.title}</h3>
                      <p className="text-[#757575]">{rec.description}</p>
                      {rec.estimatedSavings && rec.estimatedSavings > 0 && (
                        <p className="mt-3 text-lg font-bold text-[#4CAF50]">
                          Economia potencial: {formatCurrency(rec.estimatedSavings)}
                        </p>
                      )}
                    </div>

                    {rec.status === 'pending' && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleStatusChange(rec.id, 'accepted')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-xl font-bold hover:bg-[#388E3C] transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleStatusChange(rec.id, 'rejected')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#757575] text-white rounded-xl font-bold hover:bg-[#616161] transition-all"
                        >
                          <XCircle className="w-4 h-4" />
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>

                  {rec.status === 'accepted' && (
                    <div className="mt-4 pt-4 border-t border-[#E0E0E0] flex items-center justify-between">
                      <button
                        onClick={() => handleStatusChange(rec.id, 'completed')}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] text-white rounded-xl font-bold"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar como Implementada
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#757575]">Esta recomendacao foi util?</span>
                        <button
                          onClick={() => handleFeedback(rec.id, 'helpful')}
                          className="p-2 text-[#4CAF50] hover:bg-[#4CAF50]/10 rounded-lg transition-all"
                        >
                          <ThumbsUp className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(rec.id, 'not_helpful')}
                          className="p-2 text-[#BF092F] hover:bg-[#BF092F]/10 rounded-lg transition-all"
                        >
                          <ThumbsDown className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
