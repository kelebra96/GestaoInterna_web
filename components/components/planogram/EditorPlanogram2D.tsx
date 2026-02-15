'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
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
    Apple,
    Beer,
    Gauge,
    Layers,
    Milk,
    Package,
    Redo2,
    Save,
    Search,
    Sparkles,
    SprayCan,
    Trash2,
    Undo2,
    Wine,
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
const SLOT_GAP_PX = 6;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const GRID_STEP_CM = 2;
const VERSION_BADGE = 'EditorPlanogram2D v2.2 - 2026-01-31';
const DEBUG_ALWAYS_SHOW_LABEL = true;

const CATEGORY_COLORS = ['#16476A', '#3B9797', '#BF092F', '#F59E0B', '#6B7280'];
const getCategoryColor = (category?: string) => {
  if (!category) return '#6B7280';
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash + category.charCodeAt(i) * (i + 1)) % 997;
  }
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
};

const getShortSku = (sku?: string, fallback?: string) => {
  const raw = sku || fallback || '';
  if (raw.length <= 6) return raw.toUpperCase();
  return raw.slice(-6).toUpperCase();
};

const normalizeCategory = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const getCategoryIcon = (category?: string) => {
  const value = normalizeCategory(category);
  if (value.includes('vinho')) return { Icon: Wine, name: 'Wine' };
  if (value.includes('cerveja')) return { Icon: Beer, name: 'Beer' };
  if (value.includes('energetico')) return { Icon: Gauge, name: 'Gauge' };
  if (value.includes('refrigerante')) return { Icon: SprayCan, name: 'SprayCan' };
  if (value.includes('suco')) return { Icon: Apple, name: 'Apple' };
  if (value.includes('agua')) return { Icon: Milk, name: 'Milk' };
  return { Icon: Package, name: 'Package' };
};

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
      <div className="h-20 rounded-lg overflow-hidden bg-[#F3F6F9] flex items-center justify-center border border-[#3B9797]/20">
        <div className="flex flex-col items-center gap-1 text-[#16476A]">
          <Package className="w-7 h-7" />
          <span className="text-[10px] font-semibold">Produto</span>
        </div>
      </div>
      <p className="mt-2 text-[13px] font-bold text-[#212121] leading-tight break-words">{product.name}</p>
      <p className="text-[11px] text-[#757575] break-words">{product.sku}</p>
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
        'relative w-full rounded-2xl border-2 border-dashed overflow-visible transition',
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
  visualWidthPx,
  hitWidthPx,
  onRemove,
  onChange,
  onHover,
  onSelect,
  zoom,
}: {
  slot: SlotDraft;
  product?: Product;
  left: number;
  visualWidthPx: number;
  hitWidthPx: number;
  onRemove: (id: string) => void;
  onChange: (id: string, update: Partial<SlotDraft>) => void;
  onHover: (slotId: string | null, widthPx?: number, meta?: { left: number; visualWidth: number }) => void;
  onSelect: (slot: SlotDraft, product?: Product) => void;
  zoom: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id || slot.tempId || `slot-${slot.productId}`,
    data: { type: 'slot', slot },
  });

  const isCompact = visualWidthPx < 70;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        left,
        width: hitWidthPx,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={clsx(
        'absolute top-2 h-24 rounded-xl border shadow-sm overflow-hidden group transition',
        isDragging ? 'opacity-70 ring-2 ring-[#3B9797]' : 'opacity-100',
        'bg-white border-[#3B9797]/30'
      )}
      onMouseEnter={() => onHover(slot.id, Math.round(visualWidthPx * zoom), { left, visualWidth: visualWidthPx })}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(slot, product)}
    >
      <div className="absolute inset-0 border border-dashed border-[#3B9797]/25 pointer-events-none" style={{ width: visualWidthPx }} />
      <div className="flex h-full">
        <div className="w-[52px] h-full flex items-center justify-center border-r border-[#3B9797]/25" style={{ backgroundColor: getCategoryColor(product?.category) }}>
          <div className="flex flex-col items-center gap-1 text-white">
            {(() => {
              const { Icon } = getCategoryIcon(product?.category);
              return <Icon className="w-4 h-4" />;
            })()}
            <span className="text-[9px] font-semibold">{getShortSku(product?.sku, slot.productId)}</span>
          </div>
        </div>
        <div className="flex-1 p-2 flex flex-col">
          {isCompact ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-semibold text-[#212121] truncate">
                {getShortSku(product?.sku, slot.productId)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                <p className="text-[12px] font-bold text-[#212121] leading-tight line-clamp-2">
                  {product?.name || 'Produto'}
                </p>
                <p className="text-[10px] text-[#757575] truncate">{product?.sku || slot.productId}</p>
              </div>
              <button
                onClick={() => onRemove(slot.id)}
                className="p-1 rounded-full text-[#BF092F] hover:bg-[#BF092F]/10 transition"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {!isCompact && (
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
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#E9ECEF]">
        <div
          className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A]"
          style={{ width: `${Math.min(100, Math.round((slot.width || DEFAULT_WIDTH) / DEFAULT_WIDTH * 100))}%` }}
        />
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
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);
  const [hoverWidthPx, setHoverWidthPx] = useState<number | null>(null);
  const [hoverMeta, setHoverMeta] = useState<{ left: number; visualWidth: number } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: SlotDraft; product?: Product } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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

  const computeBaseScale = (shelfWidthCm: number) => {
    const pxWidth = Math.min(1080, Math.max(520, shelfWidthCm * PX_PER_CM));
    return pxWidth / shelfWidthCm;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z + delta).toFixed(2)))));
  };

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    if (event.button !== 1) return;
    setIsPanning(true);
    panStart.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
  };

  const handlePanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStart.current) return;
    setPan({ x: event.clientX - panStart.current.x, y: event.clientY - panStart.current.y });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  const handleFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
    const baseScale = computeBaseScale(targetShelf?.width || 100);
    const scale = baseScale * zoom;
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
    const activeRect = event.active.rect.current.translated || event.active.rect.current.initial;
    const dropLeftPx = typeof activeRect?.left === 'number' ? activeRect.left - baseX : clientX - baseX;
    let xCm = Math.max(0, dropLeftPx / scale);
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="absolute right-6 top-6 z-10 px-3 py-1 rounded-full bg-white/90 border border-[#E0E0E0] text-[11px] font-semibold text-[#16476A] shadow-sm">
            {VERSION_BADGE}
          </div>
          {/* Biblioteca de produtos */}
          <div className="lg:w-80 shrink-0 bg-white border border-[#E0E0E0] rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-[calc(100dvh-220px)] overflow-hidden lg:sticky lg:top-6 self-start">
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

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
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
          <div className="flex-1 bg-white border border-[#E0E0E0] rounded-2xl shadow-sm p-4 space-y-3 relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-[#757575] font-semibold">Editor visual</p>
                <h3 className="text-xl font-bold text-[#16476A]">Arraste os produtos para as prateleiras</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-xl border border-[#E0E0E0] bg-[#F8F9FA] px-2 py-1 text-xs text-[#16476A] font-semibold">
                  Zoom {Math.round(zoom * 100)}%
                </div>
                <button
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Number((z + 0.1).toFixed(2))))}
                  className="px-3 py-2 rounded-xl border border-[#E0E0E0] text-[#16476A] hover:border-[#3B9797] text-xs font-semibold"
                >
                  Zoom +
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Number((z - 0.1).toFixed(2))))}
                  className="px-3 py-2 rounded-xl border border-[#E0E0E0] text-[#16476A] hover:border-[#3B9797] text-xs font-semibold"
                >
                  Zoom -
                </button>
                <button
                  onClick={handleFit}
                  className="px-3 py-2 rounded-xl border border-[#E0E0E0] text-[#16476A] hover:border-[#3B9797] text-xs font-semibold"
                >
                  Ajustar
                </button>
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

            <div
              className="space-y-6 relative"
              onWheel={handleWheel}
              onPointerDown={handlePanStart}
              onPointerMove={handlePanMove}
              onPointerUp={handlePanEnd}
              onPointerLeave={handlePanEnd}
              style={{ cursor: isPanning ? 'grabbing' : 'default' }}
            >
              <div
                style={{
                  position: 'fixed',
                  top: 12,
                  right: 12,
                  zIndex: 999999,
                  background: '#ff00cc',
                  color: '#000',
                  border: '3px solid #000',
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.2px',
                }}
              >
                HUD ZOOM: {Math.round(zoom * 100)}%
              </div>
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 9999,
                background: '#000',
                color: '#fff',
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 12,
              }}>
                ZOOM: {Math.round(zoom * 100)}%
              </div>
              <div className="absolute left-3 top-3 z-20 rounded-lg border border-[#E0E0E0] bg-white/90 px-3 py-2 text-[11px] font-semibold text-[#16476A] shadow-sm">
                <div>ZOOM: {Math.round(zoom * 100)}%</div>
                <div>ITEM widthPx: {hoverWidthPx ?? '—'}</div>
              </div>
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
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
              {resolvedShelves.map((shelf) => {
                const shelfSlots = slots.filter((slot) => slot.shelfId === shelf.id);
                const shelfWidthCm = shelf.width || 100;
                const baseScale = computeBaseScale(shelfWidthCm);
                const scale = baseScale * zoom;
                const shelfWidthPx = shelfWidthCm * baseScale;
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
                      <div
                        className="relative overflow-visible"
                        style={{
                          width: shelfWidthPx * zoom,
                          minHeight: 120 * zoom,
                        }}
                      >
                        {DEBUG_ALWAYS_SHOW_LABEL && (
                          <div className="absolute inset-0 pointer-events-none overflow-visible">
                            {shelfSlots.map((slot, idx) => {
                              const product = productMap[slot.productId];
                              const { Icon, name: iconSelected } = getCategoryIcon(product?.category);
                              const visualWidthPx = (slot.width || product?.width || DEFAULT_WIDTH) * baseScale;
                              const left = (slot.positionX || 0) * baseScale + idx * SLOT_GAP_PX;
                              const leftScaled = left * zoom;
                              const clampLeft = Math.max(0, Math.min(leftScaled, shelfWidthPx * zoom - 140));
                              const shelfRect = shelvesRefs.current[shelf.id]?.getBoundingClientRect();
                              const labelTop = shelfRect ? shelfRect.top - 38 : 0;
                              const labelLeft = shelfRect ? shelfRect.left + clampLeft : 0;

                              const labelNode = (
                                <div
                                  className="absolute"
                                  style={{
                                    top: -38,
                                    left: clampLeft,
                                    minWidth: 140,
                                    zIndex: 99999,
                                  }}
                                >
                                  <div className="flex items-center gap-2 rounded-xl border-4 border-red-600 bg-yellow-200 px-3 py-2 shadow-lg text-[11px] text-[#16476A]">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: getCategoryColor(product?.category) }}>
                                      <Icon className="h-4 w-4 text-white" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold truncate">{getShortSku(product?.sku, slot.productId)}</p>
                                      <p className="font-bold text-[#212121] truncate">{product?.name || 'Produto'}</p>
                                      <p className="text-[10px] text-[#212121] truncate">categoryRaw: {product?.category || '—'}</p>
                                      <p className="text-[10px] text-[#212121] truncate">iconSelected: {iconSelected}</p>
                                      <p className="text-[10px] text-[#212121] truncate">visualWidthPx: {Math.round(visualWidthPx * zoom)}</p>
                                    </div>
                                  </div>
                                </div>
                              );

                              if (typeof document === 'undefined' || !shelfRect) {
                                return <div key={`label-${slot.id}`}>{labelNode}</div>;
                              }

                              return createPortal(
                                <div
                                  key={`label-portal-${slot.id}`}
                                  style={{
                                    position: 'fixed',
                                    top: labelTop,
                                    left: labelLeft,
                                    minWidth: 140,
                                    zIndex: 99999,
                                  }}
                                >
                                  <div className="flex items-center gap-2 rounded-xl border-4 border-red-600 bg-yellow-200 px-3 py-2 shadow-lg text-[11px] text-[#16476A]">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: getCategoryColor(product?.category) }}>
                                      <Icon className="h-4 w-4 text-white" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold truncate">{getShortSku(product?.sku, slot.productId)}</p>
                                      <p className="font-bold text-[#212121] truncate">{product?.name || 'Produto'}</p>
                                      <p className="text-[10px] text-[#212121] truncate">categoryRaw: {product?.category || '—'}</p>
                                      <p className="text-[10px] text-[#212121] truncate">iconSelected: {iconSelected}</p>
                                      <p className="text-[10px] text-[#212121] truncate">visualWidthPx: {Math.round(visualWidthPx * zoom)}</p>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              );
                            })}
                          </div>
                        )}
                        <div
                          className="relative"
                          style={{
                            width: shelfWidthPx,
                            minHeight: 120,
                            transform: `scale(${zoom})`,
                            transformOrigin: 'left top',
                            backgroundImage: `repeating-linear-gradient(90deg, rgba(22,71,106,0.12) 0, rgba(22,71,106,0.12) 1px, transparent 1px, transparent ${GRID_STEP_CM * baseScale}px)`,
                          }}
                        >
                        {shelfSlots
                          .sort((a, b) => (a.positionX || 0) - (b.positionX || 0))
                          .map((slot, idx) => {
                            const product = productMap[slot.productId];
                            const left = (slot.positionX || 0) * baseScale + idx * SLOT_GAP_PX;
                            const visualWidthPx = (slot.width || product?.width || DEFAULT_WIDTH) * baseScale;
                            const hitWidthPx = Math.max(44, visualWidthPx);
                            return (
                              <SlotItem
                                key={slot.id}
                                slot={slot}
                                product={product}
                                left={left}
                                visualWidthPx={visualWidthPx}
                                hitWidthPx={hitWidthPx}
                                onRemove={handleRemoveSlot}
                                onChange={handleUpdateSlot}
                                onHover={(slotId, widthPx, meta) => {
                                  setHoverSlotId(slotId);
                                  setHoverWidthPx(widthPx ?? null);
                                  setHoverMeta(meta ?? null);
                                }}
                                onSelect={(slotItem, productItem) => {
                                  if (isMobile) setSelectedSlot({ slot: slotItem, product: productItem });
                                }}
                                zoom={zoom}
                              />
                            );
                          })}
                        {shelfSlots.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-[#757575] text-sm">
                            Arraste um produto para cá
                          </div>
                        )}
                        </div>
                      </div>
                    </ShelfDropZone>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>

        {hoverSlotId && !isMobile && hoverMeta && (
          <div className="fixed bottom-6 right-6 z-50 max-w-xs rounded-2xl border border-[#E0E0E0] bg-white p-4 shadow-xl text-xs text-[#212121]">
            {(() => {
              const slot = slots.find((s) => s.id === hoverSlotId);
              if (!slot) return null;
              const product = productMap[slot.productId];
              return (
                <div className="space-y-1">
                  <p className="text-sm font-bold">{product?.name || 'Produto'}</p>
                  <p className="text-[#757575]">SKU/EAN: {product?.sku || slot.productId}</p>
                  <p className="text-[#757575]">Facings: {slot.facings || 1}</p>
                  <p className="text-[#757575]">Largura: {Math.round(slot.width || DEFAULT_WIDTH)}cm</p>
                </div>
              );
            })()}
          </div>
        )}

        {selectedSlot && isMobile && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
            <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-[#16476A]">Detalhes do produto</h4>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="text-[#BF092F] font-semibold"
                >
                  Fechar
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-bold">{selectedSlot.product?.name || 'Produto'}</p>
                <p className="text-[#757575]">SKU/EAN: {selectedSlot.product?.sku || selectedSlot.slot.productId}</p>
                <p className="text-[#757575]">Facings: {selectedSlot.slot.facings || 1}</p>
                <p className="text-[#757575]">Largura: {Math.round(selectedSlot.slot.width || DEFAULT_WIDTH)}cm</p>
              </div>
            </div>
          </div>
        )}
      </DndContext>
    </div>
  );
}
