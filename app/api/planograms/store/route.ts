// web/app/api/planograms/store/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { planogramService } from '@/lib/services/planogram.service';

// Zod schema for creating/generating a PlanogramStore
const planogramStoreSchema = z.object({
  basePlanogramId: z.string(), // Removido validação de ObjectID - aceita qualquer string
  storeId: z.string(), // Removido validação de ObjectID - aceita qualquer string
  autoGenerate: z.boolean().optional().default(false),
});

// GET /api/planograms/store - List store-specific planograms
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const basePlanogramId = searchParams.get('basePlanogramId');
    const status = searchParams.get('status');
    const requestedOrgId = searchParams.get('orgId');

    let query = supabaseAdmin
      .from('planogram_store')
      .select('*')
      .order('updated_at', { ascending: false });

    // Filtro de organização
    if (auth.role === 'super_admin') {
      if (requestedOrgId) {
        query = query.eq('org_id', requestedOrgId);
      }
    } else {
      query = query.eq('org_id', auth.orgId);
    }

    // Filtros adicionais
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (basePlanogramId) {
      query = query.eq('base_planogram_id', basePlanogramId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: planogramData, error: planogramError } = await query;

    if (planogramError) {
      console.error('[PlanogramStore] Error fetching planograms:', planogramError);
      throw planogramError;
    }

    const planograms = await Promise.all(
      (planogramData || []).map(async (row: any) => {
        // Buscar slots do planograma
        const { data: slotsData } = await supabaseAdmin
          .from('planogram_slots')
          .select('*')
          .eq('planogram_store_id', row.id);

        const slots = (slotsData || []).map((slotRow: any) => ({
          id: slotRow.id,
          productId: slotRow.product_id,
          shelfId: slotRow.shelf_id,
          positionX: slotRow.position_x,
          width: slotRow.width,
          facings: slotRow.facings,
          capacity: slotRow.capacity,
        }));

        return {
          id: row.id,
          orgId: row.org_id,
          storeId: row.store_id,
          basePlanogramId: row.base_planogram_id,
          name: row.name,
          status: row.status,
          adjustments: row.adjustments || [],
          slots,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          publishedAt: row.published_at,
        };
      })
    );

    return NextResponse.json({ planograms });
  } catch (error) {
    console.error('Error fetching store planograms:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

// POST /api/planograms/store - Create or auto-generate a store-specific planogram
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede', 'merchandiser'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = planogramStoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { basePlanogramId, storeId, autoGenerate } = validation.data;

    // Buscar store do Supabase
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (auth.role !== 'super_admin' && store.company_id !== auth.orgId) {
      return NextResponse.json({ error: 'Store not accessible' }, { status: 404 });
    }

    // Buscar planograma base
    const basePlanogram = await planogramService.getPlanogram(basePlanogramId);
    if (!basePlanogram) {
      return NextResponse.json({ error: 'Base planogram not found' }, { status: 404 });
    }

    if (auth.role !== 'super_admin' && basePlanogram.orgId !== auth.orgId) {
      return NextResponse.json({ error: 'Base planogram not accessible' }, { status: 404 });
    }

    if (basePlanogram.status !== 'publicado') {
      return NextResponse.json({ error: 'Base planogram must be published to generate store-specific' }, { status: 400 });
    }

    // Buscar slots do planograma base
    console.log('🔍 Buscando slots do planograma base:', basePlanogramId);
    const { data: baseSlots, error: slotsError } = await supabaseAdmin
      .from('planogram_slots')
      .select('*')
      .eq('planogram_base_id', basePlanogramId);

    if (slotsError) {
      console.error('[PlanogramStore] Error fetching base slots:', slotsError);
      throw slotsError;
    }

    console.log(`📦 Encontrados ${baseSlots?.length || 0} slots do planograma base`);

    let slotsToCreate = (baseSlots || []).map((slot: any) => ({
      productId: slot.product_id,
      shelfId: slot.shelf_id,
      positionX: slot.position_x,
      width: slot.width,
      facings: slot.facings,
      capacity: slot.capacity,
    }));

    let adjustments: any[] = [];
    const orgIdForPlanogram = store.company_id || basePlanogram.orgId || auth.orgId;
    if (!orgIdForPlanogram) {
      return NextResponse.json({ error: 'Organization not resolved for planogram' }, { status: 400 });
    }

    // Auto-generate: remover produtos sem estoque
    if (autoGenerate) {
      const { data: inventoryData } = await supabaseAdmin
        .from('inventory_snapshots')
        .select('product_id, quantity')
        .eq('store_id', storeId)
        .eq('org_id', orgIdForPlanogram);

      const outOfStockProductIds = new Set(
        (inventoryData || [])
          .filter((inv: any) => (inv.quantity || 0) <= 0)
          .map((inv: any) => inv.product_id)
      );

      slotsToCreate = slotsToCreate.filter((slot) => {
        if (outOfStockProductIds.has(slot.productId)) {
          adjustments.push({
            type: 'remove',
            productId: slot.productId,
            reason: 'Produto sem estoque na loja',
            autoGenerated: true,
          });
          return false;
        }
        return true;
      });
    }

    // Criar planograma de loja
    const now = new Date().toISOString();
    const planogramStoreData: Record<string, unknown> = {
      org_id: orgIdForPlanogram,
      company_id: orgIdForPlanogram,
      store_id: storeId,
      base_planogram_id: basePlanogramId,
      base_id: basePlanogramId,
      name: `${basePlanogram.name} - ${store.name}`,
      status: 'draft',
      adjustments,
      created_at: now,
      updated_at: now,
    };

    const insertPlanogramStore = async (payload: Record<string, unknown>) => {
      return supabaseAdmin
        .from('planogram_store')
        .insert(payload)
        .select()
        .single();
    };

    let planogramStore: any;
    let planogramError: any;
    let payloadToInsert: Record<string, unknown> = { ...planogramStoreData };

    const maxAttempts = Math.max(3, Object.keys(payloadToInsert).length);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      ({ data: planogramStore, error: planogramError } = await insertPlanogramStore(payloadToInsert));
      if (!planogramError) {
        break;
      }

      if (planogramError?.code === '23514' && String(planogramError?.message || '').toLowerCase().includes('status')) {
        payloadToInsert = { ...payloadToInsert, status: 'pending' };
        continue;
      }

      if (planogramError?.code !== 'PGRST204') {
        break;
      }

      const message = String(planogramError?.message || '');
      const match = message.match(/'([^']+)' column/);
      const missingColumn = match?.[1];
      if (!missingColumn || !(missingColumn in payloadToInsert)) {
        break;
      }

      const { [missingColumn]: _removed, ...rest } = payloadToInsert;
      payloadToInsert = rest;
    }

    if (planogramError) {
      console.error('[PlanogramStore] Error creating planogram:', planogramError);
      throw planogramError;
    }

    // Criar slots em batch
    const slotsDataToInsert = slotsToCreate.map((slot) => ({
      planogram_store_id: planogramStore.id,
      product_id: slot.productId,
      shelf_id: slot.shelfId,
      position_x: slot.positionX || 0,
      width: slot.width || 1,
      facings: slot.facings || 1,
      capacity: slot.capacity || 0,
      created_at: now,
      updated_at: now,
    }));

    const resultPlanogram = {
      id: planogramStore.id,
      orgId: planogramStore.org_id || planogramStore.company_id || orgIdForPlanogram,
      storeId: planogramStore.store_id || storeId,
      basePlanogramId: planogramStore.base_planogram_id || planogramStore.base_id || basePlanogramId,
      name: planogramStore.name || `${basePlanogram.name} - ${store.name}`,
      status: planogramStore.status || 'draft',
      adjustments: planogramStore.adjustments || adjustments || [],
      slots: [] as any[],
      createdAt: planogramStore.created_at || now,
      updatedAt: planogramStore.updated_at || now,
    };

    if (slotsDataToInsert.length === 0) {
      return NextResponse.json({ planogram: resultPlanogram }, { status: 201 });
    }

    const { data: createdSlotsData, error: slotsInsertError } = await supabaseAdmin
      .from('planogram_slots')
      .insert(slotsDataToInsert)
      .select();

    if (slotsInsertError) {
      if (slotsInsertError.code === 'PGRST204') {
        console.warn('[PlanogramStore] Slots table schema does not support store slots. Rolling back planogram_store.');
        await supabaseAdmin
          .from('planogram_store')
          .delete()
          .eq('id', planogramStore.id);
        return NextResponse.json({
          error: 'Slots table does not support store-specific slots. Run migration 006 to enable planogram_store_id.',
        }, { status: 409 });
      }
      console.error('[PlanogramStore] Error creating slots:', slotsInsertError);
      throw slotsInsertError;
    }

    const createdSlots = (createdSlotsData || []).map((slot: any) => ({
      id: slot.id,
      planogramStoreId: slot.planogram_store_id,
      productId: slot.product_id,
      shelfId: slot.shelf_id,
      positionX: slot.position_x,
      width: slot.width,
      facings: slot.facings,
      capacity: slot.capacity,
    }));

    const result = {
      ...resultPlanogram,
      slots: createdSlots,
    };

    return NextResponse.json({ planogram: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating store planogram:', error);
    const err = error as any;
    return NextResponse.json({
      error: 'An internal server error occurred',
      code: err?.code,
      message: err?.message,
      details: err?.details ?? null,
    }, { status: 500 });
  }
}
