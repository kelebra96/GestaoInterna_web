-- =============================================
-- MÓDULO DE PREDIÇÃO E ML
-- Clusterização, Predição de Risco, Sazonalidade, Recomendações
-- =============================================

-- =============================================
-- 0. TABELAS DE SUPORTE (se não existirem)
-- =============================================

-- Tabela de registros de perdas (base para análises de ML)
CREATE TABLE IF NOT EXISTS loss_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    loss_type TEXT NOT NULL CHECK (loss_type IN ('expiry', 'damage', 'theft', 'shrinkage', 'other')),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC(15,2),
    total_cost NUMERIC(15,2),
    loss_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    notes TEXT,
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loss_records_company ON loss_records(company_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_store ON loss_records(store_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_product ON loss_records(product_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_date ON loss_records(loss_date);

-- =============================================
-- 1. TABELAS DE CLUSTERS
-- =============================================

-- Definições de clusters
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN ('store', 'product', 'category')),
    cluster_name TEXT NOT NULL,
    cluster_label TEXT, -- Label amigável (ex: "Alto Risco", "Performance Estável")
    centroid JSONB NOT NULL DEFAULT '{}', -- Centro do cluster (features)
    feature_weights JSONB NOT NULL DEFAULT '{}', -- Pesos das features
    member_count INTEGER NOT NULL DEFAULT 0,
    avg_risk_score NUMERIC(5,2),
    characteristics JSONB DEFAULT '{}', -- Características distintivas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_cluster_per_org UNIQUE (org_id, cluster_type, cluster_name)
);

-- Membros dos clusters (lojas, produtos, categorias)
CREATE TABLE IF NOT EXISTS cluster_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category')),
    entity_id UUID NOT NULL,
    distance_to_centroid NUMERIC(10,4), -- Distância ao centro do cluster
    membership_score NUMERIC(5,4) CHECK (membership_score >= 0 AND membership_score <= 1), -- 0-1
    features JSONB NOT NULL DEFAULT '{}', -- Features do membro
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_member_in_cluster UNIQUE (cluster_id, entity_type, entity_id)
);

-- Histórico de clusterização
CREATE TABLE IF NOT EXISTS cluster_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cluster_type TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'kmeans', -- kmeans, dbscan, hierarchical
    parameters JSONB NOT NULL DEFAULT '{}',
    num_clusters INTEGER NOT NULL,
    silhouette_score NUMERIC(5,4), -- Qualidade do clustering (-1 a 1)
    inertia NUMERIC(15,4), -- Soma das distâncias ao quadrado
    total_members INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT
);

-- =============================================
-- 2. TABELAS DE PREDIÇÕES
-- =============================================

-- Modelos de predição
CREATE TABLE IF NOT EXISTS prediction_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_type TEXT NOT NULL CHECK (model_type IN (
        'risk_prediction',
        'demand_forecast',
        'loss_prediction',
        'expiry_prediction',
        'rupture_prediction'
    )),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL DEFAULT '1.0',
    algorithm TEXT NOT NULL, -- linear_regression, random_forest, gradient_boost, arima, prophet
    features JSONB NOT NULL DEFAULT '[]', -- Lista de features usadas
    hyperparameters JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}', -- MAE, RMSE, R², etc
    is_active BOOLEAN NOT NULL DEFAULT false,
    trained_at TIMESTAMPTZ,
    training_samples INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial para garantir apenas um modelo ativo por tipo/org
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_model
ON prediction_models (org_id, model_type)
WHERE is_active = true;

-- Predições geradas
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_id UUID REFERENCES prediction_models(id) ON DELETE SET NULL,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'risk_score',
        'demand_quantity',
        'loss_amount',
        'expiry_count',
        'rupture_probability'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category', 'organization')),
    entity_id UUID,
    target_date DATE NOT NULL, -- Data alvo da predição
    horizon_days INTEGER NOT NULL DEFAULT 7, -- Horizonte de predição
    predicted_value NUMERIC(15,4) NOT NULL,
    confidence_lower NUMERIC(15,4), -- Intervalo de confiança inferior
    confidence_upper NUMERIC(15,4), -- Intervalo de confiança superior
    confidence_level NUMERIC(3,2) DEFAULT 0.95, -- Nível de confiança (95%)
    actual_value NUMERIC(15,4), -- Valor real (preenchido após o fato)
    error NUMERIC(15,4), -- Erro da predição
    features_used JSONB DEFAULT '{}', -- Snapshot das features usadas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_predictions_target_date ON predictions(org_id, target_date);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON predictions(entity_type, entity_id);

-- =============================================
-- 3. TABELAS DE SAZONALIDADE
-- =============================================

-- Padrões sazonais detectados
CREATE TABLE IF NOT EXISTS seasonal_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'daily',      -- Padrão diário (hora do dia)
        'weekly',     -- Padrão semanal (dia da semana)
        'monthly',    -- Padrão mensal (dia do mês)
        'yearly',     -- Padrão anual (mês do ano)
        'holiday',    -- Padrões em feriados
        'event'       -- Eventos especiais
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category', 'organization')),
    entity_id UUID,
    metric_type TEXT NOT NULL, -- loss_rate, demand, rupture_rate, etc
    pattern_data JSONB NOT NULL DEFAULT '{}', -- Dados do padrão
    strength NUMERIC(5,4) CHECK (strength >= 0 AND strength <= 1), -- Força do padrão (0-1)
    confidence NUMERIC(5,4) CHECK (confidence >= 0 AND confidence <= 1),
    period_start DATE,
    period_end DATE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_seasonal_pattern UNIQUE (org_id, pattern_type, entity_type, entity_id, metric_type)
);

-- Feriados e eventos
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL = global
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'promotion', 'season', 'custom')),
    event_date DATE,
    recurrence TEXT CHECK (recurrence IN ('none', 'yearly', 'monthly', 'weekly')),
    impact_factor NUMERIC(5,2) DEFAULT 1.0, -- Multiplicador de impacto
    affects_categories TEXT[] DEFAULT '{}', -- Categorias afetadas
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dados de séries temporais agregadas
CREATE TABLE IF NOT EXISTS time_series_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metric_type TEXT NOT NULL,
    granularity TEXT NOT NULL CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    value NUMERIC(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}',

    CONSTRAINT unique_time_series UNIQUE (org_id, entity_type, entity_id, metric_type, granularity, period_start)
);

CREATE INDEX IF NOT EXISTS idx_time_series_lookup ON time_series_data(org_id, entity_type, metric_type, period_start);

-- =============================================
-- 4. TABELAS DE RECOMENDAÇÕES
-- =============================================

-- Recomendações geradas pelo sistema
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
        'reorder',           -- Reabastecimento
        'markdown',          -- Redução de preço
        'transfer',          -- Transferência entre lojas
        'investigation',     -- Investigar anomalia
        'process_change',    -- Mudança de processo
        'supplier_review',   -- Revisar fornecedor
        'storage_adjustment',-- Ajuste de armazenamento
        'training',          -- Treinamento de equipe
        'audit'              -- Auditoria
    )),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT, -- Explicação do porquê
    entity_type TEXT CHECK (entity_type IN ('store', 'product', 'category', 'supplier')),
    entity_id UUID,
    entity_name TEXT, -- Nome para exibição

    -- Impacto estimado
    estimated_savings NUMERIC(15,2),
    estimated_loss_reduction NUMERIC(5,2), -- Percentual
    confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Ação sugerida
    suggested_action JSONB DEFAULT '{}', -- Detalhes da ação
    action_deadline DATE,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'viewed', 'accepted', 'rejected', 'completed', 'expired'
    )),
    viewed_at TIMESTAMPTZ,
    viewed_by UUID REFERENCES users(id),
    action_taken_at TIMESTAMPTZ,
    action_taken_by UUID REFERENCES users(id),
    action_notes TEXT,
    actual_savings NUMERIC(15,2), -- Economia real após implementação

    -- Metadados
    source_data JSONB DEFAULT '{}', -- Dados que geraram a recomendação
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(org_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(org_id, recommendation_type);

-- Feedback sobre recomendações
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'irrelevant', 'already_done')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 5. TABELAS DE ANOMALIAS
-- =============================================

-- Anomalias detectadas automaticamente
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
        'spike',           -- Pico anormal
        'drop',            -- Queda anormal
        'trend_change',    -- Mudança de tendência
        'pattern_break',   -- Quebra de padrão
        'outlier',         -- Valor outlier
        'missing_data',    -- Dados faltantes
        'correlation_break'-- Quebra de correlação
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_name TEXT,
    metric_type TEXT NOT NULL,
    detected_value NUMERIC(15,4) NOT NULL,
    expected_value NUMERIC(15,4),
    expected_range_lower NUMERIC(15,4),
    expected_range_upper NUMERIC(15,4),
    deviation_score NUMERIC(10,4), -- Z-score ou similar
    detection_method TEXT, -- zscore, iqr, isolation_forest, etc
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,

    -- Status e resolução
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Vinculação com recomendação
    recommendation_id UUID REFERENCES recommendations(id),

    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(org_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON anomalies(org_id, detected_at DESC);

-- =============================================
-- 6. VIEWS PARA ANÁLISES
-- =============================================

-- View de clusters ativos com estatísticas
CREATE OR REPLACE VIEW v_cluster_summary AS
SELECT
    c.id,
    c.org_id,
    c.cluster_type,
    c.cluster_name,
    c.cluster_label,
    c.member_count,
    c.avg_risk_score,
    c.characteristics,
    COUNT(cm.id) as current_members,
    AVG(cm.membership_score) as avg_membership_score,
    AVG(cm.distance_to_centroid) as avg_distance
FROM clusters c
LEFT JOIN cluster_members cm ON cm.cluster_id = c.id
GROUP BY c.id;

-- View de predições recentes com acurácia
CREATE OR REPLACE VIEW v_prediction_accuracy AS
SELECT
    p.org_id,
    p.prediction_type,
    p.entity_type,
    pm.algorithm,
    DATE_TRUNC('week', p.target_date) as week,
    COUNT(*) as total_predictions,
    COUNT(p.actual_value) as evaluated_predictions,
    AVG(ABS(p.error)) as mean_absolute_error,
    AVG(p.error * p.error) as mean_squared_error,
    CASE
        WHEN COUNT(p.actual_value) > 0
        THEN 1 - (SUM(ABS(p.error)) / NULLIF(SUM(ABS(p.actual_value)), 0))
        ELSE NULL
    END as accuracy_rate
FROM predictions p
LEFT JOIN prediction_models pm ON pm.id = p.model_id
WHERE p.actual_value IS NOT NULL
GROUP BY p.org_id, p.prediction_type, p.entity_type, pm.algorithm, DATE_TRUNC('week', p.target_date);

-- View de recomendações pendentes por prioridade
CREATE OR REPLACE VIEW v_pending_recommendations AS
SELECT
    r.org_id,
    r.recommendation_type,
    r.priority,
    COUNT(*) as count,
    SUM(r.estimated_savings) as total_potential_savings,
    AVG(r.confidence_score) as avg_confidence,
    MIN(r.action_deadline) as nearest_deadline
FROM recommendations r
WHERE r.status IN ('pending', 'viewed')
AND (r.expires_at IS NULL OR r.expires_at > NOW())
GROUP BY r.org_id, r.recommendation_type, r.priority;

-- View de anomalias abertas
CREATE OR REPLACE VIEW v_open_anomalies AS
SELECT
    a.org_id,
    a.anomaly_type,
    a.severity,
    a.entity_type,
    COUNT(*) as count,
    AVG(a.deviation_score) as avg_deviation,
    MAX(a.detected_at) as latest_detection
FROM anomalies a
WHERE a.status IN ('open', 'investigating')
GROUP BY a.org_id, a.anomaly_type, a.severity, a.entity_type;

-- =============================================
-- 7. FUNÇÕES DE CLUSTERING
-- =============================================

-- Função para calcular features de uma loja para clustering
CREATE OR REPLACE FUNCTION calculate_store_features(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_features JSONB;
BEGIN
    SELECT jsonb_build_object(
        'avg_loss_rate', COALESCE(AVG(loss_rate), 0),
        'avg_rupture_rate', 0,
        'avg_expiry_rate', COALESCE(AVG(expiry_rate), 0),
        'total_products', COALESCE(COUNT(DISTINCT product_id), 0),
        'total_value', COALESCE(SUM(total_value), 0),
        'loss_trend', 0,
        'efficiency_score', 0
    )
    INTO v_features
    FROM (
        -- Loss metrics from loss_records
        SELECT
            lr.product_id,
            CASE
                WHEN SUM(lr.quantity) > 0 THEN
                    SUM(lr.quantity)::NUMERIC / (SUM(lr.quantity) + 100)  -- Simplified loss rate
                ELSE 0
            END as loss_rate,
            0 as expiry_rate,
            COALESCE(SUM(lr.total_cost), 0) as total_value
        FROM loss_records lr
        WHERE lr.store_id = p_store_id
        AND lr.loss_date >= NOW() - INTERVAL '90 days'
        GROUP BY lr.product_id

        UNION ALL

        -- Expiry metrics from ExpiryReport (Prisma table)
        SELECT
            er."productId" as product_id,
            0 as loss_rate,
            CASE
                WHEN COUNT(*) > 0 THEN
                    COUNT(*) FILTER (WHERE er.status = 'resolved' AND er."resolvedAt" < er."expiryDate")::NUMERIC / NULLIF(COUNT(*), 0)
                ELSE 0
            END as expiry_rate,
            0 as total_value
        FROM "ExpiryReport" er
        WHERE er."storeId" = p_store_id
        AND er."createdAt" >= NOW() - INTERVAL '90 days'
        GROUP BY er."productId"
    ) metrics;

    RETURN COALESCE(v_features, '{}'::JSONB);
END;
$$;

-- Função para atribuir entidade ao cluster mais próximo
CREATE OR REPLACE FUNCTION assign_to_nearest_cluster(
    p_org_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_features JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_best_cluster_id UUID;
    v_min_distance NUMERIC := 999999;
    v_cluster RECORD;
    v_distance NUMERIC;
BEGIN
    -- Encontrar cluster mais próximo
    FOR v_cluster IN
        SELECT id, centroid
        FROM clusters
        WHERE org_id = p_org_id
        AND cluster_type = p_entity_type
    LOOP
        -- Calcular distância euclidiana simples
        v_distance := 0;

        -- Somar diferenças ao quadrado para cada feature
        SELECT SQRT(SUM(POWER(
            COALESCE((p_features->>key)::NUMERIC, 0) -
            COALESCE((v_cluster.centroid->>key)::NUMERIC, 0)
        , 2)))
        INTO v_distance
        FROM jsonb_object_keys(v_cluster.centroid) key;

        IF v_distance < v_min_distance THEN
            v_min_distance := v_distance;
            v_best_cluster_id := v_cluster.id;
        END IF;
    END LOOP;

    -- Inserir ou atualizar membro
    IF v_best_cluster_id IS NOT NULL THEN
        INSERT INTO cluster_members (cluster_id, entity_type, entity_id, distance_to_centroid, features)
        VALUES (v_best_cluster_id, p_entity_type, p_entity_id, v_min_distance, p_features)
        ON CONFLICT (cluster_id, entity_type, entity_id)
        DO UPDATE SET
            distance_to_centroid = EXCLUDED.distance_to_centroid,
            features = EXCLUDED.features,
            assigned_at = NOW();

        -- Atualizar contagem do cluster
        UPDATE clusters SET
            member_count = (SELECT COUNT(*) FROM cluster_members WHERE cluster_id = v_best_cluster_id),
            updated_at = NOW()
        WHERE id = v_best_cluster_id;
    END IF;

    RETURN v_best_cluster_id;
END;
$$;

-- =============================================
-- 8. FUNÇÕES DE DETECÇÃO DE ANOMALIAS
-- =============================================

-- Função para detectar anomalias usando Z-score
CREATE OR REPLACE FUNCTION detect_zscore_anomalies(
    p_org_id UUID,
    p_entity_type TEXT,
    p_metric_type TEXT,
    p_threshold NUMERIC DEFAULT 3.0,
    p_lookback_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    entity_id UUID,
    entity_name TEXT,
    current_value NUMERIC,
    mean_value NUMERIC,
    std_dev NUMERIC,
    z_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            ts.entity_id,
            AVG(ts.value) as mean_val,
            STDDEV(ts.value) as std_val,
            (SELECT ts2.value FROM time_series_data ts2
             WHERE ts2.entity_id = ts.entity_id
             AND ts2.metric_type = p_metric_type
             ORDER BY ts2.period_start DESC LIMIT 1) as latest_value
        FROM time_series_data ts
        WHERE ts.org_id = p_org_id
        AND ts.entity_type = p_entity_type
        AND ts.metric_type = p_metric_type
        AND ts.period_start >= NOW() - (p_lookback_days || ' days')::INTERVAL
        GROUP BY ts.entity_id
        HAVING STDDEV(ts.value) > 0
    )
    SELECT
        s.entity_id,
        COALESCE(st.name, p.name, s.entity_id::TEXT) as entity_name,
        s.latest_value as current_value,
        s.mean_val as mean_value,
        s.std_val as std_dev,
        ABS((s.latest_value - s.mean_val) / s.std_val) as z_score
    FROM stats s
    LEFT JOIN stores st ON p_entity_type = 'store' AND st.id = s.entity_id
    LEFT JOIN products p ON p_entity_type = 'product' AND p.id = s.entity_id
    WHERE ABS((s.latest_value - s.mean_val) / s.std_val) > p_threshold;
END;
$$;

-- =============================================
-- 9. FUNÇÕES DE GERAÇÃO DE RECOMENDAÇÕES
-- =============================================

-- Função para gerar recomendações baseadas em regras
CREATE OR REPLACE FUNCTION generate_rule_based_recommendations(p_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
    v_rec RECORD;
BEGIN
    -- Regra 1: Produtos com alta taxa de perda
    FOR v_rec IN
        SELECT
            p.id as product_id,
            p.name as product_name,
            COALESCE(SUM(lr.total_cost), 0) as total_loss,
            COUNT(*) as loss_count
        FROM products p
        LEFT JOIN loss_records lr ON lr.product_id = p.id
            AND lr.company_id = p_org_id
            AND lr.loss_date >= NOW() - INTERVAL '30 days'
        WHERE p.company_id = p_org_id OR lr.company_id = p_org_id
        GROUP BY p.id, p.name
        HAVING COALESCE(SUM(lr.total_cost), 0) > 1000 -- Threshold configurável
        AND NOT EXISTS (
            SELECT 1 FROM recommendations r
            WHERE r.entity_id = p.id
            AND r.recommendation_type = 'investigation'
            AND r.status IN ('pending', 'viewed')
        )
    LOOP
        INSERT INTO recommendations (
            org_id, recommendation_type, priority, title, description,
            entity_type, entity_id, entity_name,
            estimated_savings, confidence_score,
            source_data, expires_at
        ) VALUES (
            p_org_id, 'investigation', 'high',
            'Investigar alta taxa de perda: ' || v_rec.product_name,
            'O produto "' || v_rec.product_name || '" apresentou R$ ' ||
                ROUND(v_rec.total_loss::NUMERIC, 2) || ' em perdas nos últimos 30 dias.',
            'product', v_rec.product_id, v_rec.product_name,
            v_rec.total_loss * 0.5, -- Estimativa de economia de 50%
            0.85,
            jsonb_build_object('total_loss', v_rec.total_loss, 'loss_count', v_rec.loss_count),
            NOW() + INTERVAL '7 days'
        );
        v_count := v_count + 1;
    END LOOP;

    -- Regra 2: Lojas com desempenho abaixo da média
    FOR v_rec IN
        WITH store_totals AS (
            SELECT
                s.id as store_id,
                s.name as store_name,
                COALESCE(SUM(lr.total_cost), 0) as total_loss
            FROM stores s
            LEFT JOIN loss_records lr ON lr.store_id = s.id
                AND lr.loss_date >= NOW() - INTERVAL '30 days'
                AND lr.company_id = p_org_id
            WHERE s.company_id = p_org_id
            GROUP BY s.id, s.name
        ),
        store_metrics AS (
            SELECT
                store_id,
                store_name,
                total_loss,
                AVG(total_loss) OVER () as avg_loss
            FROM store_totals
        )
        SELECT * FROM store_metrics
        WHERE total_loss > COALESCE(avg_loss, 0) * 1.5 -- 50% acima da média
        AND total_loss > 0
        AND NOT EXISTS (
            SELECT 1 FROM recommendations r
            WHERE r.entity_id = store_id
            AND r.recommendation_type = 'audit'
            AND r.status IN ('pending', 'viewed')
        )
    LOOP
        INSERT INTO recommendations (
            org_id, recommendation_type, priority, title, description,
            entity_type, entity_id, entity_name,
            estimated_loss_reduction, confidence_score,
            source_data, expires_at
        ) VALUES (
            p_org_id, 'audit', 'medium',
            'Auditoria recomendada: ' || v_rec.store_name,
            'A loja "' || v_rec.store_name || '" está com perdas 50% acima da média da rede.',
            'store', v_rec.store_id, v_rec.store_name,
            20.0, -- Estimativa de redução de 20%
            0.75,
            jsonb_build_object('total_loss', v_rec.total_loss, 'avg_loss', v_rec.avg_loss),
            NOW() + INTERVAL '14 days'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- =============================================
-- 10. ÍNDICES ADICIONAIS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_clusters_org_type ON clusters(org_id, cluster_type);
CREATE INDEX IF NOT EXISTS idx_cluster_members_entity ON cluster_members(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_lookup ON seasonal_patterns(org_id, entity_type, metric_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_anomalies_entity ON anomalies(entity_type, entity_id);

-- =============================================
-- 11. RLS POLICIES
-- =============================================

ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_series_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE loss_records ENABLE ROW LEVEL SECURITY;

-- Policy para loss_records
CREATE POLICY loss_records_org_isolation ON loss_records
    FOR ALL USING (company_id = get_current_org_id());

-- Policies para clusters
CREATE POLICY clusters_org_isolation ON clusters
    FOR ALL USING (org_id = get_current_org_id());

CREATE POLICY cluster_members_org_isolation ON cluster_members
    FOR ALL USING (
        cluster_id IN (SELECT id FROM clusters WHERE org_id = get_current_org_id())
    );

CREATE POLICY cluster_runs_org_isolation ON cluster_runs
    FOR ALL USING (org_id = get_current_org_id());

-- Policies para predictions
CREATE POLICY prediction_models_org_isolation ON prediction_models
    FOR ALL USING (org_id = get_current_org_id());

CREATE POLICY predictions_org_isolation ON predictions
    FOR ALL USING (org_id = get_current_org_id());

-- Policies para seasonal
CREATE POLICY seasonal_patterns_org_isolation ON seasonal_patterns
    FOR ALL USING (org_id = get_current_org_id());

CREATE POLICY calendar_events_org_isolation ON calendar_events
    FOR ALL USING (org_id IS NULL OR org_id = get_current_org_id());

CREATE POLICY time_series_data_org_isolation ON time_series_data
    FOR ALL USING (org_id = get_current_org_id());

-- Policies para recommendations
CREATE POLICY recommendations_org_isolation ON recommendations
    FOR ALL USING (org_id = get_current_org_id());

CREATE POLICY recommendation_feedback_org_isolation ON recommendation_feedback
    FOR ALL USING (
        recommendation_id IN (SELECT id FROM recommendations WHERE org_id = get_current_org_id())
    );

-- Policies para anomalies
CREATE POLICY anomalies_org_isolation ON anomalies
    FOR ALL USING (org_id = get_current_org_id());

-- =============================================
-- 12. DADOS INICIAIS
-- =============================================

-- Eventos de calendário globais (Brasil)
INSERT INTO calendar_events (org_id, event_name, event_type, event_date, recurrence, impact_factor)
VALUES
    (NULL, 'Ano Novo', 'holiday', '2024-01-01', 'yearly', 1.5),
    (NULL, 'Carnaval', 'holiday', '2024-02-13', 'yearly', 1.8),
    (NULL, 'Páscoa', 'holiday', '2024-03-31', 'yearly', 1.6),
    (NULL, 'Dia das Mães', 'holiday', '2024-05-12', 'yearly', 1.7),
    (NULL, 'Dia dos Namorados', 'holiday', '2024-06-12', 'yearly', 1.4),
    (NULL, 'Dia dos Pais', 'holiday', '2024-08-11', 'yearly', 1.5),
    (NULL, 'Dia das Crianças', 'holiday', '2024-10-12', 'yearly', 1.6),
    (NULL, 'Black Friday', 'promotion', '2024-11-29', 'yearly', 2.0),
    (NULL, 'Natal', 'holiday', '2024-12-25', 'yearly', 2.5),
    (NULL, 'Verão', 'season', '2024-12-21', 'yearly', 1.3),
    (NULL, 'Inverno', 'season', '2024-06-21', 'yearly', 0.9)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE clusters IS 'Clusters de lojas/produtos baseados em comportamento';
COMMENT ON TABLE predictions IS 'Predições geradas pelos modelos de ML';
COMMENT ON TABLE seasonal_patterns IS 'Padrões sazonais detectados automaticamente';
COMMENT ON TABLE recommendations IS 'Recomendações geradas pelo sistema';
COMMENT ON TABLE anomalies IS 'Anomalias detectadas automaticamente';
