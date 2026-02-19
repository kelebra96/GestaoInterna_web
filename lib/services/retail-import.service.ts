// =============================================
// Serviço de Importação de Relatórios de Varejo
// =============================================

import { createClient } from '@supabase/supabase-js';
import {
  TipoRelatorioABC,
  ReportMapping,
  REPORT_MAPPINGS,
  parseBrazilianNumber,
  parseCompradorProduto,
  ImportPreview,
  ImportResult,
  ImportError,
  DadoEstoqueParsed,
  DadoVendasParsed,
  DadoPerdasParsed,
  DadoRupturasParsed,
} from '../types/retail-import';

// Supabase client para service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getSupabaseAdmin = () => createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

// Helper para limitar valores decimais (evitar overflow em DECIMAL(8,4))
function clampDecimal(value: number, max: number = 9999.9999): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.min(Math.max(value, -max), max);
}

// Helper para retry com backoff exponencial
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Se for erro de HTML (Cloudflare), fazer retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('500')) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} após ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Para outros erros, não fazer retry
      throw error;
    }
  }

  throw lastError;
}

// =============================================
// PARSER DE CSV
// =============================================

export function parseCSV(
  content: string,
  delimiter: string = ';'
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

// =============================================
// DETECTAR TIPO DE RELATÓRIO
// =============================================

export function detectReportType(headers: string[]): TipoRelatorioABC | null {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

  // Detectar por colunas específicas
  if (headerSet.has('quantidade em estoque') || headerSet.has('dias de estoque')) {
    return 'estoque';
  }
  if (headerSet.has('quantidade perda') || headerSet.has('tot perda  liquido')) {
    return 'perdas';
  }
  if (headerSet.has('vda perdida quantidade') || headerSet.has('vda perdida valor')) {
    return 'rupturas';
  }
  if (headerSet.has('venda quantidade') || headerSet.has('venda valor')) {
    return 'vendas';
  }

  return null;
}

// =============================================
// GERAR PREVIEW
// =============================================

export function generatePreview(
  content: string,
  tipo?: TipoRelatorioABC
): ImportPreview {
  const { headers, rows } = parseCSV(content, ';');

  const detectedType = tipo || detectReportType(headers);
  if (!detectedType) {
    throw new Error('Não foi possível identificar o tipo de relatório');
  }

  const mapping = REPORT_MAPPINGS[detectedType];
  const mappedColumns = new Set(mapping.colunas.map(c => c.source.toLowerCase()));
  const unmappedColumns = headers.filter(h => !mappedColumns.has(h.toLowerCase()));

  // Calcular estatísticas básicas
  let totalQuantity = 0;
  let totalValue = 0;
  const productCodes = new Set<string>();

  const sampleRows = rows.slice(0, 10).map(row => {
    const codigo = row['Código Produto'] || '';
    productCodes.add(codigo);

    // Dependendo do tipo, pegar quantidade e valor diferentes
    switch (detectedType) {
      case 'estoque':
        totalQuantity += parseBrazilianNumber(row['Quantidade em Estoque'] || '0');
        totalValue += parseBrazilianNumber(row['Valor Custo Líquido'] || '0');
        break;
      case 'vendas':
        totalQuantity += parseBrazilianNumber(row['Venda Quantidade'] || '0');
        totalValue += parseBrazilianNumber(row['Venda Valor'] || '0');
        break;
      case 'perdas':
        totalQuantity += parseBrazilianNumber(row['Quantidade Perda'] || '0');
        totalValue += parseBrazilianNumber(row['Tot Perda  Liquido'] || '0');
        break;
      case 'rupturas':
        totalQuantity += parseBrazilianNumber(row['Vda Perdida Quantidade'] || '0');
        totalValue += parseBrazilianNumber(row['Vda Perdida Valor'] || '0');
        break;
    }

    return row;
  });

  return {
    tipo: detectedType,
    headers,
    sampleRows,
    totalRows: rows.length,
    mappedColumns: mapping.colunas.length,
    unmappedColumns,
    stats: {
      totalQuantity,
      totalValue,
      productCount: productCodes.size,
    },
  };
}

// =============================================
// FUNÇÕES DE PARSING POR TIPO
// =============================================

function parseEstoqueRow(row: Record<string, string>): DadoEstoqueParsed {
  const { comprador, produto } = parseCompradorProduto(row['Comprador : Produto'] || '');

  return {
    codigo: row['Código Produto'] || '',
    ean: row['Código Acesso'] || undefined,
    nome: produto,
    comprador,
    embalagem: row['Embalagem Unitária'] || undefined,
    quantidade_estoque: parseBrazilianNumber(row['Quantidade em Estoque']),
    quantidade_reservada: parseBrazilianNumber(row['Quantidade Reservada']),
    quantidade_disponivel: parseBrazilianNumber(row['Quantidade Disponível']),
    quantidade_pendente_compra: parseBrazilianNumber(row['Qtd. Pend. Ped.Compra']),
    custo_unitario: parseBrazilianNumber(row['Custo Liq. Unitário']),
    custo_total: parseBrazilianNumber(row['Valor Custo Líquido']),
    preco_venda: parseBrazilianNumber(row['Preço Vda Unitário']),
    valor_estoque_venda: parseBrazilianNumber(row['Valor Preço de Venda']),
    media_venda_dia: parseBrazilianNumber(row['Média Vda/Dia']),
    dias_estoque: parseBrazilianNumber(row['Dias de Estoque']),
    dias_ultima_entrada: parseInt(row['Dias Ult. Entrada'] || '0', 10) || 0,
    dias_sem_vendas: parseInt(row['Quantidade  Dias Sem Vendas'] || '0', 10) || 0,
    margem_percentual: parseBrazilianNumber(row['Lucrat. Marg %']),
    markup: parseBrazilianNumber(row['% Mark Up']),
    markdown: parseBrazilianNumber(row['% Mark Down']),
    participacao_acumulada: parseBrazilianNumber(row['%Acm. Venda']),
  };
}

function parseVendasRow(row: Record<string, string>): DadoVendasParsed {
  const { comprador, produto } = parseCompradorProduto(row['Comprador : Produto'] || '');

  return {
    codigo: row['Código Produto'] || '',
    nome: produto,
    comprador,
    embalagem: row['Embalagem Unitária'] || undefined,
    quantidade_vendida: parseBrazilianNumber(row['Venda Quantidade']),
    valor_unitario_medio: parseBrazilianNumber(row['Unitário Médio']),
    valor_venda: parseBrazilianNumber(row['Venda Valor']),
    custo_total: parseBrazilianNumber(row['Custo Líquido']),
    margem_valor: parseBrazilianNumber(row['Lucratividade Valor']),
    margem_percentual: parseBrazilianNumber(row['Lucrat. Marg %']),
    markup: parseBrazilianNumber(row['% Mark Up']),
    markdown: parseBrazilianNumber(row['% Mark Down']),
    valor_promocao: parseBrazilianNumber(row['Promoções Valor Venda']),
    percentual_promocao: parseBrazilianNumber(row['% Partic. Prom./Vda.']),
    participacao_acumulada: parseBrazilianNumber(row['%Acm. Venda']),
  };
}

function parsePerdasRow(row: Record<string, string>): DadoPerdasParsed {
  const { comprador, produto } = parseCompradorProduto(row['Comprador : Produto'] || '');

  return {
    codigo: row['Código Produto'] || '',
    nome: produto,
    comprador,
    embalagem: row['Embalagem Venda'] || undefined,
    quantidade_perda: parseBrazilianNumber(row['Quantidade Perda']),
    custo_perda: parseBrazilianNumber(row['Tot Perda  Bruto']),
    custo_perda_liquido: parseBrazilianNumber(row['Tot Perda  Liquido']),
    valor_venda_perdido: parseBrazilianNumber(row['Vlr Tot.Perda Preço Atual']),
    margem_perdida: parseBrazilianNumber(row['Lucratividade Valor Perdido']),
    margem_percentual: parseBrazilianNumber(row['Lucrat. Marg %']),
    markup: parseBrazilianNumber(row['% Mark Up']),
    markdown: parseBrazilianNumber(row['% Mark Down']),
    tipo_perda: 'vencimento', // ABC de Perdas geralmente reflete perdas por vencimento/quebra
  };
}

function parseRupturasRow(row: Record<string, string>): DadoRupturasParsed {
  const { comprador, produto } = parseCompradorProduto(row['Comprador : Produto'] || '');

  return {
    codigo: row['Código Produto'] || '',
    nome: produto,
    comprador,
    embalagem: row['Embalagem Unitária'] || undefined,
    quantidade_perdida: parseBrazilianNumber(row['Vda Perdida Quantidade']),
    valor_venda_perdida: parseBrazilianNumber(row['Vda Perdida Valor']),
    custo_ruptura: parseBrazilianNumber(row['Custo Líquido']),
    margem_perdida: parseBrazilianNumber(row['Lucratividade Valor']),
    margem_percentual: parseBrazilianNumber(row['Lucrat. Marg %']),
    markup: parseBrazilianNumber(row['% Mark Up']),
    markdown: parseBrazilianNumber(row['% Mark Down']),
  };
}

// =============================================
// GARANTIR PRODUTO NA DIMENSÃO
// =============================================

// Cache local de produtos para evitar queries repetidas
const produtoCache = new Map<string, string>();

// Carregar todos os produtos da organização em cache (BULK)
// Supabase tem limite de 1000 por query, então paginamos
async function loadProdutosCache(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string
): Promise<void> {
  console.log('[Import] Carregando cache de produtos...');
  const startTime = Date.now();

  let allProdutos: Array<{ id: string; codigo: string }> = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  // Paginar para pegar todos os produtos
  while (hasMore) {
    const { data: produtos, error } = await supabase
      .from('dim_produto')
      .select('id, codigo')
      .eq('organization_id', organizationId)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('[Import] Erro ao carregar produtos:', error);
      break;
    }

    if (produtos && produtos.length > 0) {
      allProdutos = allProdutos.concat(produtos);
      offset += pageSize;
      hasMore = produtos.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Popular cache
  allProdutos.forEach(p => {
    produtoCache.set(`${organizationId}:${p.codigo}`, p.id);
  });

  console.log(`[Import] Cache carregado: ${allProdutos.length} produtos em ${Date.now() - startTime}ms`);
}

// Criar produtos em bulk
async function createProdutosBulk(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  produtos: Array<{ codigo: string; nome: string; comprador: string; ean?: string }>
): Promise<void> {
  if (produtos.length === 0) return;

  console.log(`[Import] Criando ${produtos.length} novos produtos em bulk...`);
  const startTime = Date.now();

  // Dividir em batches de 500
  const batchSize = 500;
  for (let i = 0; i < produtos.length; i += batchSize) {
    const batch = produtos.slice(i, i + batchSize).map(p => ({
      organization_id: organizationId,
      codigo: p.codigo,
      nome: p.nome || p.codigo,
      fornecedor: p.comprador || null,
      ean: p.ean || null,
    }));

    const { error } = await supabase
      .from('dim_produto')
      .upsert(batch, {
        onConflict: 'organization_id,codigo',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`[Import] Erro ao criar batch de produtos:`, error);
    }
  }

  // Recarregar cache após inserção
  await loadProdutosCache(supabase, organizationId);
  console.log(`[Import] Produtos criados em ${Date.now() - startTime}ms`);
}

async function ensureProduto(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  codigo: string,
  nome: string,
  comprador: string,
  ean?: string
): Promise<string> {
  const cacheKey = `${organizationId}:${codigo}`;

  // Retornar do cache se existir
  if (produtoCache.has(cacheKey)) {
    return produtoCache.get(cacheKey)!;
  }

  // Se não estiver no cache, criar individualmente (fallback)
  const { data: created, error } = await supabase
    .from('dim_produto')
    .upsert(
      {
        organization_id: organizationId,
        codigo,
        nome: nome || codigo,
        fornecedor: comprador || null,
        ean: ean || null,
      },
      {
        onConflict: 'organization_id,codigo',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single();

  if (error) {
    // Tentar buscar
    const { data: existing } = await supabase
      .from('dim_produto')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('codigo', codigo)
      .maybeSingle();

    if (existing) {
      produtoCache.set(cacheKey, existing.id);
      return existing.id;
    }

    throw new Error(`Falha ao criar produto ${codigo}: ${error.message}`);
  }

  produtoCache.set(cacheKey, created.id);
  return created.id;
}

// Limpar cache de produtos
export function clearProdutoCache(): void {
  produtoCache.clear();
}

// =============================================
// GARANTIR PERÍODO NA DIMENSÃO
// =============================================

async function ensurePeriodo(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  data: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('dim_periodo')
    .select('id')
    .eq('data', data)
    .single();

  if (existing) {
    return existing.id;
  }

  // Se não existir, a função populate_dim_periodo deveria ter criado
  // Criar manualmente como fallback
  const date = new Date(data);
  const diaSemana = date.getDay();
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const { data: created, error } = await supabase
    .from('dim_periodo')
    .insert({
      data,
      dia: date.getDate(),
      mes: date.getMonth() + 1,
      ano: date.getFullYear(),
      trimestre: Math.ceil((date.getMonth() + 1) / 3),
      semestre: date.getMonth() < 6 ? 1 : 2,
      dia_semana: diaSemana,
      dia_semana_nome: diasSemana[diaSemana],
      semana_ano: getWeekNumber(date),
      semana_mes: Math.ceil(date.getDate() / 7),
      is_fim_semana: diaSemana === 0 || diaSemana === 6,
      ano_mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      ano_semana: `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao criar período:', error);
    throw error;
  }

  return created.id;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// =============================================
// IMPORTAR ESTOQUE
// =============================================

async function importarEstoque(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  lojaId: string,
  dataImportacao: string,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  const startTime = Date.now();
  const erros: ImportError[] = [];
  let importados = 0;
  let atualizados = 0;
  let valorTotal = 0;
  let quantidadeTotal = 0;

  console.log(`[Import Estoque] Iniciando importação de ${rows.length} linhas...`);

  // 1. Carregar cache de produtos existentes
  await loadProdutosCache(supabase, organizationId);

  // 2. Identificar produtos que precisam ser criados
  const produtosNovos: Array<{ codigo: string; nome: string; comprador: string; ean?: string }> = [];
  const produtosSet = new Set<string>();

  for (const row of rows) {
    const parsed = parseEstoqueRow(row);
    if (!parsed.codigo) continue;

    const cacheKey = `${organizationId}:${parsed.codigo}`;
    if (!produtoCache.has(cacheKey) && !produtosSet.has(parsed.codigo)) {
      produtosNovos.push({
        codigo: parsed.codigo,
        nome: parsed.nome,
        comprador: parsed.comprador,
        ean: parsed.ean,
      });
      produtosSet.add(parsed.codigo);
    }
  }

  // 3. Criar produtos novos em bulk
  if (produtosNovos.length > 0) {
    await createProdutosBulk(supabase, organizationId, produtosNovos);
  }

  // 4. Processar linhas
  const periodoId = await ensurePeriodo(supabase, dataImportacao);
  const batch: unknown[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const parsed = parseEstoqueRow(rows[i]);

      if (!parsed.codigo) {
        erros.push({ linha: i + 2, mensagem: 'Código do produto vazio', critico: false });
        continue;
      }

      const produtoId = await ensureProduto(
        supabase,
        organizationId,
        parsed.codigo,
        parsed.nome,
        parsed.comprador,
        parsed.ean
      );

      // Classificar curva ABC baseado na participação acumulada
      let curvaABC = 'C';
      if (parsed.participacao_acumulada <= 80) curvaABC = 'A';
      else if (parsed.participacao_acumulada <= 95) curvaABC = 'B';

      batch.push({
        organization_id: organizationId,
        loja_id: lojaId,
        produto_id: produtoId,
        periodo_id: periodoId,
        data_importacao: dataImportacao,
        quantidade_estoque: parsed.quantidade_estoque,
        quantidade_reservada: parsed.quantidade_reservada,
        quantidade_disponivel: parsed.quantidade_disponivel,
        quantidade_pendente_compra: parsed.quantidade_pendente_compra,
        custo_unitario: parsed.custo_unitario,
        custo_unitario_liquido: parsed.custo_unitario,
        preco_venda: parsed.preco_venda,
        custo_total: Math.abs(parsed.custo_total),
        custo_total_liquido: Math.abs(parsed.custo_total),
        valor_estoque_venda: parsed.valor_estoque_venda,
        media_venda_dia: parsed.media_venda_dia,
        dias_estoque: parsed.dias_estoque,
        dias_ultima_entrada: parsed.dias_ultima_entrada,
        dias_ultima_venda: parsed.dias_sem_vendas,
        curva_abc: curvaABC,
        participacao_valor_pct: clampDecimal(parsed.participacao_acumulada),
        margem_percentual: clampDecimal(parsed.margem_percentual),
        markup: clampDecimal(parsed.markup),
      });

      valorTotal += Math.abs(parsed.custo_total);
      quantidadeTotal += parsed.quantidade_estoque;

      // Inserir em batches de 500
      if (batch.length >= 500) {
        const { error } = await supabase.from('fato_estoque').upsert(batch, {
          onConflict: 'organization_id,loja_id,produto_id,data_importacao',
        });
        if (error) {
          console.error('Erro ao inserir batch:', error);
          erros.push({ linha: i + 2, mensagem: `Erro no batch: ${error.message}`, critico: true });
        } else {
          importados += batch.length;
          console.log(`[Import Estoque] Progresso: ${importados}/${rows.length} (${Math.round(importados/rows.length*100)}%)`);
        }
        batch.length = 0;
      }
    } catch (error) {
      erros.push({
        linha: i + 2,
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        critico: false,
      });
    }
  }

  // Inserir batch restante
  if (batch.length > 0) {
    const { error } = await supabase.from('fato_estoque').upsert(batch, {
      onConflict: 'organization_id,loja_id,produto_id,data_importacao',
    });
    if (error) {
      console.error('Erro ao inserir batch final:', error);
      erros.push({ linha: rows.length, mensagem: `Erro no batch final: ${error.message}`, critico: true });
    } else {
      importados += batch.length;
    }
  }

  const duracao = Date.now() - startTime;
  console.log(`[Import Estoque] Concluído: ${importados} registros em ${duracao}ms`);

  return {
    success: erros.filter(e => e.critico).length === 0,
    tipo: 'estoque',
    registrosLidos: rows.length,
    registrosImportados: importados,
    registrosAtualizados: atualizados,
    registrosErro: erros.length,
    valorTotal,
    quantidadeTotal,
    erros,
    duracao,
  };
}

// =============================================
// IMPORTAR VENDAS
// =============================================

async function importarVendas(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  lojaId: string,
  dataImportacao: string,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  const startTime = Date.now();
  const erros: ImportError[] = [];
  let importados = 0;
  let valorTotal = 0;
  let quantidadeTotal = 0;

  console.log(`[Import Vendas] Iniciando importação de ${rows.length} linhas...`);

  // Carregar cache e criar produtos em bulk
  await loadProdutosCache(supabase, organizationId);

  const produtosNovos: Array<{ codigo: string; nome: string; comprador: string }> = [];
  const produtosSet = new Set<string>();
  for (const row of rows) {
    const parsed = parseVendasRow(row);
    if (!parsed.codigo) continue;
    const cacheKey = `${organizationId}:${parsed.codigo}`;
    if (!produtoCache.has(cacheKey) && !produtosSet.has(parsed.codigo)) {
      produtosNovos.push({ codigo: parsed.codigo, nome: parsed.nome, comprador: parsed.comprador });
      produtosSet.add(parsed.codigo);
    }
  }
  if (produtosNovos.length > 0) {
    await createProdutosBulk(supabase, organizationId, produtosNovos);
  }

  const periodoId = await ensurePeriodo(supabase, dataImportacao);
  const batch: unknown[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const parsed = parseVendasRow(rows[i]);

      if (!parsed.codigo) {
        erros.push({ linha: i + 2, mensagem: 'Código do produto vazio', critico: false });
        continue;
      }

      const produtoId = await ensureProduto(
        supabase,
        organizationId,
        parsed.codigo,
        parsed.nome,
        parsed.comprador
      );

      let curvaABC = 'C';
      if (parsed.participacao_acumulada <= 80) curvaABC = 'A';
      else if (parsed.participacao_acumulada <= 95) curvaABC = 'B';

      batch.push({
        organization_id: organizationId,
        loja_id: lojaId,
        produto_id: produtoId,
        periodo_id: periodoId,
        data_importacao: dataImportacao,
        quantidade_vendida: parsed.quantidade_vendida,
        valor_unitario_medio: parsed.valor_unitario_medio,
        valor_venda: parsed.valor_venda,
        custo_total: parsed.custo_total,
        margem_valor: parsed.margem_valor,
        margem_percentual: clampDecimal(parsed.margem_percentual),
        markup: clampDecimal(parsed.markup),
        markdown: clampDecimal(parsed.markdown),
        valor_promocao: parsed.valor_promocao,
        percentual_promocao: clampDecimal(parsed.percentual_promocao),
        curva_abc: curvaABC,
        participacao_valor_pct: clampDecimal(parsed.participacao_acumulada),
      });

      valorTotal += parsed.valor_venda;
      quantidadeTotal += parsed.quantidade_vendida;

      if (batch.length >= 500) {
        const { error } = await supabase.from('fato_vendas').upsert(batch, {
          onConflict: 'organization_id,loja_id,produto_id,data_importacao',
        });
        if (error) {
          erros.push({ linha: i + 2, mensagem: `Erro no batch: ${error.message}`, critico: true });
        } else {
          importados += batch.length;
        }
        batch.length = 0;
      }
    } catch (error) {
      erros.push({
        linha: i + 2,
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        critico: false,
      });
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('fato_vendas').upsert(batch, {
      onConflict: 'organization_id,loja_id,produto_id,data_importacao',
    });
    if (error) {
      erros.push({ linha: rows.length, mensagem: `Erro no batch final: ${error.message}`, critico: true });
    } else {
      importados += batch.length;
    }
  }

  return {
    success: erros.filter(e => e.critico).length === 0,
    tipo: 'vendas',
    registrosLidos: rows.length,
    registrosImportados: importados,
    registrosAtualizados: 0,
    registrosErro: erros.length,
    valorTotal,
    quantidadeTotal,
    erros,
    duracao: Date.now() - startTime,
  };
}

// =============================================
// IMPORTAR PERDAS
// =============================================

async function importarPerdas(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  lojaId: string,
  dataImportacao: string,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  const startTime = Date.now();
  const erros: ImportError[] = [];
  let importados = 0;
  let valorTotal = 0;
  let quantidadeTotal = 0;

  console.log(`[Import Perdas] Iniciando importação de ${rows.length} linhas...`);

  // Carregar cache e criar produtos em bulk
  await loadProdutosCache(supabase, organizationId);

  const produtosNovos: Array<{ codigo: string; nome: string; comprador: string }> = [];
  const produtosSet = new Set<string>();
  for (const row of rows) {
    const parsed = parsePerdasRow(row);
    if (!parsed.codigo) continue;
    const cacheKey = `${organizationId}:${parsed.codigo}`;
    if (!produtoCache.has(cacheKey) && !produtosSet.has(parsed.codigo)) {
      produtosNovos.push({ codigo: parsed.codigo, nome: parsed.nome, comprador: parsed.comprador });
      produtosSet.add(parsed.codigo);
    }
  }
  if (produtosNovos.length > 0) {
    await createProdutosBulk(supabase, organizationId, produtosNovos);
  }

  const periodoId = await ensurePeriodo(supabase, dataImportacao);
  const batch: unknown[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const parsed = parsePerdasRow(rows[i]);

      if (!parsed.codigo) {
        erros.push({ linha: i + 2, mensagem: 'Código do produto vazio', critico: false });
        continue;
      }

      const produtoId = await ensureProduto(
        supabase,
        organizationId,
        parsed.codigo,
        parsed.nome,
        parsed.comprador
      );

      batch.push({
        organization_id: organizationId,
        loja_id: lojaId,
        produto_id: produtoId,
        periodo_id: periodoId,
        data_importacao: dataImportacao,
        quantidade_perda: parsed.quantidade_perda,
        custo_perda: parsed.custo_perda,
        custo_perda_liquido: parsed.custo_perda_liquido,
        valor_venda_perdido: parsed.valor_venda_perdido,
        margem_perdida: parsed.margem_perdida,
        margem_percentual: clampDecimal(parsed.margem_percentual),
        markup: clampDecimal(parsed.markup),
        markdown: clampDecimal(parsed.markdown),
        tipo_perda: 'vencimento', // ABC de Perdas = perdas por vencimento/quebra
      });

      valorTotal += parsed.custo_perda_liquido;
      quantidadeTotal += parsed.quantidade_perda;

      if (batch.length >= 500) {
        const { error } = await supabase.from('fato_perdas').upsert(batch, {
          onConflict: 'organization_id,loja_id,produto_id,data_importacao,tipo_perda',
        });
        if (error) {
          erros.push({ linha: i + 2, mensagem: `Erro no batch: ${error.message}`, critico: true });
        } else {
          importados += batch.length;
        }
        batch.length = 0;
      }
    } catch (error) {
      erros.push({
        linha: i + 2,
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        critico: false,
      });
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('fato_perdas').upsert(batch, {
      onConflict: 'organization_id,loja_id,produto_id,data_importacao,tipo_perda',
    });
    if (error) {
      erros.push({ linha: rows.length, mensagem: `Erro no batch final: ${error.message}`, critico: true });
    } else {
      importados += batch.length;
    }
  }

  return {
    success: erros.filter(e => e.critico).length === 0,
    tipo: 'perdas',
    registrosLidos: rows.length,
    registrosImportados: importados,
    registrosAtualizados: 0,
    registrosErro: erros.length,
    valorTotal,
    quantidadeTotal,
    erros,
    duracao: Date.now() - startTime,
  };
}

// =============================================
// IMPORTAR RUPTURAS
// =============================================

async function importarRupturas(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  lojaId: string,
  dataImportacao: string,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  const startTime = Date.now();
  const erros: ImportError[] = [];
  let importados = 0;
  let valorTotal = 0;
  let quantidadeTotal = 0;

  console.log(`[Import Rupturas] Iniciando importação de ${rows.length} linhas...`);

  // Carregar cache e criar produtos em bulk
  await loadProdutosCache(supabase, organizationId);

  const produtosNovos: Array<{ codigo: string; nome: string; comprador: string }> = [];
  const produtosSet = new Set<string>();
  for (const row of rows) {
    const parsed = parseRupturasRow(row);
    if (!parsed.codigo) continue;
    const cacheKey = `${organizationId}:${parsed.codigo}`;
    if (!produtoCache.has(cacheKey) && !produtosSet.has(parsed.codigo)) {
      produtosNovos.push({ codigo: parsed.codigo, nome: parsed.nome, comprador: parsed.comprador });
      produtosSet.add(parsed.codigo);
    }
  }
  if (produtosNovos.length > 0) {
    await createProdutosBulk(supabase, organizationId, produtosNovos);
  }

  const periodoId = await ensurePeriodo(supabase, dataImportacao);
  const batch: unknown[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const parsed = parseRupturasRow(rows[i]);

      if (!parsed.codigo) {
        erros.push({ linha: i + 2, mensagem: 'Código do produto vazio', critico: false });
        continue;
      }

      const produtoId = await ensureProduto(
        supabase,
        organizationId,
        parsed.codigo,
        parsed.nome,
        parsed.comprador
      );

      batch.push({
        organization_id: organizationId,
        loja_id: lojaId,
        produto_id: produtoId,
        periodo_id: periodoId,
        data_importacao: dataImportacao,
        quantidade_perdida: parsed.quantidade_perdida,
        valor_venda_perdida: parsed.valor_venda_perdida,
        custo_ruptura: parsed.custo_ruptura,
        margem_perdida: parsed.margem_perdida,
        margem_percentual: clampDecimal(parsed.margem_percentual),
        markup: clampDecimal(parsed.markup),
        markdown: clampDecimal(parsed.markdown),
      });

      valorTotal += parsed.valor_venda_perdida;
      quantidadeTotal += parsed.quantidade_perdida;

      if (batch.length >= 500) {
        const { error } = await supabase.from('fato_rupturas').upsert(batch, {
          onConflict: 'organization_id,loja_id,produto_id,data_importacao',
        });
        if (error) {
          erros.push({ linha: i + 2, mensagem: `Erro no batch: ${error.message}`, critico: true });
        } else {
          importados += batch.length;
        }
        batch.length = 0;
      }
    } catch (error) {
      erros.push({
        linha: i + 2,
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        critico: false,
      });
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('fato_rupturas').upsert(batch, {
      onConflict: 'organization_id,loja_id,produto_id,data_importacao',
    });
    if (error) {
      erros.push({ linha: rows.length, mensagem: `Erro no batch final: ${error.message}`, critico: true });
    } else {
      importados += batch.length;
    }
  }

  return {
    success: erros.filter(e => e.critico).length === 0,
    tipo: 'rupturas',
    registrosLidos: rows.length,
    registrosImportados: importados,
    registrosAtualizados: 0,
    registrosErro: erros.length,
    valorTotal,
    quantidadeTotal,
    erros,
    duracao: Date.now() - startTime,
  };
}

// =============================================
// FUNÇÃO PRINCIPAL DE IMPORTAÇÃO
// =============================================

export async function importarRelatorioABC(
  tipo: TipoRelatorioABC,
  organizationId: string,
  lojaId: string,
  dataImportacao: string,
  csvContent: string
): Promise<ImportResult> {
  const supabase = getSupabaseAdmin();
  const { rows } = parseCSV(csvContent, ';');

  // Registrar início da importação (upsert para permitir reimportação)
  const { data: historico, error: histError } = await supabase
    .from('historico_importacoes_varejo')
    .upsert(
      {
        organization_id: organizationId,
        loja_id: lojaId,
        tipo_relatorio: tipo,
        data_referencia: dataImportacao,
        registros_lidos: rows.length,
        status: 'processando',
        iniciado_em: new Date().toISOString(),
        // Resetar campos para nova importação
        registros_importados: 0,
        registros_erro: 0,
        concluido_em: null,
        erro_mensagem: null,
      },
      {
        onConflict: 'organization_id,loja_id,tipo_relatorio,data_referencia',
      }
    )
    .select('id')
    .single();

  if (histError) {
    console.error('Erro ao criar histórico:', histError);
  }

  let resultado: ImportResult;

  switch (tipo) {
    case 'estoque':
      resultado = await importarEstoque(supabase, organizationId, lojaId, dataImportacao, rows);
      break;
    case 'vendas':
      resultado = await importarVendas(supabase, organizationId, lojaId, dataImportacao, rows);
      break;
    case 'perdas':
      resultado = await importarPerdas(supabase, organizationId, lojaId, dataImportacao, rows);
      break;
    case 'rupturas':
      resultado = await importarRupturas(supabase, organizationId, lojaId, dataImportacao, rows);
      break;
    default:
      throw new Error(`Tipo de relatório não suportado: ${tipo}`);
  }

  // Atualizar histórico
  if (historico) {
    await supabase
      .from('historico_importacoes_varejo')
      .update({
        registros_importados: resultado.registrosImportados,
        registros_erro: resultado.registrosErro,
        valor_total_processado: resultado.valorTotal,
        quantidade_total_processada: resultado.quantidadeTotal,
        status: resultado.success ? 'concluido' : 'erro',
        duracao_ms: resultado.duracao,
        concluido_em: new Date().toISOString(),
        erro_mensagem: resultado.erros.length > 0
          ? resultado.erros.slice(0, 5).map(e => e.mensagem).join('; ')
          : null,
      })
      .eq('id', historico.id);
  }

  return resultado;
}

// =============================================
// CONSOLIDAR MÉTRICAS APÓS IMPORTAÇÃO
// =============================================

export async function consolidarMetricasAposImportacao(
  organizationId: string,
  lojaId: string,
  data: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Chamar função de consolidação
  const { error } = await supabase.rpc('consolidar_metricas_loja', {
    p_organization_id: organizationId,
    p_loja_id: lojaId,
    p_periodo: data,
    p_tipo_periodo: 'diario',
  });

  if (error) {
    console.error('Erro ao consolidar métricas:', error);
    throw error;
  }

  // Se for mensal, consolidar também mensal
  const dataObj = new Date(data);
  const primeiroDiaMes = new Date(dataObj.getFullYear(), dataObj.getMonth(), 1);

  await supabase.rpc('consolidar_metricas_loja', {
    p_organization_id: organizationId,
    p_loja_id: lojaId,
    p_periodo: primeiroDiaMes.toISOString().split('T')[0],
    p_tipo_periodo: 'mensal',
  });
}
