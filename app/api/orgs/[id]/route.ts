// web/app/api/orgs/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// Zod schema for updating an organization (all fields optional)
const updateOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").optional(),
  slug: z.string().min(2, "Slug must be at least 2 characters long").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens").optional(),
  country: z.string().length(2, "Country must be a 2-letter code").optional(),
  timezone: z.string().min(2, "Timezone is required").optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/orgs/[id] - Get a single organization
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || (auth.role !== 'super_admin' && auth.orgId !== id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error(`Error fetching organization ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// PUT /api/orgs/[id] - Update an organization
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || (auth.role !== 'super_admin' && auth.orgId !== id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // An admin_rede should not be able to change their own org slug, for example.
  // We'll add more granular checks here in a real app, but for now, this is a basic guard.
  if (auth.role === 'admin_rede' && auth.orgId === id) {
      // Allow updates but maybe log it or restrict certain fields
  } else if (auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = updateOrgSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }
    
    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json({ organization: updatedOrganization });

  } catch (error) {
    console.error(`Error updating organization ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// DELETE /api/orgs/[id] - Delete an organization
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Add logic here to ensure organization is empty (no users, stores, etc.) before deleting
    // For now, we will proceed with deletion.
    
    await prisma.organization.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error deleting organization ${id}:`, error);
    // Prisma will throw an error if relations are not empty, which is a good safeguard
    return NextResponse.json({ error: "Failed to delete organization. Ensure it has no associated users, stores, or products." }, { status: 409 });
  }
}
