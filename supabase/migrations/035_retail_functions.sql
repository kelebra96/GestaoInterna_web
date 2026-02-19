-- =============================================
-- Migration 035: Funções de Cálculo de Métricas de Varejo
-- Created: 2026-02-18
-- Description: Funções para cálculo de RFE, métricas e agregações
-- =============================================

-- ==========================================
-- CONSTANTES E CONFIGURAÇÃO
-- ==========================================

-- Tabela de configuração de parâmetros de cálculo
CREATE TABLE IF NOT EXISTS config_metricas_varejo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,

  -- Custo de capital (para RFE)
  custo_capital_anual DECIMAL(8,4) DEFAULT 0.12, -- 12% ao ano

  -- Limites para classificação de estoque
  dias_estoque_excesso INT DEFAULT 60, -- Acima = capital parado
  dias_estoque_morto INT DEFAULT 90,   -- Acima sem venda = morto

  -- Limites para RFE
  rfe_limite_baixo DECIMAL(18,2) DEFAULT 5000,
  rfe_limite_medio DECIMAL(18,2) DEFAULT 15000,
  rfe_limite_alto DECIMAL(18,2) DEFAULT 30000,
  -- Acima de alto = crítico

  -- Limites para perda
  perda_meta_faturamento_pct DECIMAL(8,4) DEFAULT 0.02, -- 2%
  perda_alerta_faturamento_pct DECIMAL(8,4) DEFAULT 0.03, -- 3%

  -- Limites para disponibilidade
  disponibilidade_meta_pct DECIMAL(8,4) DEFAULT 0.95, -- 95%
  disponibilidade_alerta_pct DECIMAL(8,4) DEFAULT 0.90, -- 90%

  -- Pesos para score de risco
  peso_perda INT DEFAULT 40,
  peso_ruptura INT DEFAULT 30,
  peso_estoque INT DEFAULT 30,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_metricas_org ON config_metricas_varejo(organization_id);

-- ==========================================
-- FUNÇÃO: Calcular RFE (Risk Financial Exposure)
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_rfe(
  p_organization_id UUID,
  p_loja_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE
)
RETURNS TABLE (
  rfe_total DECIMAL(18,2),
  componente_perdas DECIMAL(18,2),
  componente_vendas_perdidas DECIMAL(18,2),
  componente_capital_parado DECIMAL(18,2),
  custo_capital_aplicado DECIMAL(18,2),
  nivel VARCHAR(20)
) AS $$
DECLARE
  v_custo_capital DECIMAL(8,4);
  v_dias_periodo INT;
  v_perdas DECIMAL(18,2);
  v_vendas_perdidas DECIMAL(18,2);
  v_estoque_excessivo DECIMAL(18,2);
  v_custo_capital_proporcional DECIMAL(18,2);
  v_rfe DECIMAL(18,2);
  v_nivel VARCHAR(20);
  v_config config_metricas_varejo%ROWTYPE;
BEGIN
  -- Buscar configuração
  SELECT * INTO v_config FROM config_metricas_varejo WHERE organization_id = p_organization_id;
  IF v_config IS NULL THEN
    v_custo_capital := 0.12;
  ELSE
    v_custo_capital := v_config.custo_capital_anual;
  END IF;

  -- Calcular dias do período
  v_dias_periodo := p_periodo_fim - p_periodo_inicio;

  -- 1. Componente Perdas
  SELECT COALESCE(SUM(custo_perda), 0) INTO v_perdas
  FROM fato_perdas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- 2. Componente Vendas Perdidas (Rupturas)
  SELECT COALESCE(SUM(valor_venda_perdida), 0) INTO v_vendas_perdidas
  FROM fato_rupturas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- 3. Componente Estoque Excessivo (> 60 dias no último dia)
  SELECT COALESCE(SUM(custo_total), 0) INTO v_estoque_excessivo
  FROM fato_estoque
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao = p_periodo_fim
    AND dias_estoque > COALESCE(v_config.dias_estoque_excesso, 60);

  -- Custo do capital parado proporcional ao período
  v_custo_capital_proporcional := v_estoque_excessivo * (v_custo_capital * v_dias_periodo / 365);

  -- RFE Total
  v_rfe := v_perdas + v_vendas_perdidas + v_custo_capital_proporcional;

  -- Classificar nível
  IF v_config IS NOT NULL THEN
    IF v_rfe > v_config.rfe_limite_alto THEN
      v_nivel := 'critico';
    ELSIF v_rfe > v_config.rfe_limite_medio THEN
      v_nivel := 'alto';
    ELSIF v_rfe > v_config.rfe_limite_baixo THEN
      v_nivel := 'medio';
    ELSE
      v_nivel := 'baixo';
    END IF;
  ELSE
    IF v_rfe > 30000 THEN v_nivel := 'critico';
    ELSIF v_rfe > 15000 THEN v_nivel := 'alto';
    ELSIF v_rfe > 5000 THEN v_nivel := 'medio';
    ELSE v_nivel := 'baixo';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_rfe,
    v_perdas,
    v_vendas_perdidas,
    v_estoque_excessivo,
    v_custo_capital_proporcional,
    v_nivel;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calcular_rfe IS 'Calcula Risk Financial Exposure: Perdas + Vendas Perdidas + (Estoque Excessivo × Custo Capital)';

-- ==========================================
-- FUNÇÃO: Calcular Métricas de Estoque
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_metricas_estoque(
  p_organization_id UUID,
  p_loja_id UUID,
  p_data DATE
)
RETURNS TABLE (
  valor_total DECIMAL(18,2),
  quantidade_skus INT,
  giro_estoque DECIMAL(10,4),
  cobertura_dias DECIMAL(10,2),
  capital_parado DECIMAL(18,2),
  capital_parado_pct DECIMAL(8,4),
  estoque_morto_valor DECIMAL(18,2),
  estoque_morto_qtd INT,
  skus_ruptura INT
) AS $$
DECLARE
  v_config config_metricas_varejo%ROWTYPE;
  v_dias_excesso INT;
  v_dias_morto INT;
BEGIN
  SELECT * INTO v_config FROM config_metricas_varejo WHERE organization_id = p_organization_id;
  v_dias_excesso := COALESCE(v_config.dias_estoque_excesso, 60);
  v_dias_morto := COALESCE(v_config.dias_estoque_morto, 90);

  RETURN QUERY
  SELECT
    COALESCE(SUM(fe.custo_total), 0)::DECIMAL(18,2) AS valor_total,
    COUNT(DISTINCT fe.produto_id)::INT AS quantidade_skus,
    CASE
      WHEN SUM(fe.custo_total) > 0 THEN
        (COALESCE((
          SELECT SUM(fv.custo_total)
          FROM fato_vendas fv
          WHERE fv.organization_id = p_organization_id
            AND fv.loja_id = p_loja_id
            AND fv.data_importacao BETWEEN p_data - INTERVAL '30 days' AND p_data
        ), 0) / NULLIF(SUM(fe.custo_total), 0))::DECIMAL(10,4)
      ELSE 0
    END AS giro_estoque,
    COALESCE(AVG(fe.dias_estoque), 0)::DECIMAL(10,2) AS cobertura_dias,
    COALESCE(SUM(fe.custo_total) FILTER (WHERE fe.dias_estoque > v_dias_excesso), 0)::DECIMAL(18,2) AS capital_parado,
    CASE
      WHEN SUM(fe.custo_total) > 0 THEN
        (SUM(fe.custo_total) FILTER (WHERE fe.dias_estoque > v_dias_excesso) / SUM(fe.custo_total) * 100)::DECIMAL(8,4)
      ELSE 0
    END AS capital_parado_pct,
    COALESCE(SUM(fe.custo_total) FILTER (WHERE fe.dias_ultima_venda > v_dias_morto), 0)::DECIMAL(18,2) AS estoque_morto_valor,
    COUNT(*) FILTER (WHERE fe.dias_ultima_venda > v_dias_morto)::INT AS estoque_morto_qtd,
    COUNT(*) FILTER (WHERE fe.quantidade_disponivel <= 0)::INT AS skus_ruptura
  FROM fato_estoque fe
  WHERE fe.organization_id = p_organization_id
    AND fe.loja_id = p_loja_id
    AND fe.data_importacao = p_data;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- FUNÇÃO: Calcular Métricas de Perdas
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_metricas_perdas(
  p_organization_id UUID,
  p_loja_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE
)
RETURNS TABLE (
  perda_total DECIMAL(18,2),
  perda_quantidade DECIMAL(15,3),
  perda_sobre_faturamento_pct DECIMAL(8,4),
  perda_sobre_estoque_pct DECIMAL(8,4),
  perda_vencimento DECIMAL(18,2),
  perda_vencimento_pct DECIMAL(8,4),
  perda_avaria DECIMAL(18,2),
  perda_avaria_pct DECIMAL(8,4),
  perda_roubo DECIMAL(18,2),
  perda_roubo_pct DECIMAL(8,4),
  perda_outros DECIMAL(18,2),
  margem_perdida DECIMAL(18,2)
) AS $$
DECLARE
  v_faturamento DECIMAL(18,2);
  v_estoque DECIMAL(18,2);
  v_perda_total DECIMAL(18,2);
BEGIN
  -- Buscar faturamento do período
  SELECT COALESCE(SUM(valor_venda), 0) INTO v_faturamento
  FROM fato_vendas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- Buscar estoque médio
  SELECT COALESCE(AVG(custo_total), 0) INTO v_estoque
  FROM fato_estoque
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- Buscar perda total
  SELECT COALESCE(SUM(custo_perda), 0) INTO v_perda_total
  FROM fato_perdas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  RETURN QUERY
  SELECT
    COALESCE(SUM(fp.custo_perda), 0)::DECIMAL(18,2) AS perda_total,
    COALESCE(SUM(fp.quantidade_perda), 0)::DECIMAL(15,3) AS perda_quantidade,
    CASE WHEN v_faturamento > 0 THEN (v_perda_total / v_faturamento * 100)::DECIMAL(8,4) ELSE 0 END AS perda_sobre_faturamento_pct,
    CASE WHEN v_estoque > 0 THEN (v_perda_total / v_estoque * 100)::DECIMAL(8,4) ELSE 0 END AS perda_sobre_estoque_pct,
    COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'vencimento'), 0)::DECIMAL(18,2) AS perda_vencimento,
    CASE WHEN v_perda_total > 0 THEN (COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'vencimento'), 0) / v_perda_total * 100)::DECIMAL(8,4) ELSE 0 END AS perda_vencimento_pct,
    COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'avaria'), 0)::DECIMAL(18,2) AS perda_avaria,
    CASE WHEN v_perda_total > 0 THEN (COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'avaria'), 0) / v_perda_total * 100)::DECIMAL(8,4) ELSE 0 END AS perda_avaria_pct,
    COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'roubo'), 0)::DECIMAL(18,2) AS perda_roubo,
    CASE WHEN v_perda_total > 0 THEN (COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda = 'roubo'), 0) / v_perda_total * 100)::DECIMAL(8,4) ELSE 0 END AS perda_roubo_pct,
    COALESCE(SUM(fp.custo_perda) FILTER (WHERE fp.tipo_perda NOT IN ('vencimento', 'avaria', 'roubo')), 0)::DECIMAL(18,2) AS perda_outros,
    COALESCE(SUM(fp.margem_perdida), 0)::DECIMAL(18,2) AS margem_perdida
  FROM fato_perdas fp
  WHERE fp.organization_id = p_organization_id
    AND fp.loja_id = p_loja_id
    AND fp.data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- FUNÇÃO: Calcular Métricas de Ruptura
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_metricas_ruptura(
  p_organization_id UUID,
  p_loja_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE
)
RETURNS TABLE (
  vendas_perdidas DECIMAL(18,2),
  quantidade_perdida DECIMAL(15,3),
  venda_potencial DECIMAL(18,2),
  taxa_disponibilidade DECIMAL(8,4),
  impacto_margem DECIMAL(18,2),
  produtos_ruptura_freq INT
) AS $$
DECLARE
  v_vendas_realizadas DECIMAL(18,2);
  v_vendas_perdidas DECIMAL(18,2);
BEGIN
  -- Vendas realizadas
  SELECT COALESCE(SUM(valor_venda), 0) INTO v_vendas_realizadas
  FROM fato_vendas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- Vendas perdidas
  SELECT COALESCE(SUM(valor_venda_perdida), 0) INTO v_vendas_perdidas
  FROM fato_rupturas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  RETURN QUERY
  SELECT
    v_vendas_perdidas AS vendas_perdidas,
    COALESCE(SUM(fr.quantidade_perdida), 0)::DECIMAL(15,3) AS quantidade_perdida,
    (v_vendas_realizadas + v_vendas_perdidas)::DECIMAL(18,2) AS venda_potencial,
    CASE
      WHEN (v_vendas_realizadas + v_vendas_perdidas) > 0
      THEN (v_vendas_realizadas / (v_vendas_realizadas + v_vendas_perdidas))::DECIMAL(8,4)
      ELSE 1
    END AS taxa_disponibilidade,
    COALESCE(SUM(fr.margem_perdida), 0)::DECIMAL(18,2) AS impacto_margem,
    (
      SELECT COUNT(DISTINCT produto_id)
      FROM fato_rupturas fr2
      WHERE fr2.organization_id = p_organization_id
        AND fr2.loja_id = p_loja_id
        AND fr2.data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim
      GROUP BY produto_id
      HAVING COUNT(*) >= 3
    )::INT AS produtos_ruptura_freq
  FROM fato_rupturas fr
  WHERE fr.organization_id = p_organization_id
    AND fr.loja_id = p_loja_id
    AND fr.data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- FUNÇÃO: Consolidar Métricas por Loja
-- ==========================================

CREATE OR REPLACE FUNCTION consolidar_metricas_loja(
  p_organization_id UUID,
  p_loja_id UUID,
  p_periodo DATE,
  p_tipo_periodo VARCHAR(20) DEFAULT 'mensal'
)
RETURNS UUID AS $$
DECLARE
  v_periodo_inicio DATE;
  v_periodo_fim DATE;
  v_estoque RECORD;
  v_perdas RECORD;
  v_rupturas RECORD;
  v_rfe RECORD;
  v_vendas RECORD;
  v_id UUID;
BEGIN
  -- Determinar período
  CASE p_tipo_periodo
    WHEN 'diario' THEN
      v_periodo_inicio := p_periodo;
      v_periodo_fim := p_periodo;
    WHEN 'semanal' THEN
      v_periodo_inicio := DATE_TRUNC('week', p_periodo)::DATE;
      v_periodo_fim := v_periodo_inicio + INTERVAL '6 days';
    WHEN 'mensal' THEN
      v_periodo_inicio := DATE_TRUNC('month', p_periodo)::DATE;
      v_periodo_fim := (DATE_TRUNC('month', p_periodo) + INTERVAL '1 month - 1 day')::DATE;
    ELSE
      RAISE EXCEPTION 'Tipo de período inválido: %', p_tipo_periodo;
  END CASE;

  -- Calcular métricas de estoque
  SELECT * INTO v_estoque FROM calcular_metricas_estoque(p_organization_id, p_loja_id, v_periodo_fim);

  -- Calcular métricas de perdas
  SELECT * INTO v_perdas FROM calcular_metricas_perdas(p_organization_id, p_loja_id, v_periodo_inicio, v_periodo_fim);

  -- Calcular métricas de ruptura
  SELECT * INTO v_rupturas FROM calcular_metricas_ruptura(p_organization_id, p_loja_id, v_periodo_inicio, v_periodo_fim);

  -- Calcular RFE
  SELECT * INTO v_rfe FROM calcular_rfe(p_organization_id, p_loja_id, v_periodo_inicio, v_periodo_fim);

  -- Buscar vendas
  SELECT
    COALESCE(SUM(valor_venda), 0) AS faturamento_total,
    COALESCE(SUM(margem_valor), 0) AS margem_total,
    CASE WHEN SUM(valor_venda) > 0 THEN SUM(margem_valor) / SUM(valor_venda) * 100 ELSE 0 END AS margem_pct,
    COALESCE(SUM(valor_promocao), 0) AS valor_promocoes
  INTO v_vendas
  FROM fato_vendas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN v_periodo_inicio AND v_periodo_fim;

  -- Inserir ou atualizar agregação
  INSERT INTO agg_metricas_loja (
    organization_id, loja_id, periodo, tipo_periodo,
    -- Estoque
    valor_estoque_total, quantidade_skus, giro_estoque, cobertura_dias,
    capital_parado, estoque_acima_60_dias_pct, estoque_acima_60_dias_valor,
    estoque_morto_valor, estoque_morto_qtd, qtd_skus_ruptura,
    -- Perdas
    perda_valor_total, perda_quantidade_total, perda_sobre_faturamento_pct, perda_sobre_estoque_pct,
    perda_vencimento_valor, perda_vencimento_pct, perda_avaria_valor, perda_avaria_pct,
    perda_roubo_valor, perda_roubo_pct, margem_perdida_total,
    -- Rupturas
    vendas_perdidas_valor, vendas_perdidas_quantidade, venda_potencial, taxa_disponibilidade,
    ruptura_recorrente_qtd, impacto_margem_ruptura,
    -- Vendas
    faturamento_total, margem_bruta_valor, margem_bruta_pct, valor_promocoes,
    -- RFE
    rfe_score, rfe_componente_perdas, rfe_componente_vendas_perdidas, rfe_componente_capital_parado, rfe_nivel,
    -- Metadata
    calculado_em
  ) VALUES (
    p_organization_id, p_loja_id, p_periodo, p_tipo_periodo,
    -- Estoque
    v_estoque.valor_total, v_estoque.quantidade_skus, v_estoque.giro_estoque, v_estoque.cobertura_dias,
    v_estoque.capital_parado, v_estoque.capital_parado_pct, v_estoque.capital_parado,
    v_estoque.estoque_morto_valor, v_estoque.estoque_morto_qtd, v_estoque.skus_ruptura,
    -- Perdas
    v_perdas.perda_total, v_perdas.perda_quantidade, v_perdas.perda_sobre_faturamento_pct, v_perdas.perda_sobre_estoque_pct,
    v_perdas.perda_vencimento, v_perdas.perda_vencimento_pct, v_perdas.perda_avaria, v_perdas.perda_avaria_pct,
    v_perdas.perda_roubo, v_perdas.perda_roubo_pct, v_perdas.margem_perdida,
    -- Rupturas
    v_rupturas.vendas_perdidas, v_rupturas.quantidade_perdida, v_rupturas.venda_potencial, v_rupturas.taxa_disponibilidade,
    COALESCE(v_rupturas.produtos_ruptura_freq, 0), v_rupturas.impacto_margem,
    -- Vendas
    v_vendas.faturamento_total, v_vendas.margem_total, v_vendas.margem_pct, v_vendas.valor_promocoes,
    -- RFE
    v_rfe.rfe_total, v_rfe.componente_perdas, v_rfe.componente_vendas_perdidas, v_rfe.componente_capital_parado, v_rfe.nivel,
    -- Metadata
    NOW()
  )
  ON CONFLICT (organization_id, loja_id, periodo, tipo_periodo)
  DO UPDATE SET
    valor_estoque_total = EXCLUDED.valor_estoque_total,
    quantidade_skus = EXCLUDED.quantidade_skus,
    giro_estoque = EXCLUDED.giro_estoque,
    cobertura_dias = EXCLUDED.cobertura_dias,
    capital_parado = EXCLUDED.capital_parado,
    estoque_acima_60_dias_pct = EXCLUDED.estoque_acima_60_dias_pct,
    estoque_acima_60_dias_valor = EXCLUDED.estoque_acima_60_dias_valor,
    estoque_morto_valor = EXCLUDED.estoque_morto_valor,
    estoque_morto_qtd = EXCLUDED.estoque_morto_qtd,
    qtd_skus_ruptura = EXCLUDED.qtd_skus_ruptura,
    perda_valor_total = EXCLUDED.perda_valor_total,
    perda_quantidade_total = EXCLUDED.perda_quantidade_total,
    perda_sobre_faturamento_pct = EXCLUDED.perda_sobre_faturamento_pct,
    perda_sobre_estoque_pct = EXCLUDED.perda_sobre_estoque_pct,
    perda_vencimento_valor = EXCLUDED.perda_vencimento_valor,
    perda_vencimento_pct = EXCLUDED.perda_vencimento_pct,
    perda_avaria_valor = EXCLUDED.perda_avaria_valor,
    perda_avaria_pct = EXCLUDED.perda_avaria_pct,
    perda_roubo_valor = EXCLUDED.perda_roubo_valor,
    perda_roubo_pct = EXCLUDED.perda_roubo_pct,
    margem_perdida_total = EXCLUDED.margem_perdida_total,
    vendas_perdidas_valor = EXCLUDED.vendas_perdidas_valor,
    vendas_perdidas_quantidade = EXCLUDED.vendas_perdidas_quantidade,
    venda_potencial = EXCLUDED.venda_potencial,
    taxa_disponibilidade = EXCLUDED.taxa_disponibilidade,
    ruptura_recorrente_qtd = EXCLUDED.ruptura_recorrente_qtd,
    impacto_margem_ruptura = EXCLUDED.impacto_margem_ruptura,
    faturamento_total = EXCLUDED.faturamento_total,
    margem_bruta_valor = EXCLUDED.margem_bruta_valor,
    margem_bruta_pct = EXCLUDED.margem_bruta_pct,
    valor_promocoes = EXCLUDED.valor_promocoes,
    rfe_score = EXCLUDED.rfe_score,
    rfe_componente_perdas = EXCLUDED.rfe_componente_perdas,
    rfe_componente_vendas_perdidas = EXCLUDED.rfe_componente_vendas_perdidas,
    rfe_componente_capital_parado = EXCLUDED.rfe_componente_capital_parado,
    rfe_nivel = EXCLUDED.rfe_nivel,
    calculado_em = EXCLUDED.calculado_em,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNÇÃO: Consolidar Métricas da Rede
-- ==========================================

CREATE OR REPLACE FUNCTION consolidar_metricas_rede(
  p_organization_id UUID,
  p_periodo DATE,
  p_tipo_periodo VARCHAR(20) DEFAULT 'mensal'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Primeiro, consolidar todas as lojas
  PERFORM consolidar_metricas_loja(p_organization_id, loja_id, p_periodo, p_tipo_periodo)
  FROM dim_loja
  WHERE organization_id = p_organization_id AND ativo = true;

  -- Calcular ranking de RFE
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY rfe_score DESC) AS rank
    FROM agg_metricas_loja
    WHERE organization_id = p_organization_id
      AND periodo = p_periodo
      AND tipo_periodo = p_tipo_periodo
  )
  UPDATE agg_metricas_loja aml
  SET rfe_rank = r.rank
  FROM ranked r
  WHERE aml.id = r.id;

  -- Consolidar rede
  INSERT INTO agg_metricas_rede (
    organization_id, periodo, tipo_periodo,
    qtd_lojas_ativas,
    -- Estoque
    valor_estoque_total, custo_estoque_total, giro_estoque_medio, cobertura_dias_media, capital_parado_total, estoque_morto_total,
    -- Perdas
    perda_valor_total, perda_sobre_faturamento_pct, perda_sobre_estoque_pct,
    perda_vencimento_total, perda_avaria_total, perda_roubo_total,
    -- Rupturas
    vendas_perdidas_total, taxa_disponibilidade_media, impacto_margem_ruptura_total,
    -- Vendas
    faturamento_total, margem_bruta_media, ticket_medio,
    -- Promoções
    valor_promocoes_total,
    -- RFE
    rfe_total, rfe_medio_por_loja, lojas_risco_critico, lojas_risco_alto, lojas_risco_medio, lojas_risco_baixo,
    -- Percentis
    percentil_perda_p50, percentil_perda_p75, percentil_perda_p90,
    percentil_rfe_p50, percentil_rfe_p75, percentil_rfe_p90,
    calculado_em
  )
  SELECT
    p_organization_id, p_periodo, p_tipo_periodo,
    COUNT(*),
    -- Estoque
    SUM(valor_estoque_total), SUM(custo_estoque_total), AVG(giro_estoque), AVG(cobertura_dias), SUM(capital_parado), SUM(estoque_morto_valor),
    -- Perdas
    SUM(perda_valor_total),
    CASE WHEN SUM(faturamento_total) > 0 THEN SUM(perda_valor_total) / SUM(faturamento_total) * 100 ELSE 0 END,
    CASE WHEN SUM(valor_estoque_total) > 0 THEN SUM(perda_valor_total) / SUM(valor_estoque_total) * 100 ELSE 0 END,
    SUM(perda_vencimento_valor), SUM(perda_avaria_valor), SUM(perda_roubo_valor),
    -- Rupturas
    SUM(vendas_perdidas_valor), AVG(taxa_disponibilidade), SUM(impacto_margem_ruptura),
    -- Vendas
    SUM(faturamento_total), AVG(margem_bruta_pct), AVG(ticket_medio),
    -- Promoções
    SUM(valor_promocoes),
    -- RFE
    SUM(rfe_score), AVG(rfe_score),
    COUNT(*) FILTER (WHERE rfe_nivel = 'critico'),
    COUNT(*) FILTER (WHERE rfe_nivel = 'alto'),
    COUNT(*) FILTER (WHERE rfe_nivel = 'medio'),
    COUNT(*) FILTER (WHERE rfe_nivel = 'baixo'),
    -- Percentis
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY perda_valor_total),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY perda_valor_total),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY perda_valor_total),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rfe_score),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rfe_score),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY rfe_score),
    NOW()
  FROM agg_metricas_loja
  WHERE organization_id = p_organization_id
    AND periodo = p_periodo
    AND tipo_periodo = p_tipo_periodo
  ON CONFLICT (organization_id, periodo, tipo_periodo)
  DO UPDATE SET
    qtd_lojas_ativas = EXCLUDED.qtd_lojas_ativas,
    valor_estoque_total = EXCLUDED.valor_estoque_total,
    custo_estoque_total = EXCLUDED.custo_estoque_total,
    giro_estoque_medio = EXCLUDED.giro_estoque_medio,
    cobertura_dias_media = EXCLUDED.cobertura_dias_media,
    capital_parado_total = EXCLUDED.capital_parado_total,
    estoque_morto_total = EXCLUDED.estoque_morto_total,
    perda_valor_total = EXCLUDED.perda_valor_total,
    perda_sobre_faturamento_pct = EXCLUDED.perda_sobre_faturamento_pct,
    perda_sobre_estoque_pct = EXCLUDED.perda_sobre_estoque_pct,
    perda_vencimento_total = EXCLUDED.perda_vencimento_total,
    perda_avaria_total = EXCLUDED.perda_avaria_total,
    perda_roubo_total = EXCLUDED.perda_roubo_total,
    vendas_perdidas_total = EXCLUDED.vendas_perdidas_total,
    taxa_disponibilidade_media = EXCLUDED.taxa_disponibilidade_media,
    impacto_margem_ruptura_total = EXCLUDED.impacto_margem_ruptura_total,
    faturamento_total = EXCLUDED.faturamento_total,
    margem_bruta_media = EXCLUDED.margem_bruta_media,
    ticket_medio = EXCLUDED.ticket_medio,
    valor_promocoes_total = EXCLUDED.valor_promocoes_total,
    rfe_total = EXCLUDED.rfe_total,
    rfe_medio_por_loja = EXCLUDED.rfe_medio_por_loja,
    lojas_risco_critico = EXCLUDED.lojas_risco_critico,
    lojas_risco_alto = EXCLUDED.lojas_risco_alto,
    lojas_risco_medio = EXCLUDED.lojas_risco_medio,
    lojas_risco_baixo = EXCLUDED.lojas_risco_baixo,
    percentil_perda_p50 = EXCLUDED.percentil_perda_p50,
    percentil_perda_p75 = EXCLUDED.percentil_perda_p75,
    percentil_perda_p90 = EXCLUDED.percentil_perda_p90,
    percentil_rfe_p50 = EXCLUDED.percentil_rfe_p50,
    percentil_rfe_p75 = EXCLUDED.percentil_rfe_p75,
    percentil_rfe_p90 = EXCLUDED.percentil_rfe_p90,
    calculado_em = EXCLUDED.calculado_em,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGER para updated_at
-- ==========================================

CREATE TRIGGER update_config_metricas_updated_at
  BEFORE UPDATE ON config_metricas_varejo
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE config_metricas_varejo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_metricas_select_org" ON config_metricas_varejo
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "config_metricas_manage_org" ON config_metricas_varejo
  FOR ALL USING (organization_id = get_current_org_id() AND is_org_admin());

CREATE POLICY "config_metricas_service" ON config_metricas_varejo
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON config_metricas_varejo TO authenticated;
GRANT ALL ON config_metricas_varejo TO service_role;

GRANT EXECUTE ON FUNCTION calcular_rfe TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_metricas_estoque TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_metricas_perdas TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_metricas_ruptura TO authenticated;
GRANT EXECUTE ON FUNCTION consolidar_metricas_loja TO service_role;
GRANT EXECUTE ON FUNCTION consolidar_metricas_rede TO service_role;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION calcular_rfe IS 'Calcula Risk Financial Exposure para uma loja em um período';
COMMENT ON FUNCTION calcular_metricas_estoque IS 'Calcula métricas de estoque para uma loja em uma data';
COMMENT ON FUNCTION calcular_metricas_perdas IS 'Calcula métricas de perdas para uma loja em um período';
COMMENT ON FUNCTION calcular_metricas_ruptura IS 'Calcula métricas de ruptura para uma loja em um período';
COMMENT ON FUNCTION consolidar_metricas_loja IS 'Consolida todas as métricas de uma loja e salva na tabela de agregação';
COMMENT ON FUNCTION consolidar_metricas_rede IS 'Consolida métricas de todas as lojas e gera visão da rede';
