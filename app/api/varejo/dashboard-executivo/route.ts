/**
 * API: Dashboard Executivo de Varejo
 *
 * Retorna KPIs consolidados da rede:
 * - Faturamento, Margem, Perdas
 * - RFE (Risk Financial Exposure)
 * - Distribuição de risco por lojas
 * - Comparativo com período anterior
 *
 * Endpoint: GET /api/varejo/dashboard-executivo
 * Query params:
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - refresh: 'true' para forçar recálculo
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 120; // 2 minutos

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

interface DashboardExecutivo {
  periodo: string;
  tipoPeriodo: string;
  kpis: {
    faturamentoTotal: number;
    margemBrutaMedia: number;
    perdaValorTotal: number;
    perdaSobreFaturamentoPct: number;
    vendasPerdidasTotal: number;
    taxaDisponibilidadeMedia: number;
    rfeTotal: number;
  };
  composicaoPerdas: {
    vencimento: number;
    avaria: number;
    roubo: number;
    outros: number;
  };
  estoque: {
    valorTotal: number;
    giroMedio: number;
    capitalParado: number;
    estoqueMorto: number;
  };
  distribuicaoRisco: {
    critico: number;
    alto: number;
    medio: number;
    baixo: number;
    totalLojas: number;
  };
  percentis: {
    perdaP50: number;
    perdaP90: number;
    rfeP50: number;
    rfeP90: number;
  };
  calculadoEm: string;
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || getDefaultPeriodo();
    const tipoPeriodo = searchParams.get('tipo_periodo') || 'mensal';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const orgId = searchParams.get('orgId') || 'default';

    const cacheKey = `varejo:dashboard:${orgId}:${periodo}:${tipoPeriodo}`;

    // Check cache
    if (!forceRefresh) {
      const cached = await CacheService.get<DashboardExecutivo>(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          _cache: { hit: true, age: 0 },
          _performance: { durationMs: Date.now() - startTime },
        }, { headers: NO_CACHE_HEADERS });
      }
    }

    // Tentar ler da view v_dashboard_executivo, se não existir, ler direto da tabela agg_metricas_rede
    let data: any = null;
    let error: any = null;

    // Primeiro, tentar a view
    const viewResult = await supabaseAdmin
      .from('v_dashboard_executivo')
      .select('*')
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo)
      .maybeSingle();

    if (!viewResult.error) {
      data = viewResult.data;
    } else {
      console.log('[Dashboard Executivo] View não disponível, tentando tabela direta...');

      // Fallback: tentar a tabela agg_metricas_rede diretamente
      const tableResult = await supabaseAdmin
        .from('agg_metricas_rede')
        .select('*')
        .eq('periodo', periodo)
        .eq('tipo_periodo', tipoPeriodo)
        .maybeSingle();

      if (!tableResult.error) {
        data = tableResult.data;
      } else {
        console.log('[Dashboard Executivo] Tabela agg_metricas_rede não disponível');
        // Não é um erro crítico, apenas não há dados consolidados
      }
    }

    // Se não houver dados para o período, retorna valores zerados
    if (!data) {
      const emptyResponse: DashboardExecutivo = {
        periodo,
        tipoPeriodo,
        kpis: {
          faturamentoTotal: 0,
          margemBrutaMedia: 0,
          perdaValorTotal: 0,
          perdaSobreFaturamentoPct: 0,
          vendasPerdidasTotal: 0,
          taxaDisponibilidadeMedia: 0,
          rfeTotal: 0,
        },
        composicaoPerdas: { vencimento: 0, avaria: 0, roubo: 0, outros: 0 },
        estoque: { valorTotal: 0, giroMedio: 0, capitalParado: 0, estoqueMorto: 0 },
        distribuicaoRisco: { critico: 0, alto: 0, medio: 0, baixo: 0, totalLojas: 0 },
        percentis: { perdaP50: 0, perdaP90: 0, rfeP50: 0, rfeP90: 0 },
        calculadoEm: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        data: emptyResponse,
        _cache: { hit: false },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Map database response to API format
    const dashboard: DashboardExecutivo = {
      periodo: data.periodo,
      tipoPeriodo: data.tipo_periodo,
      kpis: {
        faturamentoTotal: parseFloat(data.faturamento_total) || 0,
        margemBrutaMedia: parseFloat(data.margem_bruta_media) || 0,
        perdaValorTotal: parseFloat(data.perda_valor_total) || 0,
        perdaSobreFaturamentoPct: parseFloat(data.perda_sobre_faturamento_pct) || 0,
        vendasPerdidasTotal: parseFloat(data.vendas_perdidas_total) || 0,
        taxaDisponibilidadeMedia: parseFloat(data.taxa_disponibilidade_media) || 0,
        rfeTotal: parseFloat(data.rfe_total) || 0,
      },
      composicaoPerdas: {
        vencimento: parseFloat(data.perda_vencimento_total) || 0,
        avaria: parseFloat(data.perda_avaria_total) || 0,
        roubo: parseFloat(data.perda_roubo_total) || 0,
        outros: parseFloat(data.perda_outros_total) || 0,
      },
      estoque: {
        valorTotal: parseFloat(data.valor_estoque_total) || 0,
        giroMedio: parseFloat(data.giro_estoque_medio) || 0,
        capitalParado: parseFloat(data.capital_parado_total) || 0,
        estoqueMorto: parseFloat(data.estoque_morto_total) || 0,
      },
      distribuicaoRisco: {
        critico: parseInt(data.lojas_risco_critico) || 0,
        alto: parseInt(data.lojas_risco_alto) || 0,
        medio: parseInt(data.lojas_risco_medio) || 0,
        baixo: parseInt(data.lojas_risco_baixo) || 0,
        totalLojas: parseInt(data.qtd_lojas_ativas) || 0,
      },
      percentis: {
        perdaP50: parseFloat(data.percentil_perda_p50) || 0,
        perdaP90: parseFloat(data.percentil_perda_p90) || 0,
        rfeP50: parseFloat(data.percentil_rfe_p50) || 0,
        rfeP90: parseFloat(data.percentil_rfe_p90) || 0,
      },
      calculadoEm: data.calculado_em || new Date().toISOString(),
    };

    // Cache result
    await CacheService.set(cacheKey, dashboard, CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: dashboard,
      _cache: { hit: false },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[Dashboard Executivo] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar dashboard executivo',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
