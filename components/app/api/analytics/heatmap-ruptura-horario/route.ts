// web/app/api/analytics/heatmap-ruptura-horario/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

const querySchema = z.object({
  storeId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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

    const ruptureEvents = await prisma.ruptureEvent.findMany({
      where: {
        storeId,
        startAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const heatmapData = ruptureEvents.reduce((acc, event) => {
      const day = daysOfWeek[event.startAt.getDay()];
      const hour = event.startAt.getHours();
      const key = `${day}-${hour}`;

      if (!acc[key]) {
        acc[key] = {
          eixoX: `${hour}:00`,
          eixoY: day,
          valor: 0,
        };
      }
      acc[key].valor++;
      return acc;
    }, {} as Record<string, { eixoX: string; eixoY: string; valor: number }>);

    return NextResponse.json({ data: Object.values(heatmapData) });

  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
