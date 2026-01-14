// web/app/api/promotions/route.ts
/**
 * API de Promoções e Sazonalidade
 * Conforme especificação do documento PLANOGRAMA.md - Seção 10
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const promotionSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(['promocao', 'evento', 'sazonalidade']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  storeIds: z.array(z.string()).min(1),
  planogramBaseId: z.string().optional(),
  promotedProducts: z.array(z.object({
    productId: z.string(),
    productName: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    highlightColor: z.string().optional(),
  })).optional(),
  active: z.boolean().optional().default(true),
});

/**
 * GET /api/promotions
 * Lista promoções com filtros opcionais
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const active = searchParams.get('active');
    const type = searchParams.get('type');

    let query = supabaseAdmin.from('promotions').select('*');

    // Filtrar por organização
    if (auth.role === 'super_admin') {
      const orgId = searchParams.get('orgId');
      if (orgId) {
        query = query.eq('company_id', orgId);
      }
    } else {
      query = query.eq('company_id', auth.orgId);
    }

    // Filtros adicionais
    if (active !== null) {
      query = query.eq('active', active === 'true');
    }

    if (type) {
      query = query.eq('type', type);
    }

    // Filtrar por loja específica (array contains)
    if (storeId) {
      query = query.contains('store_ids', [storeId]);
    }

    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[Promotions] Error fetching:', error);
      throw error;
    }

    const promotions = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      storeIds: row.store_ids,
      planogramBaseId: row.planogram_base_id,
      promotedProducts: row.promoted_products,
      active: row.active,
      companyId: row.company_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ promotions });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

/**
 * POST /api/promotions
 * Cria uma nova promoção
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = promotionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid input",
        details: validation.error.flatten()
      }, { status: 400 });
    }

    const data = validation.data;

    // Validar datas
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      return NextResponse.json({
        error: "endDate must be after startDate"
      }, { status: 400 });
    }

    // Verificar se as lojas existem e pertencem à organização (batch query)
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, org_id')
      .in('id', data.storeIds);

    if (storesError) {
      console.error('[Promotions] Error fetching stores:', storesError);
      throw storesError;
    }

    if (!stores || stores.length !== data.storeIds.length) {
      const foundIds = stores?.map(s => s.id) || [];
      const missingIds = data.storeIds.filter(id => !foundIds.includes(id));
      return NextResponse.json({
        error: `Store(s) not found: ${missingIds.join(', ')}`
      }, { status: 404 });
    }

    // Check organization ownership
    for (const store of stores) {
      if (auth.role !== 'super_admin' && store.org_id !== auth.orgId) {
        return NextResponse.json({
          error: `Store ${store.id} does not belong to your organization`
        }, { status: 403 });
      }
    }

    // Se planogramBaseId fornecido, verificar se existe
    if (data.planogramBaseId) {
      const { data: planogram, error: planogramError } = await supabaseAdmin
        .from('planogram_base')
        .select('id, org_id')
        .eq('id', data.planogramBaseId)
        .single();

      if (planogramError || !planogram) {
        return NextResponse.json({
          error: 'Planogram base not found'
        }, { status: 404 });
      }

      if (auth.role !== 'super_admin' && planogram.org_id !== auth.orgId) {
        return NextResponse.json({
          error: 'Planogram does not belong to your organization'
        }, { status: 403 });
      }
    }

    const companyId = auth.role === 'super_admin' ? stores[0].org_id : auth.orgId;

    const { data: created, error: insertError } = await supabaseAdmin
      .from('promotions')
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        store_ids: data.storeIds,
        planogram_base_id: data.planogramBaseId || null,
        promoted_products: data.promotedProducts || null,
        active: data.active ?? true,
        company_id: companyId,
        created_by: auth.userId,
        created_by_name: (auth as any).name || (auth as any).email,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[Promotions] Error creating:', insertError);
      throw insertError;
    }

    const promotion = {
      id: created.id,
      name: created.name,
      description: created.description,
      type: created.type,
      startDate: created.start_date,
      endDate: created.end_date,
      storeIds: created.store_ids,
      planogramBaseId: created.planogram_base_id,
      promotedProducts: created.promoted_products,
      active: created.active,
      companyId: created.company_id,
      createdBy: created.created_by,
      createdByName: created.created_by_name,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };

    return NextResponse.json({ promotion }, { status: 201 });

  } catch (error) {
    console.error("Error creating promotion:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
