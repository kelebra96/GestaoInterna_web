-- =============================================
-- Event Store - Sprint 6 Event-Driven Architecture
-- =============================================
-- Tabelas para persistência de eventos e webhooks.
-- Permite auditoria completa e replay de eventos.
-- =============================================

-- ==========================================
-- EVENTS TABLE (Event Store)
-- ==========================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do evento
  type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50),
  aggregate_id UUID,

  -- Payload do evento (JSONB para queries)
  payload JSONB NOT NULL DEFAULT '{}',

  -- Metadados
  correlation_id UUID,
  causation_id UUID,
  user_id UUID REFERENCES auth.users(id),
  org_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Versioning (para otimistic locking)
  version INTEGER DEFAULT 1,

  -- Metadata adicional
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);

-- Índice composto para queries por tipo e período
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at DESC);

-- Índice GIN para busca no payload
CREATE INDEX IF NOT EXISTS idx_events_payload ON events USING gin(payload);

-- ==========================================
-- WEBHOOKS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Configuração
  name VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,

  -- Eventos assinados (array de tipos)
  event_types TEXT[] NOT NULL DEFAULT '{}',

  -- Status
  active BOOLEAN DEFAULT true,

  -- Organização (opcional, se null = global)
  org_id UUID,

  -- Configurações de retry
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,

  -- Headers customizados
  headers JSONB DEFAULT '{}',

  -- Estatísticas
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_event_types ON webhooks USING gin(event_types);

-- ==========================================
-- WEBHOOK DELIVERIES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Detalhes do evento
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Status da entrega
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending, delivered, failed, retrying

  -- Resposta
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,

  -- Retry
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,

  -- Error
  error TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- ==========================================
-- EVENT SUBSCRIPTIONS TABLE
-- ==========================================
-- Para handlers persistentes (ex: cron jobs que processam eventos)

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Padrão de eventos (ex: "solicitacao.*", "product.created")
  event_pattern VARCHAR(100) NOT NULL,

  -- Handler (nome da função ou endpoint)
  handler_type VARCHAR(20) NOT NULL DEFAULT 'internal',
  -- internal, http, queue
  handler_config JSONB NOT NULL DEFAULT '{}',

  -- Estado
  active BOOLEAN DEFAULT true,

  -- Posição do cursor (último evento processado)
  last_event_id UUID,
  last_processed_at TIMESTAMPTZ,

  -- Estatísticas
  events_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_subscriptions_pattern ON event_subscriptions(event_pattern);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_active ON event_subscriptions(active) WHERE active = true;

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Função para inserir evento
CREATE OR REPLACE FUNCTION insert_event(
  p_type VARCHAR(100),
  p_payload JSONB,
  p_aggregate_type VARCHAR(50) DEFAULT NULL,
  p_aggregate_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (
    type,
    payload,
    aggregate_type,
    aggregate_id,
    user_id,
    org_id,
    correlation_id,
    metadata
  ) VALUES (
    p_type,
    p_payload,
    p_aggregate_type,
    p_aggregate_id,
    p_user_id,
    p_org_id,
    COALESCE(p_correlation_id, gen_random_uuid()),
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Função para obter eventos de um agregado
CREATE OR REPLACE FUNCTION get_aggregate_events(
  p_aggregate_type VARCHAR(50),
  p_aggregate_id UUID,
  p_from_version INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type VARCHAR(100),
  payload JSONB,
  version INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
  SELECT id, type, payload, version, created_at
  FROM events
  WHERE aggregate_type = p_aggregate_type
    AND aggregate_id = p_aggregate_id
    AND version > p_from_version
  ORDER BY version ASC;
$$;

-- Função para estatísticas de eventos
CREATE OR REPLACE FUNCTION get_event_stats(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  event_type VARCHAR(100),
  count BIGINT,
  first_at TIMESTAMPTZ,
  last_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
  SELECT
    type as event_type,
    COUNT(*) as count,
    MIN(created_at) as first_at,
    MAX(created_at) as last_at
  FROM events
  WHERE created_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY type
  ORDER BY count DESC;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER event_subscriptions_updated_at
  BEFORE UPDATE ON event_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- RLS Policies
-- ==========================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;

-- Events: usuários podem ver eventos da sua organização
CREATE POLICY events_select_org ON events
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ) OR org_id IS NULL);

-- Service role pode tudo
CREATE POLICY events_service ON events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Webhooks: apenas admins da organização
CREATE POLICY webhooks_org_admin ON webhooks
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
    OR auth.role() = 'service_role'
  );

-- Webhook deliveries: apenas admins
CREATE POLICY webhook_deliveries_admin ON webhook_deliveries
  FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM webhooks WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
    OR auth.role() = 'service_role'
  );

-- Event subscriptions: apenas service_role
CREATE POLICY event_subscriptions_service ON event_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT ON events TO authenticated;
GRANT ALL ON events TO service_role;

GRANT ALL ON webhooks TO authenticated;
GRANT ALL ON webhooks TO service_role;

GRANT SELECT ON webhook_deliveries TO authenticated;
GRANT ALL ON webhook_deliveries TO service_role;

GRANT ALL ON event_subscriptions TO service_role;

GRANT EXECUTE ON FUNCTION insert_event TO service_role;
GRANT EXECUTE ON FUNCTION get_aggregate_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_stats TO authenticated;

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE events IS 'Event Store - persistência de todos os eventos do sistema';
COMMENT ON TABLE webhooks IS 'Configuração de webhooks para notificações externas';
COMMENT ON TABLE webhook_deliveries IS 'Histórico de entregas de webhooks';
COMMENT ON TABLE event_subscriptions IS 'Assinaturas de eventos para processamento assíncrono';
