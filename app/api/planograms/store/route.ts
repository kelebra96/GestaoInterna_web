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

    // Auto-generate: remover produtos sem estoque
    if (autoGenerate) {
      const { data: inventoryData } = await supabaseAdmin
        .from('inventory_snapshots')
        .select('product_id, quantity')
        .eq('store_id', storeId)
        .eq('org_id', auth.orgId);

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
    const planogramStoreData = {
      org_id: auth.orgId,
      store_id: storeId,
      base_planogram_id: basePlanogramId,
      name: `${basePlanogram.name} - ${store.name}`,
      status: 'draft',
      adjustments,
      created_at: now,
      updated_at: now,
    };

    const { data: planogramStore, error: planogramError } = await supabaseAdmin
      .from('planogram_store')
      .insert(planogramStoreData)
      .select()
      .single();

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

    const { data: createdSlotsData, error: slotsInsertError } = await supabaseAdmin
      .from('planogram_slots')
      .insert(slotsDataToInsert)
      .select();

    if (slotsInsertError) {
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
      id: planogramStore.id,
      orgId: planogramStore.org_id,
      storeId: planogramStore.store_id,
      basePlanogramId: planogramStore.base_planogram_id,
      name: planogramStore.name,
      status: planogramStore.status,
      adjustments: planogramStore.adjustments || [],
      slots: createdSlots,
      createdAt: planogramStore.created_at,
      updatedAt: planogramStore.updated_at,
    };

    return NextResponse.json({ planogram: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating store planogram:', error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}