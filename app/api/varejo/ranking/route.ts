/**
 * API: Ranking de Lojas
 *
 * Rankings de performance por diferentes métricas:
 * - RFE (Risk Financial Exposure) - maior risco
 * - Perdas - maiores perdedores
 * - Rupturas - maior impacto em vendas
 * - Faturamento - maiores e menores
 * - Margem - melhores e piores
 *
 * Endpoint: GET /api/varejo/ranking
 * Query params:
 *   - metrica: 'rfe' | 'perdas' | 'rupturas' | 'faturamento' | 'margem' | 'giro'
 *   - ordem: 'desc' | 'asc' (default: 'desc' para maiores primeiro)
 *   - periodo: YYYY-MM-DD
 *   - tipo_periodo: 'diario' | 'semanal' | 'mensal'
 *   - limit: número de lojas (default: 10)
 *   - cluster: filtrar por cluster de loja
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 120;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

interface RankingItem {
  posicao: number;
  lojaId: string;
  lojaNome: string;
  lojaCodigo: string;
  lojaCluster?: string;
  valor: number;
  valorFormatado: string;
  indicador: string;
  variacao?: number; // vs período anterior
  meta?: number;
  status: 'bom' | 'alerta' | 'critico' | 'neutro';
}

interface RankingResponse {
  metrica: string;
  titulo: string;
  descricao: string;
  periodo: string;
  items: RankingItem[];
  totais: {
    soma: number;
    media: number;
    mediana: number;
  };
}

const METRICAS_CONFIG: Record<string, {
  titulo: string;
  descricao: string;
  campo: string;
  indicador: string;
  formato: 'moeda' | 'percentual' | 'numero';
  metaMaiorMelhor: boolean;
}> = {
  rfe: {
    titulo: 'Ranking RFE',
    descricao: 'Lojas com maior Risk Financial Exposure',
    campo: 'rfe_score',
    indicador: 'RFE',
    formato: 'moeda',
    metaMaiorMelhor: false,
  },
  perdas: {
    titulo: 'Ranking de Perdas',
    descricao: 'Lojas com maior valor de perdas',
    campo: 'perda_valor_total',
    indicador: 'Perdas',
    formato: 'moeda',
    metaMaiorMelhor: false,
  },
  perdas_pct: {
    titulo: 'Ranking de Perdas %',
    descricao: 'Lojas com maior % de perda sobre faturamento',
    campo: 'perda_sobre_faturamento_pct',
    indicador: '% Perda',
    formato: 'percentual',
    metaMaiorMelhor: false,
  },
  rupturas: {
    titulo: 'Ranking de Rupturas',
    descricao: 'Lojas com maior valor de vendas perdidas',
    campo: 'vendas_perdidas_valor',
    indicador: 'Vendas Perdidas',
    formato: 'moeda',
    metaMaiorMelhor: false,
  },
  faturamento: {
    titulo: 'Ranking de Faturamento',
    descricao: 'Lojas por faturamento',
    campo: 'faturamento_total',
    indicador: 'Faturamento',
    formato: 'moeda',
    metaMaiorMelhor: true,
  },
  margem: {
    titulo: 'Ranking de Margem',
    descricao: 'Lojas por margem bruta',
    campo: 'margem_bruta_pct',
    indicador: 'Margem %',
    formato: 'percentual',
    metaMaiorMelhor: true,
  },
  giro: {
    titulo: 'Ranking de Giro',
    descricao: 'Lojas por giro de estoque',
    campo: 'giro_estoque',
    indicador: 'Giro',
    formato: 'numero',
    metaMaiorMelhor: true,
  },
  disponibilidade: {
    titulo: 'Ranking de Disponibilidade',
    descricao: 'Lojas por taxa de disponibilidade',
    campo: 'taxa_disponibilidade',
    indicador: 'Disponibilidade',
    formato: 'percentual',
    metaMaiorMelhor: true,
  },
};

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatarValor(valor: number, formato: 'moeda' | 'percentual' | 'numero'): string {
  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);
    case 'percentual':
      return `${valor.toFixed(2)}%`;
    case 'numero':
      return valor.toFixed(2);
    default:
      return String(valor);
  }
}

function determinarStatus(
  valor: number,
  config: typeof METRICAS_CONFIG[string],
  mediana: number
): 'bom' | 'alerta' | 'critico' | 'neutro' {
  if (config.metaMaiorMelhor) {
    if (valor >= mediana * 1.2) return 'bom';
    if (valor >= mediana * 0.8) return 'neutro';
    if (valor >= mediana * 0.5) return 'alerta';
    return 'critico';
  } else {
    if (valor <= mediana * 0.5) return 'bom';
    if (valor <= mediana) return 'neutro';
    if (valor <= mediana * 1.5) return 'alerta';
    return 'critico';
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const metrica = searchParams.get('metrica') || 'rfe';
    const ordem = searchParams.get('ordem') || 'desc';
    const periodo = searchParams.get('periodo') || getDefaultPeriodo();
    const tipoPeriodo = searchParams.get('tipo_periodo') || 'mensal';
    const limit = parseInt(searchParams.get('limit') || '10');
    const cluster = searchParams.get('cluster');

    const config = METRICAS_CONFIG[metrica];
    if (!config) {
      return NextResponse.json({
        success: false,
        error: `Métrica inválida: ${metrica}. Válidas: ${Object.keys(METRICAS_CONFIG).join(', ')}`,
      }, { status: 400 });
    }

    const cacheKey = `varejo:ranking:${metrica}:${periodo}:${tipoPeriodo}:${ordem}:${limit}:${cluster || 'all'}`;

    // Check cache
    const cached = await CacheService.get<RankingResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        _cache: { hit: true },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Build query
    let query = supabaseAdmin
      .from('agg_metricas_loja')
      .select(`
        *,
        loja:dim_loja(id, nome, codigo, cluster)
      `)
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo);

    // Filter by cluster if specified
    if (cluster) {
      query = query.eq('loja.cluster', cluster);
    }

    // Order by the metric
    query = query.order(config.campo, { ascending: ordem === 'asc' });

    // Get all for statistics, but limit for response
    const { data: allData, error: allError } = await query;

    if (allError) {
      console.error('[Ranking API] Erro na query:', allError);
      throw allError;
    }

    if (!allData || allData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          metrica,
          titulo: config.titulo,
          descricao: config.descricao,
          periodo,
          items: [],
          totais: { soma: 0, media: 0, mediana: 0 },
        },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    // Calculate statistics
    const valores = allData.map((row: any) => parseFloat(row[config.campo]) || 0);
    const soma = valores.reduce((a: number, b: number) => a + b, 0);
    const media = soma / valores.length;
    const sortedValores = [...valores].sort((a, b) => a - b);
    const mediana = sortedValores[Math.floor(sortedValores.length / 2)];

    // Map to response format
    const items: RankingItem[] = allData.slice(0, limit).map((row: any, index: number) => {
      const valor = parseFloat(row[config.campo]) || 0;
      return {
        posicao: index + 1,
        lojaId: row.loja_id,
        lojaNome: row.loja?.nome || `Loja ${row.loja_id.slice(0, 8)}`,
        lojaCodigo: row.loja?.codigo || '',
        lojaCluster: row.loja?.cluster,
        valor,
        valorFormatado: formatarValor(valor, config.formato),
        indicador: config.indicador,
        status: determinarStatus(valor, config, mediana),
      };
    });

    const response: RankingResponse = {
      metrica,
      titulo: config.titulo,
      descricao: config.descricao,
      periodo,
      items,
      totais: {
        soma: Math.round(soma * 100) / 100,
        media: Math.round(media * 100) / 100,
        mediana: Math.round(mediana * 100) / 100,
      },
    };

    // Cache result
    await CacheService.set(cacheKey, response, CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: response,
      _cache: { hit: false },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[Ranking API] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar ranking',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
