import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';
import { AddressCheckinSchema } from '@/lib/types/inventory';

// POST - Check-in em endereço (iniciar coleta)
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

    // Buscar o endereço pelo código
    const { data: addresses, error: addressError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('address_code', addressCode)
      .limit(1);

    if (addressError || !addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Endereço não cadastrado neste inventário' },
        { status: 404 }
      );
    }

    const addressData = addresses[0];

    // Se o endereço já está atribuído ao usuário atual, permitir re-checkin
    if (addressData.assigned_user_id === auth.userId) {
      // Apenas garantir que está em in_progress
      if (addressData.status !== 'in_progress') {
        await supabaseAdmin
          .from('inventory_addresses')
          .update({
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('id', addressData.id);
      }

      return NextResponse.json({
        success: true,
        message: 'Check-in realizado com sucesso',
        address: {
          id: addressData.id,
          addressCode: addressData.address_code,
          status: 'in_progress',
        },
      });
    }

    // Verificar se usuário já tem OUTRO endereço ativo
    const { data: userActiveAddresses, error: activeError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('assigned_user_id', auth.userId)
      .in('status', ['assigned', 'in_progress'])
      .limit(1);

    if (!activeError && userActiveAddresses && userActiveAddresses.length > 0) {
      const activeAddress = userActiveAddresses[0];
      return NextResponse.json(
        {
          error: 'Você já tem um endereço ativo',
          details: {
            addressCode: activeAddress.address_code,
            status: activeAddress.status,
          },
        },
        { status: 409 }
      );
    }

    // Verificar se o endereço está sendo usado por outro usuário
    if (addressData.status === 'in_progress' || addressData.status === 'assigned') {
      return NextResponse.json(
        {
          error: 'Endereço está sendo usado por outro usuário',
          details: {
            assignedTo: addressData.assigned_user_name,
            since: addressData.assigned_at,
          },
        },
        { status: 409 }
      );
    }

    if (addressData.status === 'completed') {
      return NextResponse.json(
        { error: 'Endereço já foi finalizado' },
        { status: 409 }
      );
    }

    // Buscar nome do usuário
    let userName = auth.userId; // fallback
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('name, email')
        .eq('id', auth.userId)
        .single();

      if (!userError && userData) {
        userName = userData.name || userData.email || auth.userId;
      }
    } catch (error) {
      console.warn('Erro ao buscar nome do usuário:', error);
    }

    // Fazer check-in (atribuir ao usuário e iniciar)
    await supabaseAdmin
      .from('inventory_addresses')
      .update({
        status: 'in_progress',
        assigned_user_id: auth.userId,
        assigned_user_name: userName,
        assigned_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressData.id);

    return NextResponse.json({
      success: true,
      message: 'Check-in realizado com sucesso',
      address: {
        id: addressData.id,
        addressCode: addressData.address_code,
        status: 'in_progress',
      },
    });
  } catch (error: any) {
    console.error('Erro ao fazer check-in:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer check-in: ' + error.message },
      { status: 500 }
    );
  }
}
