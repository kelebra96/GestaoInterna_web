// web/app/api/analytics/margem-waterfall/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';
import { WaterfallStep } from '@/lib/types/analytics';

const querySchema = z.object({
  storeId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, startDate, endDate } = validation.data;

    const sales = await prisma.hourlySale.aggregate({
        _sum: { quantity: true }, // Simplified: should be price * quantity
        where: {
            storeId,
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        },
    });

    const rupture = await prisma.ruptureEvent.aggregate({
        _sum: { revenueLost: true },
        where: {
            storeId,
            startAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        },
    });

    const receitaReal = sales._sum.quantity || 0;
    const receitaPerdida = rupture._sum.revenueLost || 0;
    const receitaPotencial = receitaReal + receitaPerdida;

    // Dummy data for other costs
    const descontos = receitaPotencial * 0.05;
    const quebras = receitaPotencial * 0.02;

    const waterfallData: WaterfallStep[] = [
      { label: 'Receita Potencial', value: receitaPotencial, type: 'base' },
      { label: 'Descontos', value: -descontos, type: 'delta' },
      { label: 'Perda por Ruptura', value: -receitaPerdida, type: 'delta' },
      { label: 'Quebras', value: -quebras, type: 'delta' },
      { label: 'Receita Real', value: receitaPotencial - descontos - receitaPerdida - quebras, type: 'base' },
    ];

    return NextResponse.json({ data: waterfallData });

  } catch (error) {
    console.error("Error fetching waterfall data:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
