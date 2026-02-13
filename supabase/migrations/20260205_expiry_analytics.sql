-- ============================================================================
-- MÓDULO: Analytics de Vencimentos
-- Criado em: 2026-02-05
-- Descrição: Views, Materialized Views, Índices e Políticas RLS para o módulo
--            de análise gerencial de itens próximos do vencimento
-- ============================================================================

-- ============================================================================
-- 1. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice composto para queries de período + loja + status
CREATE INDEX IF NOT EXISTS idx_expiry_reports_analytics
ON "ExpiryReport" ("storeId", "status", "expiryDate", "createdAt");

-- Índice para buscas por data de vencimento
CREATE INDEX IF NOT EXISTS idx_expiry_reports_expiry_date
ON "ExpiryReport" ("expiryDate");

-- Índice para status
CREATE INDEX IF NOT EXISTS idx_expiry_reports_status
ON "ExpiryReport" ("status");

-- Índice para ações de usuários
CREATE INDEX IF NOT EXISTS idx_user_report_actions_report
ON "UserReportAction" ("reportId", "actionType", "createdAt");

-- ============================================================================
-- 2. VIEW: Relatórios Detalhados com Joins (para consultas diretas)
-- ============================================================================

CREATE OR REPLACE VIEW v_expiry_reports_detailed AS
SELECT
    er.id,
    er."storeId",
    er."productId",
    er.quantity,
    er."expiryDate",
    er."photoPath",
    er.status,
    er."createdBy",
    er."createdAt",
    er."resolvedAt",
    -- Store info
    s.name AS store_name,
    s.code AS store_code,
    s.city AS store_city,
    s.region AS store_region,
    s."orgId" AS org_id,
    -- Product info
    p.sku AS product_sku,
    p.ean AS product_ean,
    p.name AS product_name,
    p.brand AS product_brand,
    p.category AS product_category,
    p.subcategory AS product_subcategory,
    p."preco_venda" AS product_price,
    p."margem_percentual" AS product_margin,
    -- Creator info
    u.name AS creator_name,
    u.email AS creator_email,
    u.role AS creator_role,
    -- Calculated fields
    DATE(er."expiryDate") - CURRENT_DATE AS days_to_expiry,
    CASE
        WHEN er.status = 'resolved' AND er."resolvedAt" IS NOT NULL
        THEN EXTRACT(EPOCH FROM (er."resolvedAt" - er."createdAt")) / 3600.0
        ELSE NULL
    END AS resolution_hours,
    CASE
        WHEN er.status = 'resolved' AND er."resolvedAt"::date <= er."expiryDate"::date
        THEN true
        ELSE false
    END AS resolved_before_expiry,
    -- Value at risk
    er.quantity * COALESCE(p."preco_venda", 0) AS value_at_risk,
    er.quantity * COALESCE(p."preco_venda", 0) * COALESCE(p."margem_percentual", 0) / 100 AS margin_at_risk
FROM "ExpiryReport" er
LEFT JOIN "Store" s ON er."storeId" = s.id
LEFT JOIN "Product" p ON er."productId" = p.id
LEFT JOIN "User" u ON er."createdBy" = u.id;

-- ============================================================================
-- 3. VIEW PÚBLICA: Apenas dados públicos da rede (para feed)
-- ============================================================================

CREATE OR REPLACE VIEW v_expiry_public_feed AS
SELECT
    er.id,
    p.ean AS barcode,
    er."photoPath" AS photo_url,
    er."expiryDate" AS expiry_date,
    er."createdAt" AS reported_at,
    DATE(er."expiryDate") - CURRENT_DATE AS days_to_expiry
FROM "ExpiryReport" er
LEFT JOIN "Product" p ON er."productId" = p.id
WHERE er.status NOT IN ('canceled', 'ignored')
ORDER BY er."createdAt" DESC;

-- ============================================================================
-- 4. MATERIALIZED VIEW: Agregados diários por loja
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_expiry_daily AS
SELECT
    DATE(er."createdAt") AS report_date,
    er."storeId" AS store_id,
    s.name AS store_name,
    s.code AS store_code,
    s."orgId" AS org_id,
    -- Contagens por status
    COUNT(*) FILTER (WHERE er.status = 'reported') AS reported_count,
    COUNT(*) FILTER (WHERE er.status = 'watching') AS watching_count,
    COUNT(*) FILTER (WHERE er.status = 'confirmed') AS confirmed_count,
    COUNT(*) FILTER (WHERE er.status = 'resolved') AS resolved_count,
    COUNT(*) FILTER (WHERE er.status = 'ignored') AS ignored_count,
    COUNT(*) FILTER (WHERE er.status = 'canceled') AS canceled_count,
    COUNT(*) AS total_count,
    -- Contagens por janela de vencimento (baseado na data do relatório)
    COUNT(*) FILTER (WHERE DATE(er."expiryDate") = DATE(er."createdAt")) AS d0_count,
    COUNT(*) FILTER (WHERE DATE(er."expiryDate") = DATE(er."createdAt") + 1) AS d1_count,
    COUNT(*) FILTER (WHERE DATE(er."expiryDate") <= DATE(er."createdAt") + 7 AND DATE(er."expiryDate") > DATE(er."createdAt") + 1) AS d2_d7_count,
    COUNT(*) FILTER (WHERE DATE(er."expiryDate") < DATE(er."createdAt")) AS overdue_count,
    -- Quantidades
    SUM(er.quantity) AS total_quantity,
    -- Valores (R$)
    SUM(er.quantity * COALESCE(p."preco_venda", 0)) AS total_value_at_risk,
    SUM(er.quantity * COALESCE(p."preco_venda", 0) * COALESCE(p."margem_percentual", 0) / 100) AS total_margin_at_risk,
    -- Resolved metrics
    SUM(er.quantity * COALESCE(p."preco_venda", 0)) FILTER (
        WHERE er.status = 'resolved' AND er."resolvedAt"::date <= er."expiryDate"::date
    ) AS value_recovered,
    -- Quality metrics
    COUNT(*) FILTER (WHERE er."photoPath" IS NULL OR er."photoPath" = '') AS no_photo_count
FROM "ExpiryReport" er
LEFT JOIN "Store" s ON er."storeId" = s.id
LEFT JOIN "Product" p ON er."productId" = p.id
GROUP BY DATE(er."createdAt"), er."storeId", s.name, s.code, s."orgId";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_expiry_daily_pk
ON mv_expiry_daily (report_date, store_id);

CREATE INDEX IF NOT EXISTS idx_mv_expiry_daily_store
ON mv_expiry_daily (store_id);

CREATE INDEX IF NOT EXISTS idx_mv_expiry_daily_org
ON mv_expiry_daily (org_id);

-- ============================================================================
-- 5. MATERIALIZED VIEW: Scorecard por loja (últimos 30 dias)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_expiry_scorecard AS
WITH store_stats AS (
    SELECT
        er."storeId" AS store_id,
        s.name AS store_name,
        s.code AS store_code,
        s."orgId" AS org_id,
        -- Total reports
        COUNT(*) AS total_reports,
        SUM(er.quantity) AS total_quantity,
        -- Status counts
        COUNT(*) FILTER (WHERE er.status IN ('reported', 'watching', 'confirmed')) AS open_count,
        COUNT(*) FILTER (WHERE er.status = 'resolved') AS resolved_count,
        -- Efficiency
        COUNT(*) FILTER (
            WHERE er.status = 'resolved'
            AND er."resolvedAt"::date <= er."expiryDate"::date
        ) AS resolved_before_expiry,
        -- Overdue
        COUNT(*) FILTER (
            WHERE er.status IN ('reported', 'watching', 'confirmed')
            AND er."expiryDate"::date < CURRENT_DATE
        ) AS overdue_open,
        -- Resolution times
        PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (er."resolvedAt" - er."createdAt")) / 3600.0
        ) FILTER (WHERE er.status = 'resolved' AND er."resolvedAt" IS NOT NULL) AS p50_resolution_hours,
        PERCENTILE_CONT(0.9) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (er."resolvedAt" - er."createdAt")) / 3600.0
        ) FILTER (WHERE er.status = 'resolved' AND er."resolvedAt" IS NOT NULL) AS p90_resolution_hours,
        -- Values
        SUM(er.quantity * COALESCE(p."preco_venda", 0)) FILTER (
            WHERE er.status IN ('reported', 'watching', 'confirmed')
        ) AS value_at_risk,
        SUM(er.quantity * COALESCE(p."preco_venda", 0)) FILTER (
            WHERE er.status = 'resolved' AND er."resolvedAt"::date <= er."expiryDate"::date
        ) AS value_recovered,
        -- Quality
        COUNT(*) FILTER (WHERE er."photoPath" IS NULL OR er."photoPath" = '') AS no_photo_count
    FROM "ExpiryReport" er
    LEFT JOIN "Store" s ON er."storeId" = s.id
    LEFT JOIN "Product" p ON er."productId" = p.id
    WHERE er."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY er."storeId", s.name, s.code, s."orgId"
)
SELECT
    store_id,
    store_name,
    store_code,
    org_id,
    total_reports,
    total_quantity,
    open_count,
    resolved_count,
    resolved_before_expiry,
    overdue_open,
    p50_resolution_hours,
    p90_resolution_hours,
    value_at_risk,
    value_recovered,
    no_photo_count,
    -- Calculated KPIs
    CASE WHEN resolved_count > 0
        THEN ROUND(100.0 * resolved_before_expiry / resolved_count, 1)
        ELSE 0
    END AS efficiency_rate,
    CASE WHEN open_count > 0
        THEN ROUND(100.0 * overdue_open / open_count, 1)
        ELSE 0
    END AS overdue_rate,
    CASE WHEN total_reports > 0
        THEN ROUND(100.0 * no_photo_count / total_reports, 1)
        ELSE 0
    END AS no_photo_rate,
    CURRENT_TIMESTAMP AS refreshed_at
FROM store_stats;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_store_scorecard_pk
ON mv_store_expiry_scorecard (store_id);

-- ============================================================================
-- 6. MATERIALIZED VIEW: Top SKUs recorrentes (últimos 30 dias)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_expiry_skus AS
SELECT
    p.id AS product_id,
    p.sku,
    p.ean,
    p.name AS product_name,
    p.brand,
    p.category,
    p."preco_venda" AS price,
    COUNT(*) AS occurrence_count,
    COUNT(DISTINCT er."storeId") AS stores_affected,
    SUM(er.quantity) AS total_quantity,
    SUM(er.quantity * COALESCE(p."preco_venda", 0)) AS total_value_at_risk,
    ARRAY_AGG(DISTINCT s.name) AS store_names,
    CURRENT_TIMESTAMP AS refreshed_at
FROM "ExpiryReport" er
JOIN "Product" p ON er."productId" = p.id
LEFT JOIN "Store" s ON er."storeId" = s.id
WHERE er."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
  AND er.status NOT IN ('canceled', 'ignored')
GROUP BY p.id, p.sku, p.ean, p.name, p.brand, p.category, p."preco_venda"
ORDER BY occurrence_count DESC, total_value_at_risk DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_skus_pk
ON mv_top_expiry_skus (product_id);

-- ============================================================================
-- 7. MATERIALIZED VIEW: Métricas do Funil de Ação
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_expiry_funnel AS
WITH action_stats AS (
    SELECT
        DATE(er."createdAt") AS report_date,
        er."storeId" AS store_id,
        COUNT(*) AS reported,
        COUNT(*) FILTER (WHERE er.status IN ('watching', 'confirmed', 'resolved')) AS watched,
        COUNT(*) FILTER (WHERE er.status IN ('confirmed', 'resolved')) AS confirmed,
        COUNT(*) FILTER (WHERE er.status = 'resolved') AS resolved,
        -- First action times
        AVG(EXTRACT(EPOCH FROM (
            SELECT MIN(ura."createdAt")
            FROM "UserReportAction" ura
            WHERE ura."reportId" = er.id
        ) - er."createdAt") / 3600.0) AS avg_time_to_first_action_hours
    FROM "ExpiryReport" er
    WHERE er."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(er."createdAt"), er."storeId"
)
SELECT
    report_date,
    store_id,
    s.name AS store_name,
    s."orgId" AS org_id,
    reported,
    watched,
    confirmed,
    resolved,
    avg_time_to_first_action_hours,
    -- Conversion rates
    CASE WHEN reported > 0 THEN ROUND(100.0 * watched / reported, 1) ELSE 0 END AS watch_rate,
    CASE WHEN reported > 0 THEN ROUND(100.0 * confirmed / reported, 1) ELSE 0 END AS confirm_rate,
    CASE WHEN reported > 0 THEN ROUND(100.0 * resolved / reported, 1) ELSE 0 END AS resolve_rate,
    CURRENT_TIMESTAMP AS refreshed_at
FROM action_stats
LEFT JOIN "Store" s ON action_stats.store_id = s.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funnel_pk
ON mv_expiry_funnel (report_date, store_id);

-- ============================================================================
-- 8. FUNÇÃO: Refresh de todas as MVs
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_expiry_analytics_mvs()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_expiry_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_expiry_scorecard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_expiry_skus;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_expiry_funnel;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. RLS POLICIES (se usando Supabase diretamente)
-- ============================================================================

-- Habilitar RLS nas views (se necessário)
-- ALTER VIEW v_expiry_reports_detailed SET (security_invoker = true);

-- Nota: O controle de acesso principal é feito na camada de aplicação (Next.js)
-- através das roles do usuário. As queries filtram por storeId conforme permissão.

-- ============================================================================
-- 10. COMENTÁRIOS NAS VIEWS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_expiry_daily IS
'Agregados diários de reports de vencimento por loja. Refresh diário.';

COMMENT ON MATERIALIZED VIEW mv_store_expiry_scorecard IS
'Scorecard de KPIs por loja dos últimos 30 dias. Refresh a cada hora.';

COMMENT ON MATERIALIZED VIEW mv_top_expiry_skus IS
'Top 100 SKUs com mais ocorrências de vencimento nos últimos 30 dias.';

COMMENT ON MATERIALIZED VIEW mv_expiry_funnel IS
'Métricas do funil de ações (reported → watched → confirmed → resolved).';
