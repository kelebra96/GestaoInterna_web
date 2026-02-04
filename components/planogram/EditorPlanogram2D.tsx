'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Gauge,
  Layers,
  Package,
  Redo2,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';

import SlotGlyph, {
  resolveVisualMode,
  getCategoryColor,
  getCategoryIcon,
  getShortSku,
  type VisualMode,
} from './ui/SlotGlyph';
import SlotTooltip from './ui/SlotTooltip';
import InspectorPanel from './ui/InspectorPanel';

// ============================================================
// TIPOS E CONSTANTES
// ============================================================
type SlotDraft = PlanogramSlot & { tempId?: string };

interface EditorPlanogram2DProps {
  shelves: Shelf[];
  products: Product[];
  initialSlots: PlanogramSlot[];
  planogramCategory?: string; // categoria do planograma para fallback
  onSave: (slots: SlotDraft[]) => void | Promise<void>;
  saving?: boolean;
}

const PX_PER_CM = 3;
const DEFAULT_WIDTH = 30;
const SLOT_GAP_PX = 4;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const SLOT_HEIGHT_PX = 80;

// Debug apenas via env var
const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_PLANOGRAM === '1';

// ============================================================
// PRODUCT CARD (Biblioteca)
// ============================================================
function ProductCard({ product }: { product: Product }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `product-${product.id}`,
    data: { type: 'product', product },
  });

  const { Icon } = getCategoryIcon(product.category);
  const color = getCategoryColor(product.category);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.65 : 1,
      }}
      className="group rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-[#3B9797] hover:shadow-md transition cursor-grab active:cursor-grabbing"
    >
      <div
        className="h-16 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="mt-2 text-sm font-bold text-gray-900 leading-tight line-clamp-2">
        {product.name}
      </p>
      <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
        <span className="font-medium">{Math.round(product.width || DEFAULT_WIDTH)}cm</span>
        {product.price && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-green-600 font-medium">R${product.price.toFixed(2)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SHELF DROP ZONE
// ============================================================
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
        'relative w-full rounded-xl border-2 overflow-visible transition',
        isOver ? 'border-[#3B9797] bg-[#3B9797]/5' : 'border-gray-200 bg-gray-50'
      )}
      style={{ minHeight: SLOT_HEIGHT_PX + 24 }}
    >
      {children}
    </div>
  );
}

// ============================================================
// SLOT ITEM (Draggable wrapper)
// ============================================================
function SlotItemWrapper({
  slot,
  product,
  left,
  visualWidthPx,
  zoom,
  planogramCategory,
  isSelected,
  isHovered,
  onHover,
  onSelect,
}: {
  slot: SlotDraft;
  product?: Product;
  left: number;
  visualWidthPx: number;
  zoom: number;
  planogramCategory?: string;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (slotId: string | null) => void;
  onSelect: (slot: SlotDraft, product?: Product) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id || slot.tempId || `slot-${slot.productId}`,
    data: { type: 'slot', slot },
  });

  const mode = resolveVisualMode(visualWidthPx, zoom);
  const minWidth = 32; // mínimo para interação

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: 'absolute',
        left,
        top: 8,
        height: SLOT_HEIGHT_PX,
        width: Math.max(minWidth, visualWidthPx),
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
      }}
      className="transition-opacity"
    >
      <SlotTooltip
        productName={product?.name}
        sku={product?.sku}
        ean={product?.ean || undefined}
        category={product?.category || undefined}
        fallbackCategory={planogramCategory}
        facings={slot.facings || 1}
        widthCm={slot.width || product?.width}
        disabled={isDragging}
      >
        <SlotGlyph
          productName={product?.name}
          sku={product?.sku}
          category={product?.category || undefined}
          fallbackCategory={planogramCategory}
          facings={slot.facings || 1}
          widthCm={slot.width || product?.width}
          visualWidthPx={Math.max(minWidth, visualWidthPx)}
          mode={mode}
          isSelected={isSelected}
          isHovered={isHovered}
          onClick={() => onSelect(slot, product)}
          onMouseEnter={() => onHover(slot.id)}
          onMouseLeave={() => onHover(null)}
        />
      </SlotTooltip>
    </div>
  );
}

// ============================================================
// MAIN EDITOR COMPONENT
// ============================================================
export default function EditorPlanogram2D({
  shelves,
  products,
  initialSlots,
  planogramCategory,
  onSave,
  saving: savingProp,
}: EditorPlanogram2DProps) {
  // Normalização de slots
  const normalizeSlots = (slots: PlanogramSlot[]): SlotDraft[] =>
    (slots || []).map((slot, idx) => ({
      id: slot.id || `slot-${idx}`,
      tempId: slot.id ? undefined : `tmp-${idx}`,
      shelfId: slot.shelfId,
      productId: slot.productId,
      positionX: typeof (slot as any).positionX === 'string'
        ? parseFloat((slot as any).positionX) || 0
        : slot.positionX ?? 0,
      width: typeof (slot as any).width === 'string'
        ? parseFloat((slot as any).width) || DEFAULT_WIDTH
        : slot.width ?? DEFAULT_WIDTH,
      facings: slot.facings ?? 1,
      capacity: slot.capacity ?? Math.max(1, Math.round(slot.width || DEFAULT_WIDTH)),
      planogramBaseId: slot.planogramBaseId ?? null,
      planogramStoreId: slot.planogramStoreId ?? null,
      createdAt: (slot as any).createdAt ?? new Date(),
      updatedAt: (slot as any).updatedAt ?? new Date(),
    }));

  // State
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
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  // Fallback shelves
  const resolvedShelves: Shelf[] = useMemo(
    () => shelves.length ? shelves : [{
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
    }],
    [shelves]
  );

  // Product map
  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  // Shelf map
  const shelvesMap = useMemo(() => {
    const map: Record<string, Shelf> = {};
    resolvedShelves.forEach((s) => (map[s.id] = s));
    return map;
  }, [resolvedShelves]);

  const shelvesRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Filtered products
  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products
      .filter((p) => category === 'todas' || p.category?.toLowerCase() === category.toLowerCase())
      .filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.ean || '').toLowerCase().includes(term)
      )
      .sort((a, b) => (b.margin || 0) - (a.margin || 0));
  }, [products, search, category]);

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ['todas', ...Array.from(cats)];
  }, [products]);

  // Metrics
  const metrics = useMemo(() => ({
    totalSlots: slots.length,
    totalFacings: slots.reduce((acc, slot) => acc + (slot.facings || 1), 0),
    uniqueSkus: new Set(slots.map((s) => s.productId)).size,
  }), [slots]);

  // Selected/Hovered slot data
  const selectedSlot = useMemo(() => {
    const s = slots.find((slot) => slot.id === selectedSlotId);
    return s ? { slot: s, product: productMap[s.productId] } : null;
  }, [slots, selectedSlotId, productMap]);

  const hoveredSlot = useMemo(() => {
    const s = slots.find((slot) => slot.id === hoverSlotId);
    return s ? { slot: s, product: productMap[s.productId] } : null;
  }, [slots, hoverSlotId, productMap]);

  const inspectorData = selectedSlot || hoveredSlot;

  // Scale calculation
  const computeBaseScale = (shelfWidthCm: number) => {
    const pxWidth = Math.min(1000, Math.max(400, shelfWidthCm * PX_PER_CM));
    return pxWidth / shelfWidthCm;
  };

  // Handlers
  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z + delta).toFixed(2)))));
  };

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 1) return; // middle click only
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
    // Debug logs
    console.log('[DragEnd]', {
      'active.id': event.active.id,
      'active.type': event.active.data.current?.type,
      'over.id': event.over?.id ?? null,
      'over.type': event.over?.data.current?.type ?? null,
    });

    const overShelfId = ((event.over?.data.current as any)?.shelfId as string | undefined) ||
      (event.over?.id ? String(event.over.id) : undefined);

    console.log('[DragEnd] overShelfId:', overShelfId);

    if (!overShelfId) {
      console.log('[DragEnd] ABORT: no overShelfId');
      return;
    }

    const targetShelf = shelvesMap[overShelfId];
    const baseScale = computeBaseScale(targetShelf?.width || 100);
    const scale = baseScale * zoom;
    const rect = shelvesRefs.current[overShelfId]?.getBoundingClientRect();

    const clientX = (event.activatorEvent as PointerEvent)?.clientX ?? 0;
    const baseX = rect?.left ?? 0;
    const activeRect = event.active.rect.current.translated || event.active.rect.current.initial;
    const dropLeftPx = typeof activeRect?.left === 'number' ? activeRect.left - baseX : clientX - baseX;
    let xCm = Math.max(0, dropLeftPx / scale);
    if (!Number.isFinite(xCm)) xCm = (targetShelf?.width || 100) / 2;

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

    if (event.active.data.current?.type === 'slot') {
      const draggedSlot = event.active.data.current.slot as SlotDraft;
      const product = productMap[draggedSlot.productId];
      const slotWidth = draggedSlot.width || product?.width || DEFAULT_WIDTH;
      pushSlots(
        slots.map((slot) =>
          slot.id === draggedSlot.id
            ? { ...slot, shelfId: overShelfId, positionX: Number(xCm.toFixed(1)), width: Number(slotWidth.toFixed(1)) }
            : slot
        )
      );
    }
  };

  const handleRemoveSlot = (slotId: string) => {
    pushSlots(slots.filter((s) => s.id !== slotId));
    if (selectedSlotId === slotId) setSelectedSlotId(null);
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

  const handleSelectSlot = (slot: SlotDraft, product?: Product) => {
    setSelectedSlotId((prev) => (prev === slot.id ? null : slot.id));
  };

  // Auto-save
  useEffect(() => {
    if (!autoSave || !dirty || autoSaving) return;
    let cancelled = false;
    setAutoSaving(true);
    Promise.resolve(onSave(slots))
      .then(() => { if (!cancelled) setDirty(false); })
      .catch(() => { if (!cancelled) setAutoSave(false); })
      .finally(() => { if (!cancelled) setAutoSaving(false); });
    return () => { cancelled = true; };
  }, [slots, autoSave, dirty, onSave, autoSaving]);

  // Sync external updates
  useEffect(() => {
    setSlots(normalizeSlots(initialSlots));
    setHistory([]);
    setFuture([]);
    setDirty(false);
  }, [initialSlots]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Biblioteca de produtos */}
        <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[#16476A] font-bold mb-3">
            <Layers className="w-5 h-5" />
            <span>Biblioteca</span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
            />
          </div>
          <div className="flex gap-1 flex-wrap mt-3">
            {categories.map((cat) => (
              <button
                key={cat || 'todas'}
                onClick={() => setCategory(cat || 'todas')}
                className={clsx(
                  'px-2 py-1 rounded-full text-xs font-medium transition',
                  category === cat
                    ? 'bg-[#16476A] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {cat || 'Todas'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {filteredProducts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum produto encontrado</p>
          )}
        </div>
      </div>

      {/* Editor principal */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#16476A]" />
              <span className="font-bold text-[#16476A]">{metrics.totalFacings}</span>
              <span className="text-gray-500">facings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#3B9797]" />
              <span className="font-bold text-[#16476A]">{metrics.totalSlots}</span>
              <span className="text-gray-500">slots</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-[#16476A]">{metrics.uniqueSkus}</span>
              <span className="text-gray-500">SKUs</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs font-medium text-gray-600">
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <button
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs hover:bg-gray-50"
            >
              −
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs hover:bg-gray-50"
            >
              +
            </button>
            <button
              onClick={handleFit}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs hover:bg-gray-50"
            >
              Ajustar
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
              onClick={handleUndo}
              disabled={!history.length}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              title="Desfazer"
            >
              <Undo2 className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!future.length}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              title="Refazer"
            >
              <Redo2 className="w-4 h-4 text-gray-600" />
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded text-[#16476A] focus:ring-[#3B9797]"
              />
              Auto-save
              {autoSaving && <span className="text-gray-400">(salvando...)</span>}
            </label>

            <button
              onClick={handleSaveClick}
              disabled={savingProp || localSaving || !dirty}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#16476A] text-white text-xs font-semibold hover:bg-[#0d3a5c] disabled:opacity-50"
            >
              {savingProp || localSaving ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto p-4"
            onWheel={handleWheel}
            onPointerDown={handlePanStart}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerLeave={handlePanEnd}
            style={{ cursor: isPanning ? 'grabbing' : 'default' }}
          >
            <div
              className="space-y-6"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              {resolvedShelves.map((shelf) => {
                const shelfSlots = slots.filter((slot) => slot.shelfId === shelf.id);
                const shelfWidthCm = shelf.width || 100;
                const baseScale = computeBaseScale(shelfWidthCm);
                const shelfWidthPx = shelfWidthCm * baseScale;
                const usedCm = shelfSlots.reduce((acc, slot) => acc + (slot.width || DEFAULT_WIDTH), 0);
                const usage = Math.min(100, Math.round((usedCm / shelfWidthCm) * 100));

                return (
                  <div key={shelf.id} className="space-y-2">
                    {/* Shelf header */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">
                          Prateleira {shelf.gondolaCode || shelf.id.slice(0, 8)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {Math.round(shelfWidthCm)}cm
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A] transition-all"
                            style={{ width: `${usage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{usage}%</span>
                      </div>
                    </div>

                    {/* Shelf drop zone */}
                    <ShelfDropZone
                      shelf={shelf}
                      registerRef={(id, el) => (shelvesRefs.current[id] = el)}
                    >
                      <div
                        className="relative"
                        style={{
                          width: shelfWidthPx * zoom,
                          height: SLOT_HEIGHT_PX + 16,
                          transform: `scale(${zoom})`,
                          transformOrigin: 'left top',
                        }}
                      >
                        {shelfSlots
                          .sort((a, b) => (a.positionX || 0) - (b.positionX || 0))
                          .map((slot, idx) => {
                            const product = productMap[slot.productId];
                            const left = (slot.positionX || 0) * baseScale + idx * SLOT_GAP_PX;
                            const visualWidthPx = (slot.width || product?.width || DEFAULT_WIDTH) * baseScale;

                            return (
                              <SlotItemWrapper
                                key={slot.id}
                                slot={slot}
                                product={product}
                                left={left}
                                visualWidthPx={visualWidthPx}
                                zoom={zoom}
                                planogramCategory={planogramCategory}
                                isSelected={selectedSlotId === slot.id}
                                isHovered={hoverSlotId === slot.id}
                                onHover={setHoverSlotId}
                                onSelect={handleSelectSlot}
                              />
                            );
                          })}

                        {shelfSlots.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                            Arraste produtos para cá
                          </div>
                        )}
                      </div>
                    </ShelfDropZone>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {/* Inspector Panel */}
      <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <InspectorPanel
          productName={inspectorData?.product?.name}
          sku={inspectorData?.product?.sku}
          ean={inspectorData?.product?.ean || undefined}
          category={inspectorData?.product?.category || undefined}
          fallbackCategory={planogramCategory}
          facings={inspectorData?.slot?.facings || 1}
          widthCm={inspectorData?.slot?.width || inspectorData?.product?.width}
          price={inspectorData?.product?.price || undefined}
          margin={inspectorData?.product?.margin || undefined}
          isSelected={!!selectedSlot}
          onClose={selectedSlot ? () => setSelectedSlotId(null) : undefined}
          onRemove={selectedSlot ? () => handleRemoveSlot(selectedSlot.slot.id) : undefined}
          onChangeFacings={
            selectedSlot
              ? (delta) =>
                  handleUpdateSlot(selectedSlot.slot.id, {
                    facings: Math.max(1, (selectedSlot.slot.facings || 1) + delta),
                  })
              : undefined
          }
        />
      </div>
      </div>
    </DndContext>
  );
}
