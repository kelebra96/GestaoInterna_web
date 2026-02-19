-- =============================================
-- Migration 036: Views Materializadas e Views de Análise
-- Created: 2026-02-18
-- Description: Views para dashboards e relatórios executivos
-- =============================================

-- ==========================================
-- VIEW: Dashboard Executivo Consolidado
-- ==========================================

CREATE OR REPLACE VIEW v_dashboard_executivo AS
SELECT
  ar.organization_id,
  ar.periodo,
  ar.tipo_periodo,

  -- KPIs Principais
  ar.faturamento_total,
  ar.margem_bruta_media,
  ar.perda_valor_total,
  ar.perda_sobre_faturamento_pct,
  ar.vendas_perdidas_total,
  ar.taxa_disponibilidade_media,
  ar.rfe_total,

  -- Composição de Perdas
  ar.perda_vencimento_total,
  ar.perda_avaria_total,
  ar.perda_roubo_total,
  ar.perda_outros_total,

  -- Estoque
  ar.valor_estoque_total,
  ar.giro_estoque_medio,
  ar.capital_parado_total,
  ar.estoque_morto_total,

  -- Distribuição de Risco
  ar.lojas_risco_critico,
  ar.lojas_risco_alto,
  ar.lojas_risco_medio,
  ar.lojas_risco_baixo,
  ar.qtd_lojas_ativas,

  -- Percentis
  ar.percentil_perda_p50,
  ar.percentil_perda_p90,
  ar.percentil_rfe_p50,
  ar.percentil_rfe_p90,

  ar.calculado_em

FROM agg_metricas_rede ar;

COMMENT ON VIEW v_dashboard_executivo IS 'Visão consolidada para dashboard executivo da rede';

-- ==========================================
-- VIEW: Ranking de Lojas por RFE
-- ==========================================

CREATE OR REPLACE VIEW v_ranking_lojas_rfe AS
SELECT
  al.organization_id,
  al.loja_id,
  dl.nome AS loja_nome,
  dl.codigo AS loja_codigo,
  dl.cluster AS loja_cluster,
  al.periodo,
  al.tipo_periodo,

  -- RFE
  al.rfe_score,
  al.rfe_rank,
  al.rfe_nivel,
  al.rfe_componente_perdas,
  al.rfe_componente_vendas_perdidas,
  al.rfe_componente_capital_parado,

  -- Métricas
  al.perda_valor_total,
  al.perda_sobre_faturamento_pct,
  al.vendas_perdidas_valor,
  al.taxa_disponibilidade,
  al.capital_parado,
  al.faturamento_total,

  -- Principal problema
  CASE
    WHEN al.rfe_componente_perdas >= GREATEST(al.rfe_componente_vendas_perdidas, al.rfe_componente_capital_parado) THEN 'Perdas'
    WHEN al.rfe_componente_vendas_perdidas >= GREATEST(al.rfe_componente_perdas, al.rfe_componente_capital_parado) THEN 'Rupturas'
    ELSE 'Capital Parado'
  END AS principal_problema,

  al.calculado_em

FROM agg_metricas_loja al
JOIN dim_loja dl ON dl.id = al.loja_id
ORDER BY al.rfe_score DESC;

COMMENT ON VIEW v_ranking_lojas_rfe IS 'Ranking de lojas ordenadas por Risk Financial Exposure';

-- ==========================================
-- VIEW: Top Produtos com Perda
-- ==========================================

CREATE OR REPLACE VIEW v_top_produtos_perda AS
SELECT
  fp.organization_id,
  fp.produto_id,
  dp.codigo,
  dp.nome,
  dp.categoria,
  dp.fornecedor,
  fp.data_importacao,

  -- Agregados
  SUM(fp.custo_perda) AS perda_total,
  SUM(fp.quantidade_perda) AS quantidade_total,
  SUM(fp.margem_perdida) AS margem_perdida_total,
  COUNT(DISTINCT fp.loja_id) AS lojas_afetadas,

  -- Por tipo
  SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'vencimento') AS perda_vencimento,
  SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'avaria') AS perda_avaria,
  SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'roubo') AS perda_roubo

FROM fato_perdas fp
JOIN dim_produto dp ON dp.id = fp.produto_id
GROUP BY
  fp.organization_id, fp.produto_id, dp.codigo, dp.nome, dp.categoria, dp.fornecedor, fp.data_importacao
ORDER BY SUM(fp.custo_perda) DESC;

COMMENT ON VIEW v_top_produtos_perda IS 'Top produtos ordenados por valor de perda';

-- ==========================================
-- VIEW: Top Fornecedores por Perda
-- ==========================================

CREATE OR REPLACE VIEW v_top_fornecedores_perda AS
SELECT
  dp.organization_id,
  dp.fornecedor,

  -- Produtos
  COUNT(DISTINCT dp.id) AS qtd_produtos,
  COUNT(DISTINCT fp.produto_id) AS qtd_produtos_com_perda,

  -- Perdas
  COALESCE(SUM(fp.custo_perda), 0) AS perda_total,
  COALESCE(SUM(fp.quantidade_perda), 0) AS quantidade_total,

  -- Por tipo
  COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'vencimento'), 0) AS perda_vencimento,
  COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'avaria'), 0) AS perda_avaria,

  -- Taxa de perda estimada
  CASE
    WHEN COUNT(DISTINCT dp.id) > 0
    THEN ROUND((COUNT(DISTINCT fp.produto_id)::NUMERIC / COUNT(DISTINCT dp.id)) * 100, 2)
    ELSE 0
  END AS taxa_produtos_com_perda_pct

FROM dim_produto dp
LEFT JOIN fato_perdas fp ON fp.produto_id = dp.id
  AND fp.data_importacao >= CURRENT_DATE - INTERVAL '90 days'
WHERE dp.fornecedor IS NOT NULL
GROUP BY dp.organization_id, dp.fornecedor
ORDER BY COALESCE(SUM(fp.custo_perda), 0) DESC;

COMMENT ON VIEW v_top_fornecedores_perda IS 'Fornecedores ordenados por valor de perda dos produtos';

-- ==========================================
-- VIEW: Produtos em Ruptura Frequente
-- ==========================================

CREATE OR REPLACE VIEW v_produtos_ruptura_frequente AS
SELECT
  fr.organization_id,
  fr.produto_id,
  dp.codigo,
  dp.nome,
  dp.categoria,
  dp.fornecedor,

  -- Frequência
  COUNT(*) AS ocorrencias,
  COUNT(DISTINCT fr.loja_id) AS lojas_afetadas,
  COUNT(DISTINCT fr.data_importacao) AS dias_com_ruptura,

  -- Valor
  SUM(fr.valor_venda_perdida) AS valor_vendas_perdidas,
  SUM(fr.margem_perdida) AS margem_perdida,

  -- Período
  MIN(fr.data_importacao) AS primeira_ruptura,
  MAX(fr.data_importacao) AS ultima_ruptura

FROM fato_rupturas fr
JOIN dim_produto dp ON dp.id = fr.produto_id
WHERE fr.data_importacao >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY fr.organization_id, fr.produto_id, dp.codigo, dp.nome, dp.categoria, dp.fornecedor
HAVING COUNT(*) >= 3
ORDER BY SUM(fr.valor_venda_perdida) DESC;

COMMENT ON VIEW v_produtos_ruptura_frequente IS 'Produtos com ruptura recorrente (>= 3x nos últimos 30 dias)';

-- ==========================================
-- VIEW: Estoque em Risco
-- ==========================================

CREATE OR REPLACE VIEW v_estoque_em_risco AS
SELECT
  fe.organization_id,
  fe.loja_id,
  dl.nome AS loja_nome,
  fe.produto_id,
  dp.codigo,
  dp.nome AS produto_nome,
  dp.categoria,
  fe.data_importacao,

  -- Estoque
  fe.quantidade_estoque,
  fe.custo_total,
  fe.dias_estoque,
  fe.dias_ultima_venda,

  -- Classificação de risco
  CASE
    WHEN fe.dias_ultima_venda > 90 THEN 'morto'
    WHEN fe.dias_estoque > 60 THEN 'excesso'
    WHEN fe.dias_estoque > 30 THEN 'alto'
    ELSE 'normal'
  END AS nivel_risco,

  -- Ação sugerida
  CASE
    WHEN fe.dias_ultima_venda > 90 THEN 'Liquidar ou transferir'
    WHEN fe.dias_estoque > 60 THEN 'Reduzir próximo pedido em 50%'
    WHEN fe.dias_estoque > 30 THEN 'Monitorar e ajustar pedido'
    ELSE 'OK'
  END AS acao_sugerida

FROM fato_estoque fe
JOIN dim_loja dl ON dl.id = fe.loja_id
JOIN dim_produto dp ON dp.id = fe.produto_id
WHERE fe.dias_estoque > 30 OR fe.dias_ultima_venda > 90
ORDER BY fe.custo_total DESC;

COMMENT ON VIEW v_estoque_em_risco IS 'Produtos com estoque em risco (excesso ou morto)';

-- ==========================================
-- VIEW: Tendência de Perdas (Últimos 6 meses)
-- ==========================================

CREATE OR REPLACE VIEW v_tendencia_perdas AS
SELECT
  organization_id,
  loja_id,
  DATE_TRUNC('month', data_importacao)::DATE AS mes,

  SUM(custo_perda) AS perda_total,
  SUM(quantidade_perda) AS quantidade_total,
  COUNT(DISTINCT produto_id) AS produtos_afetados,

  -- Por tipo
  SUM(custo_perda) FILTER (WHERE tipo_perda = 'vencimento') AS perda_vencimento,
  SUM(custo_perda) FILTER (WHERE tipo_perda = 'avaria') AS perda_avaria,
  SUM(custo_perda) FILTER (WHERE tipo_perda = 'roubo') AS perda_roubo,
  SUM(custo_perda) FILTER (WHERE tipo_perda NOT IN ('vencimento', 'avaria', 'roubo')) AS perda_outros

FROM fato_perdas
WHERE data_importacao >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY organization_id, loja_id, DATE_TRUNC('month', data_importacao)
ORDER BY mes DESC;

COMMENT ON VIEW v_tendencia_perdas IS 'Evolução mensal de perdas por loja nos últimos 6 meses';

-- ==========================================
-- VIEW: Comparativo Período Anterior
-- ==========================================

CREATE OR REPLACE VIEW v_comparativo_periodos AS
WITH periodos AS (
  SELECT
    al.organization_id,
    al.loja_id,
    al.periodo,
    al.tipo_periodo,
    al.faturamento_total,
    al.perda_valor_total,
    al.perda_sobre_faturamento_pct,
    al.vendas_perdidas_valor,
    al.taxa_disponibilidade,
    al.rfe_score,
    LAG(al.faturamento_total) OVER (PARTITION BY al.organization_id, al.loja_id, al.tipo_periodo ORDER BY al.periodo) AS faturamento_anterior,
    LAG(al.perda_valor_total) OVER (PARTITION BY al.organization_id, al.loja_id, al.tipo_periodo ORDER BY al.periodo) AS perda_anterior,
    LAG(al.rfe_score) OVER (PARTITION BY al.organization_id, al.loja_id, al.tipo_periodo ORDER BY al.periodo) AS rfe_anterior
  FROM agg_metricas_loja al
)
SELECT
  p.*,
  CASE WHEN p.faturamento_anterior > 0 THEN ((p.faturamento_total - p.faturamento_anterior) / p.faturamento_anterior * 100) ELSE 0 END AS var_faturamento_pct,
  CASE WHEN p.perda_anterior > 0 THEN ((p.perda_valor_total - p.perda_anterior) / p.perda_anterior * 100) ELSE 0 END AS var_perda_pct,
  CASE WHEN p.rfe_anterior > 0 THEN ((p.rfe_score - p.rfe_anterior) / p.rfe_anterior * 100) ELSE 0 END AS var_rfe_pct,
  CASE
    WHEN p.rfe_anterior IS NULL THEN 'sem_historico'
    WHEN p.rfe_score > p.rfe_anterior * 1.1 THEN 'piorando'
    WHEN p.rfe_score < p.rfe_anterior * 0.9 THEN 'melhorando'
    ELSE 'estavel'
  END AS tendencia_rfe
FROM periodos p;

COMMENT ON VIEW v_comparativo_periodos IS 'Comparativo de métricas com período anterior';

-- ==========================================
-- VIEW MATERIALIZADA: Métricas Diárias Agregadas
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_metricas_diarias AS
SELECT
  fp.organization_id,
  fp.data_importacao AS data,

  -- Perdas
  COALESCE(SUM(fp.custo_perda), 0) AS perda_total,
  COUNT(DISTINCT fp.produto_id) AS produtos_perda,
  COUNT(DISTINCT fp.loja_id) AS lojas_perda,

  -- Rupturas
  COALESCE((SELECT SUM(fr.valor_venda_perdida) FROM fato_rupturas fr
    WHERE fr.organization_id = fp.organization_id AND fr.data_importacao = fp.data_importacao), 0) AS ruptura_total,

  -- Vendas
  COALESCE((SELECT SUM(fv.valor_venda) FROM fato_vendas fv
    WHERE fv.organization_id = fp.organization_id AND fv.data_importacao = fp.data_importacao), 0) AS venda_total

FROM fato_perdas fp
GROUP BY fp.organization_id, fp.data_importacao
ORDER BY fp.data_importacao DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_metricas_diarias ON mv_metricas_diarias(organization_id, data);

COMMENT ON MATERIALIZED VIEW mv_metricas_diarias IS 'Métricas agregadas por dia para gráficos de evolução';

-- ==========================================
-- VIEW MATERIALIZADA: Pareto de Perdas
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pareto_perdas AS
WITH ranked AS (
  SELECT
    fp.organization_id,
    fp.produto_id,
    dp.codigo,
    dp.nome,
    dp.categoria,
    dp.fornecedor,
    SUM(fp.custo_perda) AS perda_total,
    ROW_NUMBER() OVER (PARTITION BY fp.organization_id ORDER BY SUM(fp.custo_perda) DESC) AS ranking
  FROM fato_perdas fp
  JOIN dim_produto dp ON dp.id = fp.produto_id
  WHERE fp.data_importacao >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY fp.organization_id, fp.produto_id, dp.codigo, dp.nome, dp.categoria, dp.fornecedor
),
totais AS (
  SELECT organization_id, SUM(perda_total) AS total_geral
  FROM ranked
  GROUP BY organization_id
)
SELECT
  r.organization_id,
  r.produto_id,
  r.codigo,
  r.nome,
  r.categoria,
  r.fornecedor,
  r.perda_total,
  r.ranking,
  ROUND((r.perda_total / t.total_geral * 100)::NUMERIC, 2) AS participacao_pct,
  ROUND((SUM(r.perda_total) OVER (PARTITION BY r.organization_id ORDER BY r.ranking) / t.total_geral * 100)::NUMERIC, 2) AS participacao_acumulada_pct,
  CASE
    WHEN SUM(r.perda_total) OVER (PARTITION BY r.organization_id ORDER BY r.ranking) / t.total_geral <= 0.80 THEN 'A'
    WHEN SUM(r.perda_total) OVER (PARTITION BY r.organization_id ORDER BY r.ranking) / t.total_geral <= 0.95 THEN 'B'
    ELSE 'C'
  END AS curva_abc
FROM ranked r
JOIN totais t ON t.organization_id = r.organization_id
WHERE r.ranking <= 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pareto_perdas ON mv_pareto_perdas(organization_id, produto_id);

COMMENT ON MATERIALIZED VIEW mv_pareto_perdas IS 'Análise de Pareto (80/20) dos produtos com maior perda';

-- ==========================================
-- FUNÇÃO: Refresh de Views Materializadas
-- ==========================================

CREATE OR REPLACE FUNCTION refresh_retail_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_metricas_diarias;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pareto_perdas;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- GRANTS para Views
-- ==========================================

GRANT SELECT ON v_dashboard_executivo TO authenticated;
GRANT SELECT ON v_ranking_lojas_rfe TO authenticated;
GRANT SELECT ON v_top_produtos_perda TO authenticated;
GRANT SELECT ON v_top_fornecedores_perda TO authenticated;
GRANT SELECT ON v_produtos_ruptura_frequente TO authenticated;
GRANT SELECT ON v_estoque_em_risco TO authenticated;
GRANT SELECT ON v_tendencia_perdas TO authenticated;
GRANT SELECT ON v_comparativo_periodos TO authenticated;
GRANT SELECT ON mv_metricas_diarias TO authenticated;
GRANT SELECT ON mv_pareto_perdas TO authenticated;

GRANT EXECUTE ON FUNCTION refresh_retail_materialized_views TO service_role;

-- ==========================================
-- COMENTÁRIOS FINAIS
-- ==========================================

COMMENT ON FUNCTION refresh_retail_materialized_views IS 'Atualiza todas as views materializadas de varejo. Executar via cron ou após importações.';
