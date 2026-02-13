'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Store,
  Package,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClusters } from '@/hooks/usePrediction';
import { ClusterType } from '@/lib/types/prediction';

export default function ClustersPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ClusterType>('store');
  const { clusters, loading, error, fetchClusters, runClustering } = useClusters(activeTab);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      fetchClusters();
    }
  }, [firebaseUser, fetchClusters]);

  const handleRunClustering = async () => {
    setIsRunning(true);
    try {
      await runClustering(activeTab, 5, 'kmeans');
      fetchClusters();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
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
                <Users className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Clusters
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Agrupamento inteligente de lojas e produtos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunClustering}
                disabled={loading || isRunning}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100] text-white px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <BarChart3 className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
                {isRunning ? 'Processando...' : 'Executar Clustering'}
              </button>
              <button
                onClick={fetchClusters}
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
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'store'
                  ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white shadow-lg'
                  : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
              }`}
            >
              <Store className="w-5 h-5" />
              Lojas
            </button>
            <button
              onClick={() => setActiveTab('product')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'product'
                  ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white shadow-lg'
                  : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
              }`}
            >
              <Package className="w-5 h-5" />
              Produtos
            </button>
          </div>
          {activeTab === 'product' && (
            <button
              onClick={() => router.push('/inteligencia/produtos')}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all"
            >
              <TrendingUp className="w-5 h-5" />
              Analise Detalhada + PDF
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && clusters.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
              <Users className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Carregando clusters...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
            <button
              onClick={fetchClusters}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-3 rounded-xl font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && clusters.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F8F9FA] text-[#757575] mb-6">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-xl font-bold text-[#212121] mb-2">Nenhum cluster encontrado</p>
            <p className="text-[#757575] mb-6">Execute a clusterizacao para agrupar {activeTab === 'store' ? 'lojas' : 'produtos'}</p>
            <button
              onClick={handleRunClustering}
              disabled={isRunning}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white px-6 py-3 rounded-xl font-bold"
            >
              <BarChart3 className="w-5 h-5" />
              Executar Clustering
            </button>
          </div>
        )}

        {/* Clusters Grid */}
        {!loading && !error && clusters.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clusters.map((cluster) => {
              const characteristics = cluster.characteristics as Record<string, unknown> || {};
              const totalLossValue = characteristics.total_loss_value as number || 0;
              const avgLossPerMember = characteristics.avg_loss_per_member as number || 0;
              const riskLevel = characteristics.risk_level as string || 'medium';

              const riskColors: Record<string, string> = {
                high: 'from-[#BF092F] to-[#8B0000]',
                medium: 'from-[#FF9800] to-[#F57C00]',
                low: 'from-[#4CAF50] to-[#2E7D32]',
              };

              return (
                <div
                  key={cluster.id}
                  className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all"
                >
                  <div className={`bg-gradient-to-r ${riskColors[riskLevel] || 'from-[#16476A] to-[#3B9797]'} px-6 py-4`}>
                    <h3 className="text-lg font-bold text-white">{cluster.clusterLabel || cluster.clusterName}</h3>
                    <p className="text-white/70 text-sm">{cluster.memberCount} {activeTab === 'store' ? 'lojas' : 'produtos'}</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-[#F8F9FA] rounded-xl">
                        <p className="text-2xl font-bold text-[#16476A]">{cluster.memberCount}</p>
                        <p className="text-xs text-[#757575]">Membros</p>
                      </div>
                      <div className="text-center p-3 bg-[#F8F9FA] rounded-xl">
                        <p className="text-2xl font-bold text-[#3B9797]">
                          {(cluster.avgRiskScore || 0).toFixed(0)}%
                        </p>
                        <p className="text-xs text-[#757575]">Risco</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#757575]">Perda Total:</span>
                        <span className="font-bold text-[#BF092F]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLossValue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#757575]">Media/Membro:</span>
                        <span className="font-bold text-[#212121]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgLossPerMember)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className={`inline-block px-3 py-1 text-xs font-bold rounded-lg ${
                        riskLevel === 'high' ? 'bg-[#BF092F]/10 text-[#BF092F]' :
                        riskLevel === 'medium' ? 'bg-[#FF9800]/10 text-[#FF9800]' :
                        'bg-[#4CAF50]/10 text-[#4CAF50]'
                      }`}>
                        {riskLevel === 'high' ? 'Alto Risco' : riskLevel === 'medium' ? 'Risco Moderado' : 'Baixo Risco'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
