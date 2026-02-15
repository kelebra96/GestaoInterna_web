// web/app/api/analytics/scatter-execucao-vs-rentabilidade/route.ts
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
      },
      _avg: {
        durationHours: true,
      },
      _sum: {
        revenueLost: true,
      },
    });

    const productIds = ruptureEvents.map(e => e.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true, margin: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const scatterData = ruptureEvents.map(event => {
      const product = productMap.get(event.productId);
      return {
        x: event._avg.durationHours || 0,
        y: product?.margin || 0,
        size: event._sum.revenueLost || 0,
        label: product?.sku || event.productId,
      };
    });

    return NextResponse.json({ data: scatterData });

  } catch (error) {
    console.error("Error fetching scatter plot data:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
