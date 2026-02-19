/**
 * API: Risk Financial Exposure (RFE)
 *
 * Análise de exposição financeira ao risco:
 * - Ranking de lojas por RFE
 * - Decomposição: Perdas + Vendas Perdidas + Custo de Capital
 * - Identificação do principal problema por loja
 *
 * Endpoint: GET /api/varejo/rfe
 * Query params:
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - nivel: 'critico' | 'alto' | 'medio' | 'baixo' (filtra por nível)
 *   - limit: número máximo de registros (default: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 120;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

interface RfeItem {
  lojaId: string;
  lojaNome: string;
  lojaCodigo: string;
  lojaCluster?: string;
  periodo: string;

  rfeScore: number;
  rfeRank: number;
  rfeNivel: 'critico' | 'alto' | 'medio' | 'baixo';

  componentes: {
    perdas: number;
    vendasPerdidas: number;
    capitalParado: number;
  };

  metricas: {
    perdaValorTotal: number;
    perdaSobreFaturamentoPct: number;
    vendasPerdidasValor: number;
    taxaDisponibilidade: number;
    capitalParado: number;
    faturamentoTotal: number;
  };

  principalProblema: 'Perdas' | 'Rupturas' | 'Capital Parado';

  calculadoEm: string;
}

interface RfeSummary {
  totalRfe: number;
  mediaRfe: number;
  distribuicao: {
    critico: number;
    alto: number;
    medio: number;
    baixo: number;
  };
  maiorRisco: RfeItem | null;
  menorRisco: RfeItem | null;
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function mapRfeItem(row: any): RfeItem {
  return {
    lojaId: row.loja_id,
    lojaNome: row.loja_nome,
    lojaCodigo: row.loja_codigo,
    lojaCluster: row.loja_cluster,
    periodo: row.periodo,

    rfeScore: parseFloat(row.rfe_score) || 0,
    rfeRank: parseInt(row.rfe_rank) || 0,
    rfeNivel: row.rfe_nivel || 'baixo',

    componentes: {
      perdas: parseFloat(row.rfe_componente_perdas) || 0,
      vendasPerdidas: parseFloat(row.rfe_componente_vendas_perdidas) || 0,
      capitalParado: parseFloat(row.rfe_componente_capital_parado) || 0,
    },

    metricas: {
      perdaValorTotal: parseFloat(row.perda_valor_total) || 0,
      perdaSobreFaturamentoPct: parseFloat(row.perda_sobre_faturamento_pct) || 0,
      vendasPerdidasValor: parseFloat(row.vendas_perdidas_valor) || 0,
      taxaDisponibilidade: parseFloat(row.taxa_disponibilidade) || 0,
      capitalParado: parseFloat(row.capital_parado) || 0,
      faturamentoTotal: parseFloat(row.faturamento_total) || 0,
    },

    principalProblema: row.principal_problema || 'Perdas',

    calculadoEm: row.calculado_em || new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || getDefaultPeriodo();
    const tipoPeriodo = searchParams.get('tipo_periodo') || 'mensal';
    const nivel = searchParams.get('nivel');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeSummary = searchParams.get('summary') !== 'false';

    const cacheKey = `varejo:rfe:${periodo}:${tipoPeriodo}:${nivel || 'all'}:${limit}`;

    // Check cache
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        ...cached,
        _cache: { hit: true },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Query v_ranking_lojas_rfe view
    let query = supabaseAdmin
      .from('v_ranking_lojas_rfe')
      .select('*')
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo);

    if (nivel) {
      query = query.eq('rfe_nivel', nivel);
    }

    query = query.order('rfe_score', { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[RFE API] Erro na query:', error);
      throw error;
    }

    const items = (data || []).map(mapRfeItem);

    // Build summary
    let summary: RfeSummary | null = null;
    if (includeSummary && items.length > 0) {
      const totalRfe = items.reduce((sum, item) => sum + item.rfeScore, 0);
      const distribuicao = items.reduce(
        (acc, item) => {
          acc[item.rfeNivel]++;
          return acc;
        },
        { critico: 0, alto: 0, medio: 0, baixo: 0 } as Record<string, number>
      );

      summary = {
        totalRfe,
        mediaRfe: totalRfe / items.length,
        distribuicao: distribuicao as RfeSummary['distribuicao'],
        maiorRisco: items[0] || null,
        menorRisco: items[items.length - 1] || null,
      };
    }

    const response = {
      data: items,
      summary,
      periodo,
      tipoPeriodo,
    };

    // Cache result
    await CacheService.set(cacheKey, response, CACHE_TTL);

    return NextResponse.json({
      success: true,
      ...response,
      _cache: { hit: false },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[RFE API] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar análise de RFE',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

/**
 * POST: Recalcular RFE para uma loja específica
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lojaId, periodoInicio, periodoFim } = body;

    if (!lojaId || !periodoInicio || !periodoFim) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetros obrigatórios: lojaId, periodoInicio, periodoFim',
      }, { status: 400 });
    }

    // Call the calcular_rfe function
    const { data, error } = await supabaseAdmin.rpc('calcular_rfe', {
      p_organization_id: body.orgId || null,
      p_loja_id: lojaId,
      p_periodo_inicio: periodoInicio,
      p_periodo_fim: periodoFim,
    });

    if (error) {
      console.error('[RFE API] Erro ao calcular:', error);
      throw error;
    }

    // Invalidate cache
    await CacheService.invalidatePattern('varejo:rfe:*');

    return NextResponse.json({
      success: true,
      data: data?.[0] || data,
      message: 'RFE recalculado com sucesso',
    });

  } catch (error: any) {
    console.error('[RFE API] Erro POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao recalcular RFE',
      details: error.message,
    }, { status: 500 });
  }
}
