// web/app/api/supply-level/slot/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/supply-level/slot/[id] - Get supply level for a specific slot
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Fetch the slot and its capacity
    const slot = await prisma.planogramSlot.findUnique({
      where: { id },
    });

    if (!slot || !slot.capacity) {
      return NextResponse.json({ error: 'Slot not found or capacity not calculated' }, { status: 404 });
    }

    // Fetch the latest stock reading for the slot
    const lastReading = await prisma.gondolaStockReading.findFirst({
      where: { slotId: id },
      orderBy: { readAt: 'desc' },
    });

    const currentQuantity = lastReading?.quantity ?? 0;
    const capacity = slot.capacity;
    const occupation = capacity > 0 ? currentQuantity / capacity : 0;

    let supplyStatus: 'BOM' | 'REGULAR' | 'RUIM';
    if (occupation >= 0.7) {
      supplyStatus = 'BOM';
    } else if (occupation >= 0.4) {
      supplyStatus = 'REGULAR';
    } else {
      supplyStatus = 'RUIM';
    }

    return NextResponse.json({
      slotId: id,
      capacity,
      currentQuantity,
      occupation: parseFloat(occupation.toFixed(2)),
      supplyStatus,
    });

  } catch (error) {
    console.error(`Error fetching supply level for slot:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
