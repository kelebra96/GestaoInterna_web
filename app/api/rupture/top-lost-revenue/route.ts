// web/app/api/rupture/top-lost-revenue/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

const isValidObjectId = (val?: string) => !!val && /^[0-9a-fA-F]{24}$/.test(val);

// Zod schema for query parameters (sem travar em ObjectId inválido; tratamos manualmente)
const topLostRevenueQuerySchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.preprocess(val => parseInt(String(val), 10), z.number().int().min(1)).optional().default(10),
});

// GET /api/rupture/top-lost-revenue - List SKUs with the highest lost revenue
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const validation = topLostRevenueQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, startDate, endDate, limit } = validation.data;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Se storeId não for ObjectId válido, evitar erro e retornar listado vazio
    if (!isValidObjectId(storeId)) {
      console.warn('⚠️ [/api/rupture/top-lost-revenue] storeId inválido recebido:', storeId);
      return NextResponse.json({ topLostRevenue: [], warning: 'storeId inválido' });
    }

    // Ensure the store belongs to the user's organization
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || (auth.role !== 'super_admin' && store.orgId !== auth.orgId)) {
      return NextResponse.json({ topLostRevenue: [], warning: 'Loja não encontrada ou inacessível' });
    }

    // Use aggregation to group by productId and sum revenueLost
    const topLostRevenue = await prisma.ruptureEvent.groupBy({
      by: ['productId'],
      where: {
        storeId,
        startAt: {
          gte: start,
          lte: end,
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
      take: limit,
    });

    // Fetch product details for the top SKUs
    const productIds = topLostRevenue.map(item => item.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true, ean: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const result = topLostRevenue.map(item => ({
        productId: item.productId,
        product: productMap.get(item.productId),
        totalRevenueLost: item._sum.revenueLost,
    }));

    return NextResponse.json({ topLostRevenue: result });

  } catch (error) {
    console.error("Error fetching top lost revenue SKUs:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
