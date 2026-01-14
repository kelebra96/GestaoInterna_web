'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { PlanogramBase, PlanogramSlot, Product, Shelf } from '@prisma/client';
import EditorPlanogram2D from '@/components/planogram/EditorPlanogram2D';
import { useAuth } from '@/contexts/AuthContext';

export default function EditPlanogramTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planogram, setPlanogram] = useState<PlanogramBase | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [slots, setSlots] = useState<PlanogramSlot[]>([]);

  const safeFetch = async (url: string, headers: any) => {
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`Falha em ${url}: ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.error('[planograma editar] erro ao buscar', url, err);
      return null;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const token = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Planograma
      const planogramResponse = await fetch(`/api/planograms/base/${id}`, { headers });

      if (!planogramResponse.ok) {
        throw new Error('Falha ao carregar template de planograma');
      }
      const planogramData = await planogramResponse.json();
      setPlanogram(planogramData.planogram);

      // Produtos: tenta volumetria; se falhar, tenta /api/products; se falhar, segue com mock/empty
      const productsData =
        (await safeFetch(`/api/volumetria/products`, headers)) ||
        (await safeFetch(`/api/products`, headers)) ||
        { products: [] };

      const normalizedProducts: Product[] = (productsData.products || []).map((p: any, idx: number) => {
        const width = Number(p.volumetry?.largura_cm ?? p.largura_cm ?? p.largura ?? 6) || 6;
        const height = Number(p.volumetry?.altura_cm ?? p.altura_cm ?? p.altura ?? 20) || 20;
        const depth = Number(p.volumetry?.profundidade_cm ?? p.profundidade_cm ?? p.profundidade ?? 6) || 6;
        return {
          id: p.id || p.ean || `prod-${idx}`,
          orgId: 'volumetria',
          sku: p.sku || p.ean || p.id || `SKU-${idx}`,
          ean: p.ean || null as any,
          name: p.name || p.descricao || p.nome || 'Produto',
          brand: p.fornecedor || p.comprador || 'Marca',
          category: p.categoria || 'Geral',
          subcategory: p.subcategoria || undefined,
          width,
          height,
          depth,
          price: Number(p.preco ?? 0) || 0,
          margin: Number(p.margem ?? 0) || 0,
          imageUrl: p.imageUrl || null as any,
          canStack: false,
          maxStackVertical: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          planogramSlots: [] as any,
          hourlySales: [] as any,
          ruptureEvents: [] as any,
          inventorySnapshots: [] as any,
        };
      });
      setProducts(normalizedProducts);

      // Prateleiras
      const shelvesData = (await safeFetch(`/api/shelves`, headers)) || { shelves: [] };
      setShelves(shelvesData.shelves || []);

      // Slots
      const slotsData =
        (await safeFetch(`/api/planograms/base/${id}/slots`, headers)) || {
          slots: planogramData.planogram?.slots || [],
        };
      setSlots(slotsData.slots || planogramData.planogram?.slots || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && firebaseUser) {
      loadData();
    } else if (!firebaseUser) {
      setError('Usuário não autenticado. Faça login novamente.');
      setLoading(false);
    }
  }, [id, firebaseUser]);

  const handleSave = async (nextSlots: any[]) => {
    if (!firebaseUser) {
      alert('Usuário não autenticado.');
      return;
    }

    try {
      setSaving(true);
      const token = await firebaseUser.getIdToken();

      const payload = nextSlots.map((slot) => ({
        productId: slot.productId,
        shelfId: slot.shelfId,
        positionX: Number(slot.positionX) || 0,
        width: Number(slot.width) || 1,
        facings: slot.facings || 1,
        capacity: slot.capacity ?? Math.max(1, Math.round(slot.width || 1)),
      }));

      const response = await fetch(`/api/planograms/base/${id}/slots`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots: payload }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao salvar slots');
      }

      const data = await response.json();
      setSlots(data.slots || nextSlots);
      alert('Planograma salvo com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] flex items-center justify-center">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-8 shadow-md text-center">
          <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin mx-auto mb-3" />
          <p className="text-[#757575]">Carregando editor de planograma...</p>
        </div>
      </div>
    );
  }

  if (error || !planogram) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-8 shadow-sm max-w-lg w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#BF092F] mx-auto" />
          <p className="text-[#212121] font-semibold">{error || 'Template não encontrado'}</p>
          <button
            onClick={() => router.push('/planogramas/templates')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#3B9797] text-[#16476A] hover:bg-[#E0E7EF]"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-[#3B9797]/25 bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] text-white shadow-2xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-10 -left-16 w-40 h-40 bg-white/15 blur-3xl rounded-full" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#BF092F]/14 blur-3xl rounded-full" />
          </div>
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.push(`/planogramas/templates/${id}`)}
                className="p-2 rounded-2xl bg-white/10 border border-white/25 hover:bg-white/15 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[#E0E7EF] font-semibold">
                  Editor de planograma
                </p>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">{planogram.name}</h1>
                <p className="text-sm text-[#E0E7EF] mt-1">
                  Arraste produtos para montar o template. As alterações são gravadas via Firestore.
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-semibold">
                    Categoria: {planogram.category}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-semibold">
                    Status: {planogram.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                {slots.length} slots carregados
              </span>
              <span className="px-3 py-2 rounded-xl bg-white text-[#16476A] font-bold border border-[#3B9797]/40 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#BF092F]" />
                Modo arraste e solte ativo
              </span>
            </div>
          </div>
        </header>

        <EditorPlanogram2D
          shelves={shelves}
          products={products}
          initialSlots={slots}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
