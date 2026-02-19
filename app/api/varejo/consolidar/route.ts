/**
 * API: Consolidação de Métricas de Varejo
 *
 * Dispara o recálculo e consolidação das métricas:
 * - Por loja individual
 * - Por rede (todas as lojas)
 * - Atualização de views materializadas
 *
 * Endpoint: POST /api/varejo/consolidar
 * Body:
 *   - tipo: 'loja' | 'rede' | 'views'
 *   - lojaId: UUID da loja (obrigatório se tipo='loja')
 *   - periodo: YYYY-MM-DD (default: início do mês atual)
 *   - tipoPeriodo: 'diario' | 'semanal' | 'mensal' (default: 'mensal')
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CacheService } from '@/lib/services/cache.service';

interface ConsolidacaoRequest {
  tipo: 'loja' | 'rede' | 'views';
  lojaId?: string;
  orgId?: string;
  periodo?: string;
  tipoPeriodo?: 'diario' | 'semanal' | 'mensal';
}

interface ConsolidacaoResponse {
  success: boolean;
  tipo: string;
  resultados?: {
    id?: string;
    lojaId?: string;
    periodo?: string;
    metricas?: Record<string, number>;
  };
  tempoExecucaoMs: number;
  message: string;
}

function getDefaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ConsolidacaoRequest = await request.json();
    const { tipo, lojaId, orgId, tipoPeriodo = 'mensal' } = body;
    const periodo = body.periodo || getDefaultPeriodo();

    if (!tipo || !['loja', 'rede', 'views'].includes(tipo)) {
      return NextResponse.json({
        success: false,
        error: "Parâmetro 'tipo' obrigatório: 'loja', 'rede' ou 'views'",
      }, { status: 400 });
    }

    let response: ConsolidacaoResponse;

    switch (tipo) {
      case 'loja':
        if (!lojaId) {
          return NextResponse.json({
            success: false,
            error: "Parâmetro 'lojaId' obrigatório para tipo='loja'",
          }, { status: 400 });
        }
        response = await consolidarLoja(lojaId, orgId, periodo, tipoPeriodo, startTime);
        break;

      case 'rede':
        response = await consolidarRede(orgId, periodo, tipoPeriodo, startTime);
        break;

      case 'views':
        response = await refreshViews(startTime);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de consolidação inválido',
        }, { status: 400 });
    }

    // Invalidate related caches
    await CacheService.invalidatePattern('varejo:*');

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Consolidar API] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro na consolidação',
      details: error.message,
      tempoExecucaoMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

async function consolidarLoja(
  lojaId: string,
  orgId: string | undefined,
  periodo: string,
  tipoPeriodo: string,
  startTime: number
): Promise<ConsolidacaoResponse> {
  console.log(`[Consolidar API] Iniciando consolidação da loja ${lojaId} para ${periodo} (${tipoPeriodo})`);

  const { data, error } = await supabaseAdmin.rpc('consolidar_metricas_loja', {
    p_organization_id: orgId || null,
    p_loja_id: lojaId,
    p_periodo: periodo,
    p_tipo_periodo: tipoPeriodo,
  });

  if (error) {
    console.error('[Consolidar API] Erro ao consolidar loja:', error);
    throw error;
  }

  // Fetch the consolidated metrics
  const { data: metricas } = await supabaseAdmin
    .from('agg_metricas_loja')
    .select('*')
    .eq('id', data)
    .single();

  return {
    success: true,
    tipo: 'loja',
    resultados: {
      id: data,
      lojaId,
      periodo,
      metricas: metricas ? {
        faturamento: parseFloat(metricas.faturamento_total) || 0,
        perdas: parseFloat(metricas.perda_valor_total) || 0,
        rfe: parseFloat(metricas.rfe_score) || 0,
        rfeNivel: metricas.rfe_nivel,
      } : undefined,
    },
    tempoExecucaoMs: Date.now() - startTime,
    message: `Métricas consolidadas para loja ${lojaId}`,
  };
}

async function consolidarRede(
  orgId: string | undefined,
  periodo: string,
  tipoPeriodo: string,
  startTime: number
): Promise<ConsolidacaoResponse> {
  console.log(`[Consolidar API] Iniciando consolidação da rede para ${periodo} (${tipoPeriodo})`);

  // Tentar usar RPC se disponível, senão usar abordagem direta
  try {
    const { data, error } = await supabaseAdmin.rpc('consolidar_metricas_rede', {
      p_organization_id: orgId || null,
      p_periodo: periodo,
      p_tipo_periodo: tipoPeriodo,
    });

    if (error) {
      throw error;
    }

    // Fetch the consolidated network metrics
    const { data: metricas } = await supabaseAdmin
      .from('agg_metricas_rede')
      .select('*')
      .eq('id', data)
      .single();

    return {
      success: true,
      tipo: 'rede',
      resultados: {
        id: data,
        periodo,
        metricas: metricas ? {
          qtdLojas: parseInt(metricas.qtd_lojas_ativas) || 0,
          faturamentoTotal: parseFloat(metricas.faturamento_total) || 0,
          perdaTotal: parseFloat(metricas.perda_valor_total) || 0,
          rfeTotal: parseFloat(metricas.rfe_total) || 0,
          lojasRiscoCritico: parseInt(metricas.lojas_risco_critico) || 0,
          lojasRiscoAlto: parseInt(metricas.lojas_risco_alto) || 0,
        } : undefined,
      },
      tempoExecucaoMs: Date.now() - startTime,
      message: 'Métricas consolidadas para toda a rede',
    };
  } catch (rpcError: any) {
    console.log('[Consolidar API] RPC não disponível, usando abordagem direta...');

    // Fallback: consolidar diretamente das tabelas fato
    return await consolidarRedeDireto(orgId, periodo, tipoPeriodo, startTime);
  }
}

// Consolidação de uma loja específica (sem RPC)
async function consolidarLojaDireto(
  lojaId: string,
  orgId: string,
  periodo: string,
  periodoFim: string,
  tipoPeriodo: string
): Promise<void> {
  // Buscar dados de perdas da loja
  const { data: perdas } = await supabaseAdmin
    .from('fato_perdas')
    .select('custo_perda, tipo_perda, quantidade_perda')
    .eq('loja_id', lojaId)
    .gte('data_importacao', periodo)
    .lte('data_importacao', periodoFim);

  // Buscar dados de rupturas da loja
  const { data: rupturas } = await supabaseAdmin
    .from('fato_rupturas')
    .select('valor_venda_perdida, quantidade_perdida')
    .eq('loja_id', lojaId)
    .gte('data_importacao', periodo)
    .lte('data_importacao', periodoFim);

  // Buscar dados de vendas da loja
  const { data: vendas } = await supabaseAdmin
    .from('fato_vendas')
    .select('valor_venda, margem_valor, custo_total')
    .eq('loja_id', lojaId)
    .gte('data_importacao', periodo)
    .lte('data_importacao', periodoFim);

  // Buscar dados de estoque da loja
  const { data: estoque } = await supabaseAdmin
    .from('fato_estoque')
    .select('custo_total, valor_estoque_venda, dias_estoque, dias_ultima_venda, quantidade_estoque')
    .eq('loja_id', lojaId)
    .gte('data_importacao', periodo)
    .lte('data_importacao', periodoFim);

  // Calcular métricas
  const totalPerdas = perdas?.reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const totalRupturas = rupturas?.reduce((sum, r) => sum + (parseFloat(r.valor_venda_perdida) || 0), 0) || 0;
  const totalVendas = vendas?.reduce((sum, v) => sum + (parseFloat(v.valor_venda) || 0), 0) || 0;
  const totalMargem = vendas?.reduce((sum, v) => sum + (parseFloat(v.margem_valor) || 0), 0) || 0;
  const totalCusto = vendas?.reduce((sum, v) => sum + (parseFloat(v.custo_total) || 0), 0) || 0;

  // Métricas de estoque
  const valorEstoque = estoque?.reduce((sum, e) => sum + (parseFloat(e.valor_estoque_venda) || parseFloat(e.custo_total) || 0), 0) || 0;
  const custoEstoque = estoque?.reduce((sum, e) => sum + (parseFloat(e.custo_total) || 0), 0) || 0;
  const qtdSkus = estoque?.length || 0;
  const capitalParado = estoque?.filter(e => (parseFloat(e.dias_estoque) || 0) > 60)
    .reduce((sum, e) => sum + (parseFloat(e.custo_total) || 0), 0) || 0;
  const estoqueMorto = estoque?.filter(e => (parseFloat(e.dias_ultima_venda) || 0) > 90)
    .reduce((sum, e) => sum + (parseFloat(e.custo_total) || 0), 0) || 0;

  // Giro e cobertura
  const giroEstoque = custoEstoque > 0 ? totalCusto / custoEstoque : 0;
  const coberturaDias = totalVendas > 0 ? (custoEstoque / (totalVendas / 30)) : 0;

  // Perdas por tipo (incluindo 'importado' como vencimento para dados legados)
  const perdaVencimento = perdas?.filter(p => p.tipo_perda === 'vencimento' || p.tipo_perda === 'importado').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const perdaAvaria = perdas?.filter(p => p.tipo_perda === 'avaria').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const perdaRoubo = perdas?.filter(p => p.tipo_perda === 'roubo').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;

  // RFE e classificação
  const rfeScore = totalPerdas + totalRupturas + (capitalParado * 0.01); // 1% custo capital mensal
  let rfeNivel = 'baixo';
  if (rfeScore > 30000) rfeNivel = 'critico';
  else if (rfeScore > 15000) rfeNivel = 'alto';
  else if (rfeScore > 5000) rfeNivel = 'medio';

  const perdaSobreFaturamento = totalVendas > 0 ? (totalPerdas / totalVendas) : 0;
  const margemPct = totalVendas > 0 ? (totalMargem / totalVendas) : 0;
  const taxaDisponibilidade = totalVendas > 0 ? 1 - (totalRupturas / (totalVendas + totalRupturas)) : 1;

  // Inserir/atualizar agg_metricas_loja
  const lojaMetrics = {
    organization_id: orgId,
    loja_id: lojaId,
    periodo,
    tipo_periodo: tipoPeriodo,
    // Estoque
    valor_estoque_total: valorEstoque,
    custo_estoque_total: custoEstoque,
    quantidade_skus: qtdSkus,
    giro_estoque: giroEstoque,
    cobertura_dias: coberturaDias,
    capital_investido: custoEstoque,
    capital_parado: capitalParado,
    estoque_morto_valor: estoqueMorto,
    // Perdas
    perda_valor_total: totalPerdas,
    perda_sobre_faturamento_pct: perdaSobreFaturamento * 100,
    perda_vencimento_valor: perdaVencimento,
    perda_avaria_valor: perdaAvaria,
    perda_roubo_valor: perdaRoubo,
    // Rupturas
    vendas_perdidas_valor: totalRupturas,
    taxa_disponibilidade: taxaDisponibilidade,
    // Vendas
    faturamento_total: totalVendas,
    margem_bruta_valor: totalMargem,
    margem_bruta_pct: margemPct * 100,
    // RFE
    rfe_score: rfeScore,
    rfe_nivel: rfeNivel,
    rfe_componente_perdas: totalPerdas,
    rfe_componente_vendas_perdidas: totalRupturas,
    rfe_componente_capital_parado: capitalParado * 0.01,
    calculado_em: new Date().toISOString(),
  };

  // Verificar se já existe
  const { data: existing } = await supabaseAdmin
    .from('agg_metricas_loja')
    .select('id')
    .eq('loja_id', lojaId)
    .eq('periodo', periodo)
    .eq('tipo_periodo', tipoPeriodo)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('agg_metricas_loja')
      .update(lojaMetrics)
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('agg_metricas_loja')
      .insert(lojaMetrics);
  }
}

// Consolidação direta sem depender de stored procedures
async function consolidarRedeDireto(
  orgId: string | undefined,
  periodo: string,
  tipoPeriodo: string,
  startTime: number
): Promise<ConsolidacaoResponse> {
  const periodoInicio = periodo;
  const periodoFim = new Date(periodo);
  periodoFim.setMonth(periodoFim.getMonth() + 1);
  periodoFim.setDate(0); // Último dia do mês
  const periodoFimStr = periodoFim.toISOString().split('T')[0];

  // 1. Buscar lojas ativas (precisamos disso para obter o orgId se não fornecido)
  const { data: lojas } = await supabaseAdmin
    .from('dim_loja')
    .select('id, nome, organization_id')
    .eq('ativa', true);

  // Determinar organization_id: usar o fornecido ou extrair da primeira loja
  let finalOrgId = orgId || lojas?.[0]?.organization_id;
  if (!finalOrgId) {
    console.warn('[Consolidar API] Nenhum organization_id em dim_loja, tentando buscar de stores/companies...');
    // Fallback 1: buscar company_id de uma store existente
    const { data: storeData } = await supabaseAdmin
      .from('stores')
      .select('company_id')
      .limit(1)
      .single();
    if (storeData?.company_id) {
      finalOrgId = storeData.company_id;
    } else {
      // Fallback 2: buscar qualquer company existente
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('id')
        .limit(1)
        .single();
      if (!companyData?.id) {
        throw new Error('Nenhuma empresa/organização encontrada no sistema. Cadastre ao menos uma empresa.');
      }
      finalOrgId = companyData.id;
    }

    // Sincronizar dim_loja a partir de stores para futuras consolidações
    console.log('[Consolidar API] Sincronizando dim_loja com stores para org:', finalOrgId);
    try {
      await supabaseAdmin.rpc('sync_dim_loja_from_stores', {
        p_organization_id: finalOrgId,
      });
    } catch (syncErr) {
      console.warn('[Consolidar API] Não foi possível sincronizar dim_loja (não crítico):', syncErr);
    }
  }

  console.log(`[Consolidar API] Usando organization_id: ${finalOrgId}`);

  // 2. Buscar dados de perdas
  const { data: perdas } = await supabaseAdmin
    .from('fato_perdas')
    .select('custo_perda, tipo_perda, loja_id')
    .gte('data_importacao', periodoInicio)
    .lte('data_importacao', periodoFimStr);

  // 3. Buscar dados de rupturas
  const { data: rupturas } = await supabaseAdmin
    .from('fato_rupturas')
    .select('valor_venda_perdida, loja_id')
    .gte('data_importacao', periodoInicio)
    .lte('data_importacao', periodoFimStr);

  // 4. Buscar dados de vendas
  const { data: vendas } = await supabaseAdmin
    .from('fato_vendas')
    .select('valor_venda, margem_valor, custo_total, loja_id')
    .gte('data_importacao', periodoInicio)
    .lte('data_importacao', periodoFimStr);

  // 5. Buscar dados de estoque (snapshot mais recente do período)
  const { data: estoque } = await supabaseAdmin
    .from('fato_estoque')
    .select('custo_total, valor_estoque_venda, dias_estoque, dias_ultima_venda, media_venda_dia, loja_id')
    .gte('data_importacao', periodoInicio)
    .lte('data_importacao', periodoFimStr);

  // Calcular métricas consolidadas
  const totalPerdas = perdas?.reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const totalRupturas = rupturas?.reduce((sum, r) => sum + (parseFloat(r.valor_venda_perdida) || 0), 0) || 0;
  const totalVendas = vendas?.reduce((sum, v) => sum + (parseFloat(v.valor_venda) || 0), 0) || 0;
  const totalMargem = vendas?.reduce((sum, v) => sum + (parseFloat(v.margem_valor) || 0), 0) || 0;
  const totalCustoVendas = vendas?.reduce((sum, v) => sum + (parseFloat(v.custo_total) || 0), 0) || 0;

  // Métricas de estoque
  const valorEstoqueTotal = estoque?.reduce((sum, e) => sum + (parseFloat(e.valor_estoque_venda) || parseFloat(e.custo_total) || 0), 0) || 0;
  const capitalParado = estoque?.filter(e => (parseFloat(e.dias_estoque) || 0) > 60)
    .reduce((sum, e) => sum + (parseFloat(e.custo_total) || 0), 0) || 0;
  const estoqueMorto = estoque?.filter(e => (parseFloat(e.dias_ultima_venda) || 0) > 90)
    .reduce((sum, e) => sum + (parseFloat(e.custo_total) || 0), 0) || 0;
  // Giro médio = CMV / Estoque Médio
  const giroMedio = valorEstoqueTotal > 0 ? totalCustoVendas / valorEstoqueTotal : 0;

  // Perdas por tipo (incluindo 'importado' como vencimento para dados legados)
  const perdasVencimento = perdas?.filter(p => p.tipo_perda === 'vencimento' || p.tipo_perda === 'importado').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const perdasAvaria = perdas?.filter(p => p.tipo_perda === 'avaria').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const perdasRoubo = perdas?.filter(p => p.tipo_perda === 'roubo').reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;
  const perdasOutros = perdas?.filter(p => !['vencimento', 'avaria', 'roubo', 'importado'].includes(p.tipo_perda)).reduce((sum, p) => sum + (parseFloat(p.custo_perda) || 0), 0) || 0;

  // Lojas únicas com dados
  const lojasComDados = new Set([
    ...(perdas?.map(p => p.loja_id) || []),
    ...(rupturas?.map(r => r.loja_id) || []),
    ...(vendas?.map(v => v.loja_id) || []),
    ...(estoque?.map(e => e.loja_id) || []),
  ]);

  const qtdLojas = lojasComDados.size || lojas?.length || 0;

  // Consolidar métricas de cada loja individualmente
  console.log(`[Consolidar API] Consolidando ${lojasComDados.size} lojas...`);
  for (const lojaId of lojasComDados) {
    if (lojaId) {
      try {
        await consolidarLojaDireto(lojaId, finalOrgId, periodoInicio, periodoFimStr, tipoPeriodo);
      } catch (lojaErr) {
        console.warn(`[Consolidar API] Erro ao consolidar loja ${lojaId}:`, lojaErr);
      }
    }
  }
  console.log(`[Consolidar API] Consolidação de lojas concluída`);
  const rfeTotal = totalPerdas + totalRupturas;
  const perdaSobreFaturamento = totalVendas > 0 ? (totalPerdas / totalVendas) * 100 : 0;
  const margemMedia = totalVendas > 0 ? (totalMargem / totalVendas) * 100 : 0;

  // Inserir ou atualizar na tabela agg_metricas_rede
  const metricsData = {
    organization_id: finalOrgId,
    periodo: periodoInicio,
    tipo_periodo: tipoPeriodo,
    qtd_lojas_ativas: qtdLojas,
    faturamento_total: totalVendas,
    margem_bruta_media: margemMedia,
    perda_valor_total: totalPerdas,
    perda_sobre_faturamento_pct: perdaSobreFaturamento,
    vendas_perdidas_total: totalRupturas,
    rfe_total: rfeTotal,
    perda_vencimento_total: perdasVencimento,
    perda_avaria_total: perdasAvaria,
    perda_roubo_total: perdasRoubo,
    perda_outros_total: perdasOutros,
    valor_estoque_total: valorEstoqueTotal,
    capital_parado_total: capitalParado,
    estoque_morto_total: estoqueMorto,
    giro_estoque_medio: giroMedio,
    lojas_risco_critico: 0,
    lojas_risco_alto: 0,
    lojas_risco_medio: 0,
    lojas_risco_baixo: qtdLojas,
    calculado_em: new Date().toISOString(),
  };

  // Verificar se já existe registro para este período e organização
  const { data: existing } = await supabaseAdmin
    .from('agg_metricas_rede')
    .select('id')
    .eq('organization_id', finalOrgId)
    .eq('periodo', periodoInicio)
    .eq('tipo_periodo', tipoPeriodo)
    .maybeSingle();

  let resultId: string;

  if (existing) {
    // Atualizar
    await supabaseAdmin
      .from('agg_metricas_rede')
      .update(metricsData)
      .eq('id', existing.id);
    resultId = existing.id;
  } else {
    // Inserir
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('agg_metricas_rede')
      .insert(metricsData)
      .select('id')
      .single();

    if (insertError) {
      console.error('[Consolidar API] Erro ao inserir métricas:', insertError);
      throw insertError;
    }
    resultId = inserted.id;
  }

  return {
    success: true,
    tipo: 'rede',
    resultados: {
      id: resultId,
      periodo: periodoInicio,
      metricas: {
        qtdLojas,
        faturamentoTotal: totalVendas,
        perdaTotal: totalPerdas,
        rfeTotal,
        lojasRiscoCritico: 0,
        lojasRiscoAlto: 0,
      },
    },
    tempoExecucaoMs: Date.now() - startTime,
    message: `Métricas consolidadas: ${qtdLojas} lojas, R$ ${totalVendas.toFixed(2)} faturamento, R$ ${totalPerdas.toFixed(2)} perdas`,
  };
}

// Função original que usa RPC (mantida para compatibilidade)
async function consolidarRedeRPC(
  orgId: string | undefined,
  periodo: string,
  tipoPeriodo: string,
  startTime: number
): Promise<ConsolidacaoResponse> {
  const { data, error } = await supabaseAdmin.rpc('consolidar_metricas_rede', {
    p_organization_id: orgId || null,
    p_periodo: periodo,
    p_tipo_periodo: tipoPeriodo,
  });

  if (error) {
    console.error('[Consolidar API] Erro ao consolidar rede:', error);
    throw error;
  }

  // Fetch the consolidated network metrics
  const { data: metricas } = await supabaseAdmin
    .from('agg_metricas_rede')
    .select('*')
    .eq('id', data)
    .single();

  return {
    success: true,
    tipo: 'rede',
    resultados: {
      id: data,
      periodo,
      metricas: metricas ? {
        qtdLojas: parseInt(metricas.qtd_lojas_ativas) || 0,
        faturamentoTotal: parseFloat(metricas.faturamento_total) || 0,
        perdaTotal: parseFloat(metricas.perda_valor_total) || 0,
        rfeTotal: parseFloat(metricas.rfe_total) || 0,
        lojasRiscoCritico: parseInt(metricas.lojas_risco_critico) || 0,
        lojasRiscoAlto: parseInt(metricas.lojas_risco_alto) || 0,
      } : undefined,
    },
    tempoExecucaoMs: Date.now() - startTime,
    message: 'Métricas consolidadas para toda a rede',
  };
}

async function refreshViews(startTime: number): Promise<ConsolidacaoResponse> {
  console.log('[Consolidar API] Atualizando views materializadas');

  try {
    const { error } = await supabaseAdmin.rpc('refresh_retail_materialized_views');

    if (error) {
      // Se a função não existir, apenas logar e continuar
      console.warn('[Consolidar API] RPC refresh_retail_materialized_views não disponível:', error.message);
      return {
        success: true,
        tipo: 'views',
        tempoExecucaoMs: Date.now() - startTime,
        message: 'Views materializadas não configuradas (opcional)',
      };
    }

    return {
      success: true,
      tipo: 'views',
      tempoExecucaoMs: Date.now() - startTime,
      message: 'Views materializadas atualizadas (mv_metricas_diarias, mv_pareto_perdas)',
    };
  } catch (err: any) {
    console.warn('[Consolidar API] Erro ao atualizar views (não crítico):', err.message);
    return {
      success: true,
      tipo: 'views',
      tempoExecucaoMs: Date.now() - startTime,
      message: 'Views materializadas não disponíveis',
    };
  }
}

/**
 * GET: Status das últimas consolidações
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || getDefaultPeriodo();
    const tipoPeriodo = searchParams.get('tipo_periodo') || 'mensal';

    // Check if consolidation exists for this period
    const { data: redeData, error: redeError } = await supabaseAdmin
      .from('agg_metricas_rede')
      .select('id, periodo, tipo_periodo, qtd_lojas_ativas, calculado_em')
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo)
      .maybeSingle();

    const { count: lojasCount, error: lojasError } = await supabaseAdmin
      .from('agg_metricas_loja')
      .select('id', { count: 'exact', head: true })
      .eq('periodo', periodo)
      .eq('tipo_periodo', tipoPeriodo);

    return NextResponse.json({
      success: true,
      status: {
        periodo,
        tipoPeriodo,
        redeConsolidada: !!redeData,
        redeCalculadoEm: redeData?.calculado_em,
        lojasConsolidadas: lojasCount || 0,
        qtdLojasAtivas: redeData?.qtd_lojas_ativas || 0,
      },
    });

  } catch (error: any) {
    console.error('[Consolidar API] Erro GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar status',
      details: error.message,
    }, { status: 500 });
  }
}
