import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: produto, error: produtoError } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .eq('id', id)
      .single();

    if (produtoError || !produto) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      produto: {
        id: produto.id,
        name: produto.nome || 'Sem nome',
        ean: produto.ean,
        buyer: produto.comprador,
        supplier: produto.fornecedor,
        description: produto.descricao,
        active: produto.ativo === true,
        createdAt: produto.created_at || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return NextResponse.json({ error: 'Falha ao buscar produto' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id } = await params;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Aceitar campos em português ou inglês
    if (typeof body.nome === 'string') updateData.nome = body.nome.trim();
    else if (typeof body.name === 'string') updateData.nome = body.name.trim();

    if (typeof body.ean === 'string') updateData.ean = body.ean.trim();

    if (typeof body.comprador === 'string') updateData.comprador = body.comprador.trim();
    else if (typeof body.buyer === 'string') updateData.comprador = body.buyer.trim();

    if (typeof body.fornecedor === 'string') updateData.fornecedor = body.fornecedor.trim();
    else if (typeof body.supplier === 'string') updateData.fornecedor = body.supplier.trim();

    if (typeof body.descricao === 'string') updateData.descricao = body.descricao.trim();
    else if (typeof body.description === 'string') updateData.descricao = body.description.trim();

    if (typeof body.sku === 'string') updateData.sku = body.sku.trim();
    if (typeof body.unidade === 'string') updateData.unidade = body.unidade.trim();

    if (typeof body.ativo === 'boolean') updateData.ativo = body.ativo;
    else if (typeof body.active === 'boolean') updateData.ativo = body.active;

    if (body.preco !== undefined && body.preco !== null) updateData.preco = Number(body.preco);

    if (Object.keys(updateData).length <= 1) { // apenas updated_at
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('produtos')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[Produtos] Erro ao atualizar produto:', updateError);
      throw updateError;
    }

    // Buscar produto atualizado
    const { data: updatedProduto, error: fetchError } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !updatedProduto) {
      throw fetchError || new Error('Produto não encontrado após atualização');
    }

    return NextResponse.json({
      produto: {
        id: updatedProduto.id,
        name: updatedProduto.nome || 'Sem nome',
        ean: updatedProduto.ean,
        buyer: updatedProduto.comprador,
        supplier: updatedProduto.fornecedor,
        description: updatedProduto.descricao,
        active: updatedProduto.ativo === true,
        createdAt: updatedProduto.created_at || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json({ error: 'Falha ao atualizar produto' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete - marcar como inativo
    const { error: updateError } = await supabaseAdmin
      .from('produtos')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('[Produtos] Erro ao desativar produto:', updateError);
      throw updateError;
    }

    return NextResponse.json({ message: 'Produto desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar produto:', error);
    return NextResponse.json({ error: 'Falha ao desativar produto' }, { status: 500 });
  }
}
