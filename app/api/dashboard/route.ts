import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Força a rota a ser dinâmica e não fazer cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  console.log('[DASHBOARD] GET request received');

  try {
    console.log('[DASHBOARD] Starting data fetch');
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Buscar todas as solicitações (excluindo rascunhos)
    const { data: solicitacoesDataResponse, error: solicitacoesError } = await supabaseAdmin
      .from('solicitacoes')
      .select('*')
      .neq('status', 'draft');

    let solicitacoesData: any[] = [];
    if (solicitacoesError) {
      if (solicitacoesError.code === 'PGRST205') {
        console.warn('[DASHBOARD] Tabela solicitacoes não encontrada, retornando dados vazios.');
      } else {
        throw solicitacoesError;
      }
    } else {
      solicitacoesData = solicitacoesDataResponse || [];
    }

    const totalSolicitacoes = solicitacoesData.length;

    // Contar solicitações por status
    const statusCounters = {
      pending: 0,
      batched: 0,
      closed: 0,
    };

    const solicitacoesRecentes: any[] = [];
    const solicitacoesPorDia: { [key: string]: number } = {};
    const produtosContagem: Record<string, { count: number; name: string; ean?: string }> = {};

    // Rankings: contagem de itens
    const itensPorLoja: Record<string, { count: number; name: string }> = {};
    const itensPorComprador: Record<string, { count: number; name: string }> = {};
    const itensPorProduto: Record<string, { count: number; name: string; ean?: string }> = {};

    // Cache de usuários, lojas e produtos para evitar consultas duplicadas
    const usersCache: Record<string, { name: string; role: string } | null> = {};
    const storesCache: Record<string, string> = {};
    const produtoCache = new Map<string, { name: string; ean?: string; comprador?: string }>();

    const getUserName = async (userId?: string): Promise<string> => {
      if (!userId) return 'Desconhecido';

      if (usersCache[userId] !== undefined) {
        return usersCache[userId]?.name || 'Desconhecido';
      }

      try {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('display_name, role')
          .eq('id', userId)
          .single();

        if (!error && data) {
          const userName = data.display_name || 'Desconhecido';
          usersCache[userId] = { name: userName, role: data.role || 'unknown' };
          return userName;
        }
      } catch (error) {
        console.error('Error fetching user:', userId, error);
      }

      usersCache[userId] = null;
      return 'Desconhecido';
    };

    const getStoreName = async (storeId?: string): Promise<string> => {
      if (!storeId) return 'Desconhecida';

      if (storesCache[storeId]) return storesCache[storeId];

      try {
        const { data, error } = await supabaseAdmin
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();

        if (!error && data) {
          storesCache[storeId] = data.name;
          return data.name;
        }
      } catch (error) {
        console.error('Error fetching store:', error);
      }

      storesCache[storeId] = 'Desconhecida';
      return 'Desconhecida';
    };

    const getProdutoInfo = async (productId?: string, ean?: string) => {
      const cacheKey = productId || (ean ? `ean:${ean}` : undefined);
      if (cacheKey && produtoCache.has(cacheKey)) return produtoCache.get(cacheKey);

      let data: any | undefined;

      // Buscar por ID primeiro
      if (productId) {
        try {
          const { data: prodData, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

          if (!error && prodData) data = prodData;
        } catch (error) {
          console.error('Error fetching product by id:', error);
        }
      }

      // Se não encontrou, buscar por EAN
      if (!data && ean) {
        try {
          const { data: prodData, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .or(`id.eq.${ean},ean.eq.${ean}`)
            .limit(1)
            .single();

          if (!error && prodData) data = prodData;
        } catch (error) {
          console.error('Error fetching product by EAN:', error);
        }
      }

      if (!data) return undefined;

      const info = {
        name: data.nome || data.name || data.descricao || data.description || data.ean || 'Produto Desconhecido',
        ean: data.ean || ean,
        comprador: data.comprador || data.buyer || data.comprador_id || data.buyer_id,
      };

      if (cacheKey) produtoCache.set(cacheKey, info);
      return info;
    };

    let solicitacoesHoje = 0;
    let solicitacoesOntem = 0;
    let solicitacoesUltimos7Dias = 0;
    let solicitacoesUltimos7a14Dias = 0;
    let totalItens = 0;

    // Processar cada solicitação
    for (const solicitacao of solicitacoesData || []) {
      const status = ['pending', 'batched', 'closed'].includes(String(solicitacao.status))
        ? solicitacao.status
        : 'pending';

      if (status in statusCounters) statusCounters[status as keyof typeof statusCounters]++;

      // Adicionar solicitações recentes (até 10)
      if (solicitacoesRecentes.length < 10) {
        const createdAt = new Date(solicitacao.created_at || new Date());
        const userName = await getUserName(solicitacao.created_by);
        const storeName = await getStoreName(solicitacao.store_id);

        solicitacoesRecentes.push({
          id: solicitacao.id,
          status,
          createdAt: createdAt.toISOString(),
          userName,
          storeName,
          storeId: solicitacao.store_id,
        });
      }

      // Contar solicitações por dia (últimos 30 dias)
      const createdAt = new Date(solicitacao.created_at);
      if (createdAt >= thirtyDaysAgo) {
        const dateKey = createdAt.toISOString().split('T')[0];
        solicitacoesPorDia[dateKey] = (solicitacoesPorDia[dateKey] || 0) + 1;
      }

      // Contar solicitações por período
      if (createdAt >= todayStart) solicitacoesHoje++;
      if (createdAt >= yesterday && createdAt < todayStart) solicitacoesOntem++;
      if (createdAt >= sevenDaysAgo) solicitacoesUltimos7Dias++;
      if (createdAt >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) && createdAt < sevenDaysAgo) {
        solicitacoesUltimos7a14Dias++;
      }

      // Buscar itens da solicitação (substituindo subcollection por foreign key)
      try {
        const { data: itensData, error: itensError } = await supabaseAdmin
          .from('solicitacao_itens')
          .select('*')
          .eq('solicitacao_id', solicitacao.id);

        if (itensError || !itensData) continue;

        const storeId = solicitacao.store_id;

        for (const item of itensData) {
          // Suportar tanto productId quanto EAN direto no item
          let productId = item.product_id || item.produto_id;
          const ean = item.ean;
          const descricao = item.descricao || item.description || item.nome || item.name;

          // Se não tem productId mas tem EAN, usar o EAN como identificador
          if (!productId && ean) {
            productId = ean;
          }

          // Se não tem nem productId nem EAN, usar a descrição como identificador
          if (!productId && descricao) {
            productId = `desc_${descricao.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50)}`;
          }

          // Buscar informações do produto para obter o comprador correto
          const produtoInfo = await getProdutoInfo(productId, ean);

          // PRIORIZAR o comprador do PRODUTO, depois item
          let compradorKey: string | undefined;
          let compradorNome: string | undefined;

          if (produtoInfo?.comprador) {
            const compradorValue = String(produtoInfo.comprador);
            compradorKey = compradorValue;

            // Verificar se parece ser um ID de usuário ou um nome direto
            if (compradorValue.length > 20 || compradorValue.includes('-')) {
              compradorNome = await getUserName(compradorValue);
            } else {
              compradorNome = compradorValue;
            }
          } else {
            const compradorId = item.comprador || item.comprador_id || item.buyer_id;
            if (compradorId) {
              const compradorValue = String(compradorId);
              compradorKey = compradorValue;

              if (compradorValue.length > 20 || compradorValue.includes('-')) {
                compradorNome = await getUserName(compradorValue);
              } else {
                compradorNome = compradorValue;
              }
            } else {
              compradorKey = 'sem_comprador';
              compradorNome = 'Sem Comprador Definido';
            }
          }

          // Só processar se tiver algum identificador
          if (productId) {
            totalItens++;

            // Contagem de produtos
            if (!produtosContagem[productId]) {
              const productName = produtoInfo?.name || descricao || 'Produto Desconhecido';
              const productEan = produtoInfo?.ean || ean;
              produtosContagem[productId] = { count: 0, name: productName, ean: productEan };
            }
            produtosContagem[productId].count++;

            // Ranking por produto
            if (!itensPorProduto[productId]) {
              const productName = produtoInfo?.name || descricao || 'Produto Desconhecido';
              const productEan = produtoInfo?.ean || ean;
              itensPorProduto[productId] = { count: 0, name: productName, ean: productEan };
            }
            itensPorProduto[productId].count++;

            // Ranking por loja
            if (storeId) {
              if (!itensPorLoja[storeId]) {
                const storeName = await getStoreName(storeId);
                itensPorLoja[storeId] = { count: 0, name: storeName };
              }
              itensPorLoja[storeId].count++;
            }

            // Ranking por comprador
            if (compradorKey) {
              if (!itensPorComprador[compradorKey]) {
                itensPorComprador[compradorKey] = { count: 0, name: compradorNome || 'Comprador Desconhecido' };
              }
              itensPorComprador[compradorKey].count++;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching items for solicitação:', solicitacao.id, error);
      }
    }

    // Ordenar solicitações recentes por data
    solicitacoesRecentes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Buscar todos os usuários
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*');

    if (usersError) throw usersError;

    const totalUsuarios = usersData?.length || 0;
    const usuariosAtivos = usersData?.filter((u: any) => u.active !== false).length || 0;

    // Contar solicitações por loja
    const solicitacoesPorLojaMap: Record<string, { count: number; name: string }> = {};

    for (const sol of solicitacoesData || []) {
      const storeId = sol.store_id;

      if (storeId) {
        if (!solicitacoesPorLojaMap[storeId]) {
          const storeName = await getStoreName(storeId);
          solicitacoesPorLojaMap[storeId] = { count: 0, name: storeName };
        }
        solicitacoesPorLojaMap[storeId].count++;
      }
    }

    // Converter para array e ordenar por contagem
    const solicitacoesPorLoja = Object.entries(solicitacoesPorLojaMap)
      .map(([storeId, data]) => ({
        storeId,
        storeName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Buscar lojas
    const { data: storesData, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*');

    if (storesError) throw storesError;

    const totalLojas = storesData?.length || 0;

    // Lojas com 50+ profissionais
    const usuariosPorLoja: Record<string, number> = {};
    usersData?.forEach((u: any) => {
      const storeKey = u.store_id || u.loja_id || u.store || u.loja;
      if (storeKey) {
        const key = String(storeKey);
        usuariosPorLoja[key] = (usuariosPorLoja[key] || 0) + 1;
      }
    });
    const lojasCom50MaisProfissionais = Object.values(usuariosPorLoja).filter((n) => n >= 50).length;

    // Converter solicitações por dia em array para gráfico
    const chartData = Object.entries(solicitacoesPorDia)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calcular KPIs adicionais
    const mediaItensPorSolicitacao = totalSolicitacoes > 0 ? (totalItens / totalSolicitacoes).toFixed(1) : '0';
    const solicitacoesProcessadas = statusCounters.closed + statusCounters.batched;
    const taxaConversao = totalSolicitacoes > 0 ? Number(((solicitacoesProcessadas / totalSolicitacoes) * 100).toFixed(1)) : 0;
    const mudancaHoje = solicitacoesOntem > 0 ? (((solicitacoesHoje - solicitacoesOntem) / solicitacoesOntem) * 100).toFixed(0) : '0';
    const mudancaSemanal = solicitacoesUltimos7a14Dias > 0 ? (((solicitacoesUltimos7Dias - solicitacoesUltimos7a14Dias) / solicitacoesUltimos7a14Dias) * 100).toFixed(0) : '0';

    // Top produtos mais solicitados
    const topProdutos = Object.entries(produtosContagem)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        count: data.count,
        ean: data.ean,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Preparar dados de comparação de períodos (últimos 14 dias vs 14 dias anteriores)
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

    // Gerar insights automáticos
    const insights: Array<{
      type: 'success' | 'warning' | 'info' | 'alert';
      title: string;
      description: string;
      icon: 'trending-up' | 'trending-down' | 'alert' | 'check' | 'info' | 'zap';
    }> = [];

    // Insight 1: Tendência de crescimento
    if (parseFloat(mudancaSemanal) > 10) {
      insights.push({
        type: 'success',
        title: 'Crescimento Acelerado',
        description: `As solicitações cresceram ${mudancaSemanal}% na última semana comparado à semana anterior.`,
        icon: 'trending-up',
      });
    } else if (parseFloat(mudancaSemanal) < -10) {
      insights.push({
        type: 'warning',
        title: 'Redução de Atividade',
        description: `As solicitações reduziram ${Math.abs(parseFloat(mudancaSemanal))}% na última semana.`,
        icon: 'trending-down',
      });
    }

    // Insight 2: Taxa de processamento
    const taxaConversaoNum = taxaConversao;
    if (taxaConversaoNum >= 95) {
      insights.push({
        type: 'success',
        title: 'Taxa de Processamento Excelente',
        description: `${taxaConversaoNum.toFixed(1)}% das solicitações foram processadas (em análise ou concluídas).`,
        icon: 'check',
      });
    } else if (taxaConversaoNum >= 70) {
      insights.push({
        type: 'info',
        title: 'Taxa de Processamento Sólida',
        description: `${taxaConversaoNum.toFixed(1)}% das solicitações já estão processadas. Mantenha o ritmo para chegar em 95%+.`,
        icon: 'trending-up',
      });
    } else if (taxaConversaoNum < 50) {
      insights.push({
        type: 'alert',
        title: 'Taxa de Processamento Baixa',
        description: `Apenas ${taxaConversaoNum.toFixed(1)}% das solicitações foram processadas. Revise o fluxo para destravar a fila.`,
        icon: 'alert',
      });
    }

    // Insight 3: Solicitações pendentes
    const totalPendentes = statusCounters.pending;
    const totalEmAnalise = statusCounters.batched;

    if (totalPendentes === 0 && totalEmAnalise === 0) {
      insights.push({
        type: 'success',
        title: 'Tudo Processado',
        description: 'Não há solicitações pendentes. Todas foram analisadas.',
        icon: 'check',
      });
    } else if (totalPendentes > 0 && totalPendentes > totalSolicitacoes * 0.3) {
      insights.push({
        type: 'warning',
        title: 'Alto Volume Pendente',
        description: `Existem ${totalPendentes} solicitações aguardando envio para análise (${((totalPendentes / totalSolicitacoes) * 100).toFixed(0)}% do total).`,
        icon: 'alert',
      });
    } else if (totalEmAnalise > 0) {
      insights.push({
        type: 'info',
        title: 'Solicitações em Análise',
        description: `${totalEmAnalise} solicitação(ões) agrupada(s) em ficha aguardando fechamento.`,
        icon: 'info',
      });
    }

    // Insight 4: Atividade de hoje
    if (solicitacoesHoje > solicitacoesOntem) {
      insights.push({
        type: 'info',
        title: 'Dia Mais Ativo',
        description: `Hoje já foram registradas ${solicitacoesHoje} solicitações, ${solicitacoesHoje - solicitacoesOntem} a mais que ontem.`,
        icon: 'zap',
      });
    }

    // Insight 5: Top produto
    if (topProdutos.length > 0) {
      insights.push({
        type: 'info',
        title: 'Produto Mais Solicitado',
        description: `"${topProdutos[0].productName}" lidera com ${topProdutos[0].count} solicitações.`,
        icon: 'info',
      });
    }

    // Insight 6: Concentração de atividade por loja
    if (Object.keys(itensPorLoja).length > 0) {
      const lojasSorted = Object.entries(itensPorLoja).sort((a, b) => b[1].count - a[1].count);
      const topLoja = lojasSorted[0];
      const totalItensLojas = lojasSorted.reduce((sum, [_, data]) => sum + data.count, 0);
      const percentualTopLoja = ((topLoja[1].count / totalItensLojas) * 100).toFixed(0);

      if (parseFloat(percentualTopLoja) > 40) {
        insights.push({
          type: 'warning',
          title: 'Alta Concentração em Uma Loja',
          description: `A loja "${topLoja[1].name}" representa ${percentualTopLoja}% de todos os itens solicitados. Considere distribuir melhor as demandas.`,
          icon: 'alert',
        });
      } else if (lojasSorted.length >= 3) {
        const top3Total = lojasSorted.slice(0, 3).reduce((sum, [_, data]) => sum + data.count, 0);
        const percentualTop3 = ((top3Total / totalItensLojas) * 100).toFixed(0);

        insights.push({
          type: 'success',
          title: 'Distribuição Equilibrada',
          description: `As top 3 lojas representam ${percentualTop3}% das solicitações, indicando boa distribuição de atividade no sistema.`,
          icon: 'check',
        });
      }
    }

    // Preparar rankings (Top 50)
    const rankingPorLoja = Object.entries(itensPorLoja)
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const rankingPorComprador = Object.entries(itensPorComprador)
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const rankingPorProduto = Object.entries(itensPorProduto)
      .map(([id, data]) => {
        let details = undefined;
        if (data.ean) {
          details = `EAN: ${data.ean}`;
        } else if (id.startsWith('desc_')) {
          details = 'Produto sem código de barras';
        } else {
          details = `ID: ${id}`;
        }
        return {
          id,
          name: data.name,
          count: data.count,
          details,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    // Preparar resposta
    const dashboardData = {
      kpis: {
        totalSolicitacoes,
        totalUsuarios,
        usuariosAtivos,
        totalLojas,
        totalItens,
        lojasCom50MaisProfissionais,
        solicitacoesHoje,
        solicitacoesOntem,
        mediaItensPorSolicitacao: parseFloat(mediaItensPorSolicitacao),
        taxaConversao,
        solicitacoesUltimos7Dias,
        mudancaSemanal: parseFloat(mudancaSemanal),
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
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
