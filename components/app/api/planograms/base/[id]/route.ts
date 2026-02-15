// web/app/api/planograms/base/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { planogramService } from '@/lib/services/planogram.service';

// Zod schema for updating a PlanogramBase
const updatePlanogramBaseSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  type: z.enum(['normal', 'promocional', 'sazonal', 'evento']).optional(),
  category: z.string().min(2).optional(),
  status: z.enum(['rascunho', 'publicado', 'em_revisao', 'arquivado']).optional(),
  modules: z.array(z.any()).optional(),
  totalSKUs: z.number().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check access
async function checkAccess(auth: any, planogramId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;

  const planogram = await planogramService.getPlanogram(planogramId);
  if (!planogram) return false;

  return planogram.orgId === auth.orgId;
}

// GET /api/planograms/base/[id]
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const planogram = await planogramService.getPlanogram(id);

    if (!planogram) {
      return NextResponse.json({ error: 'Base planogram not found' }, { status: 404 });
    }

    return NextResponse.json({ planogram });
  } catch (error) {
    console.error(`Error fetching base planogram ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// PUT /api/planograms/base/[id] - Update a base planogram
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = updatePlanogramBaseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const updatedPlanogram = await planogramService.updatePlanogram(id, validation.data);

    return NextResponse.json({ planogram: updatedPlanogram });

  } catch (error: any) {
    console.error(`Error updating base planogram ${id}:`, error);
    return NextResponse.json({
      error: "An internal server error occurred",
      details: error.message
    }, { status: 500 });
  }
}

// DELETE /api/planograms/base/[id] - Soft delete a base planogram
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
    // Soft delete by archiving
    await planogramService.archivePlanogram(id);

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error: any) {
    console.error(`Error deleting base planogram ${id}:`, error);
    return NextResponse.json({
      error: "Failed to archive base planogram.",
      details: error.message
    }, { status: 500 });
  }
}