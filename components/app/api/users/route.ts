// web/app/api/users/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/users - List users for the authenticated user's organization
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let query: any = {
        where: {
            orgId: auth.orgId, // Restrict to user's organization
        },
        select: { // Select specific fields to omit sensitive data
            id: true,
            name: true,
            email: true,
            role: true,
            storeIds: true,
            createdAt: true,
            updatedAt: true,
        }
    };

    // Super admin can see all users, can be filtered by orgId if needed
    if (auth.role === 'super_admin') {
      const { searchParams } = new URL(request.url);
      const orgId = searchParams.get('orgId');
      if (orgId) {
        query.where.orgId = orgId;
      } else {
        delete query.where.orgId; // Super admin can see all if no orgId is specified
      }
    }

    const users = await prisma.user.findMany(query);
    return NextResponse.json({ users });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
