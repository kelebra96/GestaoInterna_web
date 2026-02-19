/**
 * API: Recomendações Inteligentes de Varejo
 *
 * Motor de recomendações baseado em análise de:
 * - RFE (Risk Financial Exposure)
 * - Padrões de perdas
 * - Rupturas frequentes
 * - Capital parado
 * - Oportunidades de melhoria
 *
 * Endpoint: GET /api/varejo/recomendacoes
 * Query params:
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - categoria: 'perda' | 'ruptura' | 'estoque' | 'rfe' | 'oportunidade' | 'processo'
 *   - prioridade: 'critica' | 'alta' | 'media' | 'baixa'
 *   - lojaId: filtrar por loja específica
 *   - limit: número máximo (default: 50)
 *   - refresh: 'true' para forçar regeneração
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheService } from '@/lib/services/cache.service';
import {
  generateAllRecommendations,
  generateRecommendationSummary,
  RetailRecommendation,
  RecommendationCategory,
  RecommendationPriority,
} from '@/lib/services/retail-recommendations.service';

const CACHE_TTL = 300; // 5 minutos

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
    const categoria = searchParams.get('categoria') as RecommendationCategory | null;
    const prioridade = searchParams.get('prioridade') as RecommendationPriority | null;
    const lojaId = searchParams.get('lojaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = `varejo:recomendacoes:${periodo}:${tipoPeriodo}`;

    // Check cache (se não for force refresh)
    let recommendations: RetailRecommendation[] | null = null;

    if (!forceRefresh) {
      recommendations = await CacheService.get<RetailRecommendation[]>(cacheKey);
    }

    // Gerar recomendações se não houver cache
    if (!recommendations) {
      console.log('[Recomendacoes API] Gerando recomendações...');
      recommendations = await generateAllRecommendations(periodo, tipoPeriodo);

      // Cache result
      await CacheService.set(cacheKey, recommendations, CACHE_TTL);
    }

    // Aplicar filtros
    let filtered = [...recommendations];

    if (categoria) {
      filtered = filtered.filter((r) => r.categoria === categoria);
    }

    if (prioridade) {
      filtered = filtered.filter((r) => r.prioridade === prioridade);
    }

    if (lojaId) {
      filtered = filtered.filter((r) => r.lojaId === lojaId);
    }

    // Aplicar limit
    const limited = filtered.slice(0, limit);

    // Gerar resumo
    const summary = generateRecommendationSummary(recommendations);

    // Estatísticas dos filtrados
    const filteredSummary = generateRecommendationSummary(filtered);

    return NextResponse.json(
      {
        success: true,
        data: {
          recomendacoes: limited,
          total: filtered.length,
          resumoGeral: summary,
          resumoFiltrado: filteredSummary,
        },
        filtros: {
          periodo,
          tipoPeriodo,
          categoria,
          prioridade,
          lojaId,
          limit,
        },
        _cache: { hit: !forceRefresh && recommendations !== null },
        _performance: { durationMs: Date.now() - startTime },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[Recomendacoes API] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao gerar recomendações',
        details: error.message,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * POST: Atualizar status de uma recomendação
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notas, feedback } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID da recomendação é obrigatório' },
        { status: 400 }
      );
    }

    // Em uma implementação real, salvaria no banco de dados
    // Por agora, apenas simula a atualização
    console.log(`[Recomendacoes API] Atualizando recomendação ${id}:`, { status, notas, feedback });

    // Invalidar cache para forçar regeneração na próxima consulta
    await CacheService.invalidatePattern('varejo:recomendacoes:*');

    return NextResponse.json({
      success: true,
      message: `Recomendação ${id} atualizada com sucesso`,
      data: {
        id,
        status,
        notas,
        feedback,
        atualizadoEm: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Recomendacoes API] Erro POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao atualizar recomendação',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
