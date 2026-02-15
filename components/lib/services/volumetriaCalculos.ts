// web/lib/services/volumetriaCalculos.ts
// Funções puras para cálculo de capacidade de gôndola e análise de abastecimento

import {
  ProdutoVolumetria,
  Prateleira,
  SlotPlanograma,
  CapacidadeSlot,
  StatusAbastecimento,
  StatusAbastecimentoSlot,
  ThresholdsAbastecimento,
  LeituraEstoqueGondola,
} from '../types/volumetria';

/**
 * 2) CÁLCULO DE CAPACIDADE DE GÔNDOLA POR SLOT
 */

/**
 * 2.1 Calcula o número máximo de facings (frentes) horizontais
 */
export function calcularMaxFacings(
  largura_util_slot_cm: number,
  largura_produto_cm: number
): number {
  if (largura_produto_cm <= 0) return 0;
  return Math.floor(largura_util_slot_cm / largura_produto_cm);
}

/**
 * 2.2 Calcula quantas unidades cabem em profundidade
 */
export function calcularMaxProfundidade(
  profundidade_prateleira_cm: number,
  profundidade_produto_cm: number
): number {
  if (profundidade_produto_cm <= 0) return 0;
  return Math.floor(profundidade_prateleira_cm / profundidade_produto_cm);
}

/**
 * 2.3 Calcula quantas camadas verticais podem ser empilhadas
 */
export function calcularMaxCamadas(
  altura_livre_cm: number,
  altura_produto_cm: number,
  pode_empilhar: boolean,
  max_camadas_vertical?: number
): number {
  if (!pode_empilhar) return 1;
  if (altura_produto_cm <= 0) return 1;

  const max_camadas_bruto = Math.floor(altura_livre_cm / altura_produto_cm);

  if (max_camadas_vertical !== undefined && max_camadas_vertical > 0) {
    return Math.min(max_camadas_bruto, max_camadas_vertical);
  }

  return max_camadas_bruto;
}

/**
 * 2.4 Calcula a capacidade total de um slot
 *
 * @param produto - Dados volumétricos do produto
 * @param prateleira - Estrutura física da prateleira
 * @param slot - Posição do produto no planograma
 * @returns Capacidade detalhada do slot
 */
export function calcularCapacidadeSlot(
  produto: ProdutoVolumetria,
  prateleira: Prateleira,
  slot: SlotPlanograma
): CapacidadeSlot {
  const max_facings = calcularMaxFacings(slot.largura_slot_cm, produto.largura_cm);

  const max_profundidade = calcularMaxProfundidade(
    prateleira.profundidade_util_cm,
    produto.profundidade_cm
  );

  const max_camadas = calcularMaxCamadas(
    prateleira.altura_livre_cm,
    produto.altura_cm,
    produto.pode_empilhar,
    produto.max_camadas_vertical
  );

  const capacidade_total_slot = max_facings * max_profundidade * max_camadas;

  return {
    max_facings,
    max_profundidade,
    max_camadas,
    capacidade_total_slot,
  };
}

/**
 * 3) NÍVEL DE ABASTECIMENTO (BOM / REGULAR / RUIM)
 */

/**
 * Thresholds padrão de abastecimento
 */
export const THRESHOLDS_PADRAO: Omit<ThresholdsAbastecimento, 'categoria'> = {
  bom_min: 0.70,       // 70% ou mais = BOM
  regular_min: 0.40,   // 40-70% = REGULAR
  critico_max: 0.10,   // Menos de 10% = ruptura funcional
};

/**
 * 3.1 Calcula o percentual de ocupação de um slot
 */
export function calcularOcupacaoSlot(
  quantidade_atual: number,
  capacidade_total: number
): number {
  if (capacidade_total <= 0) return 0;
  return quantidade_atual / capacidade_total;
}

/**
 * 3.2 Classifica o nível de abastecimento com base na ocupação
 */
export function classificarAbastecimento(
  ocupacao_slot: number,
  thresholds: Omit<ThresholdsAbastecimento, 'categoria'> = THRESHOLDS_PADRAO
): StatusAbastecimento {
  if (ocupacao_slot >= thresholds.bom_min) {
    return 'BOM';
  } else if (ocupacao_slot >= thresholds.regular_min) {
    return 'REGULAR';
  } else {
    return 'RUIM';
  }
}

/**
 * Analisa o status completo de abastecimento de um slot
 */
export function analisarAbastecimentoSlot(
  leitura: LeituraEstoqueGondola,
  capacidade_total: number,
  thresholds?: Omit<ThresholdsAbastecimento, 'categoria'>
): StatusAbastecimentoSlot {
  const ocupacao_slot = calcularOcupacaoSlot(
    leitura.quantidade_atual_slot,
    capacidade_total
  );

  const status_abastecimento = classificarAbastecimento(ocupacao_slot, thresholds);

  return {
    id_slot: leitura.id_slot,
    id_produto: leitura.id_produto,
    capacidade_total_slot: capacidade_total,
    quantidade_atual_slot: leitura.quantidade_atual_slot,
    ocupacao_slot,
    status_abastecimento,
    data_hora_leitura: leitura.data_hora_leitura,
  };
}

/**
 * 4) MEDIÇÃO DE RUPTURA
 */

/**
 * 4.1 Detecta se há ruptura total (quantidade = 0)
 */
export function detectarRupturaTotal(quantidade_atual: number): boolean {
  return quantidade_atual === 0;
}

/**
 * 4.1 Detecta se há ruptura funcional (quantidade muito baixa)
 */
export function detectarRupturaFuncional(
  ocupacao_slot: number,
  limiar_critico: number = THRESHOLDS_PADRAO.critico_max
): boolean {
  return ocupacao_slot > 0 && ocupacao_slot < limiar_critico;
}

/**
 * Detecta o tipo de ruptura presente
 */
export function detectarTipoRuptura(
  quantidade_atual: number,
  capacidade_total: number,
  limiar_critico?: number
): 'total' | 'funcional' | null {
  if (detectarRupturaTotal(quantidade_atual)) {
    return 'total';
  }

  const ocupacao = calcularOcupacaoSlot(quantidade_atual, capacidade_total);
  if (detectarRupturaFuncional(ocupacao, limiar_critico)) {
    return 'funcional';
  }

  return null;
}

/**
 * 4.2 Calcula taxa de ruptura
 */
export function calcularTaxaRuptura(
  verificacoes_com_ruptura: number,
  total_verificacoes: number
): number {
  if (total_verificacoes === 0) return 0;
  return verificacoes_com_ruptura / total_verificacoes;
}

/**
 * 5) DURAÇÃO DA RUPTURA E PERDA DE VENDA
 */

/**
 * 5.1 Calcula venda média por hora
 */
export function calcularVendaMediaHora(
  vendas_totais_periodo: number,
  horas_loja_aberta: number
): number {
  if (horas_loja_aberta <= 0) return 0;
  return vendas_totais_periodo / horas_loja_aberta;
}

/**
 * 5.2 Calcula duração da ruptura em horas
 */
export function calcularDuracaoRuptura(
  data_hora_inicio: Date,
  data_hora_fim: Date
): number {
  const diff_ms = data_hora_fim.getTime() - data_hora_inicio.getTime();
  return diff_ms / (1000 * 60 * 60); // Converter para horas
}

/**
 * 5.3 Calcula unidades não vendidas durante ruptura
 */
export function calcularUnidadesNaoVendidas(
  venda_media_por_hora: number,
  duracao_ruptura_horas: number
): number {
  return venda_media_por_hora * duracao_ruptura_horas;
}

/**
 * 5.4 Calcula receita perdida
 */
export function calcularReceitaPerdida(
  unidades_nao_vendidas: number,
  preco_venda: number
): number {
  return unidades_nao_vendidas * preco_venda;
}

/**
 * 5.4 Calcula margem perdida
 */
export function calcularMargemPerdida(
  receita_perdida: number,
  margem_percentual: number
): number {
  return receita_perdida * (margem_percentual / 100);
}

/**
 * Calcula todas as métricas de perda para um evento de ruptura
 */
export interface MetricasPerda {
  duracao_ruptura_horas: number;
  unidades_nao_vendidas: number;
  receita_perdida: number;
  margem_perdida?: number;
}

export function calcularMetricasPerda(
  data_hora_inicio: Date,
  data_hora_fim: Date,
  venda_media_por_hora: number,
  preco_venda: number,
  margem_percentual?: number
): MetricasPerda {
  const duracao_ruptura_horas = calcularDuracaoRuptura(data_hora_inicio, data_hora_fim);
  const unidades_nao_vendidas = calcularUnidadesNaoVendidas(venda_media_por_hora, duracao_ruptura_horas);
  const receita_perdida = calcularReceitaPerdida(unidades_nao_vendidas, preco_venda);

  let margem_perdida: number | undefined;
  if (margem_percentual !== undefined) {
    margem_perdida = calcularMargemPerdida(receita_perdida, margem_percentual);
  }

  return {
    duracao_ruptura_horas,
    unidades_nao_vendidas,
    receita_perdida,
    margem_perdida,
  };
}
