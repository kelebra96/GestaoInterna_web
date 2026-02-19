/**
 * API: Métricas por Loja
 *
 * Retorna métricas detalhadas para uma ou mais lojas:
 * - Estoque, Perdas, Rupturas, Vendas
 * - RFE com componentes
 * - Comparativo com período anterior
 *
 * Endpoint: GET /api/varejo/metricas-loja
 * Query params:
 *   - lojaId: UUID da loja (opcional, retorna todas se não especificado)
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - limit: número máximo de registros (default: 50)
 *   - offset: paginação (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 120;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

// Campos válidos para ordenação
const VALID_ORDER_FIELDS = [
  'rfe_score',
  'giro_estoque',
  'capital_parado',
  'estoque_morto_valor',
  'valor_estoque_total',
  'perda_valor_total',
  'vendas_perdidas_valor',
  'faturamento_total',
  'cobertura_dias',
  'qtd_skus_ruptura',
  'taxa_disponibilidade',
  'ruptura_recorrente_qtd',
  'perda_sobre_faturamento_pct',
  'margem_bruta_pct',
] as const;

interface MetricasLoja {
  id: string;
  lojaId: string;
  lojaNome?: string;
  lojaCodigo?: string;
  periodo: string;
  tipoPeriodo: string;

  // Estoque
  estoque: {
    valorTotal: number;
    quantidadeSkus: number;
    giro: number;
    coberturaDias: number;
    capitalParado: number;
    capitalParadoPct: number;
    estoqueMortoValor: number;
    estoqueMortoQtd: number;
    skusRuptura: number;
  };

  // Perdas
  perdas: {
    valorTotal: number;
    quantidadeTotal: number;
    sobreFaturamentoPct: number;
    sobreEstoquePct: number;
    vencimento: { valor: number; pct: number };
    avaria: { valor: number; pct: number };
    roubo: { valor: number; pct: number };
    margemPerdida: number;
  };

  // Rupturas
  rupturas: {
    vendasPerdidas: number;
    quantidadePerdida: number;
    vendaPotencial: number;
    taxaDisponibilidade: number;
    produtosRecorrentes: number;
    impactoMargem: number;
  };

  // Vendas
  vendas: {
    faturamentoTotal: number;
    margemBrutaValor: number;
    margemBrutaPct: number;
    valorPromocoes: number;
  };

  // RFE
  rfe: {
    score: number;
    rank: number;
    nivel: string;
    componentePerdas: number;
    componenteVendasPerdidas: number;
    componenteCapitalParado: number;
  };

  calculadoEm: string;
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function mapMetricasLoja(row: any): MetricasLoja {
  return {
    id: row.id,
    lojaId: row.loja_id,
    lojaNome: row.loja_nome || row.loja?.nome,
    lojaCodigo: row.loja_codigo || row.loja?.codigo,
    periodo: row.periodo,
    tipoPeriodo: row.tipo_periodo,

    estoque: {
      valorTotal: parseFloat(row.valor_estoque_total) || 0,
      quantidadeSkus: parseInt(row.quantidade_skus) || 0,
      giro: parseFloat(row.giro_estoque) || 0,
      coberturaDias: parseFloat(row.cobertura_dias) || 0,
      capitalParado: parseFloat(row.capital_parado) || 0,
      capitalParadoPct: parseFloat(row.estoque_acima_60_dias_pct) || 0,
      estoqueMortoValor: parseFloat(row.estoque_morto_valor) || 0,
      estoqueMortoQtd: parseInt(row.estoque_morto_qtd) || 0,
      skusRuptura: parseInt(row.qtd_skus_ruptura) || 0,
    },

    perdas: {
      valorTotal: parseFloat(row.perda_valor_total) || 0,
      quantidadeTotal: parseFloat(row.perda_quantidade_total) || 0,
      sobreFaturamentoPct: parseFloat(row.perda_sobre_faturamento_pct) || 0,
      sobreEstoquePct: parseFloat(row.perda_sobre_estoque_pct) || 0,
      vencimento: {
        valor: parseFloat(row.perda_vencimento_valor) || 0,
        pct: parseFloat(row.perda_vencimento_pct) || 0,
      },
      avaria: {
        valor: parseFloat(row.perda_avaria_valor) || 0,
        pct: parseFloat(row.perda_avaria_pct) || 0,
      },
      roubo: {
        valor: parseFloat(row.perda_roubo_valor) || 0,
        pct: parseFloat(row.perda_roubo_pct) || 0,
      },
      margemPerdida: parseFloat(row.margem_perdida_total) || 0,
    },

    rupturas: {
      vendasPerdidas: parseFloat(row.vendas_perdidas_valor) || 0,
      quantidadePerdida: parseFloat(row.vendas_perdidas_quantidade) || 0,
      vendaPotencial: parseFloat(row.venda_potencial) || 0,
      taxaDisponibilidade: parseFloat(row.taxa_disponibilidade) || 0,
      produtosRecorrentes: parseInt(row.ruptura_recorrente_qtd) || 0,
      impactoMargem: parseFloat(row.impacto_margem_ruptura) || 0,
    },

    vendas: {
      faturamentoTotal: parseFloat(row.faturamento_total) || 0,
      margemBrutaValor: parseFloat(row.margem_bruta_valor) || 0,
      margemBrutaPct: parseFloat(row.margem_bruta_pct) || 0,
      valorPromocoes: parseFloat(row.valor_promocoes) || 0,
    },

    rfe: {
      score: parseFloat(row.rfe_score) || 0,
      rank: parseInt(row.rfe_rank) || 0,
      nivel: row.rfe_nivel || 'baixo',
      componentePerdas: parseFloat(row.rfe_componente_perdas) || 0,
      componenteVendasPerdidas: parseFloat(row.rfe_componente_vendas_perdidas) || 0,
      componenteCapitalParado: parseFloat(row.rfe_componente_capital_parado) || 0,
    },

    calculadoEm: row.calculado_em || new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const lojaId = searchParams.get('lojaId');
    const periodo = searchParams.get('periodo') || getDefaultPeriodo();
    const tipoPeriodo = searchParams.get('tipo_periodo') || 'mensal';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const orderByParam = searchParams.get('orderBy') || 'rfe_score';
    const order = searchParams.get('order') || 'desc';

    // Validar campo de ordenação
    const orderBy = VALID_ORDER_FIELDS.includes(orderByParam as any)
      ? orderByParam
      : 'rfe_score';

    console.log('[Métricas Loja] Query params:', { periodo, tipoPeriodo, orderBy, order, limit });

    // Build query
    let query = supabaseAdmin
      .from('agg_metricas_loja')
      .select(`
        *,
        loja:dim_loja(id, nome, codigo, cluster)
      `)
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo);

    // Filter by loja if specified
    if (lojaId) {
      query = query.eq('loja_id', lojaId);
    }

    // Order - usar nullsFirst false para colocar nulos no final
    // Adicionar ordenação secundária por loja_id para garantir resultados consistentes
    query = query
      .order(orderBy, { ascending: order === 'asc', nullsFirst: false })
      .order('loja_id', { ascending: true });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Métricas Loja] Erro na query:', error);
      throw error;
    }

    // Se não tiver nome via dim_loja, buscar da tabela stores como fallback
    const lojaIds = (data || []).map((row: any) => row.loja_id).filter(Boolean);
    let storesMap: Record<string, { name: string; code?: string }> = {};

    if (lojaIds.length > 0) {
      const { data: stores } = await supabaseAdmin
        .from('stores')
        .select('id, name, code')
        .in('id', lojaIds);

      if (stores) {
        storesMap = stores.reduce((acc: any, s: any) => {
          acc[s.id] = { name: s.name, code: s.code };
          return acc;
        }, {});
      }
    }

    const metricas = (data || []).map((row: any) => {
      const mapped = mapMetricasLoja(row);
      // Tentar dim_loja primeiro, depois stores como fallback
      if (row.loja?.nome) {
        mapped.lojaNome = row.loja.nome;
        mapped.lojaCodigo = row.loja.codigo;
      } else if (storesMap[row.loja_id]) {
        mapped.lojaNome = storesMap[row.loja_id].name;
        mapped.lojaCodigo = storesMap[row.loja_id].code;
      } else {
        // Fallback: usar ID truncado
        mapped.lojaNome = `Loja ${row.loja_id?.slice(0, 8) || 'N/A'}`;
      }
      return mapped;
    });

    return NextResponse.json({
      success: true,
      data: lojaId ? metricas[0] || null : metricas,
      pagination: {
        limit,
        offset,
        total: count || metricas.length,
      },
      query: { orderBy, order, periodo, tipoPeriodo },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[Métricas Loja] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar métricas da loja',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
