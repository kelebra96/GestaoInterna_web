/**
 * Retail Recommendations Service
 *
 * Motor de recomendações inteligentes baseado em:
 * - Análise de RFE (Risk Financial Exposure)
 * - Padrões de perdas
 * - Rupturas frequentes
 * - Capital parado
 * - Giro de estoque
 *
 * Gera recomendações acionáveis com:
 * - Justificativas detalhadas
 * - ROI estimado
 * - Priorização automática
 * - Ações sugeridas
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ============================================
// TYPES
// ============================================

export type RecommendationCategory =
  | 'perda'
  | 'ruptura'
  | 'estoque'
  | 'rfe'
  | 'oportunidade'
  | 'processo';

export type RecommendationPriority = 'critica' | 'alta' | 'media' | 'baixa';

export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';

export interface RetailRecommendation {
  id: string;
  categoria: RecommendationCategory;
  prioridade: RecommendationPriority;
  titulo: string;
  descricao: string;
  justificativa: string;
  acaoSugerida: string;

  // Entidades relacionadas
  lojaId?: string;
  lojaNome?: string;
  produtoId?: string;
  produtoNome?: string;
  fornecedor?: string;

  // Impacto financeiro
  valorImpacto: number;
  roiEstimado?: number; // % de retorno
  economiaEstimada?: number;

  // Métricas de suporte
  metricas: {
    [key: string]: number | string;
  };

  // Metadata
  confianca: number; // 0-1
  prazoAcao?: string; // 'imediato' | '7_dias' | '30_dias' | '90_dias'
  status: RecommendationStatus;
  geradoEm: string;
  expiraEm?: string;
}

export interface RecommendationSummary {
  total: number;
  porCategoria: Record<RecommendationCategory, number>;
  porPrioridade: Record<RecommendationPriority, number>;
  economiaTotal: number;
  topLojas: Array<{ lojaId: string; lojaNome: string; qtdRecomendacoes: number; impactoTotal: number }>;
}

// ============================================
// CONFIGURATION - Thresholds e Regras
// ============================================

const THRESHOLDS = {
  // RFE
  rfe: {
    critico: 30000,
    alto: 15000,
    medio: 5000,
  },
  // Perdas
  perda: {
    critica_pct: 5, // % sobre faturamento
    alta_pct: 3,
    media_pct: 2,
  },
  // Estoque
  estoque: {
    giro_critico: 0.5,
    giro_baixo: 1.5,
    dias_excesso: 60,
    dias_morto: 90,
  },
  // Disponibilidade
  disponibilidade: {
    critica: 0.85,
    alerta: 0.90,
    meta: 0.95,
  },
  // Capital parado
  capitalParado: {
    critico_pct: 30, // % do estoque
    alto_pct: 20,
  },
};

const PRIORITY_ORDER: RecommendationPriority[] = ['critica', 'alta', 'media', 'baixa'];

// ============================================
// RECOMMENDATION GENERATORS
// ============================================

/**
 * Gera recomendações baseadas em RFE alto
 */
async function generateRfeRecommendations(
  periodo: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const recommendations: RetailRecommendation[] = [];

  const { data: lojas, error } = await supabaseAdmin
    .from('v_ranking_lojas_rfe')
    .select('*')
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .in('rfe_nivel', ['critico', 'alto'])
    .order('rfe_score', { ascending: false })
    .limit(20);

  if (error || !lojas) return recommendations;

  for (const loja of lojas) {
    const rfeScore = parseFloat(loja.rfe_score) || 0;
    const componentes = {
      perdas: parseFloat(loja.rfe_componente_perdas) || 0,
      vendasPerdidas: parseFloat(loja.rfe_componente_vendas_perdidas) || 0,
      capitalParado: parseFloat(loja.rfe_componente_capital_parado) || 0,
    };

    // Identificar principal problema
    const maxComponente = Math.max(componentes.perdas, componentes.vendasPerdidas, componentes.capitalParado);
    let principalProblema: string;
    let acaoSugerida: string;
    let categoria: RecommendationCategory;

    if (maxComponente === componentes.perdas) {
      principalProblema = 'Perdas elevadas';
      acaoSugerida = 'Implementar checklist de verificação de validade, revisar processo de recebimento e armazenagem';
      categoria = 'perda';
    } else if (maxComponente === componentes.vendasPerdidas) {
      principalProblema = 'Rupturas frequentes';
      acaoSugerida = 'Revisar parâmetros de reposição, verificar lead time de fornecedores, ajustar estoque de segurança';
      categoria = 'ruptura';
    } else {
      principalProblema = 'Capital parado excessivo';
      acaoSugerida = 'Realizar ação promocional para produtos parados, avaliar transferência entre lojas, negociar devolução com fornecedor';
      categoria = 'estoque';
    }

    const prioridade: RecommendationPriority = loja.rfe_nivel === 'critico' ? 'critica' : 'alta';

    recommendations.push({
      id: `rfe-${loja.loja_id}-${Date.now()}`,
      categoria: 'rfe',
      prioridade,
      titulo: `Loja ${loja.loja_nome} com RFE ${loja.rfe_nivel}`,
      descricao: `A loja ${loja.loja_nome} apresenta Risk Financial Exposure de ${formatCurrency(rfeScore)}, classificado como ${loja.rfe_nivel}. O principal fator é: ${principalProblema}.`,
      justificativa: `Composição do RFE: Perdas (${formatCurrency(componentes.perdas)}), Vendas Perdidas (${formatCurrency(componentes.vendasPerdidas)}), Custo Capital Parado (${formatCurrency(componentes.capitalParado)}).`,
      acaoSugerida,
      lojaId: loja.loja_id,
      lojaNome: loja.loja_nome,
      valorImpacto: rfeScore,
      roiEstimado: calculateRoiEstimate(rfeScore, prioridade),
      economiaEstimada: rfeScore * 0.3, // 30% de redução estimada
      metricas: {
        rfeScore: rfeScore.toFixed(2),
        perdas: componentes.perdas.toFixed(2),
        vendasPerdidas: componentes.vendasPerdidas.toFixed(2),
        capitalParado: componentes.capitalParado.toFixed(2),
        principalProblema,
      },
      confianca: 0.85,
      prazoAcao: prioridade === 'critica' ? 'imediato' : '7_dias',
      status: 'pending',
      geradoEm: new Date().toISOString(),
      expiraEm: getExpirationDate(prioridade),
    });
  }

  return recommendations;
}

/**
 * Gera recomendações baseadas em perdas
 */
async function generateLossRecommendations(
  periodo: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const recommendations: RetailRecommendation[] = [];

  // Top produtos com perda (Pareto)
  const { data: paretoData, error } = await supabaseAdmin
    .from('mv_pareto_perdas')
    .select('*')
    .eq('curva_abc', 'A')
    .order('perda_total', { ascending: false })
    .limit(15);

  if (error || !paretoData) return recommendations;

  for (const produto of paretoData) {
    const perdaTotal = parseFloat(produto.perda_total) || 0;
    const participacaoPct = parseFloat(produto.participacao_pct) || 0;

    if (participacaoPct < 2) continue; // Ignorar se < 2% do total

    const prioridade: RecommendationPriority = participacaoPct >= 5 ? 'critica' : participacaoPct >= 3 ? 'alta' : 'media';

    recommendations.push({
      id: `perda-produto-${produto.produto_id}-${Date.now()}`,
      categoria: 'perda',
      prioridade,
      titulo: `Produto com alta perda: ${produto.nome}`,
      descricao: `O produto "${produto.nome}" representa ${participacaoPct.toFixed(1)}% do total de perdas da rede, totalizando ${formatCurrency(perdaTotal)}.`,
      justificativa: `Este produto está na curva A de perdas (responsável por 80% do valor total). Categoria: ${produto.categoria}. Fornecedor: ${produto.fornecedor || 'N/A'}.`,
      acaoSugerida: 'Revisar processo de armazenagem, verificar condições de transporte, avaliar prazo de validade vs tempo de venda, considerar redução de pedido',
      produtoId: produto.produto_id,
      produtoNome: produto.nome,
      fornecedor: produto.fornecedor,
      valorImpacto: perdaTotal,
      roiEstimado: calculateRoiEstimate(perdaTotal, prioridade),
      economiaEstimada: perdaTotal * 0.4, // 40% de redução estimada
      metricas: {
        categoria: produto.categoria || 'N/A',
        fornecedor: produto.fornecedor || 'N/A',
        ranking: produto.ranking,
        participacaoPct: participacaoPct.toFixed(2),
        participacaoAcumuladaPct: produto.participacao_acumulada_pct,
        curvaAbc: produto.curva_abc,
      },
      confianca: 0.9,
      prazoAcao: prioridade === 'critica' ? 'imediato' : '7_dias',
      status: 'pending',
      geradoEm: new Date().toISOString(),
      expiraEm: getExpirationDate(prioridade),
    });
  }

  return recommendations;
}

/**
 * Gera recomendações baseadas em estoque
 */
async function generateStockRecommendations(
  periodo: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const recommendations: RetailRecommendation[] = [];

  // Lojas com capital parado excessivo
  const { data: lojas, error } = await supabaseAdmin
    .from('agg_metricas_loja')
    .select(`
      *,
      loja:dim_loja(id, nome, codigo)
    `)
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .gt('estoque_acima_60_dias_pct', THRESHOLDS.capitalParado.alto_pct)
    .order('capital_parado', { ascending: false })
    .limit(15);

  if (error || !lojas) return recommendations;

  for (const loja of lojas) {
    const capitalParado = parseFloat(loja.capital_parado) || 0;
    const capitalParadoPct = parseFloat(loja.estoque_acima_60_dias_pct) || 0;
    const estoqueMorto = parseFloat(loja.estoque_morto_valor) || 0;
    const giro = parseFloat(loja.giro_estoque) || 0;

    const prioridade: RecommendationPriority =
      capitalParadoPct >= THRESHOLDS.capitalParado.critico_pct ? 'critica' :
      capitalParadoPct >= THRESHOLDS.capitalParado.alto_pct ? 'alta' : 'media';

    let acaoSugerida = '';
    if (estoqueMorto > capitalParado * 0.3) {
      acaoSugerida = 'Liquidar estoque morto com desconto agressivo (50%+), avaliar doação para abatimento fiscal';
    } else if (giro < THRESHOLDS.estoque.giro_critico) {
      acaoSugerida = 'Promover giro com ação de preço, criar combos, avaliar transferência para lojas com maior demanda';
    } else {
      acaoSugerida = 'Reduzir próximos pedidos em 30-50%, negociar devolução com fornecedor, implementar promoção pontual';
    }

    recommendations.push({
      id: `estoque-${loja.loja_id}-${Date.now()}`,
      categoria: 'estoque',
      prioridade,
      titulo: `Capital parado elevado: ${loja.loja?.nome || 'Loja'}`,
      descricao: `A loja possui ${formatCurrency(capitalParado)} em estoque parado (${capitalParadoPct.toFixed(1)}% do total), com giro de ${giro.toFixed(2)}x.`,
      justificativa: `Estoque morto (>90 dias sem venda): ${formatCurrency(estoqueMorto)}. Cobertura atual: ${parseFloat(loja.cobertura_dias || 0).toFixed(0)} dias. Meta de giro: >2x.`,
      acaoSugerida,
      lojaId: loja.loja_id,
      lojaNome: loja.loja?.nome,
      valorImpacto: capitalParado,
      roiEstimado: 15, // 15% de custo de capital
      economiaEstimada: capitalParado * 0.12, // Custo de oportunidade anual
      metricas: {
        capitalParado: capitalParado.toFixed(2),
        capitalParadoPct: capitalParadoPct.toFixed(1),
        estoqueMorto: estoqueMorto.toFixed(2),
        giro: giro.toFixed(2),
        coberturaDias: parseFloat(loja.cobertura_dias || 0).toFixed(0),
      },
      confianca: 0.88,
      prazoAcao: prioridade === 'critica' ? '7_dias' : '30_dias',
      status: 'pending',
      geradoEm: new Date().toISOString(),
      expiraEm: getExpirationDate(prioridade),
    });
  }

  return recommendations;
}

/**
 * Gera recomendações baseadas em rupturas
 */
async function generateRuptureRecommendations(
  periodo: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const recommendations: RetailRecommendation[] = [];

  // Lojas com baixa disponibilidade
  const { data: lojas, error } = await supabaseAdmin
    .from('agg_metricas_loja')
    .select(`
      *,
      loja:dim_loja(id, nome, codigo)
    `)
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .lt('taxa_disponibilidade', THRESHOLDS.disponibilidade.meta)
    .order('vendas_perdidas_valor', { ascending: false })
    .limit(15);

  if (error || !lojas) return recommendations;

  for (const loja of lojas) {
    const vendasPerdidas = parseFloat(loja.vendas_perdidas_valor) || 0;
    const taxaDisp = parseFloat(loja.taxa_disponibilidade) || 0;
    const produtosRecorrentes = parseInt(loja.ruptura_recorrente_qtd) || 0;

    if (vendasPerdidas < 1000) continue; // Ignorar se muito baixo

    const prioridade: RecommendationPriority =
      taxaDisp < THRESHOLDS.disponibilidade.critica ? 'critica' :
      taxaDisp < THRESHOLDS.disponibilidade.alerta ? 'alta' : 'media';

    recommendations.push({
      id: `ruptura-${loja.loja_id}-${Date.now()}`,
      categoria: 'ruptura',
      prioridade,
      titulo: `Baixa disponibilidade: ${loja.loja?.nome || 'Loja'}`,
      descricao: `A loja opera com ${(taxaDisp * 100).toFixed(1)}% de disponibilidade (meta: 95%), resultando em ${formatCurrency(vendasPerdidas)} em vendas perdidas.`,
      justificativa: `${produtosRecorrentes} produtos apresentam ruptura recorrente. Impacto na margem: ${formatCurrency(parseFloat(loja.impacto_margem_ruptura) || 0)}.`,
      acaoSugerida: 'Revisar estoque de segurança dos SKUs críticos, acelerar processo de reposição, avaliar lead time de fornecedores, implementar alerta de estoque mínimo',
      lojaId: loja.loja_id,
      lojaNome: loja.loja?.nome,
      valorImpacto: vendasPerdidas,
      roiEstimado: calculateRoiEstimate(vendasPerdidas, prioridade),
      economiaEstimada: vendasPerdidas * 0.6, // 60% de recuperação estimada
      metricas: {
        taxaDisponibilidade: (taxaDisp * 100).toFixed(1),
        vendasPerdidas: vendasPerdidas.toFixed(2),
        produtosRecorrentes,
        impactoMargem: parseFloat(loja.impacto_margem_ruptura || 0).toFixed(2),
      },
      confianca: 0.82,
      prazoAcao: prioridade === 'critica' ? 'imediato' : '7_dias',
      status: 'pending',
      geradoEm: new Date().toISOString(),
      expiraEm: getExpirationDate(prioridade),
    });
  }

  return recommendations;
}

/**
 * Gera recomendações de oportunidades
 */
async function generateOpportunityRecommendations(
  periodo: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const recommendations: RetailRecommendation[] = [];

  // Lojas com bom desempenho para benchmark
  const { data: lojas, error } = await supabaseAdmin
    .from('agg_metricas_loja')
    .select(`
      *,
      loja:dim_loja(id, nome, codigo)
    `)
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .gt('margem_bruta_pct', 25) // Margem > 25%
    .gt('giro_estoque', 3) // Giro > 3x
    .lt('perda_sobre_faturamento_pct', 1.5) // Perda < 1.5%
    .order('faturamento_total', { ascending: false })
    .limit(5);

  if (!error && lojas && lojas.length > 0) {
    // Criar recomendação de benchmark
    const topLoja = lojas[0];

    recommendations.push({
      id: `oportunidade-benchmark-${Date.now()}`,
      categoria: 'oportunidade',
      prioridade: 'media',
      titulo: 'Benchmark: Melhores práticas identificadas',
      descricao: `A loja ${topLoja.loja?.nome} apresenta excelente performance: margem ${parseFloat(topLoja.margem_bruta_pct).toFixed(1)}%, giro ${parseFloat(topLoja.giro_estoque).toFixed(2)}x, perda ${parseFloat(topLoja.perda_sobre_faturamento_pct).toFixed(2)}%.`,
      justificativa: `Analisar processos desta loja para replicar em outras unidades pode gerar ganhos significativos na rede.`,
      acaoSugerida: 'Documentar processos da loja benchmark, criar plano de replicação para lojas com baixo desempenho, implementar programa de melhores práticas',
      lojaId: topLoja.loja_id,
      lojaNome: topLoja.loja?.nome,
      valorImpacto: 0,
      roiEstimado: 50, // ROI alto de replicação
      metricas: {
        margemPct: parseFloat(topLoja.margem_bruta_pct).toFixed(1),
        giro: parseFloat(topLoja.giro_estoque).toFixed(2),
        perdaPct: parseFloat(topLoja.perda_sobre_faturamento_pct).toFixed(2),
        faturamento: parseFloat(topLoja.faturamento_total).toFixed(2),
      },
      confianca: 0.75,
      prazoAcao: '30_dias',
      status: 'pending',
      geradoEm: new Date().toISOString(),
    });
  }

  return recommendations;
}

// ============================================
// MAIN SERVICE
// ============================================

export async function generateAllRecommendations(
  periodo?: string,
  tipoPeriodo: string = 'mensal'
): Promise<RetailRecommendation[]> {
  const targetPeriodo = periodo || getDefaultPeriodo();

  console.log(`[Recommendations] Gerando recomendações para ${targetPeriodo} (${tipoPeriodo})`);

  // Gerar todas as recomendações em paralelo
  const [rfeRecs, lossRecs, stockRecs, ruptureRecs, opportunityRecs] = await Promise.all([
    generateRfeRecommendations(targetPeriodo, tipoPeriodo),
    generateLossRecommendations(targetPeriodo, tipoPeriodo),
    generateStockRecommendations(targetPeriodo, tipoPeriodo),
    generateRuptureRecommendations(targetPeriodo, tipoPeriodo),
    generateOpportunityRecommendations(targetPeriodo, tipoPeriodo),
  ]);

  // Combinar e ordenar por prioridade e impacto
  const allRecommendations = [
    ...rfeRecs,
    ...lossRecs,
    ...stockRecs,
    ...ruptureRecs,
    ...opportunityRecs,
  ].sort((a, b) => {
    // Primeiro por prioridade
    const prioA = PRIORITY_ORDER.indexOf(a.prioridade);
    const prioB = PRIORITY_ORDER.indexOf(b.prioridade);
    if (prioA !== prioB) return prioA - prioB;

    // Depois por valor de impacto
    return b.valorImpacto - a.valorImpacto;
  });

  console.log(`[Recommendations] ${allRecommendations.length} recomendações geradas`);

  return allRecommendations;
}

export function generateRecommendationSummary(recommendations: RetailRecommendation[]): RecommendationSummary {
  const porCategoria: Record<RecommendationCategory, number> = {
    perda: 0,
    ruptura: 0,
    estoque: 0,
    rfe: 0,
    oportunidade: 0,
    processo: 0,
  };

  const porPrioridade: Record<RecommendationPriority, number> = {
    critica: 0,
    alta: 0,
    media: 0,
    baixa: 0,
  };

  const lojaMap = new Map<string, { lojaNome: string; qtd: number; impacto: number }>();

  let economiaTotal = 0;

  for (const rec of recommendations) {
    porCategoria[rec.categoria]++;
    porPrioridade[rec.prioridade]++;
    economiaTotal += rec.economiaEstimada || 0;

    if (rec.lojaId) {
      const existing = lojaMap.get(rec.lojaId) || { lojaNome: rec.lojaNome || '', qtd: 0, impacto: 0 };
      existing.qtd++;
      existing.impacto += rec.valorImpacto;
      lojaMap.set(rec.lojaId, existing);
    }
  }

  const topLojas = Array.from(lojaMap.entries())
    .map(([lojaId, data]) => ({
      lojaId,
      lojaNome: data.lojaNome,
      qtdRecomendacoes: data.qtd,
      impactoTotal: data.impacto,
    }))
    .sort((a, b) => b.impactoTotal - a.impactoTotal)
    .slice(0, 5);

  return {
    total: recommendations.length,
    porCategoria,
    porPrioridade,
    economiaTotal,
    topLojas,
  };
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function calculateRoiEstimate(impacto: number, prioridade: RecommendationPriority): number {
  // ROI estimado baseado na prioridade e histórico
  const baseRoi: Record<RecommendationPriority, number> = {
    critica: 80,
    alta: 50,
    media: 30,
    baixa: 15,
  };
  return baseRoi[prioridade];
}

function getExpirationDate(prioridade: RecommendationPriority): string {
  const daysToAdd: Record<RecommendationPriority, number> = {
    critica: 3,
    alta: 7,
    media: 30,
    baixa: 90,
  };
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd[prioridade]);
  return date.toISOString();
}

export default {
  generateAllRecommendations,
  generateRecommendationSummary,
  generateRfeRecommendations,
  generateLossRecommendations,
  generateStockRecommendations,
  generateRuptureRecommendations,
  generateOpportunityRecommendations,
};
