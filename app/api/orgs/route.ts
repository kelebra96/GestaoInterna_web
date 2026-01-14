// web/app/api/orgs/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// Zod schema for creating an organization
const orgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  slug: z.string().min(2, "Slug must be at least 2 characters long").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  country: z.string().length(2, "Country must be a 2-letter code"),
  timezone: z.string().min(2, "Timezone is required"),
});

// GET /api/orgs - List all organizations
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const organizations = await prisma.organization.findMany();
    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// POST /api/orgs - Create a new organization
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = orgSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { name, slug, country, timezone } = validation.data;

    // Check for duplicate slug
    const existingOrg = await prisma.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 409 });
    }

    const newOrganization = await prisma.organization.create({
      data: {
        name,
        slug,
        country,
        timezone,
      },
    });

    return NextResponse.json({ organization: newOrganization }, { status: 201 });

  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
