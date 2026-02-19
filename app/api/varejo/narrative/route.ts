/**
 * API: Narrative BI - Insights em Linguagem Natural
 *
 * Gera análises narrativas usando LLM (GPT-4o-mini):
 * - Resumo executivo
 * - Análise de tendências
 * - Alertas de riscos
 * - Oportunidades
 *
 * Endpoint: GET /api/varejo/narrative
 * Query params:
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - tipo: 'full' | 'resumo' | 'tendencia' | 'riscos' | 'oportunidades' | 'quick'
 *   - quick_tipo: 'resumo' | 'alerta' | 'oportunidade' (para tipo='quick')
 *   - refresh: 'true' para forçar regeneração
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateFullNarrativeReport,
  generateQuickInsight,
  FullNarrativeReport,
  NarrativeResult,
} from '@/lib/services/narrative-bi.service';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

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
    const tipo = searchParams.get('tipo') || 'full';
    const quickTipo = searchParams.get('quick_tipo') as 'resumo' | 'alerta' | 'oportunidade' | null;
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Verificar se OpenAI está configurada
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key não configurada',
          details: 'Configure OPENAI_API_KEY nas variáveis de ambiente',
        },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }

    // Quick insight (resposta rápida em texto)
    if (tipo === 'quick' && quickTipo) {
      const insight = await generateQuickInsight(quickTipo, {
        periodo,
        tipoPeriodo,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            tipo: quickTipo,
            insight,
            periodo,
          },
          _performance: { durationMs: Date.now() - startTime },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Gerar relatório completo
    console.log(`[Narrative API] Gerando narrativa para ${periodo} (${tipoPeriodo})`);
    const report = await generateFullNarrativeReport(periodo, tipoPeriodo, forceRefresh);

    // Filtrar por tipo específico se solicitado
    let responseData: FullNarrativeReport | NarrativeResult = report;

    if (tipo !== 'full') {
      switch (tipo) {
        case 'resumo':
          responseData = report.resumoExecutivo;
          break;
        case 'tendencia':
          responseData = report.analiseTendencias;
          break;
        case 'riscos':
          responseData = report.alertasRiscos;
          break;
        case 'oportunidades':
          responseData = report.oportunidades;
          break;
        default:
          responseData = report;
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        filtros: {
          periodo,
          tipoPeriodo,
          tipo,
        },
        _cache: { hit: !forceRefresh },
        _performance: { durationMs: Date.now() - startTime },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[Narrative API] Erro:', error);

    // Erro específico de OpenAI
    if (error.message?.includes('OpenAI')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro na integração com OpenAI',
          details: error.message,
        },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao gerar análise narrativa',
        details: error.message,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
