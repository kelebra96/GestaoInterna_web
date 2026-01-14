import {
  ShelfDimensions,
  ProductSlot,
  SpaceUtilization,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SpaceAllocationConfig,
  DEFAULT_SPACE_CONFIG,
  Gap,
  calculateSlotWidth,
  calculateUtilizationPercentage,
  getUtilizationStatus,
  isGapSignificant,
  getGapSeverity,
  SpaceOptimizationSuggestion,
  OptimizationAction,
} from '@/lib/types/space-validation';

export class SpaceValidationService {
  private config: SpaceAllocationConfig;

  constructor(config?: Partial<SpaceAllocationConfig>) {
    this.config = { ...DEFAULT_SPACE_CONFIG, ...config };
  }

  /**
   * Valida todos os slots em relação às prateleiras
   */
  public validatePlanogram(
    shelves: ShelfDimensions[],
    slots: ProductSlot[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const spaceUtilization: SpaceUtilization[] = [];

    // Validar cada prateleira
    shelves.forEach((shelf) => {
      const shelfSlots = slots.filter((slot) => slot.shelfId === shelf.id);
      const utilization = this.calculateShelfUtilization(shelf, shelfSlots);

      spaceUtilization.push(utilization);

      // Validar espaço excedido
      if (utilization.status === 'exceeded') {
        errors.push({
          type: 'SPACE_EXCEEDED',
          message: `Prateleira ${shelf.level} excede ${utilization.utilizationPercentage.toFixed(1)}% da largura disponível`,
          shelfId: shelf.id,
          severity: 'error',
        });
      }

      // Validar sobreposições
      const overlaps = this.detectOverlaps(shelfSlots);
      overlaps.forEach((overlap) => {
        errors.push({
          type: 'OVERLAP',
          message: `Produtos se sobrepõem na prateleira ${shelf.level}: ${overlap.slot1.productId} e ${overlap.slot2.productId}`,
          shelfId: shelf.id,
          severity: 'error',
        });
      });

      // Avisos para gaps grandes
      utilization.gaps.forEach((gap) => {
        if (gap.severity === 'major') {
          warnings.push({
            type: 'LARGE_GAP',
            message: `Gap de ${gap.width.toFixed(1)}cm na prateleira ${shelf.level} (posição ${gap.startX.toFixed(1)}cm)`,
            shelfId: shelf.id,
            severity: 'warning',
            suggestion: 'Considere redistribuir produtos para reduzir este espaço vazio',
          });
        }
      });

      // Avisos para subutilização
      if (utilization.status === 'underutilized') {
        warnings.push({
          type: 'UNDERUTILIZED',
          message: `Prateleira ${shelf.level} está subutilizada (${utilization.utilizationPercentage.toFixed(1)}%)`,
          shelfId: shelf.id,
          severity: 'info',
          suggestion: 'Considere adicionar mais produtos ou aumentar facings',
        });
      }

      // Avisos para nível dos olhos
      if (shelf.eyeLevel && utilization.status === 'underutilized') {
        warnings.push({
          type: 'EYE_LEVEL_UNDERUSED',
          message: `Prateleira no nível dos olhos está subutilizada (${utilization.utilizationPercentage.toFixed(1)}%)`,
          shelfId: shelf.id,
          severity: 'warning',
          suggestion: 'Nível dos olhos é posição premium - maximize o uso!',
        });
      }
    });

    // Calcular resumo
    const totalSpaceAvailable = shelves.reduce((sum, shelf) => sum + shelf.width, 0);
    const totalSpaceUsed = spaceUtilization.reduce((sum, util) => sum + util.usedWidth, 0);
    const totalSpaceRemaining = totalSpaceAvailable - totalSpaceUsed;
    const averageUtilization = spaceUtilization.length > 0
      ? spaceUtilization.reduce((sum, util) => sum + util.utilizationPercentage, 0) / spaceUtilization.length
      : 0;

    const valid = errors.length === 0;
    const canAdd = valid || !this.config.strictMode;

    return {
      valid,
      canAdd,
      errors,
      warnings,
      spaceUtilization,
      totalUtilization: averageUtilization,
      summary: {
        totalShelves: shelves.length,
        totalSlots: slots.length,
        totalSpaceAvailable,
        totalSpaceUsed,
        totalSpaceRemaining,
        averageUtilization,
      },
    };
  }

  /**
   * Calcula utilização de uma prateleira específica
   */
  public calculateShelfUtilization(
    shelf: ShelfDimensions,
    slots: ProductSlot[]
  ): SpaceUtilization {
    const totalWidth = shelf.width;
    let usedWidth = 0;

    // Calcular espaço usado
    slots.forEach((slot) => {
      const slotWidth = calculateSlotWidth(slot, this.config.defaultProductWidth);
      usedWidth += slotWidth;
    });

    const availableWidth = Math.max(0, totalWidth - usedWidth);
    const utilizationPercentage = calculateUtilizationPercentage(usedWidth, totalWidth);
    const status = getUtilizationStatus(utilizationPercentage, this.config);

    // Detectar gaps
    const gaps = this.detectGaps(shelf, slots);

    return {
      shelfId: shelf.id,
      shelfLevel: shelf.level,
      totalWidth,
      usedWidth,
      availableWidth,
      utilizationPercentage,
      status,
      gaps,
    };
  }

  /**
   * Detecta gaps (espaços vazios) na prateleira
   */
  private detectGaps(shelf: ShelfDimensions, slots: ProductSlot[]): Gap[] {
    if (slots.length === 0) {
      return [
        {
          startX: 0,
          endX: shelf.width,
          width: shelf.width,
          type: 'start',
          severity: getGapSeverity(shelf.width, this.config),
        },
      ];
    }

    const gaps: Gap[] = [];

    // Ordenar slots por posição X
    const sortedSlots = [...slots].sort((a, b) => a.positionX - b.positionX);

    // Gap antes do primeiro produto
    const firstSlot = sortedSlots[0];
    if (firstSlot.positionX > 0) {
      const gapWidth = firstSlot.positionX;
      if (isGapSignificant(gapWidth, this.config)) {
        gaps.push({
          startX: 0,
          endX: firstSlot.positionX,
          width: gapWidth,
          type: 'start',
          severity: getGapSeverity(gapWidth, this.config),
        });
      }
    }

    // Gaps entre produtos
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentSlot = sortedSlots[i];
      const nextSlot = sortedSlots[i + 1];

      const currentEnd = currentSlot.positionX + calculateSlotWidth(currentSlot, this.config.defaultProductWidth);
      const gapWidth = nextSlot.positionX - currentEnd;

      if (gapWidth > 0 && isGapSignificant(gapWidth, this.config)) {
        gaps.push({
          startX: currentEnd,
          endX: nextSlot.positionX,
          width: gapWidth,
          type: 'middle',
          severity: getGapSeverity(gapWidth, this.config),
        });
      }
    }

    // Gap após o último produto
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const lastEnd = lastSlot.positionX + calculateSlotWidth(lastSlot, this.config.defaultProductWidth);
    if (lastEnd < shelf.width) {
      const gapWidth = shelf.width - lastEnd;
      if (isGapSignificant(gapWidth, this.config)) {
        gaps.push({
          startX: lastEnd,
          endX: shelf.width,
          width: gapWidth,
          type: 'end',
          severity: getGapSeverity(gapWidth, this.config),
        });
      }
    }

    return gaps;
  }

  /**
   * Detecta sobreposições entre produtos
   */
  private detectOverlaps(slots: ProductSlot[]): Array<{ slot1: ProductSlot; slot2: ProductSlot }> {
    const overlaps: Array<{ slot1: ProductSlot; slot2: ProductSlot }> = [];

    if (this.config.allowOverlap) return overlaps;

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];

        const slot1Start = slot1.positionX;
        const slot1End = slot1.positionX + calculateSlotWidth(slot1, this.config.defaultProductWidth);
        const slot2Start = slot2.positionX;
        const slot2End = slot2.positionX + calculateSlotWidth(slot2, this.config.defaultProductWidth);

        // Verifica se há sobreposição
        if (
          (slot1Start < slot2End && slot1End > slot2Start) ||
          (slot2Start < slot1End && slot2End > slot1Start)
        ) {
          overlaps.push({ slot1, slot2 });
        }
      }
    }

    return overlaps;
  }

  /**
   * Valida se um novo slot pode ser adicionado
   */
  public canAddSlot(
    shelf: ShelfDimensions,
    existingSlots: ProductSlot[],
    newSlot: ProductSlot
  ): { canAdd: boolean; reason?: string; suggestedPosition?: number } {
    const slotWidth = calculateSlotWidth(newSlot, this.config.defaultProductWidth);

    // Verificar se posição está dentro dos limites
    if (newSlot.positionX < 0) {
      return {
        canAdd: false,
        reason: 'Posição X não pode ser negativa',
      };
    }

    const slotEnd = newSlot.positionX + slotWidth;
    if (slotEnd > shelf.width) {
      // Tentar sugerir posição que caiba
      const availableSpace = this.findAvailableSpace(shelf, existingSlots, slotWidth);
      if (availableSpace) {
        return {
          canAdd: false,
          reason: `Produto não cabe na posição ${newSlot.positionX.toFixed(1)}cm (excede largura da prateleira)`,
          suggestedPosition: availableSpace.startX,
        };
      }

      return {
        canAdd: false,
        reason: `Produto não cabe na prateleira (largura necessária: ${slotWidth.toFixed(1)}cm, disponível: ${shelf.width.toFixed(1)}cm)`,
      };
    }

    // Verificar sobreposição com slots existentes
    const tempSlots = [...existingSlots, newSlot];
    const overlaps = this.detectOverlaps(tempSlots.filter((s) => s.shelfId === shelf.id));

    if (overlaps.length > 0) {
      // Tentar sugerir posição sem sobreposição
      const availableSpace = this.findAvailableSpace(shelf, existingSlots, slotWidth);
      if (availableSpace) {
        return {
          canAdd: false,
          reason: 'Produto se sobrepõe a outro produto',
          suggestedPosition: availableSpace.startX,
        };
      }

      return {
        canAdd: false,
        reason: 'Produto se sobrepõe a outro produto e não há espaço disponível',
      };
    }

    // Verificar se excede utilização máxima
    const utilization = this.calculateShelfUtilization(shelf, tempSlots.filter((s) => s.shelfId === shelf.id));
    if (utilization.status === 'exceeded' && this.config.strictMode) {
      return {
        canAdd: false,
        reason: `Adicionar este produto excederia ${utilization.utilizationPercentage.toFixed(1)}% da prateleira`,
      };
    }

    return { canAdd: true };
  }

  /**
   * Encontra espaço disponível na prateleira
   */
  public findAvailableSpace(
    shelf: ShelfDimensions,
    slots: ProductSlot[],
    requiredWidth: number
  ): { startX: number; endX: number; width: number } | null {
    if (slots.length === 0) {
      if (shelf.width >= requiredWidth) {
        return { startX: 0, endX: requiredWidth, width: requiredWidth };
      }
      return null;
    }

    // Ordenar slots por posição
    const sortedSlots = [...slots].sort((a, b) => a.positionX - b.positionX);

    // Verificar espaço antes do primeiro produto
    const firstSlot = sortedSlots[0];
    if (firstSlot.positionX >= requiredWidth) {
      return { startX: 0, endX: requiredWidth, width: requiredWidth };
    }

    // Verificar espaços entre produtos
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentSlot = sortedSlots[i];
      const nextSlot = sortedSlots[i + 1];

      const currentEnd = currentSlot.positionX + calculateSlotWidth(currentSlot, this.config.defaultProductWidth);
      const availableWidth = nextSlot.positionX - currentEnd;

      if (availableWidth >= requiredWidth) {
        return {
          startX: currentEnd,
          endX: currentEnd + requiredWidth,
          width: requiredWidth,
        };
      }
    }

    // Verificar espaço após o último produto
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const lastEnd = lastSlot.positionX + calculateSlotWidth(lastSlot, this.config.defaultProductWidth);
    const remainingWidth = shelf.width - lastEnd;

    if (remainingWidth >= requiredWidth) {
      return {
        startX: lastEnd,
        endX: lastEnd + requiredWidth,
        width: requiredWidth,
      };
    }

    return null;
  }

  /**
   * Gera sugestões de otimização de espaço
   */
  public generateOptimizationSuggestions(
    shelves: ShelfDimensions[],
    slots: ProductSlot[]
  ): SpaceOptimizationSuggestion[] {
    const suggestions: SpaceOptimizationSuggestion[] = [];

    shelves.forEach((shelf) => {
      const shelfSlots = slots.filter((s) => s.shelfId === shelf.id);
      const utilization = this.calculateShelfUtilization(shelf, shelfSlots);

      // Sugestão: Remover gaps grandes
      if (utilization.gaps.some((g) => g.severity === 'major')) {
        const actions: OptimizationAction[] = [];
        const sortedSlots = [...shelfSlots].sort((a, b) => a.positionX - b.positionX);

        // Comprimir produtos para o início
        let currentX = 0;
        sortedSlots.forEach((slot) => {
          if (slot.positionX !== currentX) {
            actions.push({
              productId: slot.productId,
              action: 'MOVE',
              from: { shelfId: shelf.id, positionX: slot.positionX },
              to: { shelfId: shelf.id, positionX: currentX },
              reason: 'Remover gap desnecessário',
            });
          }
          currentX += calculateSlotWidth(slot, this.config.defaultProductWidth);
        });

        if (actions.length > 0) {
          suggestions.push({
            type: 'COMPRESS',
            description: `Comprimir produtos na prateleira ${shelf.level} para remover gaps`,
            shelfId: shelf.id,
            expectedImprovement: {
              currentUtilization: utilization.utilizationPercentage,
              projectedUtilization: utilization.utilizationPercentage, // Mesmo %
              gapsReduced: utilization.gaps.length,
            },
            actions,
          });
        }
      }

      // Sugestão: Redistribuir produtos subutilizados
      if (utilization.status === 'underutilized' && shelfSlots.length > 0) {
        suggestions.push({
          type: 'REDISTRIBUTE',
          description: `Redistribuir produtos na prateleira ${shelf.level} para melhor aproveitamento`,
          shelfId: shelf.id,
          expectedImprovement: {
            currentUtilization: utilization.utilizationPercentage,
            projectedUtilization: this.config.optimalUtilization,
            gapsReduced: 0,
          },
          actions: [
            {
              productId: shelfSlots[0].productId,
              action: 'RESIZE',
              reason: 'Aumentar facings para melhor utilização do espaço',
            },
          ],
        });
      }
    });

    return suggestions;
  }

  /**
   * Auto-ajusta posição de um slot para evitar conflitos
   */
  public autoAdjustSlotPosition(
    shelf: ShelfDimensions,
    existingSlots: ProductSlot[],
    newSlot: ProductSlot
  ): ProductSlot | null {
    const slotWidth = calculateSlotWidth(newSlot, this.config.defaultProductWidth);
    const availableSpace = this.findAvailableSpace(shelf, existingSlots, slotWidth);

    if (availableSpace) {
      return {
        ...newSlot,
        positionX: availableSpace.startX,
      };
    }

    return null;
  }
}

/**
 * Função auxiliar para validação rápida
 */
export function validateSpace(
  shelves: ShelfDimensions[],
  slots: ProductSlot[],
  config?: Partial<SpaceAllocationConfig>
): ValidationResult {
  const service = new SpaceValidationService(config);
  return service.validatePlanogram(shelves, slots);
}
