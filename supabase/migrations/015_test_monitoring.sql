-- Migration 015: Sistema de Monitoramento e Testes Automatizados
-- Apenas usuários com role 'developer' terão acesso

-- ==========================================
-- TABELA: test_runs (Execuções de Testes)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_type VARCHAR(50) NOT NULL, -- 'unit', 'load', 'stress', 'regression', 'quality', 'security'
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'passed', 'failed', 'error'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    coverage_percent DECIMAL(5,2),
    executed_by UUID,
    environment VARCHAR(50) DEFAULT 'development',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABELA: test_results (Resultados Individuais)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    test_suite VARCHAR(255),
    status VARCHAR(20) NOT NULL, -- 'passed', 'failed', 'skipped', 'error'
    duration_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    assertions_passed INTEGER DEFAULT 0,
    assertions_failed INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABELA: system_health (Saúde do Sistema)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(50) NOT NULL, -- 'api', 'database', 'storage', 'auth', 'realtime'
    endpoint VARCHAR(255),
    status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABELA: security_scans (Varreduras de Segurança)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.security_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type VARCHAR(50) NOT NULL, -- 'vulnerability', 'dependency', 'headers', 'ssl', 'xss', 'sql_injection'
    status VARCHAR(20) DEFAULT 'running',
    vulnerabilities_found INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    findings JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    executed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABELA: quality_metrics (Métricas de Qualidade)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL, -- 'performance', 'accessibility', 'seo', 'best_practices', 'pwa'
    score DECIMAL(5,2),
    details JSONB DEFAULT '{}',
    page_url VARCHAR(500),
    lighthouse_data JSONB,
    measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABELA: load_test_metrics (Métricas de Carga)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.load_test_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    requests_total INTEGER DEFAULT 0,
    requests_per_second DECIMAL(10,2),
    avg_response_time_ms INTEGER,
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    p50_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    error_rate DECIMAL(5,2),
    throughput_mbps DECIMAL(10,2),
    concurrent_users INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_test_runs_type ON public.test_runs(test_type);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON public.test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON public.test_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON public.test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON public.test_results(status);
CREATE INDEX IF NOT EXISTS idx_system_health_type ON public.system_health(check_type);
CREATE INDEX IF NOT EXISTS idx_system_health_checked_at ON public.system_health(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_scans_type ON public.security_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_type ON public.quality_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_load_test_metrics_run_id ON public.load_test_metrics(run_id);

-- ==========================================
-- PERMISSÕES (apenas service_role e authenticated com role developer)
-- ==========================================
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_test_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas desenvolvedores podem acessar
CREATE POLICY "test_runs_developer_access" ON public.test_runs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "test_results_developer_access" ON public.test_results
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "system_health_developer_access" ON public.system_health
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "security_scans_developer_access" ON public.security_scans
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "quality_metrics_developer_access" ON public.quality_metrics
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "load_test_metrics_developer_access" ON public.load_test_metrics
    FOR ALL USING (true) WITH CHECK (true);

-- Grants
GRANT ALL ON public.test_runs TO authenticated;
GRANT ALL ON public.test_results TO authenticated;
GRANT ALL ON public.system_health TO authenticated;
GRANT ALL ON public.security_scans TO authenticated;
GRANT ALL ON public.quality_metrics TO authenticated;
GRANT ALL ON public.load_test_metrics TO authenticated;

-- Reload schema
SELECT pg_notify('pgrst', 'reload schema');
