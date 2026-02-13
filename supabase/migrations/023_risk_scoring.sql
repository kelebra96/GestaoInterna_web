-- ==========================================
-- Migration 023: Sistema de Score de Risco
-- Created: 2026-02-11
-- Description: Tabelas, views e funções para cálculo de risco de perdas
-- ==========================================

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE risk_trend AS ENUM ('improving', 'stable', 'worsening');
CREATE TYPE risk_entity_type AS ENUM ('store', 'product', 'category', 'supplier');

-- ==========================================
-- TABELA: risk_scores (Scores Calculados)
-- ==========================================

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  -- Entidade avaliada
  entity_type risk_entity_type NOT NULL,
  entity_id VARCHAR(255) NOT NULL, -- store_id, product_id, category, supplier
  entity_name VARCHAR(255),

  -- Score principal (0-100, maior = mais risco)
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  level risk_level NOT NULL,
  trend risk_trend DEFAULT 'stable',

  -- Componentes do score (cada um de 0-100)
  expiry_score INTEGER DEFAULT 0,        -- Risco de vencimento
  rupture_score INTEGER DEFAULT 0,       -- Risco de ruptura
  recurrence_score INTEGER DEFAULT 0,    -- Recorrência de problemas
  financial_score INTEGER DEFAULT 0,     -- Impacto financeiro
  efficiency_score INTEGER DEFAULT 0,    -- Eficiência de resolução (inverso)

  -- Métricas base usadas no cálculo
  metrics JSONB DEFAULT '{}'::JSONB,

  -- Período de cálculo
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_entity_period UNIQUE(org_id, entity_type, entity_id, period_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_risk_scores_org_id ON risk_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_entity ON risk_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON risk_scores(level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_score ON risk_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_period ON risk_scores(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_risk_scores_org_type_period ON risk_scores(org_id, entity_type, period_start);

COMMENT ON TABLE risk_scores IS 'Scores de risco calculados para lojas, produtos, categorias e fornecedores';
COMMENT ON COLUMN risk_scores.score IS 'Score geral de risco (0-100). Maior = mais risco';
COMMENT ON COLUMN risk_scores.metrics IS 'Métricas detalhadas usadas no cálculo do score';

-- ==========================================
-- TABELA: risk_alerts (Alertas de Risco)
-- ==========================================

CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID,

  -- Entidade relacionada
  entity_type risk_entity_type NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(255),

  -- Alerta
  alert_type VARCHAR(50) NOT NULL, -- score_increased, critical_level, trend_worsening, etc
  severity risk_level NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Score quando alerta foi gerado
  current_score INTEGER,
  previous_score INTEGER,
  score_change INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_risk_alerts_org_id ON risk_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_store_id ON risk_alerts(store_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_active ON risk_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_risk_alerts_severity ON risk_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_created ON risk_alerts(created_at DESC);

COMMENT ON TABLE risk_alerts IS 'Alertas gerados automaticamente baseados em mudanças de score';

-- ==========================================
-- TABELA: risk_score_history (Histórico)
-- ==========================================

CREATE TABLE IF NOT EXISTS risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  entity_type risk_entity_type NOT NULL,
  entity_id VARCHAR(255) NOT NULL,

  -- Snapshot do score
  score INTEGER NOT NULL,
  level risk_level NOT NULL,
  components JSONB NOT NULL, -- expiry_score, rupture_score, etc

  -- Quando foi registrado
  recorded_at DATE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_history_entry UNIQUE(org_id, entity_type, entity_id, recorded_at)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_risk_history_entity ON risk_score_history(org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_date ON risk_score_history(recorded_at);

COMMENT ON TABLE risk_score_history IS 'Histórico diário de scores para análise de tendência';

-- ==========================================
-- TABELA: risk_thresholds (Configuração de Limites)
-- ==========================================

CREATE TABLE IF NOT EXISTS risk_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,

  -- Limites de score por nível
  low_max INTEGER DEFAULT 25,
  medium_max INTEGER DEFAULT 50,
  high_max INTEGER DEFAULT 75,
  -- Acima de high_max = critical

  -- Pesos dos componentes (devem somar 100)
  weight_expiry INTEGER DEFAULT 30,
  weight_rupture INTEGER DEFAULT 20,
  weight_recurrence INTEGER DEFAULT 20,
  weight_financial INTEGER DEFAULT 15,
  weight_efficiency INTEGER DEFAULT 15,

  -- Configurações de alerta
  alert_on_critical BOOLEAN DEFAULT true,
  alert_on_score_increase INTEGER DEFAULT 15, -- Alertar se score subir X pontos
  alert_on_trend_change BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE risk_thresholds IS 'Configuração customizável de limites e pesos por organização';

-- ==========================================
-- VIEWS MATERIALIZADAS
-- ==========================================

-- View: Métricas agregadas por loja para cálculo de score
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_risk_metrics AS
SELECT
  s.company_id AS org_id,
  s.id AS store_id,
  s.name AS store_name,
  s.code AS store_code,

  -- Métricas de vencimento (últimos 30 dias)
  COUNT(DISTINCT er.id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '30 days') AS reports_30d,
  COUNT(DISTINCT er.id) FILTER (WHERE er.status = 'reported' AND er.expiry_date < NOW()) AS overdue_count,
  COUNT(DISTINCT er.id) FILTER (WHERE er.status IN ('reported', 'watching', 'confirmed')) AS open_count,
  COUNT(DISTINCT er.id) FILTER (WHERE er.status = 'resolved') AS resolved_count,

  -- Valor em risco
  COALESCE(SUM(er.quantity * p.price) FILTER (
    WHERE er.status IN ('reported', 'watching', 'confirmed')
    AND er.expiry_date <= NOW() + INTERVAL '7 days'
  ), 0) AS value_at_risk,

  -- Eficiência
  CASE
    WHEN COUNT(*) FILTER (WHERE er.status = 'resolved') > 0 THEN
      ROUND(
        COUNT(*) FILTER (WHERE er.status = 'resolved' AND er.resolved_at < er.expiry_date)::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE er.status = 'resolved'), 0) * 100
      )
    ELSE NULL
  END AS efficiency_rate,

  -- Tempo médio de resolução (horas)
  ROUND(AVG(EXTRACT(EPOCH FROM (er.resolved_at - er.created_at)) / 3600) FILTER (
    WHERE er.status = 'resolved' AND er.resolved_at IS NOT NULL
  )::NUMERIC, 1) AS avg_resolution_hours,

  -- Recorrência (produtos com múltiplos reports)
  COUNT(DISTINCT er.product_id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '30 days') AS products_affected,

  NOW() AS refreshed_at

FROM stores s
LEFT JOIN expiry_reports er ON er.store_id = s.id
LEFT JOIN products p ON p.id = er.product_id
WHERE s.company_id IS NOT NULL
GROUP BY s.company_id, s.id, s.name, s.code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_store_risk_metrics ON mv_store_risk_metrics(org_id, store_id);

-- View: Métricas agregadas por produto
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_risk_metrics AS
SELECT
  i.company_id AS org_id,
  p.id AS product_id,
  p.sku,
  p.ean,
  p.name AS product_name,
  p.brand,
  p.category,
  p.price,

  -- Ocorrências (últimos 90 dias)
  COUNT(DISTINCT er.id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '90 days') AS occurrences_90d,
  COUNT(DISTINCT er.store_id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '90 days') AS stores_affected,

  -- Quantidade e valor
  COALESCE(SUM(er.quantity) FILTER (WHERE er.created_at >= NOW() - INTERVAL '90 days'), 0) AS total_quantity,
  COALESCE(SUM(er.quantity * p.price) FILTER (WHERE er.created_at >= NOW() - INTERVAL '90 days'), 0) AS total_value_at_risk,

  -- Taxa de resolução
  CASE
    WHEN COUNT(*) FILTER (WHERE er.status = 'resolved' AND er.created_at >= NOW() - INTERVAL '90 days') > 0 THEN
      ROUND(
        COUNT(*) FILTER (WHERE er.status = 'resolved' AND er.resolved_at < er.expiry_date AND er.created_at >= NOW() - INTERVAL '90 days')::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE er.status = 'resolved' AND er.created_at >= NOW() - INTERVAL '90 days'), 0) * 100
      )
    ELSE NULL
  END AS efficiency_rate,

  -- Recorrência média (ocorrências por mês)
  ROUND(
    COUNT(DISTINCT er.id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '90 days')::NUMERIC / 3,
    1
  ) AS avg_monthly_occurrences,

  NOW() AS refreshed_at

FROM products p
LEFT JOIN expiry_reports er ON er.product_id = p.id
LEFT JOIN inventories i ON i.id = (
  SELECT ii.inventory_id FROM inventory_items ii WHERE ii.ean = p.ean LIMIT 1
)
WHERE p.active = true
GROUP BY p.id, p.sku, p.ean, p.name, p.brand, p.category, p.price, i.company_id
HAVING COUNT(er.id) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_risk_metrics ON mv_product_risk_metrics(org_id, product_id);

-- View: Métricas por categoria
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_risk_metrics AS
SELECT
  i.company_id AS org_id,
  p.category,

  COUNT(DISTINCT er.id) FILTER (WHERE er.created_at >= NOW() - INTERVAL '30 days') AS reports_30d,
  COUNT(DISTINCT p.id) AS products_count,
  COUNT(DISTINCT er.store_id) AS stores_affected,

  COALESCE(SUM(er.quantity * p.price) FILTER (
    WHERE er.status IN ('reported', 'watching', 'confirmed')
  ), 0) AS value_at_risk,

  CASE
    WHEN COUNT(*) FILTER (WHERE er.status = 'resolved') > 0 THEN
      ROUND(
        COUNT(*) FILTER (WHERE er.status = 'resolved' AND er.resolved_at < er.expiry_date)::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE er.status = 'resolved'), 0) * 100
      )
    ELSE NULL
  END AS efficiency_rate,

  NOW() AS refreshed_at

FROM products p
LEFT JOIN expiry_reports er ON er.product_id = p.id
LEFT JOIN inventories i ON i.id = (
  SELECT ii.inventory_id FROM inventory_items ii WHERE ii.ean = p.ean LIMIT 1
)
WHERE p.category IS NOT NULL AND p.category != ''
GROUP BY i.company_id, p.category
HAVING COUNT(er.id) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_risk_metrics ON mv_category_risk_metrics(org_id, category);

-- ==========================================
-- FUNÇÕES DE CÁLCULO DE SCORE
-- ==========================================

-- Função: Determinar nível baseado no score
CREATE OR REPLACE FUNCTION get_risk_level(p_score INTEGER, p_org_id UUID DEFAULT NULL)
RETURNS risk_level AS $$
DECLARE
  v_low_max INTEGER := 25;
  v_medium_max INTEGER := 50;
  v_high_max INTEGER := 75;
BEGIN
  -- Buscar thresholds customizados
  IF p_org_id IS NOT NULL THEN
    SELECT low_max, medium_max, high_max
    INTO v_low_max, v_medium_max, v_high_max
    FROM risk_thresholds
    WHERE org_id = p_org_id;
  END IF;

  IF p_score <= v_low_max THEN RETURN 'low';
  ELSIF p_score <= v_medium_max THEN RETURN 'medium';
  ELSIF p_score <= v_high_max THEN RETURN 'high';
  ELSE RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Calcular tendência baseada em histórico
CREATE OR REPLACE FUNCTION calculate_risk_trend(
  p_org_id UUID,
  p_entity_type risk_entity_type,
  p_entity_id VARCHAR,
  p_current_score INTEGER
)
RETURNS risk_trend AS $$
DECLARE
  v_prev_score INTEGER;
  v_diff INTEGER;
BEGIN
  -- Buscar score de 7 dias atrás
  SELECT score INTO v_prev_score
  FROM risk_score_history
  WHERE org_id = p_org_id
    AND entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND recorded_at = CURRENT_DATE - INTERVAL '7 days';

  IF v_prev_score IS NULL THEN
    RETURN 'stable';
  END IF;

  v_diff := p_current_score - v_prev_score;

  IF v_diff <= -5 THEN RETURN 'improving';
  ELSIF v_diff >= 5 THEN RETURN 'worsening';
  ELSE RETURN 'stable';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Calcular score de risco para uma loja
CREATE OR REPLACE FUNCTION calculate_store_risk_score(
  p_org_id UUID,
  p_store_id UUID
)
RETURNS TABLE (
  score INTEGER,
  level risk_level,
  trend risk_trend,
  expiry_score INTEGER,
  rupture_score INTEGER,
  recurrence_score INTEGER,
  financial_score INTEGER,
  efficiency_score INTEGER,
  metrics JSONB
) AS $$
DECLARE
  v_metrics mv_store_risk_metrics%ROWTYPE;
  v_weights risk_thresholds%ROWTYPE;
  v_expiry_score INTEGER := 0;
  v_rupture_score INTEGER := 0;
  v_recurrence_score INTEGER := 0;
  v_financial_score INTEGER := 0;
  v_efficiency_score INTEGER := 0;
  v_total_score INTEGER := 0;
  v_level risk_level;
  v_trend risk_trend;
BEGIN
  -- Buscar métricas da loja
  SELECT * INTO v_metrics
  FROM mv_store_risk_metrics m
  WHERE m.org_id = p_org_id AND m.store_id = p_store_id;

  IF v_metrics IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 'low'::risk_level, 'stable'::risk_trend,
      0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, '{}'::JSONB;
    RETURN;
  END IF;

  -- Buscar pesos (ou usar default)
  SELECT * INTO v_weights FROM risk_thresholds WHERE org_id = p_org_id;
  IF v_weights IS NULL THEN
    v_weights.weight_expiry := 30;
    v_weights.weight_rupture := 20;
    v_weights.weight_recurrence := 20;
    v_weights.weight_financial := 15;
    v_weights.weight_efficiency := 15;
  END IF;

  -- Calcular score de vencimento (baseado em vencidos abertos)
  IF v_metrics.open_count > 0 THEN
    v_expiry_score := LEAST(100, (v_metrics.overdue_count::NUMERIC / v_metrics.open_count * 100)::INTEGER);
  END IF;

  -- Score de recorrência (baseado em reports nos últimos 30 dias)
  v_recurrence_score := LEAST(100, (v_metrics.reports_30d * 3)::INTEGER);

  -- Score financeiro (baseado em valor em risco)
  -- R$ 5000 = score 50, R$ 10000+ = score 100
  v_financial_score := LEAST(100, (v_metrics.value_at_risk / 100)::INTEGER);

  -- Score de eficiência (invertido - baixa eficiência = alto risco)
  IF v_metrics.efficiency_rate IS NOT NULL THEN
    v_efficiency_score := (100 - v_metrics.efficiency_rate)::INTEGER;
  ELSE
    v_efficiency_score := 50; -- Sem dados = risco médio
  END IF;

  -- Calcular score total ponderado
  v_total_score := (
    (v_expiry_score * v_weights.weight_expiry) +
    (v_rupture_score * v_weights.weight_rupture) +
    (v_recurrence_score * v_weights.weight_recurrence) +
    (v_financial_score * v_weights.weight_financial) +
    (v_efficiency_score * v_weights.weight_efficiency)
  ) / 100;

  v_total_score := LEAST(100, GREATEST(0, v_total_score));

  -- Determinar nível
  v_level := get_risk_level(v_total_score, p_org_id);

  -- Calcular tendência
  v_trend := calculate_risk_trend(p_org_id, 'store', p_store_id::VARCHAR, v_total_score);

  RETURN QUERY SELECT
    v_total_score,
    v_level,
    v_trend,
    v_expiry_score,
    v_rupture_score,
    v_recurrence_score,
    v_financial_score,
    v_efficiency_score,
    jsonb_build_object(
      'reports_30d', v_metrics.reports_30d,
      'overdue_count', v_metrics.overdue_count,
      'open_count', v_metrics.open_count,
      'resolved_count', v_metrics.resolved_count,
      'value_at_risk', v_metrics.value_at_risk,
      'efficiency_rate', v_metrics.efficiency_rate,
      'avg_resolution_hours', v_metrics.avg_resolution_hours,
      'products_affected', v_metrics.products_affected
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Calcular score de risco para um produto
CREATE OR REPLACE FUNCTION calculate_product_risk_score(
  p_org_id UUID,
  p_product_id UUID
)
RETURNS TABLE (
  score INTEGER,
  level risk_level,
  trend risk_trend,
  expiry_score INTEGER,
  recurrence_score INTEGER,
  financial_score INTEGER,
  spread_score INTEGER,
  metrics JSONB
) AS $$
DECLARE
  v_metrics mv_product_risk_metrics%ROWTYPE;
  v_total_score INTEGER := 0;
  v_expiry_score INTEGER := 0;
  v_recurrence_score INTEGER := 0;
  v_financial_score INTEGER := 0;
  v_spread_score INTEGER := 0;
  v_level risk_level;
  v_trend risk_trend;
BEGIN
  -- Buscar métricas do produto
  SELECT * INTO v_metrics
  FROM mv_product_risk_metrics m
  WHERE m.org_id = p_org_id AND m.product_id = p_product_id;

  IF v_metrics IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 'low'::risk_level, 'stable'::risk_trend,
      0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, '{}'::JSONB;
    RETURN;
  END IF;

  -- Score de recorrência (baseado em ocorrências mensais)
  -- 1 ocorrência/mês = 20, 5+ = 100
  v_recurrence_score := LEAST(100, (v_metrics.avg_monthly_occurrences * 20)::INTEGER);

  -- Score financeiro
  v_financial_score := LEAST(100, (v_metrics.total_value_at_risk / 50)::INTEGER);

  -- Score de dispersão (quantas lojas afetadas)
  -- 1 loja = 10, 5+ lojas = 100
  v_spread_score := LEAST(100, (v_metrics.stores_affected * 20)::INTEGER);

  -- Score de eficiência
  IF v_metrics.efficiency_rate IS NOT NULL THEN
    v_expiry_score := (100 - v_metrics.efficiency_rate)::INTEGER;
  ELSE
    v_expiry_score := 50;
  END IF;

  -- Score total (média ponderada)
  v_total_score := (
    (v_recurrence_score * 35) +
    (v_financial_score * 25) +
    (v_spread_score * 20) +
    (v_expiry_score * 20)
  ) / 100;

  v_total_score := LEAST(100, GREATEST(0, v_total_score));

  v_level := get_risk_level(v_total_score, p_org_id);
  v_trend := calculate_risk_trend(p_org_id, 'product', p_product_id::VARCHAR, v_total_score);

  RETURN QUERY SELECT
    v_total_score,
    v_level,
    v_trend,
    v_expiry_score,
    v_recurrence_score,
    v_financial_score,
    v_spread_score,
    jsonb_build_object(
      'occurrences_90d', v_metrics.occurrences_90d,
      'stores_affected', v_metrics.stores_affected,
      'total_quantity', v_metrics.total_quantity,
      'total_value_at_risk', v_metrics.total_value_at_risk,
      'avg_monthly_occurrences', v_metrics.avg_monthly_occurrences,
      'efficiency_rate', v_metrics.efficiency_rate
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Atualizar todos os scores de uma organização
CREATE OR REPLACE FUNCTION refresh_all_risk_scores(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_store RECORD;
  v_product RECORD;
  v_result RECORD;
BEGIN
  -- Refresh das views materializadas
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_risk_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_risk_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_risk_metrics;

  -- Calcular scores de lojas
  FOR v_store IN
    SELECT store_id FROM mv_store_risk_metrics WHERE org_id = p_org_id
  LOOP
    SELECT * INTO v_result FROM calculate_store_risk_score(p_org_id, v_store.store_id);

    INSERT INTO risk_scores (
      org_id, entity_type, entity_id, entity_name,
      score, level, trend,
      expiry_score, rupture_score, recurrence_score, financial_score, efficiency_score,
      metrics, period_start, period_end
    )
    SELECT
      p_org_id, 'store', v_store.store_id::VARCHAR, m.store_name,
      v_result.score, v_result.level, v_result.trend,
      v_result.expiry_score, v_result.rupture_score, v_result.recurrence_score,
      v_result.financial_score, v_result.efficiency_score,
      v_result.metrics,
      CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE
    FROM mv_store_risk_metrics m
    WHERE m.store_id = v_store.store_id
    ON CONFLICT (org_id, entity_type, entity_id, period_start)
    DO UPDATE SET
      score = EXCLUDED.score,
      level = EXCLUDED.level,
      trend = EXCLUDED.trend,
      expiry_score = EXCLUDED.expiry_score,
      rupture_score = EXCLUDED.rupture_score,
      recurrence_score = EXCLUDED.recurrence_score,
      financial_score = EXCLUDED.financial_score,
      efficiency_score = EXCLUDED.efficiency_score,
      metrics = EXCLUDED.metrics,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  -- Calcular scores de produtos
  FOR v_product IN
    SELECT product_id FROM mv_product_risk_metrics WHERE org_id = p_org_id
  LOOP
    SELECT * INTO v_result FROM calculate_product_risk_score(p_org_id, v_product.product_id);

    INSERT INTO risk_scores (
      org_id, entity_type, entity_id, entity_name,
      score, level, trend,
      expiry_score, recurrence_score, financial_score,
      metrics, period_start, period_end
    )
    SELECT
      p_org_id, 'product', v_product.product_id::VARCHAR, m.product_name,
      v_result.score, v_result.level, v_result.trend,
      v_result.expiry_score, v_result.recurrence_score, v_result.financial_score,
      v_result.metrics,
      CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE
    FROM mv_product_risk_metrics m
    WHERE m.product_id = v_product.product_id
    ON CONFLICT (org_id, entity_type, entity_id, period_start)
    DO UPDATE SET
      score = EXCLUDED.score,
      level = EXCLUDED.level,
      trend = EXCLUDED.trend,
      expiry_score = EXCLUDED.expiry_score,
      recurrence_score = EXCLUDED.recurrence_score,
      financial_score = EXCLUDED.financial_score,
      metrics = EXCLUDED.metrics,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_risk_scores_updated_at
  BEFORE UPDATE ON risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_thresholds_updated_at
  BEFORE UPDATE ON risk_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_thresholds ENABLE ROW LEVEL SECURITY;

-- Risk Scores: Acesso por organização
CREATE POLICY "risk_scores_select_org" ON risk_scores
  FOR SELECT USING (
    org_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "risk_scores_manage_service" ON risk_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Risk Alerts: Acesso por organização
CREATE POLICY "risk_alerts_select_org" ON risk_alerts
  FOR SELECT USING (
    org_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "risk_alerts_manage_org" ON risk_alerts
  FOR UPDATE USING (
    org_id = get_current_org_id()
  );

-- Risk Thresholds: Acesso por organização
CREATE POLICY "risk_thresholds_select_org" ON risk_thresholds
  FOR SELECT USING (
    org_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "risk_thresholds_manage_org" ON risk_thresholds
  FOR ALL USING (
    org_id = get_current_org_id()
    AND is_org_admin()
  );

-- History: Acesso por organização
CREATE POLICY "risk_history_select_org" ON risk_score_history
  FOR SELECT USING (
    org_id = get_current_org_id()
    OR is_super_admin()
  );

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT ON risk_scores TO authenticated;
GRANT SELECT ON risk_alerts TO authenticated;
GRANT SELECT, UPDATE ON risk_alerts TO authenticated;
GRANT SELECT ON risk_score_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON risk_thresholds TO authenticated;
GRANT SELECT ON mv_store_risk_metrics TO authenticated;
GRANT SELECT ON mv_product_risk_metrics TO authenticated;
GRANT SELECT ON mv_category_risk_metrics TO authenticated;

GRANT ALL ON risk_scores TO service_role;
GRANT ALL ON risk_alerts TO service_role;
GRANT ALL ON risk_score_history TO service_role;
GRANT ALL ON risk_thresholds TO service_role;

GRANT EXECUTE ON FUNCTION get_risk_level(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_risk_trend(UUID, risk_entity_type, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_store_risk_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_product_risk_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_risk_scores(UUID) TO service_role;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION get_risk_level IS 'Determina o nível de risco baseado no score e thresholds da org';
COMMENT ON FUNCTION calculate_store_risk_score IS 'Calcula score de risco completo para uma loja';
COMMENT ON FUNCTION calculate_product_risk_score IS 'Calcula score de risco completo para um produto';
COMMENT ON FUNCTION refresh_all_risk_scores IS 'Atualiza todos os scores de uma organização';
