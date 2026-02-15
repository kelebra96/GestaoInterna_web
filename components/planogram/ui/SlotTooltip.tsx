'use client';

import { ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCategoryColor, getCategoryIcon, resolveEffectiveCategory } from './SlotGlyph';

interface SlotTooltipProps {
  children: ReactNode;
  productName?: string;
  sku?: string;
  ean?: string;
  category?: string;
  fallbackCategory?: string;
  facings?: number;
  widthCm?: number;
  disabled?: boolean;
}

export default function SlotTooltip({
  children,
  productName,
  sku,
  ean,
  category,
  fallbackCategory,
  facings = 1,
  widthCm,
  disabled = false,
}: SlotTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const effectiveCategory = resolveEffectiveCategory(category, fallbackCategory);
  const color = getCategoryColor(effectiveCategory);
  const { Icon } = getCategoryIcon(effectiveCategory);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  const tooltipContent = isOpen && typeof document !== 'undefined' && (
    createPortal(
      <div
        className="fixed z-[99999] pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[200px] max-w-[280px]">
          {/* Header com ícone */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">
                {productName || 'Produto'}
              </p>
              <p className="text-xs text-gray-500">
                {effectiveCategory || 'Sem categoria'}
              </p>
            </div>
          </div>

          {/* Detalhes */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">SKU</span>
              <span className="font-mono font-medium text-gray-700">{sku || '—'}</span>
            </div>
            {ean && (
              <div className="flex justify-between">
                <span className="text-gray-500">EAN</span>
                <span className="font-mono font-medium text-gray-700">{ean}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Frentes</span>
              <span className="font-semibold text-[#16476A]">{facings}</span>
            </div>
            {widthCm !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Largura</span>
                <span className="font-semibold text-gray-700">{Math.round(widthCm)} cm</span>
              </div>
            )}
          </div>

          {/* Seta */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid white',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
            }}
          />
        </div>
      </div>,
      document.body
    )
  );

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipContent}
    </div>
  );
}
