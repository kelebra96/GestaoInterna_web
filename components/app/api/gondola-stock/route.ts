// web/app/api/gondola-stock/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { InventorySource, RuptureType } from '@prisma/client';

// Zod schema for creating a GondolaStockReading
const gondolaStockReadingSchema = z.object({
  storeId: z.string(),
  slotId: z.string(),
  quantity: z.number().int().min(0),
  source: z.nativeEnum(InventorySource),
});

const RUPTURE_THRESHOLD = 0.1; // Functional rupture if occupation is less than 10%

// POST /api/gondola-stock - Create a new gondola stock reading and handle rupture events
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = gondolaStockReadingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, slotId, quantity, source } = validation.data;

    const [store, slot, previousReading] = await Promise.all([
        prisma.store.findUnique({ where: { id: storeId } }),
        prisma.planogramSlot.findUnique({ where: { id: slotId } }),
        prisma.gondolaStockReading.findFirst({
            where: { slotId },
            orderBy: { readAt: 'desc' },
        }),
    ]);

    if (!store || (auth.role !== 'super_admin' && store.orgId !== auth.orgId)) {
        return NextResponse.json({ error: 'Store not found or not accessible' }, { status: 404 });
    }
    if (!slot || !slot.capacity) {
        return NextResponse.json({ error: 'Slot not found or capacity not calculated' }, { status: 404 });
    }

    const newReading = await prisma.gondolaStockReading.create({
      data: { storeId, slotId, quantity, source, readAt: new Date() },
    });

    // --- Rupture Detection Logic ---
    const currentOccupation = quantity / slot.capacity;
    const previousOccupation = previousReading ? previousReading.quantity / slot.capacity : 1; // Assume it was full if no previous reading

    const isCurrentRupture = currentOccupation < RUPTURE_THRESHOLD;
    const wasPreviousRupture = previousOccupation < RUPTURE_THRESHOLD;

    if (isCurrentRupture && !wasPreviousRupture) {
      // Rupture just started, open a new event
      await prisma.ruptureEvent.create({
        data: {
          storeId,
          productId: slot.productId,
          slotId,
          startAt: new Date(),
          type: quantity === 0 ? RuptureType.total : RuptureType.functional,
        },
      });
    } else if (!isCurrentRupture && wasPreviousRupture) {
      // Rupture just ended, close the open event
      const openRuptureEvent = await prisma.ruptureEvent.findFirst({
        where: { slotId, endAt: null },
        orderBy: { startAt: 'desc' },
      });

      if (openRuptureEvent) {
        const endAt = new Date();
        const durationHours = (endAt.getTime() - openRuptureEvent.startAt.getTime()) / (1000 * 60 * 60);

        // Calculate sales loss (simplified)
        const avgHourlySales = await prisma.hourlySale.aggregate({
            _avg: { quantity: true },
            where: { productId: slot.productId, storeId },
        });
        const avgSales = avgHourlySales._avg.quantity || 0;
        const unitsNotSold = avgSales * durationHours;

        const product = await prisma.product.findUnique({ where: { id: slot.productId } });
        const revenueLost = product ? unitsNotSold * product.price : 0;
        const marginLost = product ? revenueLost * (product.margin / 100) : 0;

        await prisma.ruptureEvent.update({
          where: { id: openRuptureEvent.id },
          data: {
            endAt,
            durationHours,
            unitsNotSold,
            revenueLost,
            marginLost,
          },
        });
      }
    }

    return NextResponse.json({ reading: newReading }, { status: 201 });

  } catch (error) {
    console.error("Error creating gondola stock reading:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}