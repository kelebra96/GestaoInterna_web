// web/app/api/inventory/status/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';

// Zod schema for query parameters
const inventoryStatusQuerySchema = z.object({
  storeId: z.string().min(1), // Aceita qualquer string não vazia (compatível com Firestore IDs)
  threshold: z.preprocess(val => parseInt(String(val), 10), z.number().int().min(0)).optional().default(10),
});

// GET /api/inventory/status - Get inventory status for a specific store
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const validation = inventoryStatusQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: validation.error.flatten() }, { status: 400 });
    }

    const { storeId, threshold } = validation.data;

    // Ensure the store belongs to the user's organization (unless super_admin)
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || (auth.role !== 'super_admin' && store.orgId !== auth.orgId)) {
      return NextResponse.json({ error: 'Store not found or not accessible' }, { status: 404 });
    }

    // Fetch inventory snapshots for the store
    const inventorySnapshots = await prisma.inventorySnapshot.findMany({
      where: {
        storeId: storeId,
        orgId: auth.orgId,
      },
      include: {
        product: { // Include product details
          select: {
            id: true,
            sku: true,
            ean: true,
            name: true,
            brand: true,
            category: true,
            subcategory: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        snapshotAt: 'desc', // Get the latest snapshot
      },
    });

    // Group by product to get the latest quantity for each product
    const productInventoryMap = new Map<string, any>();
    for (const snapshot of inventorySnapshots) {
        if (!productInventoryMap.has(snapshot.productId)) {
            productInventoryMap.set(snapshot.productId, {
                productId: snapshot.productId,
                sku: snapshot.product?.sku,
                ean: snapshot.product?.ean,
                name: snapshot.product?.name,
                brand: snapshot.product?.brand,
                category: snapshot.product?.category,
                subcategory: snapshot.product?.subcategory,
                imageUrl: snapshot.product?.imageUrl,
                quantity: snapshot.quantity,
                lowStock: snapshot.quantity <= threshold,
                lastUpdated: snapshot.snapshotAt,
            });
        }
    }

    const inventoryStatus = Array.from(productInventoryMap.values());

    return NextResponse.json({ inventoryStatus });

  } catch (error) {
    console.error("Error fetching inventory status:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
