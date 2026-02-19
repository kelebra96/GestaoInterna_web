/**
 * Narrative BI Service
 *
 * Gera análises e insights em linguagem natural usando LLM:
 * - Resumos executivos automáticos
 * - Análise de tendências
 * - Alertas contextualizados
 * - Recomendações narrativas
 *
 * Integração com OpenAI GPT-4
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

// ============================================
// TYPES
// ============================================

export type NarrativeType =
  | 'resumo_executivo'
  | 'analise_tendencia'
  | 'alerta_risco'
  | 'oportunidade'
  | 'comparativo';

export interface NarrativeContext {
  periodo: string;
  tipoPeriodo: string;
  kpis?: {
    faturamento: number;
    margem: number;
    perdas: number;
    perdasPct: number;
    vendasPerdidas: number;
    disponibilidade: number;
    rfe: number;
  };
  distribuicaoRisco?: {
    critico: number;
    alto: number;
    medio: number;
    baixo: number;
    total: number;
  };
  composicaoPerdas?: {
    vencimento: number;
    avaria: number;
    roubo: number;
    outros: number;
  };
  tendencias?: {
    perdas: 'subindo' | 'estavel' | 'descendo';
    faturamento: 'subindo' | 'estavel' | 'descendo';
    rfe: 'subindo' | 'estavel' | 'descendo';
  };
  topProblemas?: Array<{
    tipo: string;
    entidade: string;
    valor: number;
  }>;
}

export interface NarrativeResult {
  tipo: NarrativeType;
  titulo: string;
  conteudo: string;
  highlights: string[];
  alertas: string[];
  acoes: string[];
  geradoEm: string;
  modelo: string;
}

export interface FullNarrativeReport {
  resumoExecutivo: NarrativeResult;
  analiseTendencias: NarrativeResult;
  alertasRiscos: NarrativeResult;
  oportunidades: NarrativeResult;
  geradoEm: string;
  contexto: NarrativeContext;
}

// ============================================
// OPENAI INTEGRATION
// ============================================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const { maxTokens = 1000, temperature = 0.7 } = options;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[NarrativeBI] OpenAI error:', errorText);
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenAIJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const content = await callOpenAI(
    systemPrompt + '\n\nIMPORTANTE: Responda APENAS com JSON válido, sem texto adicional.',
    userPrompt,
    { ...options, temperature: 0.3 }
  );

  // Tentar extrair JSON do conteúdo
  try {
    // Remover possíveis backticks de markdown
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent) as T;
  } catch (error) {
    console.error('[NarrativeBI] JSON parse error:', content);
    throw new Error('Falha ao parsear resposta do LLM');
  }
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchDashboardData(periodo: string, tipoPeriodo: string): Promise<NarrativeContext> {
  // Buscar dados do dashboard executivo
  const { data: dashboard } = await supabaseAdmin
    .from('v_dashboard_executivo')
    .select('*')
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .maybeSingle();

  // Buscar top problemas (lojas com maior RFE)
  const { data: topRfe } = await supabaseAdmin
    .from('v_ranking_lojas_rfe')
    .select('loja_nome, rfe_score, principal_problema')
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .order('rfe_score', { ascending: false })
    .limit(5);

  // Buscar tendência de perdas
  const { data: tendenciaPerdas } = await supabaseAdmin
    .from('v_tendencia_perdas')
    .select('mes, perda_total')
    .order('mes', { ascending: false })
    .limit(3);

  // Calcular tendência
  let tendenciaPerdaStr: 'subindo' | 'estavel' | 'descendo' = 'estavel';
  if (tendenciaPerdas && tendenciaPerdas.length >= 2) {
    const atual = parseFloat(tendenciaPerdas[0]?.perda_total) || 0;
    const anterior = parseFloat(tendenciaPerdas[1]?.perda_total) || 0;
    if (atual > anterior * 1.1) tendenciaPerdaStr = 'subindo';
    else if (atual < anterior * 0.9) tendenciaPerdaStr = 'descendo';
  }

  const context: NarrativeContext = {
    periodo,
    tipoPeriodo,
    kpis: dashboard
      ? {
          faturamento: parseFloat(dashboard.faturamento_total) || 0,
          margem: parseFloat(dashboard.margem_bruta_media) || 0,
          perdas: parseFloat(dashboard.perda_valor_total) || 0,
          perdasPct: parseFloat(dashboard.perda_sobre_faturamento_pct) || 0,
          vendasPerdidas: parseFloat(dashboard.vendas_perdidas_total) || 0,
          disponibilidade: parseFloat(dashboard.taxa_disponibilidade_media) || 0,
          rfe: parseFloat(dashboard.rfe_total) || 0,
        }
      : undefined,
    distribuicaoRisco: dashboard
      ? {
          critico: parseInt(dashboard.lojas_risco_critico) || 0,
          alto: parseInt(dashboard.lojas_risco_alto) || 0,
          medio: parseInt(dashboard.lojas_risco_medio) || 0,
          baixo: parseInt(dashboard.lojas_risco_baixo) || 0,
          total: parseInt(dashboard.qtd_lojas_ativas) || 0,
        }
      : undefined,
    composicaoPerdas: dashboard
      ? {
          vencimento: parseFloat(dashboard.perda_vencimento_total) || 0,
          avaria: parseFloat(dashboard.perda_avaria_total) || 0,
          roubo: parseFloat(dashboard.perda_roubo_total) || 0,
          outros: parseFloat(dashboard.perda_outros_total) || 0,
        }
      : undefined,
    tendencias: {
      perdas: tendenciaPerdaStr,
      faturamento: 'estavel',
      rfe: 'estavel',
    },
    topProblemas: topRfe?.map((l: any) => ({
      tipo: l.principal_problema || 'RFE',
      entidade: l.loja_nome,
      valor: parseFloat(l.rfe_score) || 0,
    })),
  };

  return context;
}

// ============================================
// NARRATIVE GENERATORS
// ============================================

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)} milhões`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)} mil`;
  return `R$ ${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

async function generateResumoExecutivo(context: NarrativeContext): Promise<NarrativeResult> {
  const systemPrompt = `Você é um analista de negócios especializado em varejo brasileiro.
Gere um resumo executivo conciso e profissional baseado nos dados fornecidos.
O tom deve ser direto, focado em resultados e acionável.
Use português brasileiro formal.

Responda em JSON com o formato:
{
  "titulo": "string - título do resumo",
  "conteudo": "string - 2-3 parágrafos de análise",
  "highlights": ["array de 3-4 pontos principais"],
  "alertas": ["array de alertas importantes se houver"],
  "acoes": ["array de 2-3 ações recomendadas"]
}`;

  const userPrompt = `Analise os seguintes dados de performance de varejo do período ${context.periodo}:

INDICADORES PRINCIPAIS:
- Faturamento: ${formatCurrency(context.kpis?.faturamento || 0)}
- Margem Bruta Média: ${formatPercent(context.kpis?.margem || 0)}
- Total de Perdas: ${formatCurrency(context.kpis?.perdas || 0)} (${formatPercent(context.kpis?.perdasPct || 0)} do faturamento)
- Vendas Perdidas (Ruptura): ${formatCurrency(context.kpis?.vendasPerdidas || 0)}
- Taxa de Disponibilidade: ${formatPercent((context.kpis?.disponibilidade || 0) * 100)}
- RFE Total (Risk Financial Exposure): ${formatCurrency(context.kpis?.rfe || 0)}

DISTRIBUIÇÃO DE RISCO DAS LOJAS:
- Lojas em risco crítico: ${context.distribuicaoRisco?.critico || 0}
- Lojas em risco alto: ${context.distribuicaoRisco?.alto || 0}
- Lojas em risco médio: ${context.distribuicaoRisco?.medio || 0}
- Lojas em risco baixo: ${context.distribuicaoRisco?.baixo || 0}
- Total de lojas ativas: ${context.distribuicaoRisco?.total || 0}

COMPOSIÇÃO DAS PERDAS:
- Vencimento: ${formatCurrency(context.composicaoPerdas?.vencimento || 0)}
- Avaria: ${formatCurrency(context.composicaoPerdas?.avaria || 0)}
- Roubo: ${formatCurrency(context.composicaoPerdas?.roubo || 0)}
- Outros: ${formatCurrency(context.composicaoPerdas?.outros || 0)}

TENDÊNCIA DE PERDAS: ${context.tendencias?.perdas || 'estável'}

TOP 5 LOJAS COM MAIOR RFE:
${context.topProblemas?.map((p, i) => `${i + 1}. ${p.entidade}: ${formatCurrency(p.valor)} (${p.tipo})`).join('\n') || 'Dados não disponíveis'}

Gere um resumo executivo profissional.`;

  const result = await callOpenAIJson<{
    titulo: string;
    conteudo: string;
    highlights: string[];
    alertas: string[];
    acoes: string[];
  }>(systemPrompt, userPrompt, { maxTokens: 1200 });

  return {
    tipo: 'resumo_executivo',
    titulo: result.titulo || 'Resumo Executivo',
    conteudo: result.conteudo || '',
    highlights: result.highlights || [],
    alertas: result.alertas || [],
    acoes: result.acoes || [],
    geradoEm: new Date().toISOString(),
    modelo: 'gpt-4o-mini',
  };
}

async function generateAnaliseTendencias(context: NarrativeContext): Promise<NarrativeResult> {
  const systemPrompt = `Você é um analista de tendências de varejo.
Analise os padrões e tendências dos dados e forneça insights sobre a evolução dos indicadores.
Foque em identificar padrões, sazonalidades e mudanças significativas.

Responda em JSON com o formato:
{
  "titulo": "string",
  "conteudo": "string - análise de 2 parágrafos",
  "highlights": ["array de insights de tendência"],
  "alertas": ["array de alertas sobre mudanças"],
  "acoes": ["array de ações preventivas"]
}`;

  const userPrompt = `Analise as tendências do período ${context.periodo}:

TENDÊNCIAS OBSERVADAS:
- Perdas: ${context.tendencias?.perdas || 'estável'}
- Faturamento: ${context.tendencias?.faturamento || 'estável'}
- RFE: ${context.tendencias?.rfe || 'estável'}

SITUAÇÃO ATUAL:
- Perda sobre faturamento: ${formatPercent(context.kpis?.perdasPct || 0)}
- Disponibilidade: ${formatPercent((context.kpis?.disponibilidade || 0) * 100)}

COMPOSIÇÃO DE PERDAS:
- Vencimento: ${formatCurrency(context.composicaoPerdas?.vencimento || 0)}
- Avaria: ${formatCurrency(context.composicaoPerdas?.avaria || 0)}

Identifique tendências e padrões relevantes.`;

  const result = await callOpenAIJson<{
    titulo: string;
    conteudo: string;
    highlights: string[];
    alertas: string[];
    acoes: string[];
  }>(systemPrompt, userPrompt, { maxTokens: 800 });

  return {
    tipo: 'analise_tendencia',
    titulo: result.titulo || 'Análise de Tendências',
    conteudo: result.conteudo || '',
    highlights: result.highlights || [],
    alertas: result.alertas || [],
    acoes: result.acoes || [],
    geradoEm: new Date().toISOString(),
    modelo: 'gpt-4o-mini',
  };
}

async function generateAlertasRiscos(context: NarrativeContext): Promise<NarrativeResult> {
  const sistemPrompt = `Você é um especialista em gestão de riscos de varejo.
Identifique riscos críticos e gere alertas acionáveis baseados nos dados.
Priorize os alertas por urgência e impacto financeiro.

Responda em JSON com o formato:
{
  "titulo": "string",
  "conteudo": "string - contexto dos riscos",
  "highlights": ["array de riscos identificados"],
  "alertas": ["array de alertas críticos"],
  "acoes": ["array de ações de mitigação"]
}`;

  const hasRiskyCritical = (context.distribuicaoRisco?.critico || 0) > 0;
  const hasHighLoss = (context.kpis?.perdasPct || 0) > 3;
  const hasLowAvailability = (context.kpis?.disponibilidade || 0) < 0.92;

  const userPrompt = `Avalie os riscos do período ${context.periodo}:

INDICADORES DE RISCO:
- Lojas em risco crítico: ${context.distribuicaoRisco?.critico || 0} de ${context.distribuicaoRisco?.total || 0}
- % Perda sobre faturamento: ${formatPercent(context.kpis?.perdasPct || 0)} (meta: <2%)
- Taxa de disponibilidade: ${formatPercent((context.kpis?.disponibilidade || 0) * 100)} (meta: >95%)
- RFE Total: ${formatCurrency(context.kpis?.rfe || 0)}

MAIORES RISCOS IDENTIFICADOS:
${context.topProblemas?.slice(0, 3).map((p) => `- ${p.entidade}: ${formatCurrency(p.valor)} (${p.tipo})`).join('\n') || 'Nenhum'}

COMPOSIÇÃO DO RISCO POR PERDAS:
- Vencimento: ${formatCurrency(context.composicaoPerdas?.vencimento || 0)}
- Avaria: ${formatCurrency(context.composicaoPerdas?.avaria || 0)}
- Roubo: ${formatCurrency(context.composicaoPerdas?.roubo || 0)}

Sinalizadores: ${hasRiskyCritical ? 'LOJAS CRÍTICAS' : ''} ${hasHighLoss ? 'PERDA ELEVADA' : ''} ${hasLowAvailability ? 'BAIXA DISPONIBILIDADE' : ''}

Gere alertas de risco priorizados.`;

  const result = await callOpenAIJson<{
    titulo: string;
    conteudo: string;
    highlights: string[];
    alertas: string[];
    acoes: string[];
  }>(sistemPrompt, userPrompt, { maxTokens: 800 });

  return {
    tipo: 'alerta_risco',
    titulo: result.titulo || 'Alertas de Risco',
    conteudo: result.conteudo || '',
    highlights: result.highlights || [],
    alertas: result.alertas || [],
    acoes: result.acoes || [],
    geradoEm: new Date().toISOString(),
    modelo: 'gpt-4o-mini',
  };
}

async function generateOportunidades(context: NarrativeContext): Promise<NarrativeResult> {
  const systemPrompt = `Você é um consultor de negócios especializado em otimização de varejo.
Identifique oportunidades de melhoria e quick-wins baseados nos dados.
Foque em ações com alto ROI e baixo esforço de implementação.

Responda em JSON com o formato:
{
  "titulo": "string",
  "conteudo": "string - contexto das oportunidades",
  "highlights": ["array de oportunidades identificadas"],
  "alertas": [],
  "acoes": ["array de quick-wins recomendados"]
}`;

  const userPrompt = `Identifique oportunidades para o período ${context.periodo}:

SITUAÇÃO ATUAL:
- Faturamento: ${formatCurrency(context.kpis?.faturamento || 0)}
- Margem: ${formatPercent(context.kpis?.margem || 0)}
- Perdas: ${formatCurrency(context.kpis?.perdas || 0)} (${formatPercent(context.kpis?.perdasPct || 0)})
- Vendas perdidas por ruptura: ${formatCurrency(context.kpis?.vendasPerdidas || 0)}

COMPOSIÇÃO DE PERDAS (OPORTUNIDADE DE REDUÇÃO):
- Vencimento: ${formatCurrency(context.composicaoPerdas?.vencimento || 0)}
- Avaria: ${formatCurrency(context.composicaoPerdas?.avaria || 0)}

LOJAS EM RISCO BAIXO (BENCHMARK):
- ${context.distribuicaoRisco?.baixo || 0} lojas operando bem

Potencial de economia se reduzir perdas em 20%: ${formatCurrency((context.kpis?.perdas || 0) * 0.2)}
Potencial de recuperação de vendas perdidas (60%): ${formatCurrency((context.kpis?.vendasPerdidas || 0) * 0.6)}

Identifique oportunidades e quick-wins.`;

  const result = await callOpenAIJson<{
    titulo: string;
    conteudo: string;
    highlights: string[];
    alertas: string[];
    acoes: string[];
  }>(systemPrompt, userPrompt, { maxTokens: 800 });

  return {
    tipo: 'oportunidade',
    titulo: result.titulo || 'Oportunidades',
    conteudo: result.conteudo || '',
    highlights: result.highlights || [],
    alertas: result.alertas || [],
    acoes: result.acoes || [],
    geradoEm: new Date().toISOString(),
    modelo: 'gpt-4o-mini',
  };
}

// ============================================
// MAIN SERVICE
// ============================================

const CACHE_TTL = 600; // 10 minutos

export async function generateFullNarrativeReport(
  periodo?: string,
  tipoPeriodo: string = 'mensal',
  forceRefresh: boolean = false
): Promise<FullNarrativeReport> {
  const targetPeriodo = periodo || getDefaultPeriodo();
  const cacheKey = `narrative:full:${targetPeriodo}:${tipoPeriodo}`;

  // Check cache
  if (!forceRefresh) {
    const cached = await CacheService.get<FullNarrativeReport>(cacheKey);
    if (cached) {
      console.log('[NarrativeBI] Cache hit');
      return cached;
    }
  }

  console.log(`[NarrativeBI] Gerando relatório narrativo para ${targetPeriodo}`);

  // Fetch context data
  const context = await fetchDashboardData(targetPeriodo, tipoPeriodo);

  // Generate all narratives in parallel
  const [resumoExecutivo, analiseTendencias, alertasRiscos, oportunidades] = await Promise.all([
    generateResumoExecutivo(context),
    generateAnaliseTendencias(context),
    generateAlertasRiscos(context),
    generateOportunidades(context),
  ]);

  const report: FullNarrativeReport = {
    resumoExecutivo,
    analiseTendencias,
    alertasRiscos,
    oportunidades,
    geradoEm: new Date().toISOString(),
    contexto: context,
  };

  // Cache result
  await CacheService.set(cacheKey, report, CACHE_TTL);

  console.log('[NarrativeBI] Relatório gerado com sucesso');

  return report;
}

export async function generateQuickInsight(
  tipo: 'resumo' | 'alerta' | 'oportunidade',
  context: Partial<NarrativeContext>
): Promise<string> {
  const systemPrompt = `Você é um assistente de BI de varejo. Gere um insight curto e direto (máximo 2 frases) em português brasileiro.`;

  let userPrompt = '';

  switch (tipo) {
    case 'resumo':
      userPrompt = `Resuma em 1-2 frases: Faturamento ${formatCurrency(context.kpis?.faturamento || 0)}, Perdas ${formatPercent(context.kpis?.perdasPct || 0)}, ${context.distribuicaoRisco?.critico || 0} lojas críticas.`;
      break;
    case 'alerta':
      userPrompt = `Gere um alerta curto se relevante: Perdas ${formatPercent(context.kpis?.perdasPct || 0)} (meta <2%), Disponibilidade ${formatPercent((context.kpis?.disponibilidade || 0) * 100)} (meta >95%).`;
      break;
    case 'oportunidade':
      userPrompt = `Identifique uma oportunidade: Potencial economia ${formatCurrency((context.kpis?.perdas || 0) * 0.2)} reduzindo perdas 20%.`;
      break;
  }

  return await callOpenAI(systemPrompt, userPrompt, { maxTokens: 150, temperature: 0.5 });
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default {
  generateFullNarrativeReport,
  generateQuickInsight,
  generateResumoExecutivo,
  generateAnaliseTendencias,
  generateAlertasRiscos,
  generateOportunidades,
};
