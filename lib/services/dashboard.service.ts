/**
 * DashboardService - Lógica otimizada do Dashboard
 *
 * Otimizações:
 * 1. Queries com JOINs em vez de N+1
 * 2. Pré-carregamento batch de entidades
 * 3. Cache de entidades no Redis
 * 4. Processamento eficiente em memória
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { UserCache, StoreCache, ProductCache } from '@/lib/services/cache.service';

// Tipos
interface DashboardData {
  kpis: {
    totalSolicitacoes: number;
    totalUsuarios: number;
    usuariosAtivos: number;
    totalLojas: number;
    totalItens: number;
    lojasCom50MaisProfissionais: number;
    solicitacoesHoje: number;
    solicitacoesOntem: number;
    mediaItensPorSolicitacao: number;
    taxaConversao: number;
    solicitacoesUltimos7Dias: number;
    mudancaSemanal: number;
  };
  financeiro: {
    valorTotalSolicitado: number;
    valorTotalAprovado: number;
    valorTotalRejeitado: number;
    valorTotalPendente: number;
    itensAprovados: number;
    itensRejeitados: number;
    itensPendentes: number;
    taxaAprovacao: number;
    taxaRejeicao: number;
    mediaValorDiario: number;
    projecaoSemanal: number;
  };
  solicitacoesPorStatus: {
    pending: number;
    batched: number;
    closed: number;
  };
  solicitacoesPorLoja: Array<{ storeId: string; storeName: string; count: number }>;
  solicitacoesRecentes: any[];
  chartData: Array<{ date: string; count: number }>;
  topProdutos: any[];
  periodComparisonData: any[];
  insights: any[];
  rankingPorLoja: any[];
  rankingPorComprador: any[];
  rankingPorProduto: any[];
  projecaoFinanceira: any[];
  itensStatusChartData: any[];
  paretoFinanceiro: any[];
  valorChartData: any[];
  lastUpdated: string;
}

// Cache local (dentro do request) para evitar queries duplicadas
class EntityLookup {
  private users: Map<string, { name: string; role: string }> = new Map();
  private stores: Map<string, string> = new Map();
  private products: Map<string, { name: string; ean?: string; comprador?: string }> = new Map();

  async preloadUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    // Tentar obter do cache Redis primeiro
    const uncached: string[] = [];
    for (const id of uniqueIds) {
      const cached = await UserCache.get(id);
      if (cached) {
        this.users.set(id, { name: cached.display_name || 'Desconhecido', role: cached.role || 'unknown' });
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return;

    // Buscar do banco em batch
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, display_name, role')
      .in('id', uncached);

    if (data) {
      for (const user of data) {
        this.users.set(user.id, {
          name: user.display_name || 'Desconhecido',
          role: user.role || 'unknown',
        });
        // Salvar no cache Redis (não bloquear)
        UserCache.set(user.id, user).catch(() => {});
      }
    }
  }

  async preloadStores(storeIds: string[]) {
    const uniqueIds = [...new Set(storeIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    // Tentar obter do cache Redis primeiro
    const uncached: string[] = [];
    for (const id of uniqueIds) {
      const cached = await StoreCache.get(id);
      if (cached) {
        this.stores.set(id, cached.name || 'Desconhecida');
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return;

    // Buscar do banco em batch
    const { data } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .in('id', uncached);

    if (data) {
      for (const store of data) {
        this.stores.set(store.id, store.name || 'Desconhecida');
        // Salvar no cache Redis (não bloquear)
        StoreCache.set(store.id, store).catch(() => {});
      }
    }
  }

  async preloadProducts(productIds: string[]) {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    // Tentar obter do cache Redis primeiro
    const uncached: string[] = [];
    for (const id of uniqueIds) {
      const cached = await ProductCache.get(id);
      if (cached) {
        this.products.set(id, {
          name: cached.nome || cached.name || 'Produto Desconhecido',
          ean: cached.ean,
          comprador: cached.comprador || cached.buyer,
        });
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return;

    // Buscar do banco em batch
    const { data } = await supabaseAdmin
      .from('products')
      .select('id, nome, name, ean, comprador, buyer')
      .in('id', uncached);

    if (data) {
      for (const product of data) {
        this.products.set(product.id, {
          name: product.nome || product.name || 'Produto Desconhecido',
          ean: product.ean,
          comprador: product.comprador || product.buyer,
        });
        // Salvar no cache Redis (não bloquear)
        ProductCache.set(product.id, product).catch(() => {});
      }
    }
  }

  getUserName(userId?: string): string {
    if (!userId) return 'Desconhecido';
    return this.users.get(userId)?.name || 'Desconhecido';
  }

  getStoreName(storeId?: string): string {
    if (!storeId) return 'Desconhecida';
    return this.stores.get(storeId) || 'Desconhecida';
  }

  getProduct(productId?: string): { name: string; ean?: string; comprador?: string } | undefined {
    if (!productId) return undefined;
    return this.products.get(productId);
  }
}

export async function buildDashboardData(): Promise<DashboardData> {
  const startTime = Date.now();
  console.log('[Dashboard] Iniciando build do dashboard...');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ========================================
  // QUERY 1: Solicitações com itens (JOIN)
  // Nota: solicitacao_itens usa 'ean' diretamente, não 'product_id'
  // ========================================
  const { data: solicitacoesComItens, error: solicitacoesError } = await supabaseAdmin
    .from('solicitacoes')
    .select(`
      id,
      status,
      created_at,
      created_by,
      store_id,
      itens:solicitacao_itens (
        id,
        ean,
        sku,
        descricao,
        preco_atual,
        qtd,
        status,
        comprador,
        created_at
      )
    `)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });

  if (solicitacoesError) {
    if (solicitacoesError.code !== 'PGRST205') {
      throw solicitacoesError;
    }
  }

  const solicitacoesData = solicitacoesComItens || [];
  console.log(`[Dashboard] Query 1: ${solicitacoesData.length} solicitações com itens`);

  // ========================================
  // QUERY 2 & 3: Users e Stores (paralelo)
  // ========================================
  const [usersResult, storesResult] = await Promise.all([
    supabaseAdmin.from('users').select('id, display_name, role, active, store_id, loja_id'),
    supabaseAdmin.from('stores').select('id, name'),
  ]);

  const usersData = usersResult.data || [];
  const storesData = storesResult.data || [];
  console.log(`[Dashboard] Query 2&3: ${usersData.length} users, ${storesData.length} stores`);

  // Criar lookup de entidades
  const lookup = new EntityLookup();

  // Extrair IDs únicos
  const userIds = new Set<string>();
  const storeIds = new Set<string>();
  const productIds = new Set<string>();

  for (const sol of solicitacoesData) {
    if (sol.created_by) userIds.add(sol.created_by);
    if (sol.store_id) storeIds.add(sol.store_id);

    for (const item of (sol.itens || [])) {
      // solicitacao_itens usa 'ean' como identificador, não product_id
      if (item.ean) productIds.add(item.ean);
      if (item.comprador) userIds.add(item.comprador);
    }
  }

  // Pré-carregar entidades em batch (paralelo)
  await Promise.all([
    lookup.preloadUsers([...userIds]),
    lookup.preloadStores([...storeIds]),
    lookup.preloadProducts([...productIds]),
  ]);
  console.log(`[Dashboard] Entidades pré-carregadas: ${userIds.size} users, ${storeIds.size} stores, ${productIds.size} products`);

  // ========================================
  // PROCESSAMENTO EM MEMÓRIA
  // ========================================

  // Contadores e agregações
  const statusCounters = { pending: 0, batched: 0, closed: 0 };
  const solicitacoesPorDia: Record<string, number> = {};
  const solicitacoesPorLojaMap: Record<string, { count: number; name: string }> = {};
  const itensPorLoja: Record<string, { count: number; name: string }> = {};
  const itensPorComprador: Record<string, { count: number; name: string }> = {};
  const itensPorProduto: Record<string, { count: number; name: string; ean?: string }> = {};
  const produtosComValor: Record<string, { count: number; name: string; valor: number; ean?: string }> = {};
  const valorPorDia: Record<string, number> = {};
  const itensPorDiaStatus: Record<string, { approved: number; rejected: number; pending: number }> = {};

  let solicitacoesHoje = 0;
  let solicitacoesOntem = 0;
  let solicitacoesUltimos7Dias = 0;
  let solicitacoesUltimos7a14Dias = 0;
  let totalItens = 0;
  let valorTotalSolicitado = 0;
  let valorTotalAprovado = 0;
  let valorTotalRejeitado = 0;
  let valorTotalPendente = 0;
  let itensAprovados = 0;
  let itensRejeitados = 0;
  let itensPendentes = 0;

  const solicitacoesRecentes: any[] = [];

  for (const sol of solicitacoesData) {
    // Status counter
    const status = ['pending', 'batched', 'closed'].includes(String(sol.status))
      ? (sol.status as 'pending' | 'batched' | 'closed')
      : 'pending';
    statusCounters[status]++;

    const createdAt = new Date(sol.created_at);
    const dateKey = createdAt.toISOString().split('T')[0];

    // Solicitações por dia
    if (createdAt >= thirtyDaysAgo) {
      solicitacoesPorDia[dateKey] = (solicitacoesPorDia[dateKey] || 0) + 1;
    }

    // Contagem por período
    if (createdAt >= todayStart) solicitacoesHoje++;
    if (createdAt >= yesterday && createdAt < todayStart) solicitacoesOntem++;
    if (createdAt >= sevenDaysAgo) solicitacoesUltimos7Dias++;
    if (createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo) solicitacoesUltimos7a14Dias++;

    // Solicitações por loja
    if (sol.store_id) {
      if (!solicitacoesPorLojaMap[sol.store_id]) {
        solicitacoesPorLojaMap[sol.store_id] = {
          count: 0,
          name: lookup.getStoreName(sol.store_id),
        };
      }
      solicitacoesPorLojaMap[sol.store_id].count++;
    }

    // Recentes (top 10)
    if (solicitacoesRecentes.length < 10) {
      solicitacoesRecentes.push({
        id: sol.id,
        status,
        createdAt: createdAt.toISOString(),
        userName: lookup.getUserName(sol.created_by),
        storeName: lookup.getStoreName(sol.store_id),
        storeId: sol.store_id,
      });
    }

    // Processar itens
    for (const item of (sol.itens || [])) {
      // solicitacao_itens usa 'ean' como identificador principal
      const ean = item.ean;
      const descricao = item.descricao;

      if (!ean && !descricao) continue;

      const effectiveProductId = ean || `desc_${(descricao || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50)}`;

      totalItens++;

      // Valor do item
      const precoAtual = parseFloat(item.preco_atual) || 0;
      const quantidade = parseInt(item.qtd) || 1;
      const valorItem = precoAtual * quantidade;
      const itemStatus = item.status || 'pending';

      valorTotalSolicitado += valorItem;

      if (itemStatus === 'approved') {
        valorTotalAprovado += valorItem;
        itensAprovados++;
      } else if (itemStatus === 'rejected') {
        valorTotalRejeitado += valorItem;
        itensRejeitados++;
      } else {
        valorTotalPendente += valorItem;
        itensPendentes++;
      }

      // Valor por dia
      const itemDate = new Date(item.created_at || sol.created_at);
      const itemDateKey = itemDate.toISOString().split('T')[0];
      if (itemDate >= thirtyDaysAgo) {
        valorPorDia[itemDateKey] = (valorPorDia[itemDateKey] || 0) + valorItem;

        if (!itensPorDiaStatus[itemDateKey]) {
          itensPorDiaStatus[itemDateKey] = { approved: 0, rejected: 0, pending: 0 };
        }
        if (itemStatus === 'approved') itensPorDiaStatus[itemDateKey].approved++;
        else if (itemStatus === 'rejected') itensPorDiaStatus[itemDateKey].rejected++;
        else itensPorDiaStatus[itemDateKey].pending++;
      }

      // Info do produto (usa ean como identificador)
      const produtoInfo = lookup.getProduct(ean);
      const productName = produtoInfo?.name || descricao || 'Produto Desconhecido';
      const productEan = produtoInfo?.ean || item.ean;

      // Itens por produto
      if (!itensPorProduto[effectiveProductId]) {
        itensPorProduto[effectiveProductId] = { count: 0, name: productName, ean: productEan };
      }
      itensPorProduto[effectiveProductId].count++;

      // Produtos com valor
      if (!produtosComValor[effectiveProductId]) {
        produtosComValor[effectiveProductId] = { count: 0, name: productName, valor: 0, ean: productEan };
      }
      produtosComValor[effectiveProductId].count++;
      produtosComValor[effectiveProductId].valor += valorItem;

      // Itens por loja
      if (sol.store_id) {
        if (!itensPorLoja[sol.store_id]) {
          itensPorLoja[sol.store_id] = { count: 0, name: lookup.getStoreName(sol.store_id) };
        }
        itensPorLoja[sol.store_id].count++;
      }

      // Itens por comprador
      // O campo comprador pode ser um nome (texto) ou um UUID
      const compradorValue = produtoInfo?.comprador || item.comprador;
      if (compradorValue) {
        const compradorStr = String(compradorValue).trim();
        if (compradorStr) {
          // Verificar se é um UUID (para buscar o nome) ou um nome direto
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compradorStr);
          const compradorName = isUuid ? lookup.getUserName(compradorStr) : compradorStr;
          const compradorKey = compradorStr.toLowerCase(); // Normalizar chave para evitar duplicatas

          if (!itensPorComprador[compradorKey]) {
            itensPorComprador[compradorKey] = { count: 0, name: compradorName };
          }
          itensPorComprador[compradorKey].count++;
        }
      }
    }
  }

  // ========================================
  // CÁLCULOS FINAIS
  // ========================================

  const totalSolicitacoes = solicitacoesData.length;
  const totalUsuarios = usersData.length;
  const usuariosAtivos = usersData.filter((u: any) => u.active !== false).length;
  const totalLojas = storesData.length;

  // Lojas com 50+ profissionais
  const usuariosPorLoja: Record<string, number> = {};
  for (const u of usersData) {
    const storeKey = u.store_id || u.loja_id;
    if (storeKey) {
      usuariosPorLoja[storeKey] = (usuariosPorLoja[storeKey] || 0) + 1;
    }
  }
  const lojasCom50MaisProfissionais = Object.values(usuariosPorLoja).filter(n => n >= 50).length;

  // KPIs
  const mediaItensPorSolicitacao = totalSolicitacoes > 0
    ? Number((totalItens / totalSolicitacoes).toFixed(1))
    : 0;

  const solicitacoesProcessadas = statusCounters.closed + statusCounters.batched;
  const taxaConversao = totalSolicitacoes > 0
    ? Number(((solicitacoesProcessadas / totalSolicitacoes) * 100).toFixed(1))
    : 0;

  const mudancaSemanal = solicitacoesUltimos7a14Dias > 0
    ? Number((((solicitacoesUltimos7Dias - solicitacoesUltimos7a14Dias) / solicitacoesUltimos7a14Dias) * 100).toFixed(0))
    : 0;

  // Taxas de aprovação
  const totalItensProcessados = itensAprovados + itensRejeitados + itensPendentes;
  const taxaAprovacao = totalItensProcessados > 0
    ? Number(((itensAprovados / totalItensProcessados) * 100).toFixed(1))
    : 0;
  const taxaRejeicao = totalItensProcessados > 0
    ? Number(((itensRejeitados / totalItensProcessados) * 100).toFixed(1))
    : 0;

  // Chart data
  const chartData = Object.entries(solicitacoesPorDia)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Solicitações por loja
  const solicitacoesPorLoja = Object.entries(solicitacoesPorLojaMap)
    .map(([storeId, data]) => ({
      storeId,
      storeName: data.name,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Top produtos
  const topProdutos = Object.entries(itensPorProduto)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      count: data.count,
      ean: data.ean,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Rankings
  const rankingPorLoja = Object.entries(itensPorLoja)
    .map(([id, data]) => ({ id, name: data.name, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const rankingPorComprador = Object.entries(itensPorComprador)
    .map(([id, data]) => ({ id, name: data.name, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const rankingPorProduto = Object.entries(itensPorProduto)
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
      details: data.ean ? `EAN: ${data.ean}` : (id.startsWith('desc_') ? 'Produto sem código de barras' : `ID: ${id}`),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // Valor chart data
  const valorChartData = Object.entries(valorPorDia)
    .map(([date, valor]) => ({ date, valor: Number(valor.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Projeção financeira
  const ultimosValores = valorChartData.slice(-7);
  const mediaValorDiario = ultimosValores.length > 0
    ? ultimosValores.reduce((sum, d) => sum + d.valor, 0) / ultimosValores.length
    : 0;

  const projecaoFinanceira: Array<{ date: string; valor: number; projetado: boolean }> = [];
  for (const d of valorChartData) {
    projecaoFinanceira.push({ date: d.date, valor: d.valor, projetado: false });
  }
  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const tendencia = mudancaSemanal / 100;
    const valorProjetado = mediaValorDiario * (1 + (tendencia * i / 7));
    projecaoFinanceira.push({
      date: futureDate.toISOString().split('T')[0],
      valor: Number(valorProjetado.toFixed(2)),
      projetado: true,
    });
  }

  // Itens status chart data
  const itensStatusChartData = Object.entries(itensPorDiaStatus)
    .map(([date, status]) => ({
      date,
      aprovados: status.approved,
      rejeitados: status.rejected,
      pendentes: status.pending,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Pareto financeiro
  const paretoFinanceiro = Object.entries(produtosComValor)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      count: data.count,
      valor: Number(data.valor.toFixed(2)),
      ean: data.ean,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 20);

  const valorTotalPareto = paretoFinanceiro.reduce((sum, p) => sum + p.valor, 0);
  let acumuladoPareto = 0;
  const paretoComAcumulado = paretoFinanceiro.map(p => {
    acumuladoPareto += p.valor;
    return {
      ...p,
      percentualAcumulado: valorTotalPareto > 0
        ? Number(((acumuladoPareto / valorTotalPareto) * 100).toFixed(1))
        : 0,
    };
  });

  // Period comparison
  const periodComparisonData: Array<{ date: string; current: number; previous: number }> = [];
  for (let i = 0; i < 14; i++) {
    const currentDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const previousDate = new Date(now.getTime() - (i + 14) * 24 * 60 * 60 * 1000);
    const currentKey = currentDate.toISOString().split('T')[0];
    const previousKey = previousDate.toISOString().split('T')[0];
    periodComparisonData.unshift({
      date: currentKey,
      current: solicitacoesPorDia[currentKey] || 0,
      previous: solicitacoesPorDia[previousKey] || 0,
    });
  }

  // Insights
  const insights: any[] = [];

  if (mudancaSemanal > 10) {
    insights.push({
      type: 'success',
      title: 'Crescimento Acelerado',
      description: `As solicitações cresceram ${mudancaSemanal}% na última semana.`,
      icon: 'trending-up',
    });
  } else if (mudancaSemanal < -10) {
    insights.push({
      type: 'warning',
      title: 'Redução de Atividade',
      description: `As solicitações reduziram ${Math.abs(mudancaSemanal)}% na última semana.`,
      icon: 'trending-down',
    });
  }

  if (taxaConversao >= 95) {
    insights.push({
      type: 'success',
      title: 'Taxa de Processamento Excelente',
      description: `${taxaConversao}% das solicitações foram processadas.`,
      icon: 'check',
    });
  } else if (taxaConversao < 50) {
    insights.push({
      type: 'alert',
      title: 'Taxa de Processamento Baixa',
      description: `Apenas ${taxaConversao}% das solicitações foram processadas.`,
      icon: 'alert',
    });
  }

  if (statusCounters.pending === 0 && statusCounters.batched === 0) {
    insights.push({
      type: 'success',
      title: 'Tudo Processado',
      description: 'Não há solicitações pendentes.',
      icon: 'check',
    });
  } else if (statusCounters.pending > totalSolicitacoes * 0.3) {
    insights.push({
      type: 'warning',
      title: 'Alto Volume Pendente',
      description: `${statusCounters.pending} solicitações aguardando análise.`,
      icon: 'alert',
    });
  }

  if (topProdutos.length > 0) {
    insights.push({
      type: 'info',
      title: 'Produto Mais Solicitado',
      description: `"${topProdutos[0].productName}" lidera com ${topProdutos[0].count} solicitações.`,
      icon: 'info',
    });
  }

  const duration = Date.now() - startTime;
  console.log(`[Dashboard] Build concluído em ${duration}ms`);

  return {
    kpis: {
      totalSolicitacoes,
      totalUsuarios,
      usuariosAtivos,
      totalLojas,
      totalItens,
      lojasCom50MaisProfissionais,
      solicitacoesHoje,
      solicitacoesOntem,
      mediaItensPorSolicitacao,
      taxaConversao,
      solicitacoesUltimos7Dias,
      mudancaSemanal,
    },
    financeiro: {
      valorTotalSolicitado: Number(valorTotalSolicitado.toFixed(2)),
      valorTotalAprovado: Number(valorTotalAprovado.toFixed(2)),
      valorTotalRejeitado: Number(valorTotalRejeitado.toFixed(2)),
      valorTotalPendente: Number(valorTotalPendente.toFixed(2)),
      itensAprovados,
      itensRejeitados,
      itensPendentes,
      taxaAprovacao,
      taxaRejeicao,
      mediaValorDiario: Number(mediaValorDiario.toFixed(2)),
      projecaoSemanal: Number((mediaValorDiario * 7).toFixed(2)),
    },
    solicitacoesPorStatus: statusCounters,
    solicitacoesPorLoja,
    solicitacoesRecentes,
    chartData,
    topProdutos,
    periodComparisonData,
    insights,
    rankingPorLoja,
    rankingPorComprador,
    rankingPorProduto,
    projecaoFinanceira,
    itensStatusChartData,
    paretoFinanceiro: paretoComAcumulado,
    valorChartData,
    lastUpdated: new Date().toISOString(),
  };
}
