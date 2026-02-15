// web/app/api/rupture/critical-slots/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

const isValidObjectId = (val?: string) => !!val && /^[0-9a-fA-F]{24}$/.test(val);

// Zod schema for query parameters (não trava em ObjectId inválido; tratamos manualmente)
const criticalSlotsQuerySchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  threshold: z.preprocess(val => parseFloat(String(val)), z.number().min(0).max(1)).optional().default(0.4),
});

// GET /api/rupture/critical-slots - List critical slots for a store
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const validation = criticalSlotsQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, threshold } = validation.data;

    // Se storeId não for um ObjectId válido, evitamos quebrar e apenas retornamos vazio
    if (!isValidObjectId(storeId)) {
      console.warn('⚠️ [/api/rupture/critical-slots] storeId inválido recebido:', storeId);
      return NextResponse.json({ criticalSlots: [], warning: 'storeId inválido' });
    }

    // Ensure the store belongs to the user's organization
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || (auth.role !== 'super_admin' && store.orgId !== auth.orgId)) {
      return NextResponse.json({ criticalSlots: [], warning: 'Loja não encontrada ou inacessível' });
    }

    // Fetch all shelves for the store
    const shelves = await prisma.shelf.findMany({
        where: { storeId },
        include: { slots: true },
    });

    const allSlots = shelves.flatMap(shelf => shelf.slots);
    const criticalSlots: any[] = [];

    for (const slot of allSlots) {
        if (!slot.capacity || slot.capacity === 0) continue;

        const lastReading = await prisma.gondolaStockReading.findFirst({
            where: { slotId: slot.id },
            orderBy: { readAt: 'desc' },
        });

        const currentQuantity = lastReading?.quantity ?? 0;
        const occupation = currentQuantity / slot.capacity;

        if (occupation < threshold) {
            criticalSlots.push({
                ...slot,
                currentQuantity,
                occupation: parseFloat(occupation.toFixed(2)),
                supplyStatus: 'RUIM',
            });
        }
    }

    return NextResponse.json({ criticalSlots });

  } catch (error) {
    console.error("Error fetching critical slots:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
