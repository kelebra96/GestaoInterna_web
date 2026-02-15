// Tipos para Validação de Espaço no Planograma

export interface ShelfDimensions {
  id: string;
  level: number;
  width: number;  // cm
  depth: number;  // cm
  height: number; // cm
  eyeLevel?: boolean;
}

export interface ProductSlot {
  id?: string;
  productId: string;
  productName?: string;
  shelfId: string;
  positionX: number;  // Posição horizontal em cm
  width: number;      // Largura do produto em cm
  facings: number;    // Número de frentes
  capacity?: number;  // Capacidade de unidades
  depth?: number;     // Profundidade em cm
}

export interface SpaceUtilization {
  shelfId: string;
  shelfLevel: number;
  totalWidth: number;          // Largura total da prateleira (cm)
  usedWidth: number;           // Espaço ocupado (cm)
  availableWidth: number;      // Espaço disponível (cm)
  utilizationPercentage: number; // % de utilização (0-100)
  status: 'empty' | 'underutilized' | 'optimal' | 'overutilized' | 'exceeded';
  gaps: Gap[];
}

export interface Gap {
  startX: number;    // Início do gap (cm)
  endX: number;      // Fim do gap (cm)
  width: number;     // Largura do gap (cm)
  type: 'start' | 'middle' | 'end';
  severity: 'minor' | 'moderate' | 'major'; // Gap muito grande
}

export interface ValidationResult {
  valid: boolean;
  canAdd: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  spaceUtilization: SpaceUtilization[];
  totalUtilization: number; // % média de utilização
  summary: {
    totalShelves: number;
    totalSlots: number;
    totalSpaceAvailable: number;  // cm total
    totalSpaceUsed: number;       // cm usado
    totalSpaceRemaining: number;  // cm disponível
    averageUtilization: number;   // %
  };
}

export interface ValidationError {
  type: 'SPACE_EXCEEDED' | 'OVERLAP' | 'OUT_OF_BOUNDS' | 'INVALID_DIMENSIONS' | 'SHELF_NOT_FOUND';
  message: string;
  shelfId?: string;
  slotId?: string;
  productId?: string;
  severity: 'error';
}

export interface ValidationWarning {
  type: 'LARGE_GAP' | 'UNDERUTILIZED' | 'TIGHT_FIT' | 'UNEVEN_DISTRIBUTION' | 'EYE_LEVEL_UNDERUSED';
  message: string;
  shelfId?: string;
  slotId?: string;
  productId?: string;
  severity: 'warning' | 'info';
  suggestion?: string;
}

export interface SpaceAllocationConfig {
  // Limites de utilização
  minUtilization: number;      // % mínimo recomendado (padrão: 70%)
  optimalUtilization: number;  // % ideal (padrão: 85%)
  maxUtilization: number;      // % máximo permitido (padrão: 100%)

  // Gaps
  maxGapWidth: number;         // Largura máxima aceitável de gap (cm, padrão: 10cm)
  minGapWidth: number;         // Largura mínima para considerar gap (cm, padrão: 2cm)

  // Validações
  allowOverlap: boolean;       // Permitir sobreposição? (padrão: false)
  strictMode: boolean;         // Modo estrito - bloqueia qualquer violação (padrão: true)

  // Defaults
  defaultProductWidth: number;  // Largura padrão se não informada (cm, padrão: 10cm)
  defaultProductDepth: number;  // Profundidade padrão (cm, padrão: 10cm)
}

export const DEFAULT_SPACE_CONFIG: SpaceAllocationConfig = {
  minUtilization: 70,
  optimalUtilization: 85,
  maxUtilization: 100,
  maxGapWidth: 10,
  minGapWidth: 2,
  allowOverlap: false,
  strictMode: true,
  defaultProductWidth: 10,
  defaultProductDepth: 10,
};

export interface AddSlotRequest {
  slot: ProductSlot;
  validate?: boolean;  // Executar validação antes de adicionar (padrão: true)
  autoAdjust?: boolean; // Ajustar automaticamente posição se necessário (padrão: false)
}

export interface AddSlotResponse {
  success: boolean;
  slot?: ProductSlot;
  validation: ValidationResult;
  adjustedPosition?: {
    originalX: number;
    newX: number;
    reason: string;
  };
}

export interface SpaceOptimizationSuggestion {
  type: 'REARRANGE' | 'REMOVE_GAP' | 'REDISTRIBUTE' | 'COMPRESS' | 'EXPAND';
  description: string;
  shelfId: string;
  expectedImprovement: {
    currentUtilization: number;
    projectedUtilization: number;
    gapsReduced: number;
  };
  actions: OptimizationAction[];
}

export interface OptimizationAction {
  slotId?: string;
  productId: string;
  action: 'MOVE' | 'RESIZE' | 'REMOVE';
  from?: { shelfId: string; positionX: number };
  to?: { shelfId: string; positionX: number };
  reason: string;
}

// Helpers para cálculos rápidos
export function calculateSlotWidth(slot: ProductSlot, defaultWidth: number = 10): number {
  const productWidth = slot.width || defaultWidth;
  return productWidth * slot.facings;
}

export function calculateUtilizationPercentage(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, (used / total) * 100);
}

export function getUtilizationStatus(percentage: number, config: SpaceAllocationConfig = DEFAULT_SPACE_CONFIG): SpaceUtilization['status'] {
  if (percentage === 0) return 'empty';
  if (percentage > config.maxUtilization) return 'exceeded';
  if (percentage > config.optimalUtilization) return 'overutilized';
  if (percentage < config.minUtilization) return 'underutilized';
  return 'optimal';
}

export function isGapSignificant(gapWidth: number, config: SpaceAllocationConfig = DEFAULT_SPACE_CONFIG): boolean {
  return gapWidth >= config.minGapWidth;
}

export function getGapSeverity(gapWidth: number, config: SpaceAllocationConfig = DEFAULT_SPACE_CONFIG): Gap['severity'] {
  if (gapWidth >= config.maxGapWidth * 2) return 'major';
  if (gapWidth >= config.maxGapWidth) return 'moderate';
  return 'minor';
}
