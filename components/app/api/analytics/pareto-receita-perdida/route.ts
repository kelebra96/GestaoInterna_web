// web/app/api/analytics/pareto-receita-perdida/route.ts
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

    const ruptureEvents = await prisma.ruptureEvent.groupBy({
      by: ['productId'],
      where: {
        storeId,
        startAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        revenueLost: {
          gt: 0,
        },
      },
      _sum: {
        revenueLost: true,
      },
      orderBy: {
        _sum: {
          revenueLost: 'desc',
        },
      },
    });

    const totalLostRevenue = ruptureEvents.reduce((acc, event) => acc + (event._sum.revenueLost || 0), 0);
    let cumulativePercentage = 0;

    const productIds = ruptureEvents.map(e => e.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const paretoData = ruptureEvents.map(event => {
      const lostRevenue = event._sum.revenueLost || 0;
      const percentage = totalLostRevenue > 0 ? (lostRevenue / totalLostRevenue) * 100 : 0;
      cumulativePercentage += percentage;
      const product = productMap.get(event.productId);
      return {
        label: product?.sku || event.productId,
        valor: lostRevenue,
        percentualAcumulado: cumulativePercentage,
      };
    });

    return NextResponse.json({ data: paretoData });

  } catch (error) {
    console.error("Error fetching pareto data:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
