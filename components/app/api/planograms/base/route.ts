// web/app/api/planograms/base/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { planogramService } from '@/lib/services/planogram.service';

// Zod schema for creating a PlanogramBase
const planogramBaseSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(['normal', 'promocional', 'sazonal', 'evento']),
  category: z.string().min(2),
  subcategory: z.string().optional(),
  modules: z.array(z.any()).optional(),
  totalSKUs: z.number().optional(),
  orgId: z.string().optional(),
  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
});

// GET /api/planograms/base - List all base planograms
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('orgId');
    const status = searchParams.get('status');

    // Determinar qual orgId usar
    let orgIdToQuery: string | undefined;

    if (auth.role === 'super_admin') {
      // Super admin pode buscar por qualquer org ou todas
      orgIdToQuery = requestedOrgId || undefined;
    } else {
      // Outros usuários só veem da própria org
      orgIdToQuery = auth.orgId;
    }

    const planograms = await planogramService.listPlanograms(
      orgIdToQuery,
      status || undefined
    );

    return NextResponse.json({ planograms });
  } catch (error) {
    console.error("Error fetching base planograms:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// POST /api/planograms/base - Create a new base planogram
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    console.error('🔐 Authorization failed:', { auth, requiredRoles: ['super_admin', 'admin_rede', 'merchandiser'] });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = planogramBaseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    let { orgId, ...data } = validation.data;

    // Determinar orgId
    if (auth.role === 'super_admin') {
      if (!orgId) {
        return NextResponse.json({ error: "orgId is required for super_admin" }, { status: 400 });
      }
    } else {
      orgId = auth.orgId;
    }

    console.log('📝 Creating planogram with data:', { ...data, orgId });

    // Criar planograma usando Firestore
    const planogram = await planogramService.createPlanogram({
      ...data,
      orgId: orgId!,
    });

    console.log('✅ Planogram created successfully:', planogram.id);

    return NextResponse.json({ planogram }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating base planogram:", error);
    return NextResponse.json({
      error: "An internal server error occurred",
      details: error.message
    }, { status: 500 });
  }
}