'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Store as StoreIcon,
} from 'lucide-react';
import { Store } from '@prisma/client';
import { useAuth } from '@/contexts/AuthContext';

interface CriticalSlot {
  id: string;
  productId: string;
  currentQuantity: number;
  capacity: number;
  occupation: number;
  supplyStatus: 'RUIM';
}

interface TopLostRevenue {
  productId: string;
  product: {
    sku: string;
    name: string;
  };
  totalRevenueLost: number;
}

export default function AnalyticsDashboardPage() {
  const router = useRouter();
  const { firebaseUser, user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [criticalSlots, setCriticalSlots] = useState<CriticalSlot[]>([]);
  const [topLostRevenue, setTopLostRevenue] = useState<TopLostRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const userStoreIds =
    Array.isArray((user as any)?.storeIds) && (user as any)?.storeIds.length > 0
      ? (user as any).storeIds
      : user?.storeId
        ? [user.storeId]
        : [];

  const mapRoleToBackend = (role?: string) => {
    switch ((role || '').toLowerCase()) {
      case 'developer':
      case 'admin':
        return 'super_admin';
      case 'manager':
        return 'gestor_loja';
      case 'agent':
        return 'repositor';
      case 'buyer':
        return 'merchandiser';
      default:
        return 'super_admin';
    }
  };

  const getAuthHeaders = async () => {
    if (!firebaseUser) throw new Error('Token de autenticação não encontrado.');
    const token = await firebaseUser.getIdToken(true);
    const payload = {
      userId: firebaseUser.uid,
      orgId: (user as any)?.orgId || user?.companyId || 'default-org',
      role: mapRoleToBackend(user?.role),
      storeIds: Array.isArray((user as any)?.storeIds)
        ? (user as any).storeIds
        : user?.storeId
          ? [user.storeId]
          : [],
    };
    return {
      Authorization: `Bearer ${token}`,
      'x-user-payload': JSON.stringify(payload),
    };
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/stores', { headers, cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao carregar lojas');
      }
      const data = await response.json();
      const lojas: Store[] = data.stores || [];

      // Fallback: se API retornar vazio, tenta montar lista com storeIds do usuário
      let lojasParaUso: Store[] = lojas;
      if ((lojasParaUso == null || lojasParaUso.length === 0) && userStoreIds.length > 0) {
        const now = new Date();
        lojasParaUso = userStoreIds.map((id: string, idx: number) => ({
          id,
          orgId: (user as any)?.orgId || user?.companyId || 'org-fallback',
          name: (user as any)?.storeName || `Loja ${idx + 1}`,
          code: `store-${id.substring(0, 6)}`,
          address: '',
          city: '',
          region: '',
          userIds: [],
          createdAt: now,
          updatedAt: now,
        })) as Store[];
        console.warn('⚠️ /api/stores retornou vazio; usando fallback com storeIds do usuário:', lojasParaUso);
      }

      setStores(lojasParaUso);

      if (lojasParaUso.length > 0) {
        const defaultStore =
          lojasParaUso.find((s) => userStoreIds.includes(s.id))?.id ||
          lojasParaUso[0].id;
        setSelectedStoreId(defaultStore);
        setError(null);
      } else {
        setError('Nenhuma loja encontrada para o seu usuário. Verifique se existem lojas cadastradas e se o usuário possui storeId/storeIds.');
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedStoreId) {
      setError('Selecione uma loja para visualizar os dados.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      const [criticalSlotsResponse, topLostRevenueResponse] = await Promise.all([
        fetch(`/api/rupture/critical-slots?storeId=${selectedStoreId}`, { headers }),
        fetch(`/api/rupture/top-lost-revenue?storeId=${selectedStoreId}`, { headers }),
      ]);

      if (!criticalSlotsResponse.ok) {
        const body = await criticalSlotsResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao carregar slots críticos');
      }
      const criticalSlotsData = await criticalSlotsResponse.json();
      setCriticalSlots(criticalSlotsData.criticalSlots || []);

      if (!topLostRevenueResponse.ok) {
        const body = await topLostRevenueResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao carregar perda de receita');
      }
      const topLostRevenueData = await topLostRevenueResponse.json();
      setTopLostRevenue(topLostRevenueData.topLostRevenue || []);

      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar dados de analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchStores();
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchData();
    }
  }, [selectedStoreId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#1F53A2] via-[#2E67C3] to-[#5C94CC] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <TrendingDown className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Analytics
                  </h1>
                  <p className="text-[#E3EFFF] text-base font-medium mt-2">
                    Análise de rupturas e perdas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <StoreIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl font-bold appearance-none cursor-pointer hover:bg-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
                    disabled={stores.length === 0}
                  >
                    <option value="" className="text-gray-800">Selecione uma loja</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id} className="text-gray-800">
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading || !selectedStoreId}
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

        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-[#1F53A2] opacity-20 rounded-full animate-ping"></div>
              <RefreshCw className="w-16 h-16 animate-spin text-[#1F53A2] relative" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando analytics...</h3>
            <p className="text-[#757575]">Por favor, aguarde enquanto buscamos os dados</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#E82129] to-[#C62828] px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Erro ao Carregar
              </h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-[#E82129] mb-6 text-lg font-medium">{error}</p>
              <button
                onClick={fetchData}
                disabled={!selectedStoreId}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] hover:from-[#153D7A] hover:to-[#1F53A2] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Slots */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#E82129] to-[#C62828] px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Slots Críticos (Baixo Estoque)
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {criticalSlots.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-[#4CAF50]" />
                      </div>
                      <p className="text-[#757575] text-lg">Nenhum slot crítico encontrado</p>
                      <p className="text-[#757575] text-sm mt-1">Todos os estoques estão em bom estado!</p>
                    </div>
                  ) : (
                    criticalSlots.map((slot) => (
                      <div key={slot.id} className="p-4 bg-gradient-to-br from-[#FFEBEE] to-white rounded-xl border-2 border-[#E57373] hover:border-[#E82129] transition-all duration-300 hover:shadow-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-bold text-[#757575] mb-1">Slot ID</p>
                            <p className="font-bold text-[#212121]">{slot.id.substring(0, 8)}...</p>
                          </div>
                          <div className="px-3 py-1.5 bg-[#E82129] text-white text-xs font-bold rounded-lg shadow-md">
                            CRÍTICO
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white rounded-lg border border-[#E57373]">
                            <p className="text-xs font-bold text-[#C62828] mb-1">Ocupação</p>
                            <p className="text-2xl font-bold text-[#E82129]">
                              {(slot.occupation * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-[#E57373]">
                            <p className="text-xs font-bold text-[#C62828] mb-1">Estoque</p>
                            <p className="text-lg font-bold text-[#212121]">
                              {slot.currentQuantity} / {slot.capacity}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Top Lost Revenue */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-6 h-6" />
                  Maior Perda de Receita
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {topLostRevenue.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-10 h-10 text-[#4CAF50]" />
                      </div>
                      <p className="text-[#757575] text-lg">Nenhuma perda de receita detectada</p>
                      <p className="text-[#757575] text-sm mt-1">Excelente performance!</p>
                    </div>
                  ) : (
                    topLostRevenue.map((item, index) => (
                      <div key={item.productId} className="p-4 bg-gradient-to-br from-[#FFF3E0] to-white rounded-xl border-2 border-[#FFB74D] hover:border-[#FF9800] transition-all duration-300 hover:shadow-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-6 h-6 bg-gradient-to-br from-[#FF9800] to-[#F57C00] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {index + 1}
                              </span>
                              <p className="text-sm font-bold text-[#757575]">SKU: {item.product.sku}</p>
                            </div>
                            <p className="font-bold text-[#212121] text-lg">{item.product.name}</p>
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-[#FFB74D] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-lg">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#E65100]">Receita Perdida</p>
                              <p className="text-2xl font-bold text-[#FF9800]">
                                R$ {item.totalRevenueLost.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
