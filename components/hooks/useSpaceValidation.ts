import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShelfDimensions,
  ProductSlot,
  ValidationResult,
  SpaceAllocationConfig,
  SpaceUtilization,
} from '@/lib/types/space-validation';
import { SpaceValidationService } from '@/lib/services/space-validation.service';

interface UseSpaceValidationOptions {
  shelves: ShelfDimensions[];
  slots: ProductSlot[];
  config?: Partial<SpaceAllocationConfig>;
  autoValidate?: boolean; // Validar automaticamente quando mudar (padrão: true)
}

interface UseSpaceValidationReturn {
  validation: ValidationResult | null;
  isValid: boolean;
  canAddSlots: boolean;
  errors: ValidationResult['errors'];
  warnings: ValidationResult['warnings'];
  spaceUtilization: SpaceUtilization[];
  totalUtilization: number;
  isLoading: boolean;

  // Métodos
  validate: () => void;
  canAddSlot: (
    shelfId: string,
    newSlot: ProductSlot
  ) => { canAdd: boolean; reason?: string; suggestedPosition?: number };
  findAvailableSpace: (shelfId: string, requiredWidth: number) => { startX: number; endX: number; width: number } | null;
  autoAdjustPosition: (shelfId: string, newSlot: ProductSlot) => ProductSlot | null;
  getShelfUtilization: (shelfId: string) => SpaceUtilization | undefined;
}

export function useSpaceValidation({
  shelves,
  slots,
  config,
  autoValidate = true,
}: UseSpaceValidationOptions): UseSpaceValidationReturn {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Criar instância do serviço (memoizado)
  const service = useMemo(() => new SpaceValidationService(config), [config]);

  // Função de validação
  const validate = useCallback(() => {
    setIsLoading(true);
    try {
      const result = service.validatePlanogram(shelves, slots);
      setValidation(result);
    } catch (error) {
      console.error('Erro ao validar espaço:', error);
    } finally {
      setIsLoading(false);
    }
  }, [service, shelves, slots]);

  // Auto-validar quando shelves ou slots mudarem
  useEffect(() => {
    if (autoValidate) {
      validate();
    }
  }, [autoValidate, validate]);

  // Verificar se pode adicionar slot
  const canAddSlot = useCallback(
    (shelfId: string, newSlot: ProductSlot) => {
      const shelf = shelves.find((s) => s.id === shelfId);
      if (!shelf) {
        return {
          canAdd: false,
          reason: 'Prateleira não encontrada',
        };
      }

      const existingSlots = slots.filter((s) => s.shelfId === shelfId);
      return service.canAddSlot(shelf, existingSlots, newSlot);
    },
    [shelves, slots, service]
  );

  // Encontrar espaço disponível
  const findAvailableSpace = useCallback(
    (shelfId: string, requiredWidth: number) => {
      const shelf = shelves.find((s) => s.id === shelfId);
      if (!shelf) return null;

      const existingSlots = slots.filter((s) => s.shelfId === shelfId);
      return service.findAvailableSpace(shelf, existingSlots, requiredWidth);
    },
    [shelves, slots, service]
  );

  // Auto-ajustar posição
  const autoAdjustPosition = useCallback(
    (shelfId: string, newSlot: ProductSlot) => {
      const shelf = shelves.find((s) => s.id === shelfId);
      if (!shelf) return null;

      const existingSlots = slots.filter((s) => s.shelfId === shelfId);
      return service.autoAdjustSlotPosition(shelf, existingSlots, newSlot);
    },
    [shelves, slots, service]
  );

  // Obter utilização de prateleira específica
  const getShelfUtilization = useCallback(
    (shelfId: string) => {
      return validation?.spaceUtilization.find((util) => util.shelfId === shelfId);
    },
    [validation]
  );

  return {
    validation,
    isValid: validation?.valid ?? false,
    canAddSlots: validation?.canAdd ?? false,
    errors: validation?.errors ?? [],
    warnings: validation?.warnings ?? [],
    spaceUtilization: validation?.spaceUtilization ?? [],
    totalUtilization: validation?.totalUtilization ?? 0,
    isLoading,
    validate,
    canAddSlot,
    findAvailableSpace,
    autoAdjustPosition,
    getShelfUtilization,
  };
}
