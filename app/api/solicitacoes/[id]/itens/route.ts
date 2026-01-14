import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  const { id } = await params;
  try {
    const { data: itensData, error } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('*')
      .eq('solicitacao_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const itens = (itensData || []).map((data: any) => {
      const createdAt = new Date(data.created_at || 0);
      const validade = data.validade ? new Date(data.validade) : new Date(0);

      return {
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
      };
    });

    return NextResponse.json({ itens });
  } catch (error) {
    console.error('Erro ao listar itens:', error);
    return NextResponse.json({ error: 'Falha ao listar itens' }, { status: 500 });
  }
}
