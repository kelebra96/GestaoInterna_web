import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';
import { AddressCheckinSchema } from '@/lib/types/inventory';

// POST - Check-out de endereço (finalizar coleta)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;
    const body = await request.json();

    // Validar body
    const validation = AddressCheckinSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { addressCode } = validation.data;

    // Buscar inventário
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (inventoryError || !inventoryData) {
      return NextResponse.json(
        { error: 'Inventário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar autorização usando helper
    if (!isAuthorizedToAccessInventory(auth, {
      storeId: inventoryData.store_id,
      companyId: inventoryData.company_id
    })) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Buscar o endereço
    const { data: addresses, error: addressError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('address_code', addressCode)
      .limit(1);

    if (addressError || !addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Endereço não encontrado' },
        { status: 404 }
      );
    }

    const addressData = addresses[0];

    // Validar se o usuário tem check-in ativo neste endereço
    if (addressData.status !== 'in_progress' || addressData.assigned_user_id !== auth.userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para finalizar este endereço' },
        { status: 403 }
      );
    }

    // Fazer check-out (finalizar endereço)
    await supabaseAdmin
      .from('inventory_addresses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressData.id);

    // Incrementar contador de endereços completados no inventário
    await supabaseAdmin
      .from('inventories')
      .update({
        addresses_completed: (inventoryData.addresses_completed || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);

    return NextResponse.json({
      success: true,
      message: 'Check-out realizado com sucesso',
      address: {
        id: addressData.id,
        addressCode: addressData.address_code,
        status: 'completed',
        itemsCounted: addressData.items_counted || 0,
      },
    });
  } catch (error: any) {
    console.error('Erro ao fazer check-out:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer check-out: ' + error.message },
      { status: 500 }
    );
  }
}
