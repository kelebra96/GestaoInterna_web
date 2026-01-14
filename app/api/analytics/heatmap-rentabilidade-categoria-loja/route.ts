// web/app/api/analytics/heatmap-rentabilidade-categoria-loja/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

const querySchema = z.object({
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

    const { startDate, endDate } = validation.data;

    // This is a very simplified query. A real implementation would be more complex
    // and likely involve a database view or a more advanced aggregation pipeline.
    const [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          orgId: auth.orgId,
        },
      }),
      prisma.store.findMany({
        where: {
          orgId: auth.orgId,
        },
      }),
    ]);

    const heatmapData = products.reduce((acc, product) => {
        const category = product.category;
        stores.forEach(store => {
            const storeName = store.name;
            const key = `${category}-${storeName}`;
            if (!acc[key]) {
                acc[key] = {
                    eixoX: category,
                    eixoY: storeName,
                    valor: 0,
                    count: 0,
                };
            }
            acc[key].valor += product.margin;
            acc[key].count++;
        });
        return acc;
    }, {} as Record<string, { eixoX: string; eixoY: string; valor: number; count: number }>);

    const finalData = Object.values(heatmapData).map(item => ({
        eixoX: item.eixoX,
        eixoY: item.eixoY,
        valor: item.valor / item.count,
    }));

    return NextResponse.json({ data: finalData });

  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
