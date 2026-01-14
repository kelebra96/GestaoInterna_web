// web/app/api/volumetria/perda-receita/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PerdaReceitaProduto, EventoRuptura } from '@/lib/types/volumetria';

export const dynamic = 'force-dynamic';

/**
 * GET /api/volumetria/perda-receita
 *
 * Lista SKUs ordenados por maior perda de receita no período
 *
 * Query params:
 * - id_loja: ID da loja (obrigatório)
 * - periodo_dias: Período em dias para análise (padrão: 30)
 * - limit: Número máximo de resultados (padrão: 20)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id_loja = searchParams.get('id_loja');
    const periodo_dias = parseInt(searchParams.get('periodo_dias') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!id_loja) {
      return NextResponse.json(
        { error: 'Parâmetro id_loja é obrigatório' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodo_inicio = new Date(now.getTime() - periodo_dias * 24 * 60 * 60 * 1000);

    // 1. Buscar eventos de ruptura no período
    const { data: rupturas, error: rupturasError } = await supabaseAdmin
      .from('eventos_ruptura')
      .select('*')
      .eq('store_id', id_loja)
      .gte('data_hora_inicio', periodo_inicio.toISOString());

    if (rupturasError) {
      console.error('[VolumetriaPerda] Error fetching rupturas:', rupturasError);
      throw rupturasError;
    }

    if (!rupturas || rupturas.length === 0) {
      return NextResponse.json({
        produtos_perda_receita: [],
        total_receita_perdida: 0,
        total_margem_perdida: 0,
        message: 'Nenhum evento de ruptura encontrado no período'
      });
    }

    // 2. Agrupar eventos por produto
    const perdaPorProduto = new Map<string, {
      eventos: number;
      duracao_total_horas: number;
      unidades_nao_vendidas: number;
      receita_perdida: number;
      margem_perdida: number;
    }>();

    for (const ruptura of rupturas) {
      const id_produto = ruptura.produto_id;

      if (!perdaPorProduto.has(id_produto)) {
        perdaPorProduto.set(id_produto, {
          eventos: 0,
          duracao_total_horas: 0,
          unidades_nao_vendidas: 0,
          receita_perdida: 0,
          margem_perdida: 0,
        });
      }

      const perda = perdaPorProduto.get(id_produto)!;
      perda.eventos += 1;
      perda.duracao_total_horas += ruptura.duracao_ruptura_horas || 0;
      perda.unidades_nao_vendidas += ruptura.unidades_nao_vendidas || 0;
      perda.receita_perdida += ruptura.receita_perdida || 0;
      perda.margem_perdida += ruptura.margem_perdida || 0;
    }

    // 3. Buscar dados dos produtos e montar resultado
    const produtoIds = Array.from(perdaPorProduto.keys());
    const { data: produtos } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('id, ean, descricao')
      .in('id', produtoIds);

    const produtoMap = new Map();
    (produtos || []).forEach((p: any) => {
      produtoMap.set(p.id, p);
    });

    const produtosPerdaReceita: PerdaReceitaProduto[] = [];

    for (const [id_produto, perda] of perdaPorProduto.entries()) {
      const produto = produtoMap.get(id_produto);
      const ean = produto?.ean || '';
      const descricao = produto?.descricao || 'Produto desconhecido';

      produtosPerdaReceita.push({
        id_produto,
        ean,
        descricao,
        total_eventos_ruptura: perda.eventos,
        duracao_total_ruptura_horas: perda.duracao_total_horas,
        unidades_nao_vendidas: perda.unidades_nao_vendidas,
        receita_perdida: perda.receita_perdida,
        margem_perdida: perda.margem_perdida || undefined,
      });
    }

    // 4. Ordenar por receita perdida (maior primeiro)
    produtosPerdaReceita.sort((a, b) => b.receita_perdida - a.receita_perdida);

    // 5. Limitar resultado
    const produtosLimitados = produtosPerdaReceita.slice(0, limit);

    // 6. Calcular totais
    const total_receita_perdida = produtosPerdaReceita.reduce(
      (sum, p) => sum + p.receita_perdida,
      0
    );
    const total_margem_perdida = produtosPerdaReceita.reduce(
      (sum, p) => sum + (p.margem_perdida || 0),
      0
    );
    const total_unidades_nao_vendidas = produtosPerdaReceita.reduce(
      (sum, p) => sum + p.unidades_nao_vendidas,
      0
    );

    return NextResponse.json({
      produtos_perda_receita: produtosLimitados,
      total_produtos: produtosPerdaReceita.length,
      total_produtos_retornados: produtosLimitados.length,
      totais: {
        receita_perdida: total_receita_perdida,
        margem_perdida: total_margem_perdida,
        unidades_nao_vendidas: total_unidades_nao_vendidas,
      },
      periodo: {
        inicio: periodo_inicio.toISOString(),
        fim: now.toISOString(),
        dias: periodo_dias,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar perda de receita:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    );
  }
}
