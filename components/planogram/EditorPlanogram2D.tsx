'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { PlanogramSlot, Product, Shelf } from '@prisma/client';
import clsx from 'clsx';
import {
    Gauge,
    Layers,
    Redo2,
    Save,
    Search,
    Sparkles,
    Trash2,
    Undo2,
} from 'lucide-react';

type SlotDraft = PlanogramSlot & { tempId?: string };

interface EditorPlanogram2DProps {
  shelves: Shelf[];
  products: Product[];
  initialSlots: PlanogramSlot[];
  onSave: (slots: SlotDraft[]) => void | Promise<void>;
  saving?: boolean;
}

const PX_PER_CM = 3; // base scale for shelf width rendering
const DEFAULT_WIDTH = 30; // cm fallback when product width is missing

function ProductCard({ product }: { product: Product }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `product-${product.id}`,
    data: { type: 'product', product },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.65 : 1,
      }}
      className="group rounded-xl border border-[#E0E0E0] bg-white p-3 shadow-sm hover:border-[#3B9797] hover:shadow-md transition cursor-grab active:cursor-grabbing"
    >
      <div className="h-20 rounded-lg overflow-hidden bg-[#E0E7EF] flex items-center justify-center border border-[#3B9797]/15">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-xs font-semibold text-[#16476A] px-2 text-center">
            Sem imagem
          </div>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#212121] line-clamp-2">{product.name}</p>
      <p className="text-xs text-[#757575]">{product.sku}</p>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#3B9797] font-semibold">
        <span>{Math.round(product.width || DEFAULT_WIDTH)}cm</span>
        <span className="text-[#BFC7C9]">·</span>
        <span>R${product.price?.toFixed(2) || '0,00'}</span>
        {product.margin !== undefined && (
          <>
            <span className="text-[#BFC7C9]">·</span>
            <span>{product.margin.toFixed(1)}% margem</span>
          </>
        )}
      </div>
    </div>
  );
}

function ShelfDropZone({
  shelf,
  children,
  registerRef,
}: {
  shelf: Shelf;
  children: React.ReactNode;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: shelf.id,
    data: { type: 'shelf', shelfId: shelf.id },
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerRef(shelf.id, node);
      }}
      className={clsx(
        'relative w-full rounded-2xl border-2 border-dashed overflow-hidden transition',
        isOver ? 'border-[#3B9797] shadow-lg' : 'border-[#E0E0E0]'
      )}
      style={{
        backgroundColor: '#f4f7fb',
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(224,231,239,0.95) 70%, rgba(200,210,220,0.98) 100%), repeating-linear-gradient(90deg, rgba(22,71,106,0.06) 0, rgba(22,71,106,0.06) 8px, transparent 8px, transparent 16px)',
        backgroundSize: 'cover',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
        minHeight: 160,
      }}
    >
      <div className="absolute inset-0 bg-white/45 pointer-events-none" />
      {children}
    </div>
  );
}

function SlotItem({
  slot,
  product,
  left,
  widthPx,
  onRemove,
  onChange,
}: {
  slot: SlotDraft;
  product?: Product;
  left: number;
  widthPx: number;
  onRemove: (id: string) => void;
  onChange: (id: string, update: Partial<SlotDraft>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id || slot.tempId || `slot-${slot.productId}`,
    data: { type: 'slot', slot },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        left,
        width: widthPx,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={clsx(
        'absolute top-2 h-24 rounded-xl border shadow-sm overflow-hidden group transition',
        isDragging ? 'opacity-70 ring-2 ring-[#3B9797]' : 'opacity-100',
        slot.facings > 1 ? 'bg-[#E0E7EF]' : 'bg-white',
        'border-[#3B9797]/30'
      )}
    >
      <div className="flex h-full">
        <div className="w-[72px] h-full bg-[#E0E7EF] flex items-center justify-center border-r border-[#3B9797]/25">
          {product?.imageUrl ? (
            <img src={product.imageUrl} alt={product?.name || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="text-[10px] font-semibold text-[#16476A] px-2 text-center leading-tight">
              {product?.name || slot.productId}
            </div>
          )}
        </div>
        <div className="flex-1 p-2 flex flex-col">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div>
              <p className="font-semibold text-[#212121] line-clamp-1">{product?.name || 'Produto'}</p>
              <p className="text-[#757575]">{product?.sku}</p>
            </div>
            <button
              onClick={() => onRemove(slot.id)}
              className="p-1 rounded-full text-[#BF092F] hover:bg-[#BF092F]/10 transition"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#16476A] font-semibold mt-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange(slot.id, { facings: Math.max(1, (slot.facings || 1) - 1) })}
                className="w-6 h-6 rounded-lg bg-[#E0E7EF] text-[#16476A] flex items-center justify-center hover:bg-[#3B9797]/15"
              >
                -
              </button>
              <span className="px-2 py-1 rounded-lg bg-[#E0E7EF] border border-[#3B9797]/20">
                {slot.facings || 1} frentes
              </span>
              <button
                onClick={() => onChange(slot.id, { facings: (slot.facings || 1) + 1 })}
                className="w-6 h-6 rounded-lg bg-[#E0E7EF] text-[#16476A] flex items-center justify-center hover:bg-[#3B9797]/15"
              >
                +
              </button>
            </div>
            <span className="text-[#757575]">{Math.round(slot.width || DEFAULT_WIDTH)}cm</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPlanogram2D({
  shelves,
  products,
  initialSlots,
  onSave,
  saving: savingProp,
}: EditorPlanogram2DProps) {
  const normalizeSlots = (slots: PlanogramSlot[]): SlotDraft[] =>
    (slots || []).map((slot, idx) => ({
      id: slot.id || `slot-${idx}`,
      tempId: slot.id ? undefined : `tmp-${idx}`,
      shelfId: slot.shelfId,
      productId: slot.productId,
      positionX:
        typeof (slot as any).positionX === 'string'
          ? parseFloat((slot as any).positionX) || 0
          : slot.positionX ?? 0,
      width:
        typeof (slot as any).width === 'string'
          ? parseFloat((slot as any).width) || DEFAULT_WIDTH
          : slot.width ?? DEFAULT_WIDTH,
      facings: slot.facings ?? 1,
      capacity: slot.capacity ?? Math.max(1, Math.round(slot.width || DEFAULT_WIDTH)),
      planogramBaseId: slot.planogramBaseId ?? null,
      planogramStoreId: slot.planogramStoreId ?? null,
      createdAt: (slot as any).createdAt ?? new Date(),
      updatedAt: (slot as any).updatedAt ?? new Date(),
    }));

  const [slots, setSlots] = useState<SlotDraft[]>(() => normalizeSlots(initialSlots));
  const [history, setHistory] = useState<SlotDraft[][]>([]);
  const [future, setFuture] = useState<SlotDraft[][]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('todas');
  const [localSaving, setLocalSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);

  const resolvedShelves: Shelf[] = useMemo(
    () =>
      shelves.length
        ? shelves
        : [
            {
              id: 'mock-shelf',
              storeId: 'mock-store',
              gondolaCode: 'A',
              width: 120,
              depth: 40,
              height: 40,
              level: 'eyes' as any,
              createdAt: new Date(),
              updatedAt: new Date(),
              slots: [] as any,
            },
          ],
    [shelves]
  );

  // Fallback de produtos mock quando não há produtos reais carregados
  const mockProducts: Product[] = useMemo(
    () => [
      {
        id: 'mock-1',
        orgId: 'mock',
        sku: 'SKU-MOCK-1',
        ean: null as any,
        name: 'Molho de Tomate',
        brand: 'Marca A',
        category: 'Massas',
        subcategory: 'Molhos',
        width: 6,
        height: 12,
        depth: 6,
        price: 7.9,
        margin: 22,
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=320&q=70',
        canStack: false,
        maxStackVertical: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        planogramSlots: [] as any,
        hourlySales: [] as any,
        ruptureEvents: [] as any,
        inventorySnapshots: [] as any,
      },
      {
        id: 'mock-2',
        orgId: 'mock',
        sku: 'SKU-MOCK-2',
        ean: null as any,
        name: 'Refrigerante Cola',
        brand: 'Marca B',
        category: 'Bebidas',
        subcategory: 'Refrigerantes',
        width: 7,
        height: 24,
        depth: 7,
        price: 6.5,
        margin: 18,
        imageUrl: 'https://images.unsplash.com/photo-1584302179600-016ec2b73d59?w=320&q=70',
        canStack: false,
        maxStackVertical: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        planogramSlots: [] as any,
        hourlySales: [] as any,
        ruptureEvents: [] as any,
        inventorySnapshots: [] as any,
      },
      {
        id: 'mock-3',
        orgId: 'mock',
        sku: 'SKU-MOCK-3',
        ean: null as any,
        name: 'Detergente Neutro',
        brand: 'Marca C',
        category: 'Limpeza',
        subcategory: 'Detergentes',
        width: 6,
        height: 22,
        depth: 6,
        price: 4.5,
        margin: 30,
        imageUrl: 'https://images.unsplash.com/photo-1582719478248-72f2ce637c65?w=320&q=70',
        canStack: false,
        maxStackVertical: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        planogramSlots: [] as any,
        hourlySales: [] as any,
        ruptureEvents: [] as any,
        inventorySnapshots: [] as any,
      },
    ],
    []
  );

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    (products.length ? products : mockProducts).forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products, mockProducts]);

  const shelvesMap = useMemo(() => {
    const map: Record<string, Shelf> = {};
    resolvedShelves.forEach((s) => (map[s.id] = s));
    return map;
  }, [resolvedShelves]);

  const shelvesRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filteredProducts = useMemo(() => {
    const source = products.length ? products : mockProducts;
    const term = search.toLowerCase();
    return source
      .filter((p) =>
        category === 'todas'
          ? true
          : p.category?.toLowerCase() === category.toLowerCase()
      )
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.ean || '').toLowerCase().includes(term)
      )
      .sort((a, b) => (b.margin || 0) - (a.margin || 0));
  }, [products, search, category]);

  const metrics = useMemo(() => {
    const totalSlots = slots.length;
    const totalFacings = slots.reduce((acc, slot) => acc + (slot.facings || 1), 0);
    const uniqueSkus = new Set(slots.map((s) => s.productId)).size;
    return { totalSlots, totalFacings, uniqueSkus };
  }, [slots]);

  const computeScale = (shelfWidthCm: number) => {
    const pxWidth = Math.min(1080, Math.max(520, shelfWidthCm * PX_PER_CM));
    return pxWidth / shelfWidthCm;
  };

  const pushSlots = (next: SlotDraft[]) => {
    setHistory((prev) => [...prev.slice(-14), slots]);
    setFuture([]);
    setSlots(next);
    setDirty(true);
  };

  const handleUndo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [slots, ...f]);
    setSlots(previous);
    setDirty(true);
  };

  const handleRedo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, slots]);
    setSlots(next);
    setDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overShelfId =
      ((event.over?.data.current as any)?.shelfId as string | undefined) ||
      (event.over?.id ? String(event.over.id) : undefined);
    if (!overShelfId) return;

    const targetShelf = shelvesMap[overShelfId];
    const scale = computeScale(targetShelf?.width || 100);
    const rect = shelvesRefs.current[overShelfId]?.getBoundingClientRect();
    const overRect = (event.over as any)?.rect;

    const clientX =
      (event.activatorEvent as PointerEvent)?.clientX ??
      (event.activatorEvent as MouseEvent)?.clientX ??
      0;

    const baseX =
      rect?.left ??
      (typeof overRect?.left === 'number' ? overRect.left : 0);

    const targetWidth = targetShelf?.width || 100;
    let xCm = Math.max(0, (clientX - baseX) / scale);
    if (!Number.isFinite(xCm) || xCm === 0) {
      // Fallback: centraliza se não conseguir calcular posição
      xCm = targetWidth / 2;
    }

    // New product drop
    if (event.active.data.current?.type === 'product') {
      const product = event.active.data.current?.product as Product;
      const slotWidth = Math.min(targetShelf?.width || DEFAULT_WIDTH, product.width || DEFAULT_WIDTH);
      const newSlot: SlotDraft = {
        id: `slot-${Date.now()}`,
        tempId: `slot-${Date.now()}`,
        shelfId: overShelfId,
        productId: product.id,
        positionX: Number(xCm.toFixed(1)),
        width: Number(slotWidth.toFixed(1)),
        facings: 1,
        capacity: Math.max(1, Math.round(slotWidth)),
        planogramBaseId: null,
        planogramStoreId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      pushSlots([...slots, newSlot]);
    }

    // Move existing slot
    if (event.active.data.current?.type === 'slot') {
      const draggedSlot = event.active.data.current.slot as SlotDraft;
      const product = productMap[draggedSlot.productId];
      const slotWidth = draggedSlot.width || product?.width || DEFAULT_WIDTH;

      pushSlots(
        slots.map((slot) =>
          slot.id === draggedSlot.id
            ? {
                ...slot,
                shelfId: overShelfId,
                positionX: Number(xCm.toFixed(1)),
                width: Number(slotWidth.toFixed(1)),
              }
            : slot
        )
      );
    }
  };

  const handleRemoveSlot = (slotId: string) => {
    pushSlots(slots.filter((s) => s.id !== slotId));
  };

  const handleUpdateSlot = (slotId: string, update: Partial<SlotDraft>) => {
    pushSlots(
      slots.map((slot) => (slot.id === slotId ? { ...slot, ...update, updatedAt: new Date() } : slot))
    );
  };

  const handleSaveClick = async () => {
    try {
      setLocalSaving(true);
      await onSave(slots);
      setDirty(false);
    } finally {
      setLocalSaving(false);
    }
  };

  // Auto-save após operações de arrastar/soltar
  useEffect(() => {
    if (!autoSave || !dirty || autoSaving) return;
    let cancelled = false;
    setAutoSaving(true);
    const savePromise = Promise.resolve(onSave(slots));
    savePromise
      .then(() => {
        if (!cancelled) {
          setDirty(false);
        }
      })
      .catch((err) => {
        console.warn('Falha ao salvar automaticamente', err);
        if (!cancelled) {
          setAutoSave(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAutoSaving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slots, autoSave, dirty, onSave]);

  // Sync external slot updates (ex: recarregou do servidor)
  useEffect(() => {
    setSlots(normalizeSlots(initialSlots));
    setHistory([]);
    setFuture([]);
    setDirty(false);
  }, [initialSlots]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-sm">
          <Gauge className="w-5 h-5 text-[#16476A]" />
          <div>
            <p className="text-xs text-[#757575]">Facings totais</p>
            <p className="text-xl font-bold text-[#16476A]">{metrics.totalFacings}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-sm">
          <Layers className="w-5 h-5 text-[#3B9797]" />
          <div>
            <p className="text-xs text-[#757575]">Slots</p>
            <p className="text-xl font-bold text-[#16476A]">{metrics.totalSlots}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-sm">
          <Sparkles className="w-5 h-5 text-[#BF092F]" />
          <div>
            <p className="text-xs text-[#757575]">SKUs distintos</p>
            <p className="text-xl font-bold text-[#16476A]">{metrics.uniqueSkus}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Biblioteca de produtos */}
        <div className="lg:w-80 shrink-0 bg-white border border-[#E0E0E0] rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-[#16476A] font-bold">
            <Layers className="w-5 h-5" />
            <span>Biblioteca</span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-[#757575] absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU ou EAN"
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-[#E0E0E0] focus:ring-2 focus:ring-[#3B9797] focus:border-transparent text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['todas', ...new Set((products.length ? products : mockProducts).map((p) => p.category))].map((cat) => (
              <button
                key={cat || 'blank'}
                onClick={() => setCategory(cat || 'todas')}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition',
                  category === (cat || 'todas')
                    ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white border-[#3B9797]'
                    : 'bg-[#F8F9FA] text-[#16476A] border-[#E0E0E0] hover:border-[#3B9797]'
                )}
              >
                {cat || 'Sem categoria'}
              </button>
            ))}
          </div>

          <div className="h-[520px] overflow-y-auto space-y-3 pr-1">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-[#757575] text-center py-6">
                Nenhum produto encontrado com esse filtro.
              </p>
            )}
            {products.length === 0 && (
              <div className="rounded-xl border border-[#E0E0E0] bg-[#F8F9FA] p-3 text-xs text-[#757575]">
                Mostrando produtos mock para teste. Preencha <code>imageUrl</code> no cadastro de produtos para ver as imagens reais aqui.
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-white border border-[#E0E0E0] rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-[#757575] font-semibold">Editor visual</p>
              <h3 className="text-xl font-bold text-[#16476A]">Arraste os produtos para as prateleiras</h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-[#16476A] font-semibold px-3 py-2 rounded-xl border border-[#E0E0E0] bg-[#F8F9FA]">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded text-[#16476A] focus:ring-[#3B9797]"
                />
                Salvar ao soltar
                {autoSaving && <span className="text-[#757575]">(salvando...)</span>}
              </label>
              <button
                onClick={handleUndo}
                disabled={!history.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E0E0E0] text-[#16476A] hover:border-[#3B9797] disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" />
                Desfazer
              </button>
              <button
                onClick={handleRedo}
                disabled={!future.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E0E0E0] text-[#16476A] hover:border-[#3B9797] disabled:opacity-50"
              >
                <Redo2 className="w-4 h-4" />
                Refazer
              </button>
              <button
                onClick={handleSaveClick}
                disabled={savingProp || localSaving || !dirty}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white font-bold shadow-lg disabled:opacity-50"
              >
                {savingProp || localSaving ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar slots
                  </>
                )}
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="space-y-6">
              {(!shelves || shelves.length === 0) && (
                <div className="rounded-2xl border-2 border-dashed border-[#E0E0E0] overflow-hidden">
                  <div
                    className="relative h-52 flex items-center justify-center text-[#757575] text-sm"
                    style={{
                      backgroundColor: '#f4f7fb',
                      backgroundImage:
                        'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(224,231,239,0.95) 70%, rgba(200,210,220,0.98) 100%), repeating-linear-gradient(90deg, rgba(22,71,106,0.06) 0, rgba(22,71,106,0.06) 8px, transparent 8px, transparent 16px)',
                      backgroundSize: 'cover',
                      backgroundRepeat: 'repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="absolute inset-0 bg-white/45" />
                    <span className="relative z-10 font-semibold">
                      Nenhuma prateleira cadastrada para este template
                    </span>
                  </div>
                </div>
              )}
              {resolvedShelves.map((shelf) => {
                const shelfSlots = slots.filter((slot) => slot.shelfId === shelf.id);
                const shelfWidthCm = shelf.width || 100;
                const scale = computeScale(shelfWidthCm);
                const shelfWidthPx = shelfWidthCm * scale;
                const usedCm = shelfSlots.reduce((acc, slot) => acc + (slot.width || DEFAULT_WIDTH), 0);
                const usage = Math.min(100, Math.round((usedCm / (shelfWidthCm || 1)) * 100));

                return (
                  <div key={shelf.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-[#212121]">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#16476A]">Prateleira {shelf.gondolaCode || shelf.id}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-[#E0E7EF] text-[#16476A] border border-[#3B9797]/25">
                          Largura {Math.round(shelfWidthCm)}cm
                        </span>
                      </div>
                      <span className="text-xs text-[#757575]">Ocupação: {usage}%</span>
                    </div>
                    <div className="w-full bg-[#E0E0E0] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A]"
                        style={{ width: `${usage}%` }}
                      />
                    </div>

                    <ShelfDropZone
                      shelf={shelf}
                      registerRef={(id, el) => (shelvesRefs.current[id] = el)}
                    >
                      <div className="relative" style={{ width: shelfWidthPx, minHeight: 120 }}>
                        {shelfSlots
                          .sort((a, b) => (a.positionX || 0) - (b.positionX || 0))
                          .map((slot) => {
                            const product = productMap[slot.productId];
                            const left = (slot.positionX || 0) * scale;
                            const widthPx = (slot.width || product?.width || DEFAULT_WIDTH) * scale;
                            return (
                              <SlotItem
                                key={slot.id}
                                slot={slot}
                                product={product}
                                left={left}
                                widthPx={widthPx}
                                onRemove={handleRemoveSlot}
                                onChange={handleUpdateSlot}
                              />
                            );
                          })}
                        {shelfSlots.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-[#757575] text-sm">
                            Arraste um produto para cá
                          </div>
                        )}
                      </div>
                    </ShelfDropZone>
                  </div>
                );
              })}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
