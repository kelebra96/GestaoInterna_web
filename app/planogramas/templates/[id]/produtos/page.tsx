'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2, RefreshCw, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductSlot, ShelfDimensions } from '@/lib/types/space-validation';
import { useSpaceValidation } from '@/hooks/useSpaceValidation';
import SpaceUtilizationView from '@/components/space-validation/SpaceUtilizationView';
export const dynamic = 'force-dynamic';

export default function TemplateProductsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser, user } = useAuth();

  const [slots, setSlots] = useState<ProductSlot[]>([]);
  const [shelves, setShelves] = useState<ShelfDimensions[]>([
    // Exemplo de prateleiras - deve vir da API
    { id: 'shelf-1', level: 1, width: 120, depth: 40, height: 30, eyeLevel: false },
    { id: 'shelf-2', level: 2, width: 120, depth: 40, height: 30, eyeLevel: false },
    { id: 'shelf-3', level: 3, width: 120, depth: 40, height: 30, eyeLevel: true },
    { id: 'shelf-4', level: 4, width: 120, depth: 40, height: 30, eyeLevel: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [productDocId, setProductDocId] = useState<string | null>(null);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [productList, setProductList] = useState<any[]>([]);
  const [productListLoading, setProductListLoading] = useState(false);
  const [productListError, setProductListError] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [pendingAddProduct, setPendingAddProduct] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [volumeForm, setVolumeForm] = useState({
    ean: '',
    descricao: '',
    largura: '',
    altura: '',
    profundidade: '',
    peso: '',
  });
  const totalShelves = shelves.length;
  const totalSlots = slots.length;

  // Novo slot sendo adicionado
  const [newSlot, setNewSlot] = useState<ProductSlot>({
    productId: '',
    shelfId: 'shelf-1',
    positionX: 0,
    width: 10,
    facings: 1,
    capacity: 10,
  });

  const numberOrUndefined = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };

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
    if (!firebaseUser) throw new Error('Usuário não autenticado');
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

  const fetchProductList = async (searchTerm?: string) => {
    try {
      setProductListLoading(true);
      setProductListError(null);
      const headers = await getAuthHeaders().catch(() => ({} as any));
      const params = new URLSearchParams();
      if (searchTerm && searchTerm.length >= 2) {
        params.set('search', searchTerm);
      }
      const url = `/api/volumetria/products${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, { cache: 'no-store', headers });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao listar produtos');
      }
      const data = await response.json();
      setProductList(data.products || []);
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      setProductListError('Falha ao listar produtos. Tente novamente.');
    }
    setProductListLoading(false);
  };

  const addSlotFromProduct = (product: any) => {
    const vw = product?.volumetry?.largura_cm ? Number(product.volumetry.largura_cm) : newSlot.width;
    const pd = product?.volumetry?.profundidade_cm ? Number(product.volumetry.profundidade_cm) : newSlot.depth;
    setSlots((prev) => [
      ...prev,
      {
        productId: product.ean || product.id,
        productName: product.name,
        shelfId: newSlot.shelfId,
        positionX: 0,
        width: vw || 10,
        depth: pd,
        facings: 1,
        capacity: 10,
      },
    ]);
  };

  const openVolumeModal = (code: string, existing?: any) => {
    setVolumeForm({
      ean: existing?.ean || code || '',
      descricao: existing?.descricao || existing?.nome || '',
      largura: existing?.largura_cm?.toString?.() || existing?.largura?.toString?.() || '',
      altura: existing?.altura_cm?.toString?.() || existing?.altura?.toString?.() || '',
      profundidade: existing?.profundidade_cm?.toString?.() || existing?.profundidade?.toString?.() || existing?.comprimento_cm?.toString?.() || '',
      peso: existing?.peso_kg?.toString?.() || existing?.peso?.toString?.() || existing?.peso_bruto_kg?.toString?.() || '',
    });
    setShowVolumeModal(true);
  };

  const loadProductFromFirestore = async (code: string) => {
    if (!code.trim()) return;
    setProductLoading(true);
    setProductMessage(null);
    setProductInfo(null);
    setProductListError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/volumetria/products?code=${encodeURIComponent(code)}`, {
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao buscar produto');
      }

      const data = await response.json();
      const found = data.product;

      if (!found) {
        setProductMessage('Produto não encontrado no catálogo. Cadastre os dados para continuar.');
        openVolumeModal(code);
        return;
      }

      setProductDocId(found.id);
      setProductInfo(found);

      const largura = numberOrUndefined(found.largura_cm ?? found.largura ?? found.width_cm);
      const profundidade = numberOrUndefined(found.profundidade_cm ?? found.profundidade ?? found.comprimento_cm);
      const altura = numberOrUndefined(found.altura_cm ?? found.altura);
      const peso = numberOrUndefined(found.peso_kg ?? found.peso ?? found.peso_bruto_kg);
      const productName = found.descricao || found.nome;

      setNewSlot((prev) => ({
        ...prev,
        productId: prev.productId || found.ean || found.id,
        productName: productName || prev.productName,
        width: largura || prev.width,
        depth: profundidade || prev.depth,
      }));

      const missingVolumes = !largura || !profundidade || !altura || !peso;
      if (missingVolumes) {
        setProductMessage('Produto encontrado, mas sem volumetria completa. Preencha para continuar.');
        openVolumeModal(code, found);
      } else {
        setProductMessage('Produto carregado e volumetria encontrada.');
      }
    } catch (error: any) {
      console.error('Erro ao buscar produto:', error);
      setProductMessage(error?.message || 'Erro ao buscar produto');
    } finally {
      setProductLoading(false);
    }
  };

  const saveVolumetry = async () => {
    const largura = numberOrUndefined(volumeForm.largura);
    const profundidade = numberOrUndefined(volumeForm.profundidade);
    const altura = numberOrUndefined(volumeForm.altura);
    const peso = numberOrUndefined(volumeForm.peso);

    if (!volumeForm.descricao || !volumeForm.ean || !largura || !profundidade || !altura || !peso) {
      setProductMessage('Preencha EAN, descrição e todas as medidas antes de salvar.');
      return;
    }

    const docId = productDocId || volumeForm.ean || newSlot.productId;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/volumetria/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          id: docId,
          ean: volumeForm.ean,
          descricao: volumeForm.descricao,
          largura_cm: largura,
          altura_cm: altura,
          profundidade_cm: profundidade,
          peso_kg: peso,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao salvar volumetria');
      }

      setShowVolumeModal(false);
      setProductMessage('Volumetria salva com sucesso.');

      setNewSlot((prev) => ({
        ...prev,
        productId: prev.productId || volumeForm.ean,
        productName: prev.productName || volumeForm.descricao,
        width: largura,
        depth: profundidade,
      }));

      if (pendingAddProduct) {
        addSlotFromProduct({
          ...pendingAddProduct,
          volumetry: {
            largura_cm: largura,
            profundidade_cm: profundidade,
            altura_cm: altura,
            peso_kg: peso,
          },
          hasVolumetry: true,
        });
        setPendingAddProduct(null);
      }

      await loadProductFromFirestore(docId);
    } catch (error: any) {
      console.error('Erro ao salvar volumetria:', error);
      setProductMessage(error?.message || 'Erro ao salvar volumetria');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkInclude = async () => {
    if (selectedProducts.size === 0) {
      setProductMessage('Selecione ao menos um produto.');
      return;
    }

    const selectedList = productList.filter((p) => selectedProducts.has(p.id));
    if (selectedList.length === 0) return;

    for (const product of selectedList) {
      if (product.hasVolumetry) {
        addSlotFromProduct(product);
      } else {
        // interrompe para forçar preenchimento de volumetria
        setPendingAddProduct(product);
        openVolumeModal(product.ean || product.id, { ...product.volumetry, descricao: product.name, ean: product.ean });
        setShowAddModal(false);
        return;
      }
    }

    // limpeza após adicionar todos com volumetria
    setSelectedProducts(new Set());
    setShowAddModal(false);
  };

  const handleIncludeAllFiltered = () => {
    if (filteredProductList.length === 0) {
      alert('Nenhum produto para incluir.');
      return;
    }

    const confirmed = confirm(
      `Deseja incluir todos os ${filteredProductList.length} produtos listados no planograma?\n\nOs produtos serão adicionados sequencialmente em cada prateleira.`
    );
    if (!confirmed) return;

    // Calcular posição ocupada atual em cada prateleira (considerando slots existentes)
    const shelfOccupancy: Map<string, number> = new Map();
    for (const shelf of shelves) {
      shelfOccupancy.set(shelf.id, 0);
    }

    // Calcular onde termina cada slot existente em cada prateleira
    for (const slot of slots) {
      const currentEnd = shelfOccupancy.get(slot.shelfId) || 0;
      const slotEnd = slot.positionX + (slot.width * slot.facings);
      if (slotEnd > currentEnd) {
        shelfOccupancy.set(slot.shelfId, slotEnd);
      }
    }

    // Adicionar produtos distribuindo automaticamente nas prateleiras
    const newSlots: any[] = [];
    let currentShelfIndex = 0;
    let addedCount = 0;
    let skippedCount = 0;

    for (const product of filteredProductList) {
      const productWidth = product?.volumetry?.largura_cm ? Number(product.volumetry.largura_cm) : 10;
      const pd = product?.volumetry?.profundidade_cm ? Number(product.volumetry.profundidade_cm) : undefined;

      // Encontrar uma prateleira com espaço disponível
      let foundShelf = false;
      const startIndex = currentShelfIndex;

      do {
        const shelfId = shelves[currentShelfIndex].id;
        const shelfWidth = shelves[currentShelfIndex].width;
        const currentEnd = shelfOccupancy.get(shelfId) || 0;

        if (currentEnd + productWidth <= shelfWidth) {
          // Cabe nesta prateleira
          newSlots.push({
            productId: product.ean || product.id,
            productName: product.name,
            shelfId: shelfId,
            positionX: currentEnd,
            width: productWidth,
            depth: pd,
            facings: 1,
            capacity: 10,
          });

          // Atualizar ocupação da prateleira
          shelfOccupancy.set(shelfId, currentEnd + productWidth);
          addedCount++;
          foundShelf = true;
          break;
        } else {
          // Prateleira cheia, tentar a próxima
          currentShelfIndex = (currentShelfIndex + 1) % shelves.length;
        }
      } while (currentShelfIndex !== startIndex);

      if (!foundShelf) {
        // Não há espaço em nenhuma prateleira
        skippedCount++;
      }
    }

    setSlots((prev) => [...prev, ...newSlots]);

    if (skippedCount > 0) {
      alert(`${addedCount} produtos adicionados.\n${skippedCount} produtos não puderam ser adicionados por falta de espaço nas prateleiras.`);
    } else {
      alert(`${addedCount} produtos adicionados e distribuídos automaticamente nas prateleiras!`);
    }
  };

  const includeSingleProduct = (product: any) => {
    if (product.hasVolumetry) {
      addSlotFromProduct(product);
      return;
    }
    setPendingAddProduct(product);
    openVolumeModal(product.ean || product.id, { ...product.volumetry, descricao: product.name, ean: product.ean });
  };

  // Busca server-side com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch.length >= 2 || productSearch.length === 0) {
        fetchProductList(productSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Lista já vem filtrada do servidor
  const filteredProductList = productList;

  // Hook de validação de espaço
  const {
    validation,
    isValid,
    errors,
    warnings,
    canAddSlot,
    findAvailableSpace,
    autoAdjustPosition,
  } = useSpaceValidation({
    shelves,
    slots,
    autoValidate: true,
  });

  const fetchSlots = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base/${id}/slots`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Erro ao carregar slots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser && id) {
      fetchSlots();
    }
  }, [firebaseUser, id]);

  // Carregamento inicial já é feito pelo useEffect de busca com productSearch vazio

  // Buscar dados do produto automaticamente ao digitar
  useEffect(() => {
    const code = newSlot.productId?.trim();
    if (!code) return;

    const timer = setTimeout(() => {
      loadProductFromFirestore(code);
    }, 500);

    return () => clearTimeout(timer);
  }, [newSlot.productId]);

  const handleAddSlot = () => {
    if (!newSlot.productId.trim()) {
      alert('Por favor, informe o ID ou EAN do produto');
      return;
    }

    // Validar se pode adicionar
    const validation = canAddSlot(newSlot.shelfId, newSlot);

    if (!validation.canAdd) {
      // Tentar auto-ajustar posição
      if (validation.suggestedPosition !== undefined) {
        const confirmed = confirm(
          `${validation.reason}\n\nPosição sugerida: ${validation.suggestedPosition.toFixed(1)}cm\n\nDeseja usar esta posição?`
        );

        if (confirmed) {
          const adjustedSlot = { ...newSlot, positionX: validation.suggestedPosition };
          setSlots([...slots, adjustedSlot]);

          // Reset form
          setNewSlot({
            productId: '',
            shelfId: newSlot.shelfId,
            positionX: 0,
            width: 10,
            facings: 1,
            capacity: 10,
          });
        }
      } else {
        alert(validation.reason);
      }
      return;
    }

    // Adicionar produto
    setSlots([...slots, { ...newSlot }]);

    // Reset form
    setNewSlot({
      productId: '',
      shelfId: newSlot.shelfId,
      positionX: 0,
      width: 10,
      facings: 1,
      capacity: 10,
    });
  };

  const handleAutoPosition = () => {
    if (!newSlot.productId.trim()) {
      alert('Por favor, informe o ID ou EAN do produto primeiro');
      return;
    }

    const slotWidth = newSlot.width * newSlot.facings;
    const availableSpace = findAvailableSpace(newSlot.shelfId, slotWidth);

    if (availableSpace) {
      setNewSlot({ ...newSlot, positionX: availableSpace.startX });
      alert(`Posição ajustada automaticamente para ${availableSpace.startX.toFixed(1)}cm`);
    } else {
      alert('Não há espaço disponível nesta prateleira para este produto');
    }
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Verificar validação antes de salvar
    if (!isValid) {
      const confirmSave = confirm(
        `ATENÇÃO: Existem ${errors.length} erro(s) de validação.\n\n` +
        errors.map(e => `- ${e.message}`).join('\n') +
        `\n\nDeseja salvar mesmo assim?`
      );

      if (!confirmSave) return;
    }

    try {
      setSaving(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/base/${id}/slots`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ slots }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar produtos');
      }

      alert('Produtos salvos com sucesso!');
      router.push(`/planogramas/templates/${id}`);
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Calcular espaço total necessário para novo slot
  const newSlotTotalWidth = newSlot.width * newSlot.facings;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/planogramas/templates/${id}`)}
                className="text-[#16476A] hover:text-[#132440]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">
                Gerenciar Produtos do Template
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-white border border-[#E0E0E0] text-[#16476A] hover:bg-[#E0E7EF] transition-all"
              >
                <Plus className="w-4 h-4" />
                Incluir itens
              </button>
              <button
                onClick={handleSave}
                disabled={saving || slots.length === 0}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  isValid
                    ? 'bg-[#16476A] hover:bg-[#132440] text-white'
                    : 'bg-[#BF092F] hover:bg-[#132440] text-white'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {isValid ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    Salvar Produtos ({slots.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Resumo estratégico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-[#757575] uppercase">Status</p>
            <p className={`text-lg font-bold ${isValid ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
              {isValid ? 'Layout válido' : 'Ajustes necessários'}
            </p>
          </div>
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-[#757575] uppercase">Prateleiras</p>
            <p className="text-lg font-bold text-[#212121]">{totalShelves}</p>
          </div>
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-[#757575] uppercase">Produtos adicionados</p>
            <p className="text-lg font-bold text-[#212121]">{totalSlots}</p>
          </div>
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-[#757575] uppercase">Seleção atual</p>
            <p className="text-lg font-bold text-[#212121]">
              {selectedProducts.size} {selectedProducts.size === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </div>

        {/* Validação de Espaço */}
        {validation && (
          <div className="mb-6">
            <SpaceUtilizationView validation={validation} compact />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário - Adicionar Produto */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6 sticky top-4">
              <h2 className="text-lg font-bold text-[#212121] mb-4">Adicionar Produto</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#212121] mb-2">
                    ID ou EAN do Produto *
                  </label>
                  <input
                    type="text"
                    value={newSlot.productId}
                    onChange={(e) => setNewSlot({ ...newSlot, productId: e.target.value })}
                    onBlur={() => loadProductFromFirestore(newSlot.productId)}
                    className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Digite o ID ou EAN"
                  />
                  {productLoading && (
                    <p className="text-xs text-blue-600 mt-1">Buscando produto...</p>
                  )}
                  {productMessage && (
                    <p className="text-xs text-orange-700 mt-1">{productMessage}</p>
                  )}
                  {productInfo && (
                    <div className="mt-2 text-xs text-gray-700 border border-gray-200 rounded-lg p-2 bg-gray-50">
                      <p className="font-semibold">
                        {productInfo.descricao || productInfo.nome || productInfo.id}
                      </p>
                      <p className="mt-1">
                        EAN: {productInfo.ean || '---'} | Larg: {productInfo.largura_cm ?? '---'} cm · Alt: {productInfo.altura_cm ?? '---'} cm · Prof: {productInfo.profundidade_cm ?? '---'} cm
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#212121] mb-2">
                    Prateleira *
                  </label>
                  <select
                    value={newSlot.shelfId}
                    onChange={(e) => setNewSlot({ ...newSlot, shelfId: e.target.value })}
                    className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {shelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        Prateleira {shelf.level} {shelf.eyeLevel ? '👁️ (Nível dos Olhos)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#212121] mb-2">
                      Posição X (cm)
                    </label>
                    <input
                      type="number"
                      value={newSlot.positionX}
                      onChange={(e) => setNewSlot({ ...newSlot, positionX: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#212121] mb-2">
                      Largura (cm)
                    </label>
                    <input
                      type="number"
                      value={newSlot.width}
                      onChange={(e) => setNewSlot({ ...newSlot, width: parseFloat(e.target.value) || 1 })}
                      className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#212121] mb-2">
                      Facings
                    </label>
                    <input
                      type="number"
                      value={newSlot.facings}
                      onChange={(e) => setNewSlot({ ...newSlot, facings: parseInt(e.target.value) || 1 })}
                      className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#212121] mb-2">
                      Capacidade
                    </label>
                    <input
                      type="number"
                      value={newSlot.capacity}
                      onChange={(e) => setNewSlot({ ...newSlot, capacity: parseInt(e.target.value) || 0 })}
                      className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                {/* Indicador de Espaço Necessário */}
                <div className="p-3 bg-[#E0E7EF] border border-[#16476A]/20 rounded-lg">
                  <p className="text-xs text-[#16476A] font-medium mb-1">
                    Espaço necessário:
                  </p>
                  <p className="text-lg font-bold text-[#132440]">
                    {newSlotTotalWidth.toFixed(1)} cm
                  </p>
                  <p className="text-xs text-[#16476A] mt-1">
                    {newSlot.width.toFixed(1)} cm × {newSlot.facings} facing(s)
                  </p>
                </div>

                <button
                  onClick={handleAutoPosition}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#16476A] hover:bg-[#132440] text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Lightbulb className="w-4 h-4" />
                  Sugerir Posição
                </button>

                <button
                  onClick={handleAddSlot}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#BF092F] hover:bg-[#16476A] text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Produto
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Produtos + Validação Completa */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lista de Produtos */}
            <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6">
              <h2 className="text-lg font-bold text-[#212121] mb-4">
                Produtos Adicionados ({slots.length})
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#16476A] mb-2" />
                  <p className="text-[#757575]">Carregando...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#757575]">Nenhum produto adicionado ainda</p>
                  <p className="text-sm text-[#9E9E9E] mt-2">
                    Use o formulário ao lado para adicionar produtos
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map((slot, index) => (
                    <div
                      key={index}
                      className="border border-[#E0E0E0] rounded-lg p-4 flex items-center justify-between hover:border-[#16476A] transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-[#212121] mb-1">
                          {slot.productName || slot.productId}
                        </p>
                        <div className="text-sm text-[#757575] space-y-1">
                          <p>Prateleira: {slot.shelfId} | Posição: {slot.positionX.toFixed(1)} cm</p>
                          <p>
                            Facings: {slot.facings} | Largura: {slot.width.toFixed(1)} cm × {slot.facings} = {(slot.width * slot.facings).toFixed(1)} cm
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSlot(index)}
                        className="ml-4 p-2 text-[#BF092F] hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catálogo completo */}
            <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#212121]">Catálogo de produtos</h2>
                  <p className="text-sm text-gray-600">Selecione itens da lista abaixo para incluir no template.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-lg px-3 py-2 bg-white shadow-sm">
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar: termo% (início) ou %termo% (contém)"
                      className="text-sm text-[#212121] focus:outline-none w-64"
                    />
                  </div>
                  <button
                    onClick={handleIncludeAllFiltered}
                    disabled={filteredProductList.length === 0}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3B9797] hover:bg-[#2d7a7a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
                  >
                    Incluir todos ({filteredProductList.length})
                  </button>
                  <button
                    onClick={handleBulkInclude}
                    disabled={selectedProducts.size === 0}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#BF092F] hover:bg-[#16476A] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
                  >
                    Incluir selecionados ({selectedProducts.size})
                  </button>
                </div>
              </div>
              {productListError && (
                <p className="text-sm text-red-600 mb-2">{productListError}</p>
              )}
              <div className="overflow-auto max-h-[480px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 w-10"></th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Produto</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">EAN</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Volumetria</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productListLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-sm text-gray-700">
                          Carregando catálogo...
                        </td>
                      </tr>
                    ) : filteredProductList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm text-gray-600">
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredProductList.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedProducts.has(p.id)}
                              onChange={() => handleToggleSelect(p.id)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{p.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{p.ean || '—'}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`text-xs px-2 py-1 rounded border ${
                                p.hasVolumetry
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-orange-50 text-orange-700 border-orange-200'
                              }`}
                            >
                              {p.hasVolumetry ? 'Completa' : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => includeSingleProduct(p)}
                              className="text-sm text-[#16476A] hover:text-[#132440] font-semibold"
                            >
                              Incluir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validação Completa */}
            {validation && slots.length > 0 && (
              <SpaceUtilizationView validation={validation} />
            )}
          </div>
        </div>
      </div>

      {/* Modal para complementar volumetria */}
      {showVolumeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold text-[#212121] mb-4">Completar volumetria do produto</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#212121] mb-1">EAN</label>
                <input
                  type="text"
                  value={volumeForm.ean}
                  onChange={(e) => setVolumeForm({ ...volumeForm, ean: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#212121] mb-1">Descrição</label>
                <input
                  type="text"
                  value={volumeForm.descricao}
                  onChange={(e) => setVolumeForm({ ...volumeForm, descricao: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">Largura (cm)</label>
                <input
                  type="number"
                  value={volumeForm.largura}
                  onChange={(e) => setVolumeForm({ ...volumeForm, largura: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">Altura (cm)</label>
                <input
                  type="number"
                  value={volumeForm.altura}
                  onChange={(e) => setVolumeForm({ ...volumeForm, altura: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">Comprimento/Profundidade (cm)</label>
                <input
                  type="number"
                  value={volumeForm.profundidade}
                  onChange={(e) => setVolumeForm({ ...volumeForm, profundidade: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">Peso (kg)</label>
                <input
                  type="number"
                  value={volumeForm.peso}
                  onChange={(e) => setVolumeForm({ ...volumeForm, peso: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowVolumeModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveVolumetry}
                className="px-4 py-2 rounded-lg bg-[#16476A] text-white hover:bg-[#132440]"
              >
                Salvar volumetria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de inclusão em massa */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#212121]">Selecionar produtos</h3>
                <p className="text-sm text-gray-600">Lista em ordem alfabética</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl">
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                {productList.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">Nenhum produto cadastrado.</div>
                ) : (
                  productList.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(p.id)}
                          onChange={() => handleToggleSelect(p.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-600">EAN: {p.ean || '—'}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded border ${
                          p.hasVolumetry
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}
                      >
                        {p.hasVolumetry ? 'Volumetria OK' : 'Volumetria pendente'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkInclude}
                className="px-4 py-2 rounded-lg bg-[#16476A] text-white hover:bg-[#132440]"
              >
                Incluir selecionados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
