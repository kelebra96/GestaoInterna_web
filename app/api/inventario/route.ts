import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { InventoryCreateSchema, INVENTORY_ERROR_MESSAGES } from '@/lib/types/inventory';

/**
 * GET /api/inventario
 * Lista inventários com filtros opcionais
 * Query params: status, storeId
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const storeIdFilter = searchParams.get('storeId');

    console.log('🔍 [GET /api/inventario] Auth:', {
      userId: auth.userId,
      role: auth.role,
      orgId: auth.orgId,
      storeIds: auth.storeIds,
    });

    // Construir query baseado nas permissões do usuário
    let query = supabaseAdmin.from('inventories').select('*');

    // Se o usuário tem lojas específicas, filtrar por elas
    if (auth.storeIds && auth.storeIds.length > 0) {
      console.log('🔍 Buscando inventários das lojas:', auth.storeIds);

      // Supabase não tem limite de 10 itens no IN!
      if (storeIdFilter && auth.storeIds.includes(storeIdFilter)) {
        query = query.eq('store_id', storeIdFilter);
      } else {
        query = query.in('store_id', auth.storeIds);
      }
    } else if (auth.role !== 'super_admin' && auth.orgId) {
      // Usuário sem lojas específicas - filtrar por companyId
      console.log('🔍 Buscando inventários da empresa:', auth.orgId);

      if (storeIdFilter) {
        query = query.eq('store_id', storeIdFilter);
      } else {
        query = query.eq('company_id', auth.orgId);
      }
    } else if (storeIdFilter) {
      // Super admin com filtro de loja
      query = query.eq('store_id', storeIdFilter);
    }

    // Aplicar filtro de status se especificado
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    const { data: inventarios, error } = await query;

    if (error) throw error;

    // Converter timestamps para o formato esperado
    const formattedInventarios = (inventarios || []).map((inv: any) => ({
      id: inv.id,
      ...inv,
      createdAt: new Date(inv.created_at),
      updatedAt: new Date(inv.updated_at),
      startedAt: inv.started_at ? new Date(inv.started_at) : null,
      completedAt: inv.completed_at ? new Date(inv.completed_at) : null,
      importedAt: inv.imported_at ? new Date(inv.imported_at) : null,
    }));

    console.log(`🔍 Encontrados ${formattedInventarios.length} inventários`);

    return NextResponse.json({ inventarios: formattedInventarios });
  } catch (error) {
    console.error('Erro ao listar inventários:', error);
    return NextResponse.json({ error: 'Falha ao listar inventários' }, { status: 500 });
  }
}

/**
 * POST /api/inventario
 * Cria um novo inventário
 * Body: { name: string, storeId: string }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validar com Zod
    const validation = InventoryCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: validation.error.issues[0].message
      }, { status: 400 });
    }

    const { name, storeId } = validation.data;

    // Validar se a loja existe
    const { data: storeData, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('company_id')
      .eq('id', storeId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({
        error: 'Loja não encontrada'
      }, { status: 404 });
    }

    const companyId = storeData.company_id;

    if (!companyId) {
      return NextResponse.json({
        error: 'Loja sem empresa associada'
      }, { status: 400 });
    }

    // Validar se usuário tem acesso à loja (exceto super_admin)
    if (auth.role !== 'super_admin' && auth.orgId !== companyId) {
      return NextResponse.json({
        error: 'Você não tem permissão para criar inventário nesta loja'
      }, { status: 403 });
    }

    // REGRA DE NEGÓCIO: Verificar se já existe inventário ativo na loja
    const { data: activeInventories, error: activeError } = await supabaseAdmin
      .from('inventories')
      .select('id, name')
      .eq('store_id', storeId)
      .eq('status', 'in_progress')
      .limit(1);

    if (!activeError && activeInventories && activeInventories.length > 0) {
      const activeInv = activeInventories[0];
      return NextResponse.json({
        error: INVENTORY_ERROR_MESSAGES.INVENTORY_ALREADY_ACTIVE,
        activeInventory: {
          id: activeInv.id,
          name: activeInv.name,
        }
      }, { status: 400 });
    }

    // Criar inventário
    const newInventory = {
      name,
      store_id: storeId,
      company_id: companyId,
      status: 'preparation',
      created_by: auth.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Métricas iniciais
      total_addresses: 0,
      addresses_completed: 0,
      total_items_expected: 0,
      total_items_counted: 0,
      total_discrepancies: 0,
    };

    const { data: created, error: createError } = await supabaseAdmin
      .from('inventories')
      .insert(newInventory)
      .select()
      .single();

    if (createError) throw createError;

    return NextResponse.json({
      inventario: {
        id: created.id,
        ...created,
        createdAt: new Date(created.created_at),
        updatedAt: new Date(created.updated_at),
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar inventário:', error);
    return NextResponse.json({
      error: 'Falha ao criar inventário'
    }, { status: 500 });
  }
}
