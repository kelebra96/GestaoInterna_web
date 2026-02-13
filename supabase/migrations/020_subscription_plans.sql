-- ==========================================
-- Migration 020: Modelo de Planos e Assinaturas SaaS
-- Created: 2026-02-11
-- Description: Tabelas para gerenciar planos, assinaturas, features e uso
-- ==========================================

-- ==========================================
-- PLANS (Planos Disponíveis)
-- ==========================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'BRL',

  -- Limites do plano
  max_stores INTEGER DEFAULT 3,
  max_users INTEGER DEFAULT 10,
  max_products INTEGER DEFAULT 1000,
  max_monthly_imports INTEGER DEFAULT 100,
  max_api_calls_per_day INTEGER DEFAULT 1000,

  -- Features booleanas
  has_analytics_basic BOOLEAN DEFAULT true,
  has_analytics_advanced BOOLEAN DEFAULT false,
  has_risk_scoring BOOLEAN DEFAULT false,
  has_predictions BOOLEAN DEFAULT false,
  has_api_access BOOLEAN DEFAULT false,
  has_custom_reports BOOLEAN DEFAULT false,
  has_realtime_alerts BOOLEAN DEFAULT false,
  has_integrations BOOLEAN DEFAULT false,
  has_dedicated_support BOOLEAN DEFAULT false,
  has_white_label BOOLEAN DEFAULT false,

  -- Retenção de dados
  data_retention_months INTEGER DEFAULT 12,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true, -- false = plano enterprise customizado
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_active_public ON plans(is_active, is_public);

COMMENT ON TABLE plans IS 'Planos de assinatura disponíveis na plataforma SaaS';
COMMENT ON COLUMN plans.max_stores IS 'Número máximo de lojas permitidas no plano';
COMMENT ON COLUMN plans.data_retention_months IS 'Meses que os dados são mantidos (compliance)';

-- ==========================================
-- PLAN_FEATURES (Features Granulares por Plano)
-- ==========================================
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  feature_value JSONB DEFAULT 'true'::JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_plan_feature UNIQUE(plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_key ON plan_features(feature_key);

COMMENT ON TABLE plan_features IS 'Features granulares e configuráveis por plano';
COMMENT ON COLUMN plan_features.feature_value IS 'Valor da feature em JSON (true/false, número, objeto)';

-- ==========================================
-- SUBSCRIPTIONS (Assinaturas das Organizações)
-- ==========================================
CREATE TYPE subscription_status AS ENUM (
  'trialing',      -- Em período de teste
  'active',        -- Ativa e paga
  'past_due',      -- Pagamento atrasado
  'canceled',      -- Cancelada pelo usuário
  'unpaid',        -- Não paga (após past_due)
  'paused',        -- Pausada temporariamente
  'expired'        -- Expirada
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE, -- Referência à organização (1:1)
  plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT NOT NULL,

  status subscription_status DEFAULT 'trialing' NOT NULL,

  -- Datas importantes
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
  next_billing_date TIMESTAMP WITH TIME ZONE,

  -- Gateway de pagamento
  payment_gateway VARCHAR(50), -- stripe, pagarme, pix, etc
  gateway_subscription_id VARCHAR(255),
  gateway_customer_id VARCHAR(255),

  -- Customizações (override de limites do plano)
  custom_limits JSONB DEFAULT '{}'::JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE status = 'trialing';
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_date ON subscriptions(next_billing_date);

COMMENT ON TABLE subscriptions IS 'Assinaturas das organizações com planos';
COMMENT ON COLUMN subscriptions.custom_limits IS 'Override de limites específico para esta assinatura';

-- ==========================================
-- USAGE_TRACKING (Rastreamento de Uso)
-- ==========================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  -- Período de medição
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Contadores de uso
  stores_count INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 0,
  products_count INTEGER DEFAULT 0,
  imports_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,

  -- Uso de features específicas
  analytics_queries INTEGER DEFAULT 0,
  reports_generated INTEGER DEFAULT 0,
  alerts_sent INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_org_period UNIQUE(org_id, period_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_id ON usage_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

COMMENT ON TABLE usage_tracking IS 'Rastreamento mensal de uso por organização para billing e limites';

-- ==========================================
-- INVOICES (Histórico de Faturas)
-- ==========================================
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'open',
  'paid',
  'void',
  'uncollectible'
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  status invoice_status DEFAULT 'draft' NOT NULL,

  -- Valores
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',

  -- Datas
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Gateway
  payment_gateway VARCHAR(50),
  gateway_invoice_id VARCHAR(255),
  payment_method VARCHAR(50), -- credit_card, pix, boleto

  -- Detalhes
  line_items JSONB DEFAULT '[]'::JSONB,
  billing_details JSONB DEFAULT '{}'::JSONB,

  -- PDF
  pdf_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

COMMENT ON TABLE invoices IS 'Histórico de faturas e pagamentos';

-- ==========================================
-- API_KEYS (Chaves de API para Integrações)
-- ==========================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL, -- Hash da chave (nunca armazenar plain text)
  key_prefix VARCHAR(10) NOT NULL, -- Primeiros caracteres para identificação (ex: "sk_live_")

  -- Permissões
  scopes TEXT[] DEFAULT ARRAY['read']::TEXT[],

  -- Limites
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER,

  -- Tracking
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID,
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

COMMENT ON TABLE api_keys IS 'Chaves de API para integrações externas (M2M)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash da chave - NUNCA armazenar plain text';
COMMENT ON COLUMN api_keys.scopes IS 'Escopos permitidos: read, write, admin, etc';

-- ==========================================
-- AUDIT_LOG (Log de Auditoria)
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID,

  -- Ação
  action VARCHAR(100) NOT NULL, -- user.login, subscription.upgraded, etc
  resource_type VARCHAR(50), -- user, store, product, etc
  resource_id UUID,

  -- Detalhes
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Contexto
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Particionar por mês para performance (opcional, requer config adicional)
COMMENT ON TABLE audit_log IS 'Log de auditoria completo para compliance e debugging';

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- DADOS INICIAIS: PLANOS PADRÃO
-- ==========================================

INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, max_stores, max_users, max_products, max_monthly_imports, max_api_calls_per_day, has_analytics_basic, has_analytics_advanced, has_risk_scoring, has_predictions, has_api_access, has_custom_reports, has_realtime_alerts, has_integrations, has_dedicated_support, data_retention_months, sort_order)
VALUES
  -- Plano Gratuito (Trial permanente limitado)
  ('free', 'Gratuito', 'Ideal para testar a plataforma', 0, 0, 1, 3, 100, 10, 100, true, false, false, false, false, false, false, false, false, 3, 0),

  -- Plano Essencial
  ('essential', 'Essencial', 'Para pequenos varejos começando a controlar perdas', 199.00, 1990.00, 3, 10, 1000, 100, 1000, true, false, false, false, false, false, false, false, false, 12, 1),

  -- Plano Profissional
  ('professional', 'Profissional', 'Para redes em crescimento com necessidade de análises avançadas', 499.00, 4990.00, 10, 50, 10000, 500, 5000, true, true, true, false, true, true, true, false, false, 24, 2),

  -- Plano Enterprise
  ('enterprise', 'Enterprise', 'Para grandes redes com necessidades customizadas', 1499.00, 14990.00, -1, -1, -1, -1, -1, true, true, true, true, true, true, true, true, true, 60, 3)
ON CONFLICT (name) DO NOTHING;

-- Features extras por plano
INSERT INTO plan_features (plan_id, feature_key, feature_value, description)
SELECT
  p.id,
  f.feature_key,
  f.feature_value,
  f.description
FROM plans p
CROSS JOIN (
  VALUES
    ('essential', 'export_formats', '["csv", "xlsx"]'::JSONB, 'Formatos de exportação disponíveis'),
    ('professional', 'export_formats', '["csv", "xlsx", "pdf"]'::JSONB, 'Formatos de exportação disponíveis'),
    ('enterprise', 'export_formats', '["csv", "xlsx", "pdf", "api"]'::JSONB, 'Formatos de exportação disponíveis'),
    ('professional', 'dashboard_widgets', '["pareto", "ranking", "trends", "alerts"]'::JSONB, 'Widgets disponíveis no dashboard'),
    ('enterprise', 'dashboard_widgets', '["pareto", "ranking", "trends", "alerts", "predictions", "clusters", "custom"]'::JSONB, 'Widgets disponíveis no dashboard'),
    ('enterprise', 'sla_response_hours', '24'::JSONB, 'SLA de resposta em horas'),
    ('enterprise', 'custom_branding', 'true'::JSONB, 'Permite branding customizado')
) AS f(plan_name, feature_key, feature_value, description)
WHERE p.name = f.plan_name
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- ==========================================
-- VIEWS ÚTEIS
-- ==========================================

-- View: Organizações com status de assinatura
CREATE OR REPLACE VIEW org_subscription_status AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  o.slug AS org_slug,
  s.id AS subscription_id,
  s.status AS subscription_status,
  p.name AS plan_name,
  p.display_name AS plan_display_name,
  p.max_stores,
  p.max_users,
  p.max_products,
  COALESCE((s.custom_limits->>'max_stores')::INTEGER, p.max_stores) AS effective_max_stores,
  COALESCE((s.custom_limits->>'max_users')::INTEGER, p.max_users) AS effective_max_users,
  COALESCE((s.custom_limits->>'max_products')::INTEGER, p.max_products) AS effective_max_products,
  s.trial_end,
  s.current_period_end,
  CASE
    WHEN s.status = 'trialing' AND s.trial_end < NOW() THEN true
    WHEN s.status IN ('past_due', 'unpaid', 'expired') THEN true
    ELSE false
  END AS needs_attention
FROM organizations o
LEFT JOIN subscriptions s ON s.org_id = o.id
LEFT JOIN plans p ON p.id = s.plan_id;

COMMENT ON VIEW org_subscription_status IS 'Status consolidado de assinatura por organização';

-- ==========================================
-- FUNCTIONS ÚTEIS
-- ==========================================

-- Função: Verificar se organização tem acesso a feature
CREATE OR REPLACE FUNCTION has_feature(p_org_id UUID, p_feature_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_id UUID;
  v_has_feature BOOLEAN;
BEGIN
  -- Buscar plano da organização
  SELECT s.plan_id INTO v_plan_id
  FROM subscriptions s
  WHERE s.org_id = p_org_id
    AND s.status IN ('trialing', 'active');

  IF v_plan_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar feature específica
  SELECT (pf.feature_value)::TEXT::BOOLEAN INTO v_has_feature
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id
    AND pf.feature_key = p_feature_key;

  RETURN COALESCE(v_has_feature, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Verificar limite de uso
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_org_id UUID,
  p_limit_type VARCHAR, -- stores, users, products, imports
  p_current_count INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_max_limit INTEGER;
  v_current INTEGER;
  v_result JSONB;
BEGIN
  -- Buscar limite do plano
  SELECT
    CASE p_limit_type
      WHEN 'stores' THEN COALESCE((s.custom_limits->>'max_stores')::INTEGER, p.max_stores)
      WHEN 'users' THEN COALESCE((s.custom_limits->>'max_users')::INTEGER, p.max_users)
      WHEN 'products' THEN COALESCE((s.custom_limits->>'max_products')::INTEGER, p.max_products)
      WHEN 'imports' THEN COALESCE((s.custom_limits->>'max_monthly_imports')::INTEGER, p.max_monthly_imports)
      ELSE 0
    END INTO v_max_limit
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.org_id = p_org_id
    AND s.status IN ('trialing', 'active');

  -- -1 significa ilimitado
  IF v_max_limit = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', -1,
      'current', COALESCE(p_current_count, 0),
      'unlimited', true
    );
  END IF;

  v_current := COALESCE(p_current_count, 0);

  RETURN jsonb_build_object(
    'allowed', v_current < v_max_limit,
    'limit', v_max_limit,
    'current', v_current,
    'remaining', GREATEST(0, v_max_limit - v_current),
    'unlimited', false
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Gerar número de fatura
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR;
  v_sequence INTEGER;
  v_number VARCHAR;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 5 FOR 6) AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE invoice_number LIKE v_year || '%';

  v_number := v_year || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- RLS PARA TABELAS DE SUBSCRIPTION
-- ==========================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Plans: Leitura pública para planos ativos
CREATE POLICY "plans_select_public" ON plans
  FOR SELECT USING (is_active = true AND is_public = true);

CREATE POLICY "plans_admin_all" ON plans
  FOR ALL USING (
    auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- Plan Features: Leitura pública
CREATE POLICY "plan_features_select" ON plan_features
  FOR SELECT USING (true);

CREATE POLICY "plan_features_admin" ON plan_features
  FOR ALL USING (
    auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- Subscriptions: Apenas própria organização
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (
    org_id::TEXT = auth.jwt()->>'orgId'
    OR auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

CREATE POLICY "subscriptions_admin" ON subscriptions
  FOR ALL USING (
    auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- Usage Tracking: Apenas própria organização
CREATE POLICY "usage_tracking_select_own" ON usage_tracking
  FOR SELECT USING (
    org_id::TEXT = auth.jwt()->>'orgId'
    OR auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- Invoices: Apenas própria organização
CREATE POLICY "invoices_select_own" ON invoices
  FOR SELECT USING (
    org_id::TEXT = auth.jwt()->>'orgId'
    OR auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- API Keys: Apenas própria organização
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (
    org_id::TEXT = auth.jwt()->>'orgId'
  );

CREATE POLICY "api_keys_manage_own" ON api_keys
  FOR ALL USING (
    org_id::TEXT = auth.jwt()->>'orgId'
    AND auth.jwt()->>'role' IN ('super_admin', 'admin_rede')
  );

-- Audit Log: Apenas própria organização (leitura)
CREATE POLICY "audit_log_select_own" ON audit_log
  FOR SELECT USING (
    org_id::TEXT = auth.jwt()->>'orgId'
    OR auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- Service role pode inserir em audit_log
CREATE POLICY "audit_log_service_insert" ON audit_log
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR auth.jwt()->>'role' IN ('super_admin', 'developer')
  );

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT ON plans TO authenticated;
GRANT SELECT ON plan_features TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON usage_tracking TO authenticated;
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT ON org_subscription_status TO authenticated;

-- Service role tem acesso total
GRANT ALL ON plans TO service_role;
GRANT ALL ON plan_features TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON usage_tracking TO service_role;
GRANT ALL ON invoices TO service_role;
GRANT ALL ON api_keys TO service_role;
GRANT ALL ON audit_log TO service_role;

-- ==========================================
-- MIGRATION COMPLETA
-- ==========================================
