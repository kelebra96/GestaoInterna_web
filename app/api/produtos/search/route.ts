import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/produtos/search?ean=123456789
 * Busca produto pelo código de barras (EAN)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ean = searchParams.get('ean');

    if (!ean || ean.trim().length < 8) {
      return NextResponse.json(
        { error: 'Código de barras inválido (mínimo 8 caracteres)' },
        { status: 400 }
      );
    }

    const cleanEan = ean.trim();

    // Buscar no Supabase
    const { data, error } = await supabaseAdmin
      .from('produtos')
      .select('id, ean, nome, descricao, preco, unidade, sku')
      .eq('ean', cleanEan)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Produtos/Search] Erro ao buscar produto:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar produto' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { product: null, message: 'Produto não encontrado' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      product: {
        id: data.id,
        ean: data.ean,
        nome: data.nome,
        descricao: data.descricao,
        preco: data.preco,
        unidade: data.unidade,
        sku: data.sku,
      },
    });
  } catch (error) {
    console.error('[Produtos/Search] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
