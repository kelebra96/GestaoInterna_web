import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
};

export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  const { id, itemId } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('*')
      .eq('id', itemId)
      .eq('solicitacao_id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    const createdAt = new Date(data.created_at || 0);
    const validade = data.validade ? new Date(data.validade) : new Date(0);

    return NextResponse.json({
      item: {
        id: data.id,
        ean: data.ean,
        sku: data.sku,
        descricao: data.descricao || 'Sem descrição',
        precoAtual: data.preco_atual || 0,
        validade: validade.toISOString(),
        qtd: data.qtd || 0,
        loja: data.loja,
        comprador: data.comprador,
        localizacao: data.localizacao,
        lote: data.lote,
        fotoUrl: Array.isArray(data.foto_url) ? data.foto_url : [],
        sugestaoDescontoPercent: data.sugestao_desconto_percent,
        precoSugerido: data.preco_sugerido,
        observacao: data.observacao,
        status: data.status || 'pending',
        motivoRejeicao: data.motivo_rejeicao,
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar item:', error);
    return NextResponse.json({ error: 'Falha ao buscar item' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  const { id, itemId } = await params;
  try {
    const body = await req.json().catch(() => ({}));

    // Campos atualizáveis
    const updateData: any = {};

    if (typeof body.status === 'string') updateData.status = body.status;
    if (typeof body.motivoRejeicao === 'string') updateData.motivo_rejeicao = body.motivoRejeicao;
    if (typeof body.observacao === 'string') updateData.observacao = body.observacao;
    if (typeof body.sugestaoDescontoPercent === 'number') updateData.sugestao_desconto_percent = body.sugestaoDescontoPercent;
    if (typeof body.precoSugerido === 'number') updateData.preco_sugerido = body.precoSugerido;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('solicitacao_itens')
      .update(updateData)
      .eq('id', itemId)
      .eq('solicitacao_id', id);

    if (updateError) throw updateError;

    const { data, error } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Item não encontrado após atualização' }, { status: 404 });
    }

    const createdAt = new Date(data.created_at || 0);
    const validade = data.validade ? new Date(data.validade) : new Date(0);

    return NextResponse.json({
      item: {
        id: data.id,
        ean: data.ean,
        sku: data.sku,
        descricao: data.descricao,
        precoAtual: data.preco_atual,
        validade: validade.toISOString(),
        qtd: data.qtd,
        loja: data.loja,
        comprador: data.comprador,
        localizacao: data.localizacao,
        lote: data.lote,
        fotoUrl: data.foto_url,
        sugestaoDescontoPercent: data.sugestao_desconto_percent,
        precoSugerido: data.preco_sugerido,
        observacao: data.observacao,
        status: data.status,
        motivoRejeicao: data.motivo_rejeicao,
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    return NextResponse.json({ error: 'Falha ao atualizar item' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: Params
) {
  const { id, itemId } = await params;
  try {
    // Delete item (foreign key cascade should handle relations)
    const { error: deleteError } = await supabaseAdmin
      .from('solicitacao_itens')
      .delete()
      .eq('id', itemId)
      .eq('solicitacao_id', id);

    if (deleteError) throw deleteError;

    // Count remaining items and update solicitacao
    const { data: remainingItems, error: countError } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('id')
      .eq('solicitacao_id', id);

    if (!countError) {
      await supabaseAdmin
        .from('solicitacoes')
        .update({
          item_count: remainingItems?.length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    return NextResponse.json({ message: 'Item deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar item:', error);
    return NextResponse.json({ error: 'Falha ao deletar item' }, { status: 500 });
  }
}
