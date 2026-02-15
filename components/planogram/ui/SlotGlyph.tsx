'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import {
  Apple,
  Beer,
  CupSoda,
  Droplets,
  Gauge,
  Milk,
  Package,
  Sandwich,
  ShoppingBasket,
  SprayCan,
  Wine,
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================
export type VisualMode = 'compact' | 'normal' | 'detailed';

export interface SlotGlyphProps {
  productName?: string;
  sku?: string;
  category?: string;
  fallbackCategory?: string; // categoria do planograma
  facings?: number;
  widthCm?: number;
  visualWidthPx: number;
  mode: VisualMode;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

// ============================================================
// RESOLVE VISUAL MODE
// ============================================================
export function resolveVisualMode(visualWidthPx: number, zoom: number): VisualMode {
  const effectiveWidth = visualWidthPx * zoom;
  if (effectiveWidth < 70) return 'compact';
  if (effectiveWidth < 110) return 'normal';
  if (zoom >= 1.2) return 'detailed';
  return 'normal';
}

// ============================================================
// CATEGORIA NORMALIZADA
// ============================================================
const normalizeCategory = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

// ============================================================
// RESOLVE CATEGORIA EFETIVA
// ============================================================
export function resolveEffectiveCategory(
  productCategory?: string,
  fallbackCategory?: string
): string {
  // Se produto tem categoria válida (não genérica), usa ela
  const normalized = normalizeCategory(productCategory);
  if (normalized && normalized !== 'geral' && normalized !== 'outros' && normalized !== 'sem categoria') {
    return productCategory || '';
  }
  // Senão, usa categoria do planograma como fallback
  return fallbackCategory || productCategory || '';
}

// ============================================================
// COR POR CATEGORIA
// ============================================================
const CATEGORY_COLORS: Record<string, string> = {
  bebidas: '#0891b2',      // cyan-600
  refrigerante: '#0891b2',
  cerveja: '#d97706',      // amber-600
  vinho: '#7c3aed',        // violet-600
  agua: '#0ea5e9',         // sky-500
  suco: '#65a30d',         // lime-600
  energetico: '#dc2626',   // red-600
  limpeza: '#2563eb',      // blue-600
  higiene: '#0d9488',      // teal-600
  alimentos: '#ea580c',    // orange-600
  massas: '#f59e0b',       // amber-500
  frios: '#06b6d4',        // cyan-500
  laticinios: '#fafafa',   // white (com outline)
  padaria: '#92400e',      // amber-800
  hortifruti: '#16a34a',   // green-600
  carnes: '#b91c1c',       // red-700
};

const DEFAULT_CATEGORY_COLOR = '#6b7280'; // gray-500

export function getCategoryColor(category?: string): string {
  const normalized = normalizeCategory(category);

  // Busca direta
  if (CATEGORY_COLORS[normalized]) {
    return CATEGORY_COLORS[normalized];
  }

  // Busca parcial
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return color;
    }
  }

  // Hash-based fallback para consistência
  if (category) {
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = (hash + category.charCodeAt(i) * (i + 1)) % 997;
    }
    const colors = Object.values(CATEGORY_COLORS);
    return colors[hash % colors.length];
  }

  return DEFAULT_CATEGORY_COLOR;
}

// ============================================================
// ÍCONE POR CATEGORIA
// ============================================================
type IconComponent = typeof Package;

interface CategoryIconResult {
  Icon: IconComponent;
  name: string;
}

export function getCategoryIcon(category?: string): CategoryIconResult {
  const normalized = normalizeCategory(category);

  // Bebidas
  if (normalized.includes('vinho') || normalized.includes('wine')) {
    return { Icon: Wine, name: 'Wine' };
  }
  if (normalized.includes('cerveja') || normalized.includes('beer')) {
    return { Icon: Beer, name: 'Beer' };
  }
  if (normalized.includes('energetico') || normalized.includes('energy')) {
    return { Icon: Gauge, name: 'Gauge' };
  }
  if (normalized.includes('refrigerante') || normalized.includes('soda') || normalized.includes('bebida')) {
    return { Icon: CupSoda, name: 'CupSoda' };
  }
  if (normalized.includes('suco') || normalized.includes('juice')) {
    return { Icon: Apple, name: 'Apple' };
  }
  if (normalized.includes('agua') || normalized.includes('water')) {
    return { Icon: Droplets, name: 'Droplets' };
  }
  if (normalized.includes('leite') || normalized.includes('laticinios') || normalized.includes('milk')) {
    return { Icon: Milk, name: 'Milk' };
  }

  // Limpeza
  if (normalized.includes('limpeza') || normalized.includes('higiene') || normalized.includes('clean')) {
    return { Icon: SprayCan, name: 'SprayCan' };
  }

  // Alimentos
  if (normalized.includes('alimento') || normalized.includes('comida') || normalized.includes('food')) {
    return { Icon: ShoppingBasket, name: 'ShoppingBasket' };
  }
  if (normalized.includes('padaria') || normalized.includes('pao') || normalized.includes('bread')) {
    return { Icon: Sandwich, name: 'Sandwich' };
  }

  // Fallback
  return { Icon: Package, name: 'Package' };
}

// ============================================================
// SHORT SKU
// ============================================================
export function getShortSku(sku?: string, fallback?: string, length = 6): string {
  const raw = sku || fallback || '';
  if (raw.length <= length) return raw.toUpperCase();
  return raw.slice(-length).toUpperCase();
}

// ============================================================
// SLOT GLYPH COMPONENT
// ============================================================
export default function SlotGlyph({
  productName,
  sku,
  category,
  fallbackCategory,
  facings = 1,
  widthCm,
  visualWidthPx,
  mode,
  isSelected = false,
  isHovered = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: SlotGlyphProps) {
  const effectiveCategory = resolveEffectiveCategory(category, fallbackCategory);
  const color = getCategoryColor(effectiveCategory);
  const { Icon } = getCategoryIcon(effectiveCategory);
  const shortSku = getShortSku(sku);

  const containerClasses = clsx(
    'relative h-full rounded-lg overflow-hidden transition-all duration-150 cursor-pointer',
    'border-2',
    isSelected
      ? 'border-[#16476A] ring-2 ring-[#16476A]/30 shadow-lg'
      : isHovered
        ? 'border-[#3B9797] shadow-md'
        : 'border-transparent',
    'hover:shadow-md'
  );

  // Contraste: se cor clara, usa texto escuro
  const isLightColor = color === '#fafafa';
  const textColor = isLightColor ? '#374151' : '#ffffff';
  const iconBgOpacity = isLightColor ? 'bg-gray-200' : '';

  return (
    <div
      className={containerClasses}
      style={{ width: visualWidthPx, backgroundColor: color }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Badge de facings */}
      {facings > 1 && (
        <div
          className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-white/90 flex items-center justify-center text-[10px] font-bold shadow-sm"
          style={{ color }}
        >
          {facings}
        </div>
      )}

      {mode === 'compact' && (
        <div className="h-full flex items-center justify-center">
          <Icon className="w-5 h-5" style={{ color: textColor }} />
        </div>
      )}

      {mode === 'normal' && (
        <div className="h-full flex flex-col items-center justify-center gap-1 p-1">
          <Icon className="w-4 h-4" style={{ color: textColor }} />
          <span
            className="text-[9px] font-semibold truncate max-w-full px-1"
            style={{ color: textColor }}
          >
            {shortSku}
          </span>
        </div>
      )}

      {mode === 'detailed' && (
        <div className="h-full flex flex-col items-center justify-center gap-1 p-2">
          <Icon className="w-5 h-5" style={{ color: textColor }} />
          <span
            className="text-[10px] font-bold truncate max-w-full text-center leading-tight line-clamp-1"
            style={{ color: textColor }}
          >
            {productName || 'Produto'}
          </span>
          <span
            className="text-[9px] font-medium opacity-80"
            style={{ color: textColor }}
          >
            {shortSku}
          </span>
        </div>
      )}

      {/* Indicador de largura na base */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
        <div
          className="h-full bg-white/40"
          style={{ width: `${Math.min(100, (widthCm || 10) * 3)}%` }}
        />
      </div>
    </div>
  );
}
