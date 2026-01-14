// web/app/api/planograms/base/[id]/slots/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Schema para um slot
const slotSchema = z.object({
  productId: z.string().min(1),
  shelfId: z.string().min(1).default('shelf-1'), // Default shelf
  positionX: z.number().min(0).default(0),
  width: z.number().min(1).default(1),
  facings: z.number().int().min(1).default(1),
  capacity: z.number().int().min(0).default(0),
});

const updateSlotsSchema = z.object({
  slots: z.array(slotSchema),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/planograms/base/[id]/slots - Atualizar slots do planograma base
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Verificar se o planograma existe e usuário tem acesso
    const { data: planogram, error: planogramError } = await supabaseAdmin
      .from('planogram_base')
      .select('org_id')
      .eq('id', id)
      .single();

    if (planogramError || !planogram) {
      return NextResponse.json({ error: 'Planogram not found' }, { status: 404 });
    }

    if (auth.role !== 'super_admin' && planogram.org_id !== auth.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateSlotsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid input",
        details: validation.error.flatten()
      }, { status: 400 });
    }

    const { slots } = validation.data;

    // Deletar slots antigos
    const { error: deleteError } = await supabaseAdmin
      .from('planogram_slots')
      .delete()
      .eq('planogram_base_id', id);

    if (deleteError) {
      console.error('[PlanogramSlots] Error deleting old slots:', deleteError);
      throw deleteError;
    }

    // Criar novos slots em batch
    const now = new Date().toISOString();
    const slotsToInsert = slots.map((slot: any) => ({
      planogram_base_id: id,
      product_id: slot.productId,
      shelf_id: slot.shelfId,
      position_x: slot.positionX,
      width: slot.width,
      facings: slot.facings,
      capacity: slot.capacity,
      created_at: now,
      updated_at: now,
    }));

    const { data: createdSlotsData, error: insertError } = await supabaseAdmin
      .from('planogram_slots')
      .insert(slotsToInsert)
      .select();

    if (insertError) {
      console.error('[PlanogramSlots] Error creating slots:', insertError);
      throw insertError;
    }

    // Atualizar contagem de SKUs no planograma
    const { error: updateError } = await supabaseAdmin
      .from('planogram_base')
      .update({
        total_skus: slots.length,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[PlanogramSlots] Error updating planogram:', updateError);
    }

    const createdSlots = (createdSlotsData || []).map((slot: any) => ({
      id: slot.id,
      productId: slot.product_id,
      shelfId: slot.shelf_id,
      positionX: slot.position_x,
      width: slot.width,
      facings: slot.facings,
      capacity: slot.capacity,
    }));

    return NextResponse.json({
      message: 'Slots updated successfully',
      totalSlots: slots.length,
      slots: createdSlots,
    });

  } catch (error) {
    console.error(`Error updating slots for planogram ${id}:`, error);
    return NextResponse.json({
      error: "An internal server error occurred"
    }, { status: 500 });
  }
}

// GET /api/planograms/base/[id]/slots - Buscar slots do planograma base
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  const { id } = await params;

  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Verificar se o planograma existe e usuário tem acesso
    const { data: planogram, error: planogramError } = await supabaseAdmin
      .from('planogram_base')
      .select('org_id')
      .eq('id', id)
      .single();

    if (planogramError || !planogram) {
      return NextResponse.json({ error: 'Planogram not found' }, { status: 404 });
    }

    if (auth.role !== 'super_admin' && planogram.org_id !== auth.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar slots
    const { data: slotsData, error: slotsError } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_base_id', id);

    if (slotsError) {
      console.error('[PlanogramSlots] Error fetching slots:', slotsError);
      throw slotsError;
    }

    const slots = (slotsData || []).map((slot: any) => ({
      id: slot.id,
      productId: slot.product_id,
      shelfId: slot.shelf_id,
      positionX: slot.position_x,
      width: slot.width,
      facings: slot.facings,
      capacity: slot.capacity,
      createdAt: slot.created_at,
      updatedAt: slot.updated_at,
    }));

    return NextResponse.json({ slots });

  } catch (error) {
    console.error(`Error fetching slots for planogram ${id}:`, error);
    return NextResponse.json({
      error: "An internal server error occurred"
    }, { status: 500 });
  }
}
