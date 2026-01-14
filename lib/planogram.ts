// web/lib/planogram.ts
import { Product, Shelf, PlanogramSlot } from '@prisma/client';

interface CapacityCalculationParams {
  product: Product;
  shelf: Shelf;
  slot: PlanogramSlot;
}

/**
 * Calculates the total capacity of a planogram slot based on product and shelf dimensions.
 * @param params - The product, shelf, and slot data.
 * @returns The total capacity of the slot in units.
 */
export function calculateSlotCapacity({ product, shelf, slot }: CapacityCalculationParams): number {
  if (!product || !shelf || !slot) {
    return 0;
  }

  // 1. Calculate maximum facings (horizontal)
  // Using the slot's own width for this calculation
  const maxFacings = Math.floor(slot.width / product.width);

  // 2. Calculate maximum depth (how many units fit "backwards")
  const maxDepth = Math.floor(shelf.depth / product.depth);

  // 3. Calculate maximum layers (stacking)
  let maxLayers = 1;
  if (product.canStack) {
    const grossMaxLayers = Math.floor(shelf.height / product.height);
    maxLayers = product.maxStackVertical
      ? Math.min(grossMaxLayers, product.maxStackVertical)
      : grossMaxLayers;
  }

  // 4. Calculate total capacity
  // The number of facings is defined in the planogram, so we use that instead of maxFacings.
  const totalCapacity = slot.facings * maxDepth * maxLayers;

  return totalCapacity;
}
