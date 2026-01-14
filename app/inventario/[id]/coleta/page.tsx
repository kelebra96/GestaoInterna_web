'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Hash,
  Loader2,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { inventoryCacheService } from '@/lib/services/inventory-cache.service';
import { useInventorySync } from '@/hooks/useInventorySync';

interface ActiveAddress {
  addressCode: string;
  itemsCounted: number;
}

interface CountRecord {
  ean: string;
  description: string;
  internalCode: string;
  quantity: number;
  expirationDate?: string;
  diffType: 'ok' | 'excess' | 'shortage';
  timestamp: Date;
}

export default function ColetaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  // Hook de sincronização
  const { isOnline, isSyncing, pendingCount, syncNow, updatePendingCount } = useInventorySync(id);

  const [addressCode, setAddressCode] = useState('');
  const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const [ean, setEan] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [productInfo, setProductInfo] = useState<{
    description: string;
    internalCode: string;
    expectedQuantity: number;
  } | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [recentCounts, setRecentCounts] = useState<CountRecord[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cacheInitialized, setCacheInitialized] = useState(false);
  const [isReadyForOffline, setIsReadyForOffline] = useState(false);
  const [downloadingOfflineData, setDownloadingOfflineData] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState<string | null>(null);
  const [loadingInventoryStatus, setLoadingInventoryStatus] = useState(true);

  const eanInputRef = useRef<HTMLInputElement>(null);

  // Função para preparar dados offline
  const handlePrepareOffline = async () => {
    if (!firebaseUser) {
      alert('Você precisa estar autenticado');
      return;
    }

    try {
      setDownloadingOfflineData(true);

      console.log('[Prepare Offline] Baixando dados do inventário...');

      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/inventario/${id}/download-offline`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Falha ao baixar dados');
      }

      const data = await response.json();
      console.log('[Prepare Offline] Dados recebidos:', data.stats);

      // Salvar no cache local
      await inventoryCacheService.downloadInventoryForOffline(
        id,
        data.inventory.name,
        data.items,
        data.addresses
      );

      setIsReadyForOffline(true);
      alert(`✅ Pronto para uso offline!\n\n📦 ${data.stats.itemsCount} produtos\n📍 ${data.stats.addressesCount} endereços\n\nAgora você pode fazer a coleta sem internet!`);
    } catch (error: any) {
      console.error('[Prepare Offline] Erro:', error);
      alert('Erro ao preparar dados offline: ' + error.message);
    } finally {
      setDownloadingOfflineData(false);
    }
  };

  // Verificar status do inventário
  useEffect(() => {
    const checkInventoryStatus = async () => {
      if (!firebaseUser) return;

      try {
        setLoadingInventoryStatus(true);
        const token = await firebaseUser.getIdToken();
        const response = await fetch(`/api/inventario/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setInventoryStatus(data.inventory?.status || null);
        }
      } catch (error) {
        console.error('[Coleta] Erro ao verificar status:', error);
      } finally {
        setLoadingInventoryStatus(false);
      }
    };

    checkInventoryStatus();
  }, [id, firebaseUser]);

  // Inicializar cache IndexedDB
  useEffect(() => {
    inventoryCacheService
      .init()
      .then(async () => {
        console.log('[Coleta] Cache inicializado');
        setCacheInitialized(true);

        // Verificar se está pronto para offline
        const isReady = await inventoryCacheService.isReadyForOffline(id);
        setIsReadyForOffline(isReady);
        console.log('[Coleta] Pronto para offline:', isReady);

        // Limpar registros antigos
        return inventoryCacheService.cleanupOldRecords();
      })
      .catch((error) => {
        console.error('[Coleta] Erro ao inicializar cache:', error);
      });
  }, [id]);

  useEffect(() => {
    if (activeAddress && eanInputRef.current) {
      eanInputRef.current.focus();
    }
  }, [activeAddress]);

  // Buscar informações do produto quando EAN completo for digitado
  useEffect(() => {
    const fetchProductInfo = async () => {
      if (ean.length !== 13 || !firebaseUser) {
        setProductInfo(null);
        return;
      }

      try {
        setLoadingProduct(true);

        // Tentar buscar do cache local primeiro
        if (cacheInitialized) {
          const cachedItem = await inventoryCacheService.getInventoryItemByEan(id, ean);
          if (cachedItem) {
            setProductInfo({
              description: cachedItem.description,
              internalCode: cachedItem.internalCode,
              expectedQuantity: cachedItem.expectedQuantity,
            });
            setLoadingProduct(false);
            return;
          }
        }

        // Se não encontrou no cache ou está online, buscar do servidor
        if (isOnline) {
          const token = await firebaseUser.getIdToken();

          const response = await fetch(`/api/inventario/${id}/items?ean=${ean}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.item) {
              setProductInfo({
                description: data.item.description,
                internalCode: data.item.internalCode,
                expectedQuantity: data.item.expectedQuantity,
              });
            } else {
              setProductInfo(null);
            }
          } else {
            setProductInfo(null);
          }
        } else {
          setProductInfo(null);
        }
      } catch (error) {
        console.error('Erro ao buscar produto:', error);
        setProductInfo(null);
      } finally {
        setLoadingProduct(false);
      }
    };

    fetchProductInfo();
  }, [ean, id, firebaseUser, isOnline, cacheInitialized]);

  const handleCheckin = async () => {
    if (!addressCode.trim()) {
      alert('Informe o código do endereço');
      return;
    }

    try {
      setCheckingIn(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const normalizedAddress = addressCode.trim().toUpperCase();
      let checkedIn = false;

      // Tentar check-in online primeiro
      if (isOnline) {
        try {
          const token = await firebaseUser.getIdToken();

          const response = await fetch(`/api/inventario/${id}/addresses/checkin`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addressCode: normalizedAddress }),
          });

          if (response.ok) {
            const result = await response.json();
            setActiveAddress({
              addressCode: result.address.addressCode,
              itemsCounted: 0,
            });
            checkedIn = true;
          }
        } catch (error) {
          console.warn('[Check-in] Falha online, tentando offline:', error);
        }
      }

      // Se não fez check-in online (offline ou erro), verificar no cache
      if (!checkedIn && cacheInitialized) {
        const addressExistsInCache = await inventoryCacheService.addressExists(id, normalizedAddress);

        if (addressExistsInCache) {
          // Endereço existe no cache, permitir check-in offline
          setActiveAddress({
            addressCode: normalizedAddress,
            itemsCounted: 0,
          });

          // Salvar sessão ativa no cache
          await inventoryCacheService.saveActiveSession({
            inventoryId: id,
            addressCode: normalizedAddress,
            startedAt: Date.now(),
          });

          checkedIn = true;
          console.log('[Check-in] Check-in offline realizado com sucesso');
        } else {
          throw new Error(`Endereço "${normalizedAddress}" não encontrado no inventário offline. Conecte-se à internet ou verifique o código.`);
        }
      }

      if (checkedIn) {
        setAddressCode('');
        setRecentCounts([]);
      } else {
        throw new Error('Não foi possível fazer check-in');
      }
    } catch (error: any) {
      alert('Erro ao fazer check-in: ' + error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCount = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    // Prevenir comportamento padrão
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!ean.trim() || !quantity.trim()) {
      alert('Informe o EAN e a quantidade');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantidade inválida');
      return;
    }

    if (ean.length !== 13) {
      alert('EAN deve ter 13 dígitos');
      return;
    }

    try {
      setSubmitting(true);

      if (!firebaseUser || !activeAddress) {
        throw new Error('Sessão inválida');
      }

      let result: any = null;
      let savedOffline = false;

      // Tentar salvar online primeiro
      if (isOnline) {
        try {
          const token = await firebaseUser.getIdToken();

          const response = await fetch(`/api/inventario/${id}/count`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ean: ean.trim(),
              quantity: qty,
              expirationDate: expirationDate || undefined,
              addressCode: activeAddress.addressCode,
            }),
          });

          if (response.ok) {
            result = await response.json();
          } else {
            throw new Error('Falha na requisição online');
          }
        } catch (error) {
          console.warn('[Coleta] Falha ao salvar online, salvando offline:', error);
          // Se falhou online, vai salvar offline abaixo
        }
      }

      // Se não salvou online (offline ou erro), salvar no cache
      if (!result && cacheInitialized) {
        await inventoryCacheService.saveCountRecord({
          inventoryId: id,
          addressCode: activeAddress.addressCode,
          ean: ean.trim(),
          quantity: qty,
          expirationDate: expirationDate || undefined,
          timestamp: Date.now(),
          synced: 0, // 0 = não sincronizado
          userId: firebaseUser.uid,
        });

        savedOffline = true;
        updatePendingCount(); // Atualizar contador de pendências

        // Usar dados do cache para resultado
        result = {
          item: {
            description: productInfo?.description || 'Produto',
            internalCode: productInfo?.internalCode || '',
            diffType: 'ok',
          },
        };

        console.log('[Coleta] Contagem salva offline');
      }

      // Adicionar na lista de contagens recentes
      setRecentCounts([
        {
          ean: ean.trim(),
          description: result?.item?.description || productInfo?.description || 'Produto',
          internalCode: result?.item?.internalCode || productInfo?.internalCode || '',
          quantity: qty,
          expirationDate: expirationDate || undefined,
          diffType: result?.item?.diffType || 'ok',
          timestamp: new Date(),
        },
        ...recentCounts.slice(0, 9),
      ]);

      // Atualizar contador
      setActiveAddress({
        ...activeAddress,
        itemsCounted: activeAddress.itemsCounted + 1,
      });

      // Limpar campos
      setEan('');
      setQuantity('');
      setExpirationDate('');
      setProductInfo(null);

      // Feedback visual
      if (savedOffline) {
        // Mostrar notificação visual de que foi salvo offline
        console.log('[Coleta] Contagem salva offline, será sincronizada quando voltar online');
      }

      // Focar no input EAN
      if (eanInputRef.current) {
        eanInputRef.current.focus();
      }
    } catch (error: any) {
      alert('Erro ao registrar contagem: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (!activeAddress) return;

    const confirm = window.confirm(
      `Deseja finalizar o endereço ${activeAddress.addressCode}?\n\nItens contados: ${activeAddress.itemsCounted}`
    );

    if (!confirm) return;

    try {
      setCheckingOut(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}/addresses/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressCode: activeAddress.addressCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao fazer check-out');
      }

      alert(`Endereço ${activeAddress.addressCode} finalizado com sucesso!`);
      setActiveAddress(null);
      setRecentCounts([]);
    } catch (error: any) {
      alert('Erro ao fazer check-out: ' + error.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const getDiffIcon = (diffType: string) => {
    switch (diffType) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'excess':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'shortage':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getDiffBg = (diffType: string) => {
    switch (diffType) {
      case 'ok':
        return 'bg-green-50 border-green-200';
      case 'excess':
        return 'bg-yellow-50 border-yellow-200';
      case 'shortage':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Se o inventário estiver finalizado, mostrar tela de bloqueio
  if (inventoryStatus === 'completed' && !loadingInventoryStatus) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-red-200 p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Inventário Finalizado</h2>
            <p className="text-gray-600 mb-6">
              Este inventário já foi finalizado e não aceita mais coletas.
            </p>
            <button
              onClick={() => router.push(`/inventario/${id}`)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao Inventário
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push(`/inventario/${id}`)}
              className="text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Coleta de Inventário</h1>
          </div>
          <p className="text-gray-600">Informe o código do endereço para iniciar a coleta</p>
        </div>

        {/* Botão de Preparar para Offline */}
        {!isReadyForOffline && isOnline && (
          <div className="mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-900">Preparar para Uso Offline</p>
                    <p className="text-sm text-blue-700">
                      Baixe todos os dados do inventário para trabalhar sem internet
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePrepareOffline}
                  disabled={downloadingOfflineData}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {downloadingOfflineData ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Baixando...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Preparar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de Pronto para Offline */}
        {isReadyForOffline && (
          <div className="mb-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">✓ Pronto para Uso Offline</p>
                  <p className="text-sm text-green-700">
                    Todos os dados estão salvos localmente. Você pode trabalhar sem internet!
                  </p>
                </div>
                <button
                  onClick={handlePrepareOffline}
                  disabled={downloadingOfflineData}
                  className="text-sm text-green-700 hover:text-green-900 underline"
                >
                  {downloadingOfflineData ? 'Atualizando...' : 'Atualizar dados'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de Status de Conexão */}
        <div className="mb-6">
          <div
            className={`rounded-lg p-4 border-2 transition-all ${
              isOnline
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-green-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-yellow-600" />
                )}
                <div>
                  <p className={`font-semibold ${isOnline ? 'text-green-900' : 'text-yellow-900'}`}>
                    {isOnline ? 'Online' : 'Modo Offline'}
                  </p>
                  <p className={`text-sm ${isOnline ? 'text-green-700' : 'text-yellow-700'}`}>
                    {isOnline
                      ? 'Dados sendo salvos no servidor'
                      : 'Dados sendo salvos localmente - Serão sincronizados quando voltar online'}
                  </p>
                </div>
              </div>

              {/* Contador de pendências e botão de sincronização */}
              {(pendingCount > 0 || isSyncing) && (
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && !isSyncing && (
                    <div className="flex items-center gap-2 bg-white/60 px-3 py-1 rounded-lg">
                      <Database className="w-4 h-4 text-yellow-700" />
                      <span className="text-sm font-semibold text-yellow-900">
                        {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {isSyncing && (
                    <div className="flex items-center gap-2 bg-white/60 px-3 py-1 rounded-lg">
                      <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      <span className="text-sm font-semibold text-blue-900">
                        Sincronizando...
                      </span>
                    </div>
                  )}
                  {isOnline && pendingCount > 0 && !isSyncing && (
                    <button
                      onClick={syncNow}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sincronizar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {!activeAddress ? (
          /* Check-in de Endereço */
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Iniciar Coleta</h2>
                <p className="text-sm text-gray-600">Digite ou escaneie o código do endereço</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código do Endereço
                </label>
                <input
                  type="text"
                  value={addressCode}
                  onChange={(e) => setAddressCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCheckin();
                    }
                  }}
                  placeholder="Ex: A1-01-01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handleCheckin}
                disabled={checkingIn || !addressCode.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Iniciar Coleta
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Interface de Coleta Ativa */
          <div className="space-y-6">
            {/* Info do Endereço Ativo */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Endereço Ativo</p>
                  <p className="text-3xl font-bold">{activeAddress.addressCode}</p>
                  <p className="text-sm opacity-90 mt-2">
                    {activeAddress.itemsCounted} {activeAddress.itemsCounted === 1 ? 'item coletado' : 'itens coletados'}
                  </p>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-all backdrop-blur-sm disabled:opacity-50"
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Finalizar Endereço
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Formulário de Contagem */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Registrar Produto</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    EAN (13 dígitos)
                  </label>
                  <input
                    ref={eanInputRef}
                    type="text"
                    value={ean}
                    onChange={(e) => setEan(e.target.value.replace(/\D/g, '').slice(0, 13))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('qty-input')?.focus();
                      }
                    }}
                    placeholder="0000000000000"
                    maxLength={13}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {/* Informações do Produto */}
                  {loadingProduct && (
                    <div className="mt-2 flex items-center gap-2 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Buscando produto...</span>
                    </div>
                  )}
                  {!loadingProduct && productInfo && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="font-semibold text-blue-900">{productInfo.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-blue-700">
                        <span>Código: {productInfo.internalCode}</span>
                        <span>Estoque esperado: {productInfo.expectedQuantity}</span>
                      </div>
                    </div>
                  )}
                  {!loadingProduct && ean.length === 13 && !productInfo && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">⚠️ Produto não encontrado no inventário</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Quantidade
                  </label>
                  <input
                    id="qty-input"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('exp-input')?.focus();
                      }
                    }}
                    placeholder="0"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Data de Validade (Opcional)
                  </label>
                  <input
                    id="exp-input"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCount();
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="button"
                  onClick={(e) => handleCount(e)}
                  disabled={submitting || !ean.trim() || !quantity.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Registrar Contagem
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Últimas Contagens */}
            {recentCounts.length > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Últimas Contagens</h2>
                <div className="space-y-2">
                  {recentCounts.map((count, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 flex items-center justify-between ${getDiffBg(count.diffType)}`}
                    >
                      <div className="flex items-center gap-3">
                        {getDiffIcon(count.diffType)}
                        <div>
                          <p className="font-semibold text-gray-800">{count.description}</p>
                          <p className="font-mono text-xs text-gray-600">{count.ean}</p>
                          <p className="text-sm text-gray-600">
                            Qtd: {count.quantity}
                            {count.expirationDate && ` | Val: ${new Date(count.expirationDate).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {count.timestamp.toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
