// web/app/api/promotions/[id]/route.ts
/**
 * API de Promoções - Operações individuais
 * GET, PUT, DELETE de promoções específicas
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const promotionUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  type: z.enum(['promocao', 'evento', 'sazonalidade']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  storeIds: z.array(z.string()).min(1).optional(),
  planogramBaseId: z.string().optional().nullable(),
  promotedProducts: z.array(z.object({
    productId: z.string(),
    productName: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    highlightColor: z.string().optional(),
  })).optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/promotions/[id]
 * Busca uma promoção específica
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    // Verificar acesso
    if (auth.role !== 'super_admin' && data.company_id !== auth.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const promotion = {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      startDate: data.start_date,
      endDate: data.end_date,
      storeIds: data.store_ids,
      planogramBaseId: data.planogram_base_id,
      promotedProducts: data.promoted_products,
      active: data.active,
      companyId: data.company_id,
      createdBy: data.created_by,
      createdByName: data.created_by_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ promotion });
  } catch (error) {
    console.error("Error fetching promotion:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

/**
 * PUT /api/promotions/[id]
 * Atualiza uma promoção
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    // Verificar acesso
    if (auth.role !== 'super_admin' && existing.company_id !== auth.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = promotionUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid input",
        details: validation.error.flatten()
      }, { status: 400 });
    }

    const data = validation.data;

    // Validar datas se ambas fornecidas
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : new Date(existing.start_date);
      const endDate = data.endDate ? new Date(data.endDate) : new Date(existing.end_date);

      if (endDate <= startDate) {
        return NextResponse.json({
          error: "endDate must be after startDate"
        }, { status: 400 });
      }
    }

    const updatePayload: any = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.startDate !== undefined) updatePayload.start_date = new Date(data.startDate).toISOString();
    if (data.endDate !== undefined) updatePayload.end_date = new Date(data.endDate).toISOString();
    if (data.storeIds !== undefined) updatePayload.store_ids = data.storeIds;
    if (data.planogramBaseId !== undefined) updatePayload.planogram_base_id = data.planogramBaseId;
    if (data.promotedProducts !== undefined) updatePayload.promoted_products = data.promotedProducts;
    if (data.active !== undefined) updatePayload.active = data.active;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('promotions')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Promotions] Error updating:', updateError);
      throw updateError;
    }

    const promotion = {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      type: updated.type,
      startDate: updated.start_date,
      endDate: updated.end_date,
      storeIds: updated.store_ids,
      planogramBaseId: updated.planogram_base_id,
      promotedProducts: updated.promoted_products,
      active: updated.active,
      companyId: updated.company_id,
      createdBy: updated.created_by,
      createdByName: updated.created_by_name,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    return NextResponse.json({ promotion });

  } catch (error) {
    console.error("Error updating promotion:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

/**
 * DELETE /api/promotions/[id]
 * Deleta uma promoção
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { data: promotion, error: fetchError } = await supabaseAdmin
      .from('promotions')
      .select('company_id')
      .eq('id', id)
      .single();

    if (fetchError || !promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    // Verificar acesso
    if (auth.role !== 'super_admin' && promotion.company_id !== auth.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('promotions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Promotions] Error deleting:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Promotion deleted successfully'
    });

  } catch (error) {
    console.error("Error deleting promotion:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
