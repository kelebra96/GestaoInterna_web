// web/app/api/products/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// Zod schema for creating a product
const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  ean: z.string().optional(),
  name: z.string().min(2, "Name is required"),
  brand: z.string().min(1, "Brand is required"),
  category: z.string().min(2, "Category is required"),
  subcategory: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
  price: z.number().positive(),
  margin: z.number().min(0),
  imageUrl: z.string().url().optional(),
  orgId: z.string().optional(), // Optional for admin_rede, required for super_admin
});

// GET /api/products - List products
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    let query: any = {};

    // Super admin can query by orgId, or get all products (not recommended in a real app)
    if (auth.role === 'super_admin') {
      if (orgId) {
        query.where = { orgId };
      }
    } else {
      // Other roles are restricted to their own organization
      query.where = { orgId: auth.orgId };
    }

    const products = await prisma.product.findMany(query);
    return NextResponse.json({ products });

  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// POST /api/products - Create a new product
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = productSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    let { orgId, ...productData } = validation.data;

    if (auth.role === 'super_admin') {
      if (!orgId) {
        return NextResponse.json({ error: "orgId is required for super_admin" }, { status: 400 });
      }
    } else { // admin_rede
      orgId = auth.orgId;
    }

    // Check for duplicate SKU within the same organization
    const existingProduct = await prisma.product.findFirst({
      where: { sku: productData.sku, orgId: orgId }
    });

    if (existingProduct) {
      return NextResponse.json({ error: "A product with this SKU already exists in this organization" }, { status: 409 });
    }

    const newProduct = await prisma.product.create({
      data: {
        ...productData,
        orgId: orgId,
      },
    });

    return NextResponse.json({ product: newProduct }, { status: 201 });

  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
