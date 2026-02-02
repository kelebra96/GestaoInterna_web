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
  const { searchParams } = new URL(request.url);
  const requestedStoreId = searchParams.get('storeId') || undefined;

  try {
    const storeId = requestedStoreId;

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
    const err = error as { name?: string; message?: string };
    const message = err?.message || '';
    console.warn('[Shelves] Falling back to mock shelves:', err?.name, message);
    const fallbackStoreId = requestedStoreId || 'mock-store';
    const now = new Date().toISOString();
    const shelves = [
      { id: `shelf_${fallbackStoreId}_1`, storeId: fallbackStoreId, gondolaCode: 'A', width: 120, depth: 40, height: 30, level: 'eyes', createdAt: now, updatedAt: now },
      { id: `shelf_${fallbackStoreId}_2`, storeId: fallbackStoreId, gondolaCode: 'B', width: 120, depth: 40, height: 30, level: 'hands', createdAt: now, updatedAt: now },
      { id: `shelf_${fallbackStoreId}_3`, storeId: fallbackStoreId, gondolaCode: 'C', width: 120, depth: 40, height: 30, level: 'hands', createdAt: now, updatedAt: now },
      { id: `shelf_${fallbackStoreId}_4`, storeId: fallbackStoreId, gondolaCode: 'D', width: 120, depth: 40, height: 30, level: 'feet', createdAt: now, updatedAt: now },
    ];
    return NextResponse.json({ shelves, warning: 'Fallback shelves (database unavailable)' }, { status: 200 });
  }
}
