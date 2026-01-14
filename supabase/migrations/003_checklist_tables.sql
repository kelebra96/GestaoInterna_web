-- ==========================================
-- Migration 003: Tabelas de Checklists
-- ==========================================

-- ==========================================
-- CHECKLIST_TEMPLATES (Templates de Checklist)
-- ==========================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  store_ids UUID[] DEFAULT ARRAY[]::UUID[],
  sectors TEXT[] DEFAULT ARRAY[]::TEXT[],
  allowed_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  questions JSONB NOT NULL DEFAULT '[]'::JSONB,
  estimated_duration INTEGER DEFAULT 0,
  requires_gps BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  allow_offline_execution BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_template_type CHECK (type IN ('quality', 'safety', 'maintenance', 'inventory', 'custom')),
  CONSTRAINT valid_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'on_demand'))
);

-- Índices para checklist_templates
CREATE INDEX IF NOT EXISTS idx_checklist_templates_company_id ON checklist_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_type ON checklist_templates(type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_active ON checklist_templates(active);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_created_by ON checklist_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_store_ids ON checklist_templates USING GIN (store_ids);

COMMENT ON TABLE checklist_templates IS 'Templates de checklists com perguntas configuráveis';
COMMENT ON COLUMN checklist_templates.questions IS 'Array JSONB de perguntas: [{ id, order, question, type, required, options, ... }]';
COMMENT ON COLUMN checklist_templates.store_ids IS 'Array de lojas onde este template é aplicável (vazio = todas as lojas)';
COMMENT ON COLUMN checklist_templates.version IS 'Versão do template, incrementa quando questions são atualizadas';

-- ==========================================
-- CHECKLIST_EXECUTIONS (Execuções de Checklist)
-- ==========================================
CREATE TABLE IF NOT EXISTS checklist_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  store_name VARCHAR(255),
  sector VARCHAR(100),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  user_name VARCHAR(255),
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_duration INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  answers JSONB DEFAULT '[]'::JSONB,
  score JSONB,
  conformity JSONB,
  gps_location JSONB,
  final_signature TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_execution_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue'))
);

-- Índices para checklist_executions
CREATE INDEX IF NOT EXISTS idx_checklist_executions_template_id ON checklist_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_company_id ON checklist_executions(company_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_store_id ON checklist_executions(store_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_user_id ON checklist_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_status ON checklist_executions(status);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_scheduled_date ON checklist_executions(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_store_status ON checklist_executions(store_id, status);

COMMENT ON TABLE checklist_executions IS 'Execuções de checklists pelos usuários';
COMMENT ON COLUMN checklist_executions.answers IS 'Array JSONB de respostas: [{ questionId, value, answeredAt, photos, ... }]';
COMMENT ON COLUMN checklist_executions.score IS 'JSONB com pontuação: { total, earned, percentage }';
COMMENT ON COLUMN checklist_executions.conformity IS 'JSONB com conformidade: { total, passed, percentage }';
COMMENT ON COLUMN checklist_executions.gps_location IS 'JSONB com localização: { latitude, longitude, accuracy, timestamp }';
COMMENT ON COLUMN checklist_executions.status IS 'scheduled: agendado, in_progress: em andamento, completed: concluído, cancelled: cancelado, overdue: atrasado';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

CREATE TRIGGER trigger_checklist_executions_updated_at
  BEFORE UPDATE ON checklist_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();
