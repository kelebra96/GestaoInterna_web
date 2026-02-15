-- =============================================
-- Materialized Views - Sprint 5 Otimização
-- =============================================
-- Views materializadas para acelerar queries do dashboard.
-- São "snapshots" de dados que podem ser atualizados periodicamente.
-- =============================================

-- ==========================================
-- VIEW: Dashboard Totais por Status
-- ==========================================
-- Resumo de solicitações por status para widget do dashboard

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_status_summary AS
SELECT
  org_id,
  status,
  COUNT(*) as total_count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30d,
  MAX(created_at) as last_created
FROM solicitacoes
WHERE status != 'draft'
GROUP BY org_id, status;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_status_summary_pk
  ON mv_dashboard_status_summary(org_id, status);

-- ==========================================
-- VIEW: Métricas por Loja
-- ==========================================
-- Performance de cada loja (solicitações, valores, etc.)

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_metrics AS
SELECT
  s.id as store_id,
  s.name as store_name,
  s.org_id,
  COALESCE(COUNT(sol.id), 0) as total_solicitacoes,
  COALESCE(COUNT(CASE WHEN sol.status = 'completed' THEN 1 END), 0) as completed,
  COALESCE(COUNT(CASE WHEN sol.status = 'pending' THEN 1 END), 0) as pending,
  COALESCE(COUNT(CASE WHEN sol.status = 'rejected' THEN 1 END), 0) as rejected,
  COALESCE(SUM(
    CASE WHEN sol.status = 'completed' THEN
      (SELECT SUM(quantity * unit_price) FROM solicitacao_itens WHERE solicitacao_id = sol.id)
    END
  ), 0) as total_value_completed,
  COALESCE(AVG(
    CASE WHEN sol.status = 'completed' THEN
      EXTRACT(EPOCH FROM (sol.updated_at - sol.created_at)) / 3600
    END
  ), 0) as avg_completion_hours,
  MAX(sol.created_at) as last_solicitacao
FROM stores s
LEFT JOIN solicitacoes sol ON sol.store_id = s.id AND sol.status != 'draft'
GROUP BY s.id, s.name, s.org_id;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_store_metrics_pk
  ON mv_store_metrics(store_id);

-- Índice por organização para filtros
CREATE INDEX IF NOT EXISTS idx_mv_store_metrics_org
  ON mv_store_metrics(org_id);

-- ==========================================
-- VIEW: Produtos Mais Solicitados
-- ==========================================
-- Top produtos por quantidade de solicitações

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_products AS
SELECT
  sol.org_id,
  i.ean,
  MAX(i.nome) as nome,
  MAX(i.unidade) as unidade,
  COUNT(DISTINCT i.solicitacao_id) as num_solicitacoes,
  SUM(i.quantity) as total_quantity,
  SUM(i.quantity * i.unit_price) as total_value,
  MAX(i.created_at) as last_requested
FROM solicitacao_itens i
JOIN solicitacoes sol ON sol.id = i.solicitacao_id
WHERE sol.status != 'draft'
  AND i.ean IS NOT NULL
GROUP BY sol.org_id, i.ean
ORDER BY num_solicitacoes DESC;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_products_pk
  ON mv_top_products(org_id, ean);

-- ==========================================
-- VIEW: Métricas de Inventário
-- ==========================================
-- Resumo de inventários por loja e período

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_metrics AS
SELECT
  i.store_id,
  s.name as store_name,
  s.org_id,
  COUNT(DISTINCT i.id) as total_inventories,
  COUNT(DISTINCT CASE WHEN i.status = 'completed' THEN i.id END) as completed,
  COUNT(DISTINCT CASE WHEN i.status = 'in_progress' THEN i.id END) as in_progress,
  COUNT(DISTINCT CASE WHEN i.created_at >= NOW() - INTERVAL '30 days' THEN i.id END) as last_30d,
  SUM(ic.total_items) as total_items_counted,
  MAX(i.created_at) as last_inventory
FROM inventories i
JOIN stores s ON s.id = i.store_id
LEFT JOIN (
  SELECT inventory_id, COUNT(*) as total_items
  FROM inventory_counts
  GROUP BY inventory_id
) ic ON ic.inventory_id = i.id
GROUP BY i.store_id, s.name, s.org_id;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_metrics_pk
  ON mv_inventory_metrics(store_id);

-- ==========================================
-- VIEW: Análise de Compliance
-- ==========================================
-- Status de tarefas de compliance por loja

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_summary AS
SELECT
  ct.store_id,
  s.name as store_name,
  s.org_id,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN ct.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN ct.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN ct.status = 'overdue' THEN 1 END) as overdue,
  ROUND(
    COUNT(CASE WHEN ct.status = 'completed' THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as completion_rate,
  COUNT(CASE WHEN ct.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as tasks_last_7d
FROM compliance_tasks ct
JOIN stores s ON s.id = ct.store_id
GROUP BY ct.store_id, s.name, s.org_id;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_compliance_summary_pk
  ON mv_compliance_summary(store_id);

-- ==========================================
-- VIEW: Resumo Geral por Organização
-- ==========================================
-- Dashboard KPIs agregados por organização

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_org_dashboard AS
SELECT
  o.id as org_id,
  o.name as org_name,
  (SELECT COUNT(*) FROM stores WHERE org_id = o.id) as total_stores,
  (SELECT COUNT(*) FROM users WHERE org_id = o.id AND (active = true OR active IS NULL)) as total_users,
  (SELECT COUNT(*) FROM solicitacoes WHERE org_id = o.id AND status != 'draft') as total_solicitacoes,
  (SELECT COUNT(*) FROM solicitacoes WHERE org_id = o.id AND status = 'pending') as pending_solicitacoes,
  (SELECT COUNT(*) FROM products WHERE org_id = o.id) as total_products,
  (SELECT COUNT(*) FROM inventories i JOIN stores s ON s.id = i.store_id WHERE s.org_id = o.id) as total_inventories,
  NOW() as refreshed_at
FROM organizations o;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_dashboard_pk
  ON mv_org_dashboard(org_id);

-- ==========================================
-- FUNÇÃO: Refresh de Views Materializadas
-- ==========================================
-- Função para atualizar todas as views de forma concorrente

CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refresh concorrente (não bloqueia leituras)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_status_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_dashboard;

  -- Log do refresh
  RAISE NOTICE 'Dashboard views refreshed at %', NOW();
END;
$$;

-- ==========================================
-- FUNÇÃO: Refresh Individual
-- ==========================================
-- Permite refresh de uma view específica

CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
  RAISE NOTICE 'View % refreshed at %', view_name, NOW();
END;
$$;

-- ==========================================
-- CRON JOB: Agendamento de Refresh
-- ==========================================
-- Se pg_cron estiver disponível, agendar refresh automático
-- (Executar apenas se extensão estiver instalada)

DO $$
BEGIN
  -- Verificar se pg_cron está disponível
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Refresh a cada 5 minutos (ajustar conforme necessidade)
    PERFORM cron.schedule(
      'refresh-dashboard-views',
      '*/5 * * * *',
      'SELECT refresh_dashboard_views()'
    );
    RAISE NOTICE 'pg_cron job scheduled for dashboard views refresh';
  ELSE
    RAISE NOTICE 'pg_cron not available - views will need manual refresh';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END;
$$;

-- ==========================================
-- GRANT: Permissões
-- ==========================================

GRANT SELECT ON mv_dashboard_status_summary TO authenticated;
GRANT SELECT ON mv_store_metrics TO authenticated;
GRANT SELECT ON mv_top_products TO authenticated;
GRANT SELECT ON mv_inventory_metrics TO authenticated;
GRANT SELECT ON mv_compliance_summary TO authenticated;
GRANT SELECT ON mv_org_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_views() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_materialized_view(text) TO service_role;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON MATERIALIZED VIEW mv_dashboard_status_summary IS 'Resumo de solicitações por status para widget do dashboard';
COMMENT ON MATERIALIZED VIEW mv_store_metrics IS 'Métricas de performance por loja';
COMMENT ON MATERIALIZED VIEW mv_top_products IS 'Produtos mais solicitados';
COMMENT ON MATERIALIZED VIEW mv_inventory_metrics IS 'Métricas de inventário por loja';
COMMENT ON MATERIALIZED VIEW mv_compliance_summary IS 'Resumo de compliance por loja';
COMMENT ON MATERIALIZED VIEW mv_org_dashboard IS 'KPIs agregados por organização';
COMMENT ON FUNCTION refresh_dashboard_views() IS 'Atualiza todas as views materializadas do dashboard';
COMMENT ON FUNCTION refresh_materialized_view(text) IS 'Atualiza uma view materializada específica';

-- ==========================================
-- REFRESH INICIAL
-- ==========================================
-- Fazer primeiro refresh para popular as views
-- (Nota: Primeira vez não pode usar CONCURRENTLY pois views estão vazias)

REFRESH MATERIALIZED VIEW mv_dashboard_status_summary;
REFRESH MATERIALIZED VIEW mv_store_metrics;
REFRESH MATERIALIZED VIEW mv_top_products;
REFRESH MATERIALIZED VIEW mv_inventory_metrics;
REFRESH MATERIALIZED VIEW mv_compliance_summary;
REFRESH MATERIALIZED VIEW mv_org_dashboard;
