// web/app/api/planograms/store/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Zod schema for a single slot
const slotSchema = z.object({
  shelfId: z.string(),
  productId: z.string(),
  positionX: z.number(),
  width: z.number(),
  facings: z.number().int(),
});

// Zod schema for updating a PlanogramStore
const updatePlanogramStoreSchema = z.object({
  name: z.string().min(3).optional(),
  status: z.enum(['draft', 'published', 'expired', 'archived']).optional(),
  slots: z.array(slotSchema).optional(),
  adjustments: z.any().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check access
async function checkAccess(auth: any, planogramStoreId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'super_admin') return true;

  const { data, error } = await supabaseAdmin
    .from('planogram_store')
    .select('org_id')
    .eq('id', planogramStoreId)
    .single();

  if (error || !data) return false;

  return data.org_id === auth.orgId;
}

// GET /api/planograms/store/[id] - Get a single store-specific planogram
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!await checkAccess(auth, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: planogramData, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .select('*')
      .eq('id', id)
      .single();

    if (planogramError || !planogramData) {
      return NextResponse.json({ error: 'Store planogram not found' }, { status: 404 });
    }

    // Buscar slots
    const { data: slotsData } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_store_id', id);

    const slots = (slotsData || []).map((slot: any) => ({
      id: slot.id,
      productId: slot.product_id,
      shelfId: slot.shelf_id,
      positionX: slot.position_x,
      width: slot.width,
      facings: slot.facings,
    }));

    const planogram = {
      id: planogramData.id,
      orgId: planogramData.org_id,
      storeId: planogramData.store_id,
      basePlanogramId: planogramData.base_planogram_id,
      name: planogramData.name,
      status: planogramData.status,
      adjustments: planogramData.adjustments || [],
      slots,
      createdAt: planogramData.created_at,
      updatedAt: planogramData.updated_at,
      publishedAt: planogramData.published_at,
    };

    return NextResponse.json({ planogram });
  } catch (error) {
    console.error(`Error fetching store planogram ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// PUT /api/planograms/store/[id] - Update a store-specific planogram
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
    const validation = updatePlanogramStoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { slots, ...planogramData } = validation.data;
    const now = new Date().toISOString();

    // Atualizar planograma
    const updateData: any = { updated_at: now };
    if (planogramData.name !== undefined) updateData.name = planogramData.name;
    if (planogramData.status !== undefined) updateData.status = planogramData.status;
    if (planogramData.adjustments !== undefined) updateData.adjustments = planogramData.adjustments;

    const { error: updateError } = await supabaseAdmin
      .from('planogram_store')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[PlanogramStore] Error updating planogram:', updateError);
      throw updateError;
    }

    // Se houver slots, atualizar
    if (slots) {
      // Deletar slots antigos
      await supabaseAdmin
        .from('planogram_slots')
        .delete()
        .eq('planogram_store_id', id);

      // Criar novos slots
      const slotsToInsert = slots.map((slot: any) => ({
        planogram_store_id: id,
        product_id: slot.productId,
        shelf_id: slot.shelfId,
        position_x: slot.positionX,
        width: slot.width,
        facings: slot.facings,
        created_at: now,
        updated_at: now,
      }));

      await supabaseAdmin
        .from('planogram_slots')
        .insert(slotsToInsert);
    }

    // Buscar planograma atualizado
    const { data: updatedData } = await supabaseAdmin
      .from('planogram_store')
      .select('*')
      .eq('id', id)
      .single();

    const { data: updatedSlots } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_store_id', id);

    const result = {
      id: updatedData!.id,
      orgId: updatedData!.org_id,
      storeId: updatedData!.store_id,
      basePlanogramId: updatedData!.base_planogram_id,
      name: updatedData!.name,
      status: updatedData!.status,
      adjustments: updatedData!.adjustments || [],
      slots: (updatedSlots || []).map((s: any) => ({
        id: s.id,
        productId: s.product_id,
        shelfId: s.shelf_id,
        positionX: s.position_x,
        width: s.width,
        facings: s.facings,
      })),
      createdAt: updatedData!.created_at,
      updatedAt: updatedData!.updated_at,
      publishedAt: updatedData!.published_at,
    };

    return NextResponse.json({ planogram: result });

  } catch (error) {
    console.error(`Error updating store planogram ${id}:`, error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

// DELETE /api/planograms/store/[id] - Delete a store-specific planogram
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
    // Deletar slots primeiro (cascade deleção via FK no schema, mas fazemos explicitamente)
    await supabaseAdmin
      .from('planogram_slots')
      .delete()
      .eq('planogram_store_id', id);

    // Deletar planograma
    const { error } = await supabaseAdmin
      .from('planogram_store')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[PlanogramStore] Error deleting planogram:', error);
      throw error;
    }

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error deleting store planogram ${id}:`, error);
    return NextResponse.json({ error: "Failed to delete store planogram." }, { status: 500 });
  }
}
