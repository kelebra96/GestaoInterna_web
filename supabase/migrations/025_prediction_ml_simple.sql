-- =============================================
-- MÓDULO DE PREDIÇÃO E ML - VERSÃO SIMPLIFICADA
-- Apenas tabelas e views (sem funções complexas)
-- =============================================

-- =============================================
-- 1. TABELAS
-- =============================================

-- Tabela de registros de perdas
CREATE TABLE IF NOT EXISTS loss_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    store_id UUID,
    product_id UUID,
    loss_type TEXT NOT NULL CHECK (loss_type IN ('expiry', 'damage', 'theft', 'shrinkage', 'other')),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC(15,2),
    total_cost NUMERIC(15,2),
    loss_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    notes TEXT,
    reported_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clusters
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN ('store', 'product', 'category')),
    cluster_name TEXT NOT NULL,
    cluster_label TEXT,
    centroid JSONB NOT NULL DEFAULT '{}',
    feature_weights JSONB NOT NULL DEFAULT '{}',
    member_count INTEGER NOT NULL DEFAULT 0,
    avg_risk_score NUMERIC(5,2),
    characteristics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_cluster_per_org UNIQUE (org_id, cluster_type, cluster_name)
);

-- Membros dos clusters
CREATE TABLE IF NOT EXISTS cluster_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category')),
    entity_id UUID NOT NULL,
    distance_to_centroid NUMERIC(10,4),
    membership_score NUMERIC(5,4) CHECK (membership_score >= 0 AND membership_score <= 1),
    features JSONB NOT NULL DEFAULT '{}',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_in_cluster UNIQUE (cluster_id, entity_type, entity_id)
);

-- Histórico de clusterização
CREATE TABLE IF NOT EXISTS cluster_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    cluster_type TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'kmeans',
    parameters JSONB NOT NULL DEFAULT '{}',
    num_clusters INTEGER NOT NULL,
    silhouette_score NUMERIC(5,4),
    inertia NUMERIC(15,4),
    total_members INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT
);

-- Modelos de predição
CREATE TABLE IF NOT EXISTS prediction_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN (
        'risk_prediction', 'demand_forecast', 'loss_prediction', 'expiry_prediction', 'rupture_prediction'
    )),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL DEFAULT '1.0',
    algorithm TEXT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]',
    hyperparameters JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    trained_at TIMESTAMPTZ,
    training_samples INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial para modelo ativo único
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_model
ON prediction_models (org_id, model_type)
WHERE is_active = true;

-- Predições
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    model_id UUID REFERENCES prediction_models(id) ON DELETE SET NULL,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'risk_score', 'demand_quantity', 'loss_amount', 'expiry_count', 'rupture_probability'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category', 'organization')),
    entity_id UUID,
    target_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL DEFAULT 7,
    predicted_value NUMERIC(15,4) NOT NULL,
    confidence_lower NUMERIC(15,4),
    confidence_upper NUMERIC(15,4),
    confidence_level NUMERIC(3,2) DEFAULT 0.95,
    actual_value NUMERIC(15,4),
    error NUMERIC(15,4),
    features_used JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Padrões sazonais
CREATE TABLE IF NOT EXISTS seasonal_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('daily', 'weekly', 'monthly', 'yearly', 'holiday', 'event')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'product', 'category', 'organization')),
    entity_id UUID,
    metric_type TEXT NOT NULL,
    pattern_data JSONB NOT NULL DEFAULT '{}',
    strength NUMERIC(5,4) CHECK (strength >= 0 AND strength <= 1),
    confidence NUMERIC(5,4) CHECK (confidence >= 0 AND confidence <= 1),
    period_start DATE,
    period_end DATE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_seasonal_pattern UNIQUE (org_id, pattern_type, entity_type, entity_id, metric_type)
);

-- Eventos de calendário
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'promotion', 'season', 'custom')),
    event_date DATE,
    recurrence TEXT CHECK (recurrence IN ('none', 'yearly', 'monthly', 'weekly')),
    impact_factor NUMERIC(5,2) DEFAULT 1.0,
    affects_categories TEXT[] DEFAULT '{}',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Séries temporais
CREATE TABLE IF NOT EXISTS time_series_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
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

-- Recomendações
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
        'reorder', 'markdown', 'transfer', 'investigation', 'process_change',
        'supplier_review', 'storage_adjustment', 'training', 'audit'
    )),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT,
    entity_type TEXT CHECK (entity_type IN ('store', 'product', 'category', 'supplier')),
    entity_id UUID,
    entity_name TEXT,
    estimated_savings NUMERIC(15,2),
    estimated_loss_reduction NUMERIC(5,2),
    confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    suggested_action JSONB DEFAULT '{}',
    action_deadline DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected', 'completed', 'expired')),
    viewed_at TIMESTAMPTZ,
    viewed_by UUID,
    action_taken_at TIMESTAMPTZ,
    action_taken_by UUID,
    action_notes TEXT,
    actual_savings NUMERIC(15,2),
    source_data JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback de recomendações
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'irrelevant', 'already_done')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anomalias
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
        'spike', 'drop', 'trend_change', 'pattern_break', 'outlier', 'missing_data', 'correlation_break'
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
    deviation_score NUMERIC(10,4),
    detection_method TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    recommendation_id UUID REFERENCES recommendations(id),
    metadata JSONB DEFAULT '{}'
);

-- =============================================
-- 2. ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_loss_records_company ON loss_records(company_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_store ON loss_records(store_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_date ON loss_records(loss_date);
CREATE INDEX IF NOT EXISTS idx_predictions_target_date ON predictions(org_id, target_date);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_clusters_org_type ON clusters(org_id, cluster_type);
CREATE INDEX IF NOT EXISTS idx_cluster_members_entity ON cluster_members(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_lookup ON seasonal_patterns(org_id, entity_type, metric_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_anomalies_entity ON anomalies(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(org_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(org_id, recommendation_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(org_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON anomalies(org_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_series_lookup ON time_series_data(org_id, entity_type, metric_type, period_start);

-- =============================================
-- 3. VIEWS
-- =============================================

-- View de clusters
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

-- View de predições com acurácia
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

-- View de recomendações pendentes
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
-- 4. DADOS INICIAIS
-- =============================================

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

-- =============================================
-- 5. COMENTÁRIOS
-- =============================================

COMMENT ON TABLE clusters IS 'Clusters de lojas/produtos baseados em comportamento';
COMMENT ON TABLE predictions IS 'Predições geradas pelos modelos de ML';
COMMENT ON TABLE seasonal_patterns IS 'Padrões sazonais detectados automaticamente';
COMMENT ON TABLE recommendations IS 'Recomendações geradas pelo sistema';
COMMENT ON TABLE anomalies IS 'Anomalias detectadas automaticamente';
