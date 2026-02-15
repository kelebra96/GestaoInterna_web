'use client';

import { Package, Trash2, X } from 'lucide-react';
import { getCategoryColor, getCategoryIcon, resolveEffectiveCategory } from './SlotGlyph';

interface InspectorPanelProps {
  productName?: string;
  sku?: string;
  ean?: string;
  category?: string;
  fallbackCategory?: string;
  facings?: number;
  widthCm?: number;
  price?: number;
  margin?: number;
  imageUrl?: string;
  isSelected?: boolean;
  onClose?: () => void;
  onRemove?: () => void;
  onChangeFacings?: (delta: number) => void;
}

export default function InspectorPanel({
  productName,
  sku,
  ean,
  category,
  fallbackCategory,
  facings = 1,
  widthCm,
  price,
  margin,
  imageUrl,
  isSelected = false,
  onClose,
  onRemove,
  onChangeFacings,
}: InspectorPanelProps) {
  const effectiveCategory = resolveEffectiveCategory(category, fallbackCategory);
  const color = getCategoryColor(effectiveCategory);
  const { Icon, name: iconName } = getCategoryIcon(effectiveCategory);

  if (!productName && !sku) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <Package className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">Nenhum item selecionado</p>
        <p className="text-xs mt-1">Passe o mouse ou clique em um slot</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {isSelected ? 'Selecionado' : 'Detalhes'}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Ícone + Categoria */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
            style={{ backgroundColor: color }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Categoria</p>
            <p className="text-sm font-semibold text-gray-900">
              {effectiveCategory || 'Sem categoria'}
            </p>
          </div>
        </div>

        {/* Nome */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Produto</p>
          <p className="text-base font-bold text-gray-900 leading-tight">
            {productName || 'Sem nome'}
          </p>
        </div>

        {/* SKU / EAN */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">SKU</p>
            <p className="text-sm font-mono font-medium text-gray-700">
              {sku || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">EAN</p>
            <p className="text-sm font-mono font-medium text-gray-700">
              {ean || '—'}
            </p>
          </div>
        </div>

        {/* Facings */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Frentes (facings)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeFacings?.(-1)}
              disabled={facings <= 1}
              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
            >
              −
            </button>
            <span className="w-12 text-center text-lg font-bold text-[#16476A]">
              {facings}
            </span>
            <button
              onClick={() => onChangeFacings?.(1)}
              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Largura */}
        {widthCm !== undefined && (
          <div>
            <p className="text-xs text-gray-500">Largura</p>
            <p className="text-sm font-semibold text-gray-900">
              {Math.round(widthCm)} cm
            </p>
          </div>
        )}

        {/* Preço / Margem */}
        {(price !== undefined || margin !== undefined) && (
          <div className="grid grid-cols-2 gap-3">
            {price !== undefined && (
              <div>
                <p className="text-xs text-gray-500">Preço</p>
                <p className="text-sm font-semibold text-green-600">
                  R$ {price.toFixed(2)}
                </p>
              </div>
            )}
            {margin !== undefined && (
              <div>
                <p className="text-xs text-gray-500">Margem</p>
                <p className="text-sm font-semibold text-blue-600">
                  {margin.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Debug info (apenas em dev) */}
        {process.env.NEXT_PUBLIC_DEBUG_PLANOGRAM === '1' && (
          <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-[10px] font-mono text-gray-500">
              icon: {iconName}
            </p>
            <p className="text-[10px] font-mono text-gray-500">
              color: {color}
            </p>
            <p className="text-[10px] font-mono text-gray-500">
              categoryRaw: {category || '—'}
            </p>
            <p className="text-[10px] font-mono text-gray-500">
              categoryEffective: {effectiveCategory || '—'}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {isSelected && onRemove && (
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onRemove}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition font-semibold text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Remover do planograma
          </button>
        </div>
      )}
    </div>
  );
}
