// web/lib/types/volumetria.ts
// Modelos de dados para sistema de volumetria e ruptura de gôndola

/**
 * 1.1 Produto (SKU) - Dados de volumetria do produto
 */
export interface ProdutoVolumetria {
  id_produto: string;
  ean: string;
  descricao: string;
  categoria: string;
  marca: string;
  largura_cm: number;
  altura_cm: number;
  profundidade_cm: number;
  pode_empilhar: boolean;
  max_camadas_vertical?: number;
  preco_venda: number;
  margem_percentual?: number;
}

/**
 * 1.2 Prateleira / Equipamento (estrutura física)
 */
export interface Prateleira {
  id_prateleira: string;
  id_gondola: string;
  id_loja: string;
  largura_util_cm: number;
  profundidade_util_cm: number;
  altura_livre_cm: number;
  nivel: 'olhos' | 'maos' | 'pes';
}

/**
 * 1.3 Slot de Planograma (posição do produto na prateleira)
 */
export interface SlotPlanograma {
  id_slot: string;
  id_loja: string;
  id_prateleira: string;
  id_produto: string;
  posicao_x_cm: number;
  largura_slot_cm: number;
  facings_definidos: number;
}

/**
 * 1.4 Leitura de Estoque de Gôndola
 */
export interface LeituraEstoqueGondola {
  id_leitura: string;
  id_loja: string;
  id_slot: string;
  id_produto: string;
  quantidade_atual_slot: number;
  origem_leitura: 'contagem_manual' | 'app_mobile' | 'visao_computacional';
  data_hora_leitura: Date;
}

/**
 * 1.5 Vendas por Hora (histórico de vendas)
 */
export interface VendasHora {
  id_loja: string;
  id_produto: string;
  data: string; // YYYY-MM-DD
  hora: number; // 0-23
  vendas_unidades: number;
}

/**
 * 1.6 Evento de Ruptura
 */
export interface EventoRuptura {
  id_evento_ruptura: string;
  id_loja: string;
  id_produto: string;
  id_slot?: string;
  data_hora_inicio: Date;
  data_hora_fim?: Date;
  tipo_ruptura: 'total' | 'funcional';
  duracao_ruptura_horas?: number;
  unidades_nao_vendidas?: number;
  receita_perdida?: number;
  margem_perdida?: number;
}

/**
 * Resultado do cálculo de capacidade de um slot
 */
export interface CapacidadeSlot {
  max_facings: number;
  max_profundidade: number;
  max_camadas: number;
  capacidade_total_slot: number;
}

/**
 * Nível de abastecimento de um slot
 */
export type StatusAbastecimento = 'BOM' | 'REGULAR' | 'RUIM';

/**
 * Resultado da análise de abastecimento de um slot
 */
export interface StatusAbastecimentoSlot {
  id_slot: string;
  id_produto: string;
  capacidade_total_slot: number;
  quantidade_atual_slot: number;
  ocupacao_slot: number; // 0-1
  status_abastecimento: StatusAbastecimento;
  data_hora_leitura: Date;
}

/**
 * Configuração de thresholds por categoria
 */
export interface ThresholdsAbastecimento {
  categoria: string;
  bom_min: number; // ex: 0.70
  regular_min: number; // ex: 0.40
  critico_max: number; // ex: 0.10 para ruptura funcional
}

/**
 * Taxa de ruptura calculada
 */
export interface TaxaRuptura {
  id_produto?: string;
  id_loja?: string;
  categoria?: string;
  periodo_inicio: Date;
  periodo_fim: Date;
  total_verificacoes: number;
  verificacoes_com_ruptura: number;
  taxa_ruptura: number; // 0-1
}

/**
 * Venda média por hora calculada
 */
export interface VendaMediaHora {
  id_loja: string;
  id_produto: string;
  periodo_inicio: Date;
  periodo_fim: Date;
  venda_media_por_hora: number;
  total_vendas_periodo: number;
  horas_loja_aberta: number;
}

/**
 * Slot crítico para alerta
 */
export interface SlotCritico {
  id_slot: string;
  id_produto: string;
  descricao_produto: string;
  id_loja: string;
  status_abastecimento: StatusAbastecimento;
  ocupacao_slot: number;
  ultima_leitura: Date;
  eventos_ruptura_recentes: number;
}

/**
 * Perda de receita por produto
 */
export interface PerdaReceitaProduto {
  id_produto: string;
  ean: string;
  descricao: string;
  total_eventos_ruptura: number;
  duracao_total_ruptura_horas: number;
  unidades_nao_vendidas: number;
  receita_perdida: number;
  margem_perdida?: number;
}

/**
 * Painel de ruptura por horário
 */
export interface RupturaPorHorario {
  hora: number; // 0-23
  dia_semana?: number; // 0-6 (0=domingo)
  total_verificacoes: number;
  verificacoes_com_ruptura: number;
  taxa_ruptura: number;
}
