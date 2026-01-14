// web/app/api/analytics/ruptura-timeseries/route.ts
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

    // This is a simplified example. A real implementation would be more complex.
    // It would need to calculate the percentage of slots in rupture each day.
    const ruptureEvents = await prisma.ruptureEvent.findMany({
      where: {
        storeId,
        startAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    // Group by day and count events
    const dataByDay = ruptureEvents.reduce((acc, event) => {
      const day = event.startAt.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = 0;
      }
      acc[day]++;
      return acc;
    }, {} as Record<string, number>);

    const totalSlots = await prisma.planogramSlot.count({
        where: { shelf: { storeId: storeId } }
    });

    const timeSeriesData = Object.entries(dataByDay).map(([date, count]) => ({
      date,
      rupturaPercent: totalSlots > 0 ? (count / totalSlots) * 100 : 0,
    }));

    return NextResponse.json({ data: timeSeriesData });

  } catch (error) {
    console.error("Error fetching rupture time series:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
