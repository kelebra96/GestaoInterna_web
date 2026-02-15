-- ==========================================
-- Migration 007: Compliance Tables
-- ==========================================

-- Tabela compliance_tasks (tarefas de conformidade de planogramas)
CREATE TABLE IF NOT EXISTS compliance_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'concluido', 'overdue', 'cancelled')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela compliance_executions (execuções de conformidade com fotos e análise AI)
CREATE TABLE IF NOT EXISTS compliance_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES compliance_tasks(id) ON DELETE SET NULL,
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  org_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  store_name VARCHAR(255),
  executed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  executed_by_name VARCHAR(255),

  -- Fotos (array JSON)
  photos JSONB DEFAULT '[]'::jsonb,

  -- Análise de IA (JSON object)
  ai_analysis JSONB,
  ai_score INTEGER DEFAULT 0 CHECK (ai_score >= 0 AND ai_score <= 100),

  -- Manual review (JSON object, opcional)
  manual_review JSONB,

  -- Status e metadados
  status VARCHAR(50) NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido', 'nao_conforme', 'em_revisao', 'aprovado', 'rejeitado')),
  notes TEXT,
  signature TEXT,

  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para compliance_tasks
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_org_id ON compliance_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_store_id ON compliance_tasks(store_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_planogram_store_id ON compliance_tasks(planogram_store_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_assigned_to ON compliance_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_status ON compliance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_due_date ON compliance_tasks(due_date);

-- Índices para compliance_executions
CREATE INDEX IF NOT EXISTS idx_compliance_executions_org_id ON compliance_executions(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_task_id ON compliance_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_store_id ON compliance_executions(store_id);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_planogram_store_id ON compliance_executions(planogram_store_id);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_executed_by ON compliance_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_status ON compliance_executions(status);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_ai_score ON compliance_executions(ai_score);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_executed_at ON compliance_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_created_at ON compliance_executions(created_at);

-- Índices GIN para busca em JSONB
CREATE INDEX IF NOT EXISTS idx_compliance_executions_photos_gin ON compliance_executions USING GIN (photos);
CREATE INDEX IF NOT EXISTS idx_compliance_executions_ai_analysis_gin ON compliance_executions USING GIN (ai_analysis);

-- Comentários
COMMENT ON TABLE compliance_tasks IS 'Tarefas de conformidade de planogramas por loja';
COMMENT ON TABLE compliance_executions IS 'Execuções de conformidade com fotos e análise de IA';

COMMENT ON COLUMN compliance_tasks.status IS 'Status: pending, in_progress, concluido, overdue, cancelled';
COMMENT ON COLUMN compliance_executions.photos IS 'Array JSON de fotos: [{id, url, moduleId, timestamp, gpsLocation}, ...]';
COMMENT ON COLUMN compliance_executions.ai_analysis IS 'Resultado da análise de IA: {analysisId, timestamp, complianceScore, issues, totalProducts, ...}';
COMMENT ON COLUMN compliance_executions.ai_score IS 'Score de conformidade de 0-100 calculado pela IA';
COMMENT ON COLUMN compliance_executions.manual_review IS 'Revisão manual (opcional): {reviewedBy, reviewedAt, reviewScore, comments}';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_compliance_tasks_updated_at
  BEFORE UPDATE ON compliance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_executions_updated_at
  BEFORE UPDATE ON compliance_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
