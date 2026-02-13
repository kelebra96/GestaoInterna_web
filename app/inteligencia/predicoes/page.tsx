'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Target,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePredictions } from '@/hooks/usePrediction';
import { PredictionType } from '@/lib/types/prediction';

// Traducoes para tipos de entidade
const translateEntityType = (type: string): string => {
  const translations: Record<string, string> = {
    'organization': 'Organizacao',
    'store': 'Loja',
    'product': 'Produto',
    'category': 'Categoria',
  };
  return translations[type] || type;
};

export default function PredicoesPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [activeType, setActiveType] = useState<PredictionType>('loss_volume');
  const { predictions, accuracy, loading, error, fetchPredictions, fetchAccuracy, generatePredictions } = usePredictions({ predictionType: activeType });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      fetchPredictions();
      fetchAccuracy();
    }
  }, [firebaseUser, fetchPredictions, fetchAccuracy]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generatePredictions(activeType, 7);
      fetchPredictions();
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const predictionTypes: { value: PredictionType; label: string }[] = [
    { value: 'loss_volume', label: 'Volume de Perdas' },
    { value: 'loss_value', label: 'Valor de Perdas' },
    { value: 'expiry_risk', label: 'Risco de Vencimento' },
    { value: 'demand', label: 'Demanda' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#16476A] overflow-hidden">
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
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Predicoes
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Previsoes baseadas em Machine Learning
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading || isGenerating}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100] text-white px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <Target className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
                {isGenerating ? 'Gerando...' : 'Gerar Predicoes'}
              </button>
              <button
                onClick={() => { fetchPredictions(); fetchAccuracy(); }}
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
        {/* Type Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {predictionTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveType(type.value)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${
                activeType === type.value
                  ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white shadow-lg'
                  : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Accuracy Cards */}
        {accuracy.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {accuracy.filter(a => a.predictionType === activeType).slice(0, 3).map((acc) => (
              <div key={acc.id} className="bg-white rounded-xl shadow-lg border border-[#E0E0E0] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#757575]">Precisao</span>
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg ${
                    acc.accuracy >= 0.8 ? 'bg-[#4CAF50]/10 text-[#4CAF50]' :
                    acc.accuracy >= 0.6 ? 'bg-[#FF9800]/10 text-[#FF9800]' :
                    'bg-[#BF092F]/10 text-[#BF092F]'
                  }`}>
                    {(acc.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#212121]">{acc.sampleSize} amostras</p>
                <p className="text-xs text-[#757575] mt-1">MAE: {acc.mae?.toFixed(2) || 'N/A'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && predictions.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Carregando predicoes...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
            <button
              onClick={fetchPredictions}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-3 rounded-xl font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && predictions.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F8F9FA] text-[#757575] mb-6">
              <TrendingUp className="w-8 h-8" />
            </div>
            <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma predicao disponivel</p>
            <p className="text-[#757575] mb-6">Gere predicoes para visualizar previsoes</p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white px-6 py-3 rounded-xl font-bold"
            >
              <Target className="w-5 h-5" />
              Gerar Predicoes
            </button>
          </div>
        )}

        {/* Predictions List */}
        {!loading && !error && predictions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-[#16476A] to-[#3B9797]">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white">Entidade</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white">Data Prevista</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-white">Valor Previsto</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-white">Confianca</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white">Intervalo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {predictions.map((pred) => (
                    <tr key={pred.id} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#212121]">{pred.entityName || pred.entityId}</p>
                        <p className="text-xs text-[#757575]">{translateEntityType(pred.entityType)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[#212121]">
                          <Calendar className="w-4 h-4 text-[#757575]" />
                          {formatDate(pred.predictionDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-lg font-bold text-[#16476A]">
                          {activeType.includes('value') ? formatCurrency(pred.predictedValue) : pred.predictedValue.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 text-sm font-bold rounded-lg ${
                          pred.confidence >= 0.8 ? 'bg-[#4CAF50]/10 text-[#4CAF50]' :
                          pred.confidence >= 0.6 ? 'bg-[#FF9800]/10 text-[#FF9800]' :
                          'bg-[#BF092F]/10 text-[#BF092F]'
                        }`}>
                          {(pred.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-[#757575]">
                        {pred.lowerBound?.toFixed(1)} - {pred.upperBound?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
