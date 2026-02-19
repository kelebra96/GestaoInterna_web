/**
 * API: Tendência e Evolução de Métricas
 *
 * Análise de evolução temporal:
 * - Perdas por período (últimos 6 meses)
 * - Comparativo com período anterior
 * - Métricas diárias para gráficos
 *
 * Endpoint: GET /api/varejo/tendencia
 * Query params:
 *   - metrica: 'perdas' | 'rupturas' | 'vendas' | 'rfe'
 *   - agregacao: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 *   - meses: número de meses para trás (default: 6)
 *   - lojaId: filtrar por loja (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

const CACHE_TTL = 300;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

interface TendenciaItem {
  periodo: string;
  label: string;
  valor: number;
  valorFormatado: string;
  variacao?: number; // vs período anterior
  variacaoPct?: number;
}

interface TendenciaResponse {
  metrica: string;
  agregacao: string;
  dados: TendenciaItem[];
  resumo: {
    atual: number;
    anterior: number;
    variacaoPct: number;
    tendencia: 'subindo' | 'descendo' | 'estavel';
    mediaMovel: number;
    minimo: number;
    maximo: number;
  };
  decomposicao?: {
    // Para perdas
    vencimento: TendenciaItem[];
    avaria: TendenciaItem[];
    roubo: TendenciaItem[];
    outros: TendenciaItem[];
  };
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarLabel(data: string, agregacao: string): string {
  const date = new Date(data);
  switch (agregacao) {
    case 'diario':
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    case 'semanal':
      return `Sem ${Math.ceil(date.getDate() / 7)} - ${date.toLocaleDateString('pt-BR', { month: 'short' })}`;
    case 'mensal':
    default:
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const metrica = searchParams.get('metrica') || 'perdas';
    const agregacao = searchParams.get('agregacao') || 'mensal';
    const meses = parseInt(searchParams.get('meses') || '6');
    const lojaId = searchParams.get('lojaId');

    const cacheKey = `varejo:tendencia:${metrica}:${agregacao}:${meses}:${lojaId || 'all'}`;

    // Check cache
    const cached = await CacheService.get<TendenciaResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        _cache: { hit: true },
        _performance: { durationMs: Date.now() - startTime },
      }, { headers: NO_CACHE_HEADERS });
    }

    let response: TendenciaResponse;

    if (metrica === 'perdas') {
      response = await getTendenciaPerdas(agregacao, meses, lojaId);
    } else if (metrica === 'diario') {
      response = await getMetricasDiarias(meses);
    } else {
      // Generic metrics from agg_metricas_loja
      response = await getTendenciaGenerica(metrica, agregacao, meses, lojaId);
    }

    // Cache result
    await CacheService.set(cacheKey, response, CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: response,
      _cache: { hit: false },
      _performance: { durationMs: Date.now() - startTime },
    }, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('[Tendencia API] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar tendência',
      details: error.message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

async function getTendenciaPerdas(
  agregacao: string,
  meses: number,
  lojaId: string | null
): Promise<TendenciaResponse> {
  // Query v_tendencia_perdas view
  let query = supabaseAdmin
    .from('v_tendencia_perdas')
    .select('*')
    .order('mes', { ascending: true })
    .limit(meses);

  if (lojaId) {
    query = query.eq('loja_id', lojaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Tendencia API] Erro v_tendencia_perdas:', error);
    throw error;
  }

  // Aggregate by loja if needed
  const aggregatedData = lojaId
    ? data || []
    : aggregateByPeriod(data || []);

  const dados: TendenciaItem[] = aggregatedData.map((row: any, index: number, arr: any[]) => {
    const valor = parseFloat(row.perda_total) || 0;
    const anterior = index > 0 ? parseFloat(arr[index - 1].perda_total) || 0 : valor;

    return {
      periodo: row.mes,
      label: formatarLabel(row.mes, agregacao),
      valor,
      valorFormatado: formatarMoeda(valor),
      variacao: valor - anterior,
      variacaoPct: anterior > 0 ? ((valor - anterior) / anterior) * 100 : 0,
    };
  });

  // Decomposition by type
  const decomposicao = {
    vencimento: aggregatedData.map((row: any) => ({
      periodo: row.mes,
      label: formatarLabel(row.mes, agregacao),
      valor: parseFloat(row.perda_vencimento) || 0,
      valorFormatado: formatarMoeda(parseFloat(row.perda_vencimento) || 0),
    })),
    avaria: aggregatedData.map((row: any) => ({
      periodo: row.mes,
      label: formatarLabel(row.mes, agregacao),
      valor: parseFloat(row.perda_avaria) || 0,
      valorFormatado: formatarMoeda(parseFloat(row.perda_avaria) || 0),
    })),
    roubo: aggregatedData.map((row: any) => ({
      periodo: row.mes,
      label: formatarLabel(row.mes, agregacao),
      valor: parseFloat(row.perda_roubo) || 0,
      valorFormatado: formatarMoeda(parseFloat(row.perda_roubo) || 0),
    })),
    outros: aggregatedData.map((row: any) => ({
      periodo: row.mes,
      label: formatarLabel(row.mes, agregacao),
      valor: parseFloat(row.perda_outros) || 0,
      valorFormatado: formatarMoeda(parseFloat(row.perda_outros) || 0),
    })),
  };

  return {
    metrica: 'perdas',
    agregacao,
    dados,
    resumo: buildResumo(dados),
    decomposicao,
  };
}

async function getMetricasDiarias(meses: number): Promise<TendenciaResponse> {
  const { data, error } = await supabaseAdmin
    .from('mv_metricas_diarias')
    .select('*')
    .order('data', { ascending: true })
    .limit(meses * 30);

  if (error) {
    console.error('[Tendencia API] Erro mv_metricas_diarias:', error);
    throw error;
  }

  const dados: TendenciaItem[] = (data || []).map((row: any, index: number, arr: any[]) => {
    const valor = parseFloat(row.perda_total) || 0;
    const anterior = index > 0 ? parseFloat(arr[index - 1].perda_total) || 0 : valor;

    return {
      periodo: row.data,
      label: formatarLabel(row.data, 'diario'),
      valor,
      valorFormatado: formatarMoeda(valor),
      variacao: valor - anterior,
      variacaoPct: anterior > 0 ? ((valor - anterior) / anterior) * 100 : 0,
    };
  });

  return {
    metrica: 'diario',
    agregacao: 'diario',
    dados,
    resumo: buildResumo(dados),
  };
}

async function getTendenciaGenerica(
  metrica: string,
  agregacao: string,
  meses: number,
  lojaId: string | null
): Promise<TendenciaResponse> {
  const campoMap: Record<string, string> = {
    rupturas: 'vendas_perdidas_valor',
    vendas: 'faturamento_total',
    rfe: 'rfe_score',
    margem: 'margem_bruta_valor',
  };

  const campo = campoMap[metrica] || 'perda_valor_total';

  let query = supabaseAdmin
    .from('agg_metricas_loja')
    .select(`periodo, ${campo}`)
    .eq('tipo_periodo', 'mensal')
    .order('periodo', { ascending: true })
    .limit(meses);

  if (lojaId) {
    query = query.eq('loja_id', lojaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Tendencia API] Erro agg_metricas_loja:', error);
    throw error;
  }

  // Aggregate
  const aggregated = lojaId ? data : aggregateByField(data || [], 'periodo', campo);

  const dados: TendenciaItem[] = aggregated.map((row: any, index: number, arr: any[]) => {
    const valor = parseFloat(row[campo]) || 0;
    const anterior = index > 0 ? parseFloat(arr[index - 1][campo]) || 0 : valor;

    return {
      periodo: row.periodo,
      label: formatarLabel(row.periodo, agregacao),
      valor,
      valorFormatado: formatarMoeda(valor),
      variacao: valor - anterior,
      variacaoPct: anterior > 0 ? ((valor - anterior) / anterior) * 100 : 0,
    };
  });

  return {
    metrica,
    agregacao,
    dados,
    resumo: buildResumo(dados),
  };
}

function aggregateByPeriod(data: any[]): any[] {
  const grouped = new Map<string, any>();

  data.forEach(row => {
    const key = row.mes;
    const existing = grouped.get(key) || {
      mes: key,
      perda_total: 0,
      perda_vencimento: 0,
      perda_avaria: 0,
      perda_roubo: 0,
      perda_outros: 0,
    };

    existing.perda_total += parseFloat(row.perda_total) || 0;
    existing.perda_vencimento += parseFloat(row.perda_vencimento) || 0;
    existing.perda_avaria += parseFloat(row.perda_avaria) || 0;
    existing.perda_roubo += parseFloat(row.perda_roubo) || 0;
    existing.perda_outros += parseFloat(row.perda_outros) || 0;

    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}

function aggregateByField(data: any[], groupField: string, valueField: string): any[] {
  const grouped = new Map<string, number>();

  data.forEach(row => {
    const key = row[groupField];
    const current = grouped.get(key) || 0;
    grouped.set(key, current + (parseFloat(row[valueField]) || 0));
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => ({ [groupField]: key, [valueField]: value }))
    .sort((a, b) => String(a[groupField]).localeCompare(String(b[groupField])));
}

function buildResumo(dados: TendenciaItem[]): TendenciaResponse['resumo'] {
  if (dados.length === 0) {
    return {
      atual: 0,
      anterior: 0,
      variacaoPct: 0,
      tendencia: 'estavel',
      mediaMovel: 0,
      minimo: 0,
      maximo: 0,
    };
  }

  const valores = dados.map(d => d.valor);
  const atual = valores[valores.length - 1] || 0;
  const anterior = valores[valores.length - 2] || atual;
  const variacaoPct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;

  // Media móvel dos últimos 3 períodos
  const ultimos3 = valores.slice(-3);
  const mediaMovel = ultimos3.reduce((a, b) => a + b, 0) / ultimos3.length;

  // Tendência baseada nos últimos 3 períodos
  let tendencia: 'subindo' | 'descendo' | 'estavel' = 'estavel';
  if (ultimos3.length >= 3) {
    const diff1 = ultimos3[1] - ultimos3[0];
    const diff2 = ultimos3[2] - ultimos3[1];
    if (diff1 > 0 && diff2 > 0) tendencia = 'subindo';
    else if (diff1 < 0 && diff2 < 0) tendencia = 'descendo';
  }

  return {
    atual,
    anterior,
    variacaoPct: Math.round(variacaoPct * 100) / 100,
    tendencia,
    mediaMovel: Math.round(mediaMovel * 100) / 100,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
  };
}
