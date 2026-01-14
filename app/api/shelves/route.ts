// web/app/api/shelves/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/shelves - List all shelves for the authenticated user's organization
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    let query: any = {
        where: {
            // This is a bit tricky, as shelves are tied to stores, not directly to orgs.
            // We'll need to filter by stores within the user's org.
        },
        orderBy: {
            gondolaCode: 'asc',
        }
    };

    const userStores = await prisma.store.findMany({
        where: { orgId: auth.orgId },
        select: { id: true },
    });
    const userStoreIds = userStores.map(s => s.id);

    if (storeId) {
        if (!userStoreIds.includes(storeId)) {
            return NextResponse.json({ error: 'Store not accessible' }, { status: 403 });
        }
        query.where.storeId = storeId;
    } else {
        query.where.storeId = { in: userStoreIds };
    }

    const shelves = await prisma.shelf.findMany(query);
    return NextResponse.json({ shelves });

  } catch (error) {
    console.error("Error fetching shelves:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
