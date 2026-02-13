'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Package,
  RefreshCw,
  Store as StoreIcon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Store } from '@prisma/client';
import { AllKPIs, TrendDataPoint, StoreRanking, SKURanking, FunnelData } from '@/lib/types/expiry-analytics';
import { formatarMoeda, formatarHoras } from '@/lib/services/expiry-analytics.service';

// Mock de componentes de UI - em um projeto real, seriam importados de um design system
const Card = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>{children}</div>
);
const CardTitle = ({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) => (
  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
    {Icon && <Icon className="w-5 h-5 text-[#132440]" />}
    {children}
  </h3>
);
const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-[#132440]" />
    </div>
);

const ErrorDisplay = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-[#BF092F] mx-auto mb-4" />
        <p className="text-[#BF092F] font-semibold mb-4">{message}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-[#132440] text-white rounded-lg hover:bg-[#16476A]">Tentar Novamente</button>
    </div>
);


export default function ExpiryAnalyticsDashboard() {
  const { firebaseUser, user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [period, setPeriod] = useState<string>('30d');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<AllKPIs | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [storeRankings, setStoreRankings] = useState<StoreRanking[]>([]);
  const [skuRankings, setSkuRankings] = useState<SKURanking[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);

  const userStoreIds = useMemo(() => {
    return Array.isArray((user as any)?.storeIds) && (user as any)?.storeIds.length > 0
      ? (user as any).storeIds
      : user?.storeId
        ? [user.storeId]
        : [];
  }, [user]);

  const getAuthHeaders = useCallback(async () => {
    if (!firebaseUser) throw new Error('Token de autenticação não encontrado.');
    const token = await firebaseUser.getIdToken(true);
    const payload = {
      userId: firebaseUser.uid,
      orgId: (user as any)?.orgId || 'default-org',
      role: (user as any)?.role || 'agent',
      storeIds: userStoreIds,
    };
    return {
      Authorization: `Bearer ${token}`,
      'x-user-payload': JSON.stringify(payload),
    };
  }, [firebaseUser, user, userStoreIds]);

  const fetchStores = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/stores', { headers, cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao carregar lojas');
      const data = await response.json();
      const userStores = data.stores.filter((s: Store) => userStoreIds.includes(s.id));
      setStores(userStores.length > 0 ? userStores : data.stores);

      if (data.stores.length > 0) {
        setSelectedStoreId(userStoreIds[0] || data.stores[0].id);
      } else {
        setError('Nenhuma loja encontrada para seu usuário.');
      }
    } catch (e: any) {
      setError(e.message);
      setStores([]);
    }
  }, [getAuthHeaders, userStoreIds]);
  
  const fetchData = useCallback(async () => {
    if (!selectedStoreId && !user?.role.includes('admin')) {
        // Non-admins must select a store
        return;
    }

    setLoading(true);
    setError(null);

    try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({
            period,
            ...(selectedStoreId && { storeId: selectedStoreId }),
        });

        const [kpisRes, trendsRes, storeRankingsRes, skuRankingsRes, funnelRes] = await Promise.all([
            fetch(`/api/expiry-analytics/kpis?${params.toString()}`, { headers }),
            fetch(`/api/expiry-analytics/trends?${params.toString()}`, { headers }),
            fetch(`/api/expiry-analytics/rankings?type=stores&${params.toString()}`, { headers }),
            fetch(`/api/expiry-analytics/rankings?type=skus&${params.toString()}`, { headers }),
            fetch(`/api/expiry-analytics/funnel?${params.toString()}`, { headers }),
        ]);

        if (!kpisRes.ok) throw new Error('Falha ao carregar KPIs');
        const kpisData = await kpisRes.json();
        setKpis(kpisData.data);

        if (!trendsRes.ok) throw new Error('Falha ao carregar tendências');
        const trendsData = await trendsRes.json();
        setTrends(trendsData.data);
        
        if (!storeRankingsRes.ok) throw new Error('Falha ao carregar ranking de lojas');
        const storeRankingsData = await storeRankingsRes.json();
        setStoreRankings(storeRankingsData.data);

        if (!skuRankingsRes.ok) throw new Error('Falha ao carregar ranking de SKUs');
        const skuRankingsData = await skuRankingsRes.json();
        setSkuRankings(skuRankingsData.data);

        if (!funnelRes.ok) throw new Error('Falha ao carregar dados do funil');
        const funnelData = await funnelRes.json();
        setFunnel(funnelData.data);

    } catch (e: any) {
        setError(e.message);
    } finally {
        setLoading(false);
    }
  }, [getAuthHeaders, period, selectedStoreId, user?.role]);

  useEffect(() => {
    if (firebaseUser) {
      fetchStores();
    }
  }, [firebaseUser, fetchStores]);

  useEffect(() => {
    if(user) {
        fetchData();
    }
  }, [user, fetchData]);

  const KPICard = ({ title, value, subValue, trend, icon: Icon, color = 'text-[#132440]' }: any) => (
    <Card>
        <CardContent>
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="text-sm font-medium text-gray-500">{title}</h4>
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                    <p className="text-sm text-gray-600">{subValue}</p>
                </div>
                <div className={`p-2 bg-[#E0E7EF] rounded-lg`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[#132440]" />
            Analytics de Vencimentos
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
                <StoreIcon className="w-5 h-5 text-gray-500" />
                <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-[#16476A] focus:ring focus:ring-[#16476A]/30 text-black"
                >
                    <option value="">Toda a Rede</option>
                    {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-[#16476A] focus:ring focus:ring-[#16476A]/30 text-black"
                >
                    <option value="7d">Últimos 7 dias</option>
                    <option value="14d">Últimos 14 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                    <option value="90d">Últimos 90 dias</option>
                </select>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 bg-[#132440] text-white rounded-md hover:bg-[#16476A] disabled:bg-[#132440]/50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && <ErrorDisplay message={error} onRetry={fetchData} />}

        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Card key={i} className="h-36 animate-pulse bg-gray-200" />)}
            </div>
        ) : kpis ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <KPICard title="Valor em Risco" value={formatarMoeda(kpis.risk.valueAtRisk)} subValue={`${kpis.risk.totalOpen} itens abertos`} icon={AlertTriangle} color="text-[#BF092F]" />
              <KPICard title="Eficiência" value={`${kpis.efficiency.efficiencyRate}%`} subValue="Resolvido antes de vencer" icon={CheckCircle2} color="text-[#3B9797]" />
              <KPICard title="SLA de Resolução" value={formatarHoras(kpis.sla.p50ResolutionHours)} subValue="Mediana" icon={Clock} color="text-[#BF092F]" />
              <KPICard title="Valor Recuperado" value={formatarMoeda(kpis.efficiency.valueRecovered)} subValue={`${kpis.efficiency.resolvedBeforeExpiry} itens`} icon={DollarSign} color="text-[#16476A]" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle icon={TrendingUp}>Tendência de Itens</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {trends.length > 0 ? "CHART_PLACEHOLDER" : "Sem dados de tendência."}
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle icon={Zap}>Funil de Ação</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {funnel ? "FUNNEL_CHART_PLACEHOLDER" : "Sem dados de funil."}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle icon={StoreIcon}>Ranking de Lojas (por Risco)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {storeRankings.slice(0, 5).map(store => (
                                <div key={store.storeId} className="p-2 rounded-lg hover:bg-gray-100">
                                    <p className="font-bold text-[#132440]">{store.storeName}</p>
                                    <p className="text-sm text-[#BF092F]">{formatarMoeda(store.valueAtRisk)} em risco</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle icon={Package}>Ranking de Produtos (por Ocorrências)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {skuRankings.slice(0, 5).map(sku => (
                                <div key={sku.productId} className="p-2 rounded-lg hover:bg-gray-100">
                                    <p className="font-bold text-[#132440]">{sku.productName}</p>
                                    <p className="text-sm text-[#16476A]">{sku.occurrenceCount} ocorrências em {sku.storesAffected} lojas</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
          </>
        ) : (
          !loading && <p>Nenhum dado para exibir. Tente ajustar os filtros.</p>
        )}
      </main>
    </div>
  );
}
