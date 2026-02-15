'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  useDroppable,
  useDraggable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  RefreshCw,
  ArrowLeft,
  Grid,
  Undo,
  Redo,
  Save,
  Layers,
} from 'lucide-react';

type Shelf = { id: string; y: number; height: number };
type Product = { id: string; name: string; sku: string; image: string; width: number; height: number };
type Placement = {
  id: string;
  productId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shelfId: string;
};

const sampleProducts: Product[] = [
  { id: 'p1', name: 'Molho de Tomate', sku: 'SKU-001', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&q=80', width: 60, height: 80 },
  { id: 'p2', name: 'Refrigerante Cola', sku: 'SKU-002', image: 'https://images.unsplash.com/photo-1584302179600-016ec2b73d59?w=300&q=80', width: 50, height: 90 },
  { id: 'p3', name: 'Suco Natural', sku: 'SKU-003', image: 'https://images.unsplash.com/photo-1527169402691-feff5539e52c?w=300&q=80', width: 55, height: 85 },
  { id: 'p4', name: 'Detergente', sku: 'SKU-004', image: 'https://images.unsplash.com/photo-1582719478248-72f2ce637c65?w=300&q=80', width: 50, height: 100 },
  { id: 'p5', name: 'Cerveja Premium', sku: 'SKU-005', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7b?w=300&q=80', width: 55, height: 95 },
];

function DraggableProduct({ product }: { product: Product }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: product.id,
    data: { product },
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="group relative border border-[#E0E0E0] rounded-xl p-3 bg-white hover:border-[#3B9797] hover:shadow-md transition"
    >
      <div className="w-full h-20 rounded-lg overflow-hidden bg-[#E0E7EF]">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <p className="mt-2 text-sm font-semibold text-[#212121] line-clamp-2">{product.name}</p>
      <p className="text-xs text-[#757575]">{product.sku}</p>
    </div>
  );
}

function Canvas({
  shelves,
  placements,
  products,
  onDelete,
}: {
  shelves: Shelf[];
  placements: Placement[];
  products: Product[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: 'canvas' });
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  return (
    <div
      ref={setNodeRef}
      className="relative bg-white border-2 border-dashed border-[#E0E0E0] rounded-2xl h-[540px] overflow-hidden"
    >
      {/* Shelves */}
      {shelves.map((shelf) => (
        <div
          key={shelf.id}
          className="absolute left-0 right-0 border-t-2 border-[#3B9797]/40"
          style={{ top: shelf.y }}
        >
          <div className="px-3 py-1 text-[11px] text-[#757575] bg-[#E0E7EF] inline-block rounded-br-lg">
            Prateleira {shelf.id.toUpperCase()}
          </div>
        </div>
      ))}

      {/* Placements */}
      {placements.map((p) => {
        const product = productMap[p.productId];
        if (!product) return null;
        return (
          <div
            key={p.id}
            className="absolute rounded-lg border border-[#3B9797]/40 bg-white shadow-sm overflow-hidden group"
            style={{
              left: p.x,
              top: p.y,
              width: p.width,
              height: p.height,
            }}
          >
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs">
              <span className="font-bold">{product.name}</span>
              <button
                onClick={() => onDelete(p.id)}
                className="px-2 py-1 rounded bg-[#BF092F] hover:bg-[#a30829] text-white"
              >
                Remover
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PlanogramEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const shelves: Shelf[] = [
    { id: 'a', y: 80, height: 100 },
    { id: 'b', y: 180, height: 100 },
    { id: 'c', y: 280, height: 100 },
    { id: 'd', y: 380, height: 100 },
  ];

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [history, setHistory] = useState<Placement[][]>([]);
  const [future, setFuture] = useState<Placement[][]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const pushHistory = (next: Placement[]) => {
    setHistory((prev) => [...prev, placements]);
    setFuture([]);
    setPlacements(next);
  };

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [placements, ...f]);
    setPlacements(prev);
  };

  const handleRedo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, placements]);
    setPlacements(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active, delta } = event;
    if (!over || over.id !== 'canvas') return;
    const product = (active.data.current as any)?.product as Product;
    if (!product) return;

    const activatorEvent = event.activatorEvent as PointerEvent | undefined;
    const target = activatorEvent?.target;
    const canvasRect =
      over.rect ??
      (target instanceof Element && typeof target.getBoundingClientRect === 'function'
        ? target.getBoundingClientRect()
        : undefined);

    const clientX = activatorEvent?.clientX ?? 0;
    const clientY = activatorEvent?.clientY ?? 0;

    // fallback if rect not available
    const baseX = canvasRect?.left ?? 0;
    const baseY = canvasRect?.top ?? 0;
    const x = clientX - baseX - product.width / 2;
    const y = clientY - baseY - product.height / 2;

    // snap to nearest shelf (y)
    const nearest = shelves.reduce(
      (acc, shelf) => {
        const dist = Math.abs((shelf.y + shelf.height / 2) - y);
        return dist < acc.dist ? { shelf, dist } : acc;
      },
      { shelf: shelves[0], dist: Infinity } as { shelf: Shelf; dist: number }
    ).shelf;

    const snappedY = nearest.y + nearest.height - product.height;
    const snappedX = Math.max(8, Math.round(x / 10) * 10);

    const newPlacement: Placement = {
      id: `pl-${Date.now()}`,
      productId: product.id,
      x: snappedX,
      y: snappedY,
      width: product.width,
      height: product.height,
      shelfId: nearest.id,
    };

    pushHistory([...placements, newPlacement]);
  };

  const handleDeletePlacement = (placementId: string) => {
    pushHistory(placements.filter((p) => p.id !== placementId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] text-[#212121]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-[#3B9797]/25 bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] text-white shadow-2xl">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, #FFFFFF22, transparent 35%), radial-gradient(circle at 80% 0%, #FFFFFF11, transparent 30%)',
            }}
          />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.push('/planogramas/templates')}
                className="p-2 rounded-2xl bg-white/10 border border-white/25 hover:bg-white/15 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[#E0E7EF] font-semibold">
                  Editor de Planograma
                </p>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">Template {id}</h1>
                <p className="text-sm text-[#E0E7EF] mt-1">Arraste produtos para montar a gôndola</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleUndo}
                disabled={!history.length}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/20 font-semibold disabled:opacity-50"
              >
                <Undo className="w-4 h-4" />
                Desfazer
              </button>
              <button
                onClick={handleRedo}
                disabled={!future.length}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/20 font-semibold disabled:opacity-50"
              >
                <Redo className="w-4 h-4" />
                Refazer
              </button>
              <button className="inline-flex items-center gap-2 bg-white text-[#16476A] px-4 py-2 rounded-xl font-bold shadow-lg border border-[#3B9797]/30">
                <Save className="w-4 h-4" />
                Salvar (mock)
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[#16476A] font-bold">
                  <Layers className="w-5 h-5" />
                  Biblioteca
                </div>
                <span className="text-xs text-[#757575]">{sampleProducts.length} produtos</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sampleProducts.map((product) => (
                  <DraggableProduct key={product.id} product={product} />
                ))}
              </div>
              <p className="text-xs text-[#757575] mt-3">
                Arraste um produto para o canvas ao lado e solte sobre uma prateleira.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-4">
              <div className="flex items-center gap-2 text-[#16476A] font-bold mb-2">
                <Grid className="w-5 h-5" />
                Dicas rápidas
              </div>
              <ul className="text-sm text-[#757575] space-y-1">
                <li>- Snap horizontal a cada 10px.</li>
                <li>- Solte próximo à prateleira; o item alinha sozinho.</li>
                <li>- Use Desfazer/Refazer para experimentar.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-9 rounded-2xl border border-[#E0E0E0] bg-[#F8F9FA] p-4 shadow-sm">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <Canvas shelves={shelves} placements={placements} products={sampleProducts} onDelete={handleDeletePlacement} />
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
