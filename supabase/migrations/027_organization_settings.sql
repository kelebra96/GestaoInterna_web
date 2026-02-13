-- =============================================
-- TABELA: organization_settings
-- Configurações de ML por organização
-- =============================================

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  ml_settings JSONB DEFAULT '{
    "enableAutoPredictions": true,
    "enableAnomalyDetection": true,
    "enableRecommendations": true,
    "predictionHorizonDays": 7,
    "anomalyThreshold": 2.5,
    "recommendationMinConfidence": 0.7,
    "clusteringEnabled": true,
    "seasonalityDetection": true
  }'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(org_id);

-- Grants
GRANT ALL ON organization_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON organization_settings TO authenticated;

COMMENT ON TABLE organization_settings IS 'Configurações de ML por organização';
