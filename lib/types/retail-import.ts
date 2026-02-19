// =============================================
// Tipos para Importação de Relatórios de Varejo
// =============================================

// Tipos de relatório ABC
export type TipoRelatorioABC = 'estoque' | 'vendas' | 'perdas' | 'rupturas';

// Configuração de coluna para mapeamento
export interface ColumnConfig {
  source: string;        // Nome da coluna no CSV
  target: string;        // Nome do campo no banco
  required: boolean;     // Obrigatório?
  type: 'string' | 'number' | 'currency' | 'date' | 'percent';
  transform?: (value: string) => unknown;
}

// Mapeamento de colunas por tipo de relatório
export interface ReportMapping {
  tipo: TipoRelatorioABC;
  nome: string;
  descricao: string;
  colunas: ColumnConfig[];
  delimiter: string;
  encoding: string;
}

// =============================================
// MAPEAMENTOS DOS RELATÓRIOS ABC
// =============================================

// Função para converter número brasileiro (1.234,56 -> 1234.56)
export const parseBrazilianNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  // Remove pontos de milhar e troca vírgula por ponto
  const cleaned = String(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Função para extrair código do produto do formato "COMPRADOR : PRODUTO"
export const parseCompradorProduto = (value: string): { comprador: string; produto: string } => {
  const parts = String(value).split(':');
  if (parts.length >= 2) {
    return {
      comprador: parts[0].trim(),
      produto: parts.slice(1).join(':').trim()
    };
  }
  return { comprador: '', produto: String(value).trim() };
};

// MAPEAMENTO: ABC de Estoque
export const MAPPING_ESTOQUE: ReportMapping = {
  tipo: 'estoque',
  nome: 'ABC de Estoque',
  descricao: 'Análise ABC do estoque com giro, cobertura e valores',
  delimiter: ';',
  encoding: 'latin1',
  colunas: [
    { source: 'Comprador : Produto', target: 'comprador_produto', required: true, type: 'string' },
    { source: 'Código Produto', target: 'codigo', required: true, type: 'string' },
    { source: 'Código Acesso', target: 'ean', required: false, type: 'string' },
    { source: 'Embalagem Unitária', target: 'embalagem', required: false, type: 'string' },
    { source: 'Quantidade em Estoque', target: 'quantidade_estoque', required: true, type: 'number' },
    { source: 'Quantidade Reservada', target: 'quantidade_reservada', required: false, type: 'number' },
    { source: 'Quantidade Disponível', target: 'quantidade_disponivel', required: false, type: 'number' },
    { source: 'Qtd. Pend. Ped.Compra', target: 'quantidade_pendente_compra', required: false, type: 'number' },
    { source: 'Valor Preço de Venda', target: 'valor_preco_venda', required: false, type: 'currency' },
    { source: 'Preço Vda Unitário', target: 'preco_venda_unitario', required: false, type: 'currency' },
    { source: 'Valor Custo Líquido', target: 'custo_total_liquido', required: false, type: 'currency' },
    { source: 'Custo Liq. Unitário', target: 'custo_unitario_liquido', required: false, type: 'currency' },
    { source: 'Valor Custo Bruto', target: 'custo_total_bruto', required: false, type: 'currency' },
    { source: 'Cto Bruto Unitário', target: 'custo_unitario_bruto', required: false, type: 'currency' },
    { source: 'Custo Fiscal Unit.', target: 'custo_fiscal_unitario', required: false, type: 'currency' },
    { source: 'Custo Fiscal Total', target: 'custo_fiscal_total', required: false, type: 'currency' },
    { source: 'Lucrat. Marg %', target: 'margem_percentual', required: false, type: 'percent' },
    { source: 'Lucratividade Valor', target: 'lucratividade_valor', required: false, type: 'currency' },
    { source: '% Mark Up', target: 'markup', required: false, type: 'percent' },
    { source: '% Mark Down', target: 'markdown', required: false, type: 'percent' },
    { source: 'Contribuição Valor', target: 'contribuicao_valor', required: false, type: 'currency' },
    { source: 'Média Vda/Dia', target: 'media_venda_dia', required: false, type: 'number' },
    { source: 'Dias de Estoque', target: 'dias_estoque', required: false, type: 'number' },
    { source: 'Dias Ult. Entrada', target: 'dias_ultima_entrada', required: false, type: 'number' },
    { source: 'Quantidade  Dias Sem Vendas', target: 'dias_sem_vendas', required: false, type: 'number' },
    { source: '%Acm. Venda', target: 'participacao_acumulada', required: false, type: 'percent' },
    { source: '%Partic. Pr.Vda', target: 'participacao_preco_venda', required: false, type: 'percent' },
    { source: '%Partic. Cto Liq.', target: 'participacao_custo', required: false, type: 'percent' },
    { source: 'Peso Bruto', target: 'peso_bruto', required: false, type: 'number' },
    { source: 'Peso Líquido', target: 'peso_liquido', required: false, type: 'number' },
    { source: 'ICMS s/ Venda', target: 'icms_venda', required: false, type: 'currency' },
    { source: 'PIS s/ Venda', target: 'pis_venda', required: false, type: 'currency' },
    { source: 'COFINS s/ Venda', target: 'cofins_venda', required: false, type: 'currency' },
    { source: 'Compror', target: 'comprador_codigo', required: false, type: 'string' },
  ]
};

// MAPEAMENTO: ABC de Vendas
export const MAPPING_VENDAS: ReportMapping = {
  tipo: 'vendas',
  nome: 'ABC de Vendas',
  descricao: 'Análise ABC de vendas com promoções e margens',
  delimiter: ';',
  encoding: 'latin1',
  colunas: [
    { source: 'Comprador : Produto', target: 'comprador_produto', required: true, type: 'string' },
    { source: 'Código Produto', target: 'codigo', required: true, type: 'string' },
    { source: 'Embalagem Unitária', target: 'embalagem', required: false, type: 'string' },
    { source: 'Venda Quantidade', target: 'quantidade_vendida', required: true, type: 'number' },
    { source: 'Unitário Médio', target: 'valor_unitario_medio', required: false, type: 'currency' },
    { source: 'Venda Valor', target: 'valor_venda', required: true, type: 'currency' },
    { source: 'Venda % Partic.', target: 'participacao_venda', required: false, type: 'percent' },
    { source: 'Promoções Valor Venda', target: 'valor_promocao', required: false, type: 'currency' },
    { source: '% Partic. Prom./Vda.', target: 'percentual_promocao', required: false, type: 'percent' },
    { source: 'Lucratividade Unit.', target: 'lucratividade_unitaria', required: false, type: 'currency' },
    { source: 'Lucratividade Valor', target: 'lucratividade_valor', required: false, type: 'currency' },
    { source: 'Lucrat. Marg %', target: 'margem_percentual', required: false, type: 'percent' },
    { source: '% Mark Up', target: 'markup', required: false, type: 'percent' },
    { source: '% Mark Down', target: 'markdown', required: false, type: 'percent' },
    { source: 'Custo Bruto', target: 'custo_bruto', required: false, type: 'currency' },
    { source: 'Custo Líquido', target: 'custo_liquido', required: false, type: 'currency' },
    { source: 'Custo Fiscal Total', target: 'custo_fiscal_total', required: false, type: 'currency' },
    { source: 'Contribuição Valor', target: 'contribuicao_valor', required: false, type: 'currency' },
    { source: 'Contrib. Marg %*', target: 'contribuicao_margem', required: false, type: 'percent' },
    { source: '%Acm. Venda', target: 'participacao_acumulada', required: false, type: 'percent' },
    { source: 'Peso Bruto', target: 'peso_bruto', required: false, type: 'number' },
    { source: 'Peso Líquido', target: 'peso_liquido', required: false, type: 'number' },
    { source: 'Impostos Venda', target: 'impostos_venda', required: false, type: 'currency' },
  ]
};

// MAPEAMENTO: ABC de Perdas
export const MAPPING_PERDAS: ReportMapping = {
  tipo: 'perdas',
  nome: 'ABC de Perdas',
  descricao: 'Análise ABC de perdas por produto',
  delimiter: ';',
  encoding: 'latin1',
  colunas: [
    { source: 'Comprador : Produto', target: 'comprador_produto', required: true, type: 'string' },
    { source: 'Código Produto', target: 'codigo', required: true, type: 'string' },
    { source: 'Embalagem Venda', target: 'embalagem', required: false, type: 'string' },
    { source: 'Quantidade Perda', target: 'quantidade_perda', required: true, type: 'number' },
    { source: '% Part. Qt.Perda', target: 'participacao_quantidade', required: false, type: 'percent' },
    { source: 'Tot Perda  Liquido', target: 'custo_perda_liquido', required: true, type: 'currency' },
    { source: 'Tot Perda  Bruto', target: 'custo_perda_bruto', required: false, type: 'currency' },
    { source: '% Partic. Cto Lanc.', target: 'participacao_custo', required: false, type: 'percent' },
    { source: 'Vlr Tot.Perda Preço Atual', target: 'valor_venda_perdido', required: false, type: 'currency' },
    { source: 'Impostos  Vda Realizada', target: 'impostos_venda', required: false, type: 'currency' },
    { source: 'Lucratividade Valor Perdido', target: 'lucratividade_perdida', required: false, type: 'currency' },
    { source: 'Lucrat. Marg %', target: 'margem_percentual', required: false, type: 'percent' },
    { source: '% Mark Up', target: 'markup', required: false, type: 'percent' },
    { source: '% Mark Down', target: 'markdown', required: false, type: 'percent' },
    { source: 'Contribuição Perdida', target: 'contribuicao_perdida', required: false, type: 'currency' },
    { source: 'Custo Bruto', target: 'custo_bruto', required: false, type: 'currency' },
    { source: 'Custo Líquido', target: 'custo_liquido', required: false, type: 'currency' },
    { source: 'Custo Fiscal Total', target: 'custo_fiscal_total', required: false, type: 'currency' },
    { source: '%Acm. Venda', target: 'participacao_acumulada', required: false, type: 'percent' },
    { source: 'ICMS s/ Venda', target: 'icms_venda', required: false, type: 'currency' },
    { source: 'PIS s/ Venda', target: 'pis_venda', required: false, type: 'currency' },
    { source: 'COFINS s/ Venda', target: 'cofins_venda', required: false, type: 'currency' },
  ]
};

// MAPEAMENTO: ABC de Rupturas
export const MAPPING_RUPTURAS: ReportMapping = {
  tipo: 'rupturas',
  nome: 'ABC de Rupturas',
  descricao: 'Análise ABC de vendas perdidas por falta de estoque',
  delimiter: ';',
  encoding: 'latin1',
  colunas: [
    { source: 'Comprador : Produto', target: 'comprador_produto', required: true, type: 'string' },
    { source: 'Código Produto', target: 'codigo', required: true, type: 'string' },
    { source: 'Embalagem Unitária', target: 'embalagem', required: false, type: 'string' },
    { source: 'Vda Perdida Quantidade', target: 'quantidade_perdida', required: true, type: 'number' },
    { source: 'Vda Perdida Valor', target: 'valor_venda_perdida', required: true, type: 'currency' },
    { source: 'Venda % Partic.', target: 'participacao_venda', required: false, type: 'percent' },
    { source: 'Lucratividade Valor', target: 'lucratividade_perdida', required: false, type: 'currency' },
    { source: 'Lucrat. Marg %', target: 'margem_percentual', required: false, type: 'percent' },
    { source: '% Mark Up', target: 'markup', required: false, type: 'percent' },
    { source: '% Mark Down', target: 'markdown', required: false, type: 'percent' },
    { source: 'Contribuição Valor', target: 'contribuicao_valor', required: false, type: 'currency' },
    { source: 'Custo Bruto', target: 'custo_bruto', required: false, type: 'currency' },
    { source: 'Custo Líquido', target: 'custo_liquido', required: false, type: 'currency' },
    { source: '%Acm. Venda', target: 'participacao_acumulada', required: false, type: 'percent' },
    { source: 'Total Impostos', target: 'total_impostos', required: false, type: 'currency' },
    { source: 'ICMS s/ Venda', target: 'icms_venda', required: false, type: 'currency' },
    { source: 'PIS s/ Venda', target: 'pis_venda', required: false, type: 'currency' },
    { source: 'COFINS s/ Venda', target: 'cofins_venda', required: false, type: 'currency' },
  ]
};

// Todos os mapeamentos
export const REPORT_MAPPINGS: Record<TipoRelatorioABC, ReportMapping> = {
  estoque: MAPPING_ESTOQUE,
  vendas: MAPPING_VENDAS,
  perdas: MAPPING_PERDAS,
  rupturas: MAPPING_RUPTURAS,
};

// =============================================
// INTERFACES DE RESULTADO
// =============================================

export interface ImportPreview {
  tipo: TipoRelatorioABC;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  mappedColumns: number;
  unmappedColumns: string[];
  stats: {
    totalQuantity: number;
    totalValue: number;
    productCount: number;
  };
}

export interface ImportResult {
  success: boolean;
  tipo: TipoRelatorioABC;
  registrosLidos: number;
  registrosImportados: number;
  registrosAtualizados: number;
  registrosErro: number;
  valorTotal: number;
  quantidadeTotal: number;
  erros: ImportError[];
  duracao: number; // ms
}

export interface ImportError {
  linha: number;
  campo?: string;
  valor?: string;
  mensagem: string;
  critico: boolean;
}

export interface ImportJob {
  id: string;
  organizationId: string;
  lojaId: string;
  tipo: TipoRelatorioABC;
  dataReferencia: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  resultado?: ImportResult;
  criadoEm: string;
  concluidoEm?: string;
}

// =============================================
// INTERFACE PARA DADOS PARSEADOS
// =============================================

export interface DadoEstoqueParsed {
  codigo: string;
  ean?: string;
  nome: string;
  comprador: string;
  embalagem?: string;
  quantidade_estoque: number;
  quantidade_reservada: number;
  quantidade_disponivel: number;
  quantidade_pendente_compra: number;
  custo_unitario: number;
  custo_total: number;
  preco_venda: number;
  valor_estoque_venda: number;
  media_venda_dia: number;
  dias_estoque: number;
  dias_ultima_entrada: number;
  dias_sem_vendas: number;
  margem_percentual: number;
  markup: number;
  markdown: number;
  curva_abc?: string;
  participacao_acumulada: number;
}

export interface DadoVendasParsed {
  codigo: string;
  nome: string;
  comprador: string;
  embalagem?: string;
  quantidade_vendida: number;
  valor_unitario_medio: number;
  valor_venda: number;
  custo_total: number;
  margem_valor: number;
  margem_percentual: number;
  markup: number;
  markdown: number;
  valor_promocao: number;
  percentual_promocao: number;
  curva_abc?: string;
  participacao_acumulada: number;
}

export interface DadoPerdasParsed {
  codigo: string;
  nome: string;
  comprador: string;
  embalagem?: string;
  quantidade_perda: number;
  custo_perda: number;
  custo_perda_liquido: number;
  valor_venda_perdido: number;
  margem_perdida: number;
  margem_percentual: number;
  markup: number;
  markdown: number;
  tipo_perda: string;
  curva_abc?: string;
}

export interface DadoRupturasParsed {
  codigo: string;
  nome: string;
  comprador: string;
  embalagem?: string;
  quantidade_perdida: number;
  valor_venda_perdida: number;
  custo_ruptura: number;
  margem_perdida: number;
  margem_percentual: number;
  markup: number;
  markdown: number;
  curva_abc?: string;
}
