import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';
import { AddressCreateSchema } from '@/lib/types/inventory';

// GET - Listar endereços do inventário
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;

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

    // Buscar endereços
    const { data: addressesData, error: addressesError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('inventory_id', inventoryId);

    if (addressesError) {
      throw addressesError;
    }

    // Mapear endereços e enriquecer com nome do usuário se necessário
    const addresses = await Promise.all(
      (addressesData || []).map(async (data: any) => {
        let assignedUserName = data.assigned_user_name;

        // Se assignedUserName parece ser um ID (tem mais de 20 caracteres e sem espaços), buscar nome real
        if (
          data.assigned_user_id &&
          (!assignedUserName ||
            (assignedUserName.length > 20 && !assignedUserName.includes(' ')))
        ) {
          try {
            const { data: userData, error: userError } = await supabaseAdmin
              .from('users')
              .select('name, email')
              .eq('id', data.assigned_user_id)
              .single();

            if (!userError && userData) {
              assignedUserName = userData.name || userData.email || data.assigned_user_id;
            }
          } catch (error) {
            console.warn('Erro ao buscar nome do usuário:', error);
          }
        }

        return {
          id: data.id,
          addressCode: data.address_code || '',
          status: data.status || 'pending',
          assignedUserId: data.assigned_user_id,
          assignedUserName,
          itemsCounted: data.items_counted || 0,
          itemsExpected: data.items_expected || 0,
          createdAt: data.created_at ? new Date(data.created_at) : null,
          updatedAt: data.updated_at ? new Date(data.updated_at) : null,
          startedAt: data.started_at ? new Date(data.started_at) : null,
          completedAt: data.completed_at ? new Date(data.completed_at) : null,
          assignedAt: data.assigned_at ? new Date(data.assigned_at) : null,
        };
      })
    );

    // Ordenar por addressCode
    addresses.sort((a: any, b: any) => (a.addressCode || '').localeCompare(b.addressCode || ''));

    // Calcular estatísticas de produtividade por usuário
    const userStats = new Map<string, {
      userId: string;
      userName: string;
      addressesCompleted: number;
      totalItemsCounted: number;
    }>();

    addresses.forEach((address: any) => {
      if (address.assignedUserId && address.status === 'completed') {
        const existing = userStats.get(address.assignedUserId);
        if (existing) {
          existing.addressesCompleted += 1;
          existing.totalItemsCounted += address.itemsCounted || 0;
        } else {
          userStats.set(address.assignedUserId, {
            userId: address.assignedUserId,
            userName: address.assignedUserName || address.assignedUserId,
            addressesCompleted: 1,
            totalItemsCounted: address.itemsCounted || 0,
          });
        }
      }
    });

    // Converter para array e ordenar por produtividade
    const topUsers = Array.from(userStats.values())
      .sort((a, b) => {
        // Ordenar primeiro por endereços completos, depois por itens contados
        if (b.addressesCompleted !== a.addressesCompleted) {
          return b.addressesCompleted - a.addressesCompleted;
        }
        return b.totalItemsCounted - a.totalItemsCounted;
      })
      .slice(0, 10); // Top 10

    return NextResponse.json({ addresses, topUsers });
  } catch (error: any) {
    console.error('Erro ao buscar endereços:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar endereços: ' + error.message },
      { status: 500 }
    );
  }
}

// POST - Cadastrar novos endereços
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
    const validation = AddressCreateSchema.safeParse(body);
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

    // Verificar se endereço já existe
    const { data: existingAddress, error: existingError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('id')
      .eq('inventory_id', inventoryId)
      .eq('address_code', addressCode)
      .limit(1);

    if (!existingError && existingAddress && existingAddress.length > 0) {
      return NextResponse.json(
        { error: 'Endereço já cadastrado neste inventário' },
        { status: 409 }
      );
    }

    // Criar endereço
    const newAddress = {
      inventory_id: inventoryId,
      store_id: inventoryData.store_id,
      company_id: auth.orgId,
      address_code: addressCode,
      status: 'pending',
      items_counted: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdAddress, error: createError } = await supabaseAdmin
      .from('inventory_addresses')
      .insert(newAddress)
      .select()
      .single();

    if (createError) throw createError;

    // Atualizar contador no inventário
    await supabaseAdmin
      .from('inventories')
      .update({
        total_addresses: (inventoryData.total_addresses || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);

    return NextResponse.json({
      success: true,
      message: 'Endereço cadastrado com sucesso',
      addressId: createdAddress.id,
    });
  } catch (error: any) {
    console.error('Erro ao cadastrar endereço:', error);
    return NextResponse.json(
      { error: 'Erro ao cadastrar endereço: ' + error.message },
      { status: 500 }
    );
  }
}
