import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId, addressId } = await params;

    // Verificar inventário
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (inventoryError || !inventoryData) {
      return NextResponse.json({ error: 'Inventário não encontrado' }, { status: 404 });
    }

    const isAuthorizedCompany =
      auth.role === 'super_admin' || inventoryData?.company_id === auth.orgId;

    if (!isAuthorizedCompany) {
      return NextResponse.json({ error: 'Acesso negado a este inventário' }, { status: 403 });
    }

    // Verificar se endereço pertence ao inventário
    const { data: addressData, error: addressError } = await supabaseAdmin
      .from('inventory_addresses')
      .select('*')
      .eq('id', addressId)
      .single();

    if (addressError || !addressData || addressData.inventory_id !== inventoryId) {
      return NextResponse.json({ error: 'Endereço não encontrado' }, { status: 404 });
    }

    // Excluir endereço
    const { error: deleteError } = await supabaseAdmin
      .from('inventory_addresses')
      .delete()
      .eq('id', addressId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Endereço excluído' });
  } catch (error: any) {
    console.error('[Delete Address] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir endereço: ' + error.message },
      { status: 500 }
    );
  }
}
