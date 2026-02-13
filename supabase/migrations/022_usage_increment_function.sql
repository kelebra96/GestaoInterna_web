-- ==========================================
-- Migration 022: Função para Incremento de Uso
-- Created: 2026-02-11
-- Description: RPC para incremento atômico de contadores de uso
-- ==========================================

-- Função para incremento atômico de contadores de uso
CREATE OR REPLACE FUNCTION increment_usage_counter(
  p_org_id UUID,
  p_period_start DATE,
  p_column_name TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_period_end DATE;
BEGIN
  -- Calcular fim do período (último dia do mês)
  v_period_end := (DATE_TRUNC('month', p_period_start) + INTERVAL '1 month - 1 day')::DATE;

  -- Usar UPSERT com incremento
  EXECUTE format(
    'INSERT INTO usage_tracking (org_id, period_start, period_end, %I)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, period_start)
     DO UPDATE SET %I = usage_tracking.%I + $4, updated_at = NOW()',
    p_column_name, p_column_name, p_column_name
  ) USING p_org_id, p_period_start, v_period_end, p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que apenas service_role pode executar
REVOKE ALL ON FUNCTION increment_usage_counter(UUID, DATE, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_usage_counter(UUID, DATE, TEXT, INTEGER) TO service_role;

-- Função para obter uso atual do mês
CREATE OR REPLACE FUNCTION get_current_month_usage(p_org_id UUID)
RETURNS TABLE (
  stores_count INTEGER,
  users_count INTEGER,
  products_count INTEGER,
  imports_count INTEGER,
  api_calls_count INTEGER,
  storage_bytes BIGINT,
  analytics_queries INTEGER,
  reports_generated INTEGER,
  alerts_sent INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ut.stores_count, 0),
    COALESCE(ut.users_count, 0),
    COALESCE(ut.products_count, 0),
    COALESCE(ut.imports_count, 0),
    COALESCE(ut.api_calls_count, 0),
    COALESCE(ut.storage_bytes, 0),
    COALESCE(ut.analytics_queries, 0),
    COALESCE(ut.reports_generated, 0),
    COALESCE(ut.alerts_sent, 0)
  FROM usage_tracking ut
  WHERE ut.org_id = p_org_id
    AND ut.period_start = DATE_TRUNC('month', NOW())::DATE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_month_usage(UUID) TO authenticated;

-- Função para atualizar contagem real de recursos
CREATE OR REPLACE FUNCTION sync_resource_counts(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stores_count INTEGER;
  v_users_count INTEGER;
  v_products_count INTEGER;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  v_period_start := DATE_TRUNC('month', NOW())::DATE;
  v_period_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')::DATE;

  -- Contar lojas
  SELECT COUNT(*)::INTEGER INTO v_stores_count
  FROM stores
  WHERE company_id = p_org_id;

  -- Contar usuários
  SELECT COUNT(*)::INTEGER INTO v_users_count
  FROM users
  WHERE company_id = p_org_id;

  -- Contar produtos (se a tabela tiver org_id)
  -- Como products pode ser catálogo global, usar contagem de inventários
  SELECT COUNT(DISTINCT product_id)::INTEGER INTO v_products_count
  FROM inventory_items ii
  JOIN inventories i ON i.id = ii.inventory_id
  WHERE i.company_id = p_org_id;

  -- Atualizar ou inserir
  INSERT INTO usage_tracking (
    org_id,
    period_start,
    period_end,
    stores_count,
    users_count,
    products_count
  ) VALUES (
    p_org_id,
    v_period_start,
    v_period_end,
    v_stores_count,
    v_users_count,
    v_products_count
  )
  ON CONFLICT (org_id, period_start)
  DO UPDATE SET
    stores_count = EXCLUDED.stores_count,
    users_count = EXCLUDED.users_count,
    products_count = EXCLUDED.products_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_resource_counts(UUID) TO service_role;

-- ==========================================
-- Trigger para sincronizar contagem ao criar/deletar recursos
-- ==========================================

-- Função trigger para atualizar contagem de lojas
CREATE OR REPLACE FUNCTION trigger_sync_store_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM sync_resource_counts(NEW.company_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM sync_resource_counts(OLD.company_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função trigger para atualizar contagem de usuários
CREATE OR REPLACE FUNCTION trigger_sync_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM sync_resource_counts(NEW.company_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM sync_resource_counts(OLD.company_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers (descomentado se stores e users tiverem company_id)
-- DROP TRIGGER IF EXISTS sync_store_count_trigger ON stores;
-- CREATE TRIGGER sync_store_count_trigger
--   AFTER INSERT OR DELETE ON stores
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_sync_store_count();

-- DROP TRIGGER IF EXISTS sync_user_count_trigger ON users;
-- CREATE TRIGGER sync_user_count_trigger
--   AFTER INSERT OR DELETE ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_sync_user_count();

-- ==========================================
-- Job para atualizar contagens diariamente (opcional)
-- ==========================================
-- Este seria executado por um cron job ou pg_cron

-- SELECT sync_resource_counts(org_id) FROM organizations;

COMMENT ON FUNCTION increment_usage_counter IS 'Incrementa atomicamente um contador de uso para uma organização';
COMMENT ON FUNCTION get_current_month_usage IS 'Retorna uso do mês atual para uma organização';
COMMENT ON FUNCTION sync_resource_counts IS 'Sincroniza contagens reais de recursos (lojas, usuários, produtos)';
