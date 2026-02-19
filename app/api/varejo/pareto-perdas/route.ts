/**
 * API: Análise de Pareto de Perdas
 *
 * Análise 80/20 dos produtos que mais geram perdas:
 * - Top produtos por valor de perda
 * - Classificação ABC
 * - Participação acumulada
 * - Por categoria e comprador
 *
 * Endpoint: GET /api/varejo/pareto-perdas
 * Query params:
 *   - limit: número de produtos (default: 50)
 *   - curva: 'A' | 'B' | 'C' (filtra por curva ABC)
 *   - categoria: filtrar por categoria
 *   - comprador: filtrar por comprador
 *   - lojaId: filtrar por loja
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 300; // 5 minutos (view materializada)

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

interface ParetoItem {
  ranking: number;
  produtoId: string;
  codigo: string;
  nome: string;
  categoria: string;
  comprador?: string;

  perdaTotal: number;
  perdaTotalFormatada: string;

  participacaoPct: number;
  participacaoAcumuladaPct: number;
  curvaAbc: 'A' | 'B' | 'C';

  // Indicadores visuais
  barWidth: number; // 0-100 para gráfico de barras
  isTop20: boolean;
}

interface ParetoSummary {
  totalPerdas: number;
  totalProdutos: number;
  curvaA: {
    produtos: number;
    valor: number;
    participacaoPct: number;
  };
  curvaB: {
    produtos: number;
    valor: number;
    participacaoPct: number;
  };
  curvaC: {
    produtos: number;
    valor: number;
    participacaoPct: number;
  };
  top5Categorias: Array<{ categoria: string; valor: number; pct: number }>;
  top5Compradores: Array<{ comprador: string; valor: number; pct: number }>;
}

interface ParetoResponse {
  items: ParetoItem[];
  summary: ParetoSummary;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const curva = searchParams.get('curva');
    const categoria = searchParams.get('categoria');
    const comprador = searchParams.get('comprador');
    const lojaId = searchParams.get('lojaId');

    const cacheKey = `varejo:pareto:${limit}:${curva || 'all'}:${categoria || 'all'}:${comprador || 'all'}:${lojaId || 'all'}`;

    // Check cache
    const cached = await CacheService.get<ParetoResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        _cache: { hit: true },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Query mv_pareto_perdas materialized view
    let query = supabaseAdmin
      .from('mv_pareto_perdas')
      .select('*');

    // Apply filters
    if (curva) {
      query = query.eq('curva_abc', curva.toUpperCase());
    }
    if (categoria) {
      query = query.ilike('categoria', `%${categoria}%`);
    }
    if (comprador) {
      query = query.ilike('fornecedor', `%${comprador}%`);
    }

    // Order by ranking
    query = query.order('ranking', { ascending: true }).limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[Pareto API] Erro na query mv_pareto_perdas:', error);

      // Fallback: query v_top_produtos_perda if materialized view doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('v_top_produtos_perda')
        .select('*')
        .order('perda_total', { ascending: false })
        .limit(limit);

      if (fallbackError) {
        throw fallbackError;
      }

      // Transform fallback data
      const totalPerdas = fallbackData?.reduce((sum: number, row: any) =>
        sum + (parseFloat(row.perda_total) || 0), 0) || 0;

      let acumulado = 0;
      const items: ParetoItem[] = (fallbackData || []).map((row: any, index: number) => {
        const perdaTotal = parseFloat(row.perda_total) || 0;
        const participacaoPct = totalPerdas > 0 ? (perdaTotal / totalPerdas) * 100 : 0;
        acumulado += participacaoPct;

        let curvaAbc: 'A' | 'B' | 'C' = 'C';
        if (acumulado <= 80) curvaAbc = 'A';
        else if (acumulado <= 95) curvaAbc = 'B';

        return {
          ranking: index + 1,
          produtoId: row.produto_id,
          codigo: row.codigo || '',
          nome: row.nome || 'Produto sem nome',
          categoria: row.categoria || 'Sem categoria',
          comprador: row.fornecedor,
          perdaTotal,
          perdaTotalFormatada: formatarMoeda(perdaTotal),
          participacaoPct: Math.round(participacaoPct * 100) / 100,
          participacaoAcumuladaPct: Math.round(acumulado * 100) / 100,
          curvaAbc,
          barWidth: Math.min(100, (perdaTotal / (fallbackData?.[0]?.perda_total || 1)) * 100),
          isTop20: index < 20,
        };
      });

      return NextResponse.json({
        success: true,
        data: { items, summary: buildSummary(items, totalPerdas) },
        _cache: { hit: false },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Calculate total for summary
    const totalPerdas = data?.reduce((sum: number, row: any) =>
      sum + (parseFloat(row.perda_total) || 0), 0) || 0;

    const maxPerda = data?.[0]?.perda_total || 1;

    // Map items
    const items: ParetoItem[] = (data || []).map((row: any) => ({
      ranking: parseInt(row.ranking) || 0,
      produtoId: row.produto_id,
      codigo: row.codigo || '',
      nome: row.nome || 'Produto sem nome',
      categoria: row.categoria || 'Sem categoria',
      comprador: row.fornecedor,
      perdaTotal: parseFloat(row.perda_total) || 0,
      perdaTotalFormatada: formatarMoeda(parseFloat(row.perda_total) || 0),
      participacaoPct: parseFloat(row.participacao_pct) || 0,
      participacaoAcumuladaPct: parseFloat(row.participacao_acumulada_pct) || 0,
      curvaAbc: row.curva_abc || 'C',
      barWidth: Math.min(100, ((parseFloat(row.perda_total) || 0) / maxPerda) * 100),
      isTop20: (parseInt(row.ranking) || 0) <= 20,
    }));

    // Build summary
    const summary = buildSummary(items, totalPerdas);

    const response: ParetoResponse = { items, summary };

    // Cache result
    await CacheService.set(cacheKey, response, CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: response,
      _cache: { hit: false },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[Pareto API] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar análise de Pareto',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

function buildSummary(items: ParetoItem[], totalPerdas: number): ParetoSummary {
  const curvaA = items.filter(i => i.curvaAbc === 'A');
  const curvaB = items.filter(i => i.curvaAbc === 'B');
  const curvaC = items.filter(i => i.curvaAbc === 'C');

  const valorA = curvaA.reduce((sum, i) => sum + i.perdaTotal, 0);
  const valorB = curvaB.reduce((sum, i) => sum + i.perdaTotal, 0);
  const valorC = curvaC.reduce((sum, i) => sum + i.perdaTotal, 0);

  // Top 5 categorias
  const categoriaMap = new Map<string, number>();
  items.forEach(item => {
    const current = categoriaMap.get(item.categoria) || 0;
    categoriaMap.set(item.categoria, current + item.perdaTotal);
  });
  const top5Categorias = Array.from(categoriaMap.entries())
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      pct: totalPerdas > 0 ? (valor / totalPerdas) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  // Top 5 compradores
  const compradorMap = new Map<string, number>();
  items.forEach(item => {
    if (item.comprador) {
      const current = compradorMap.get(item.comprador) || 0;
      compradorMap.set(item.comprador, current + item.perdaTotal);
    }
  });
  const top5Compradores = Array.from(compradorMap.entries())
    .map(([comprador, valor]) => ({
      comprador,
      valor,
      pct: totalPerdas > 0 ? (valor / totalPerdas) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  return {
    totalPerdas,
    totalProdutos: items.length,
    curvaA: {
      produtos: curvaA.length,
      valor: valorA,
      participacaoPct: totalPerdas > 0 ? (valorA / totalPerdas) * 100 : 0,
    },
    curvaB: {
      produtos: curvaB.length,
      valor: valorB,
      participacaoPct: totalPerdas > 0 ? (valorB / totalPerdas) * 100 : 0,
    },
    curvaC: {
      produtos: curvaC.length,
      valor: valorC,
      participacaoPct: totalPerdas > 0 ? (valorC / totalPerdas) * 100 : 0,
    },
    top5Categorias,
    top5Compradores,
  };
}

/**
 * POST: Refresh materialized view
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await supabaseAdmin.rpc('refresh_retail_materialized_views');

    if (error) {
      console.error('[Pareto API] Erro ao atualizar views:', error);
      throw error;
    }

    // Invalidate cache
    await CacheService.invalidatePattern('varejo:pareto:*');

    return NextResponse.json({
      success: true,
      message: 'Views materializadas atualizadas com sucesso',
    });

  } catch (error: any) {
    console.error('[Pareto API] Erro POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao atualizar views materializadas',
      details: error.message,
    }, { status: 500 });
  }
}
