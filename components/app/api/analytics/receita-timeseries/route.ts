// web/app/api/analytics/receita-timeseries/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

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

    const sales = await prisma.hourlySale.findMany({
        where: {
            storeId,
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        },
    });

    const ruptureEvents = await prisma.ruptureEvent.findMany({
        where: {
            storeId,
            startAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        },
    });

    const salesByDay = sales.reduce((acc, sale) => {
        const day = sale.date.toISOString().split('T')[0];
        if (!acc[day]) {
            acc[day] = 0;
        }
        // This is a simplification. In a real scenario, you'd join with product price.
        // Assuming quantity is the value for now.
        acc[day] += sale.quantity;
        return acc;
    }, {} as Record<string, number>);

    const lostRevenueByDay = ruptureEvents.reduce((acc, event) => {
        const day = event.startAt.toISOString().split('T')[0];
        if (!acc[day]) {
            acc[day] = 0;
        }
        acc[day] += event.revenueLost || 0;
        return acc;
    }, {} as Record<string, number>);

    const allDays = new Set([...Object.keys(salesByDay), ...Object.keys(lostRevenueByDay)]);
    const sortedDays = Array.from(allDays).sort();

    const timeSeriesData = sortedDays.map(day => {
        const receitaReal = salesByDay[day] || 0;
        const receitaPerdida = lostRevenueByDay[day] || 0;
        return {
            date: day,
            receitaReal,
            receitaPotencial: receitaReal + receitaPerdida,
        };
    });

    return NextResponse.json({ data: timeSeriesData });

  } catch (error) {
    console.error("Error fetching receita time series:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
