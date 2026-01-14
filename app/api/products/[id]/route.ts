// web/app/api/products/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// Zod schema for updating a product (all fields optional)
const updateProductSchema = z.object({
    sku: z.string().min(1, "SKU is required").optional(),
    ean: z.string().optional(),
    name: z.string().min(2, "Name is required").optional(),
    brand: z.string().min(1, "Brand is required").optional(),
    category: z.string().min(2, "Category is required").optional(),
    subcategory: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    price: z.number().positive().optional(),
    margin: z.number().min(0).optional(),
    imageUrl: z.string().url().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check access
async function checkAccess(auth: any, productId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return false;

  // Any user can access products within their own organization
  if (product.orgId === auth.orgId) return true;

  return false;
}

// GET /api/products/[id] - Get a single product
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// PUT /api/products/[id] - Update a product
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = updateProductSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }
    
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json({ product: updatedProduct });

  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await prisma.product.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    return NextResponse.json({ error: "Failed to delete product." }, { status: 409 });
  }
}
