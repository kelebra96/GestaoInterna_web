-- ==========================================
-- Migration 024: Módulo de Importação Robusto
-- Created: 2026-02-11
-- Description: Sistema completo de importação com templates, validação e histórico
-- ==========================================

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE import_status AS ENUM (
  'pending',      -- Aguardando processamento
  'validating',   -- Validando dados
  'processing',   -- Processando registros
  'completed',    -- Concluído com sucesso
  'completed_with_errors', -- Concluído com erros parciais
  'failed',       -- Falha total
  'cancelled'     -- Cancelado pelo usuário
);

CREATE TYPE import_type AS ENUM (
  'losses',           -- Perdas/quebras
  'expiry',           -- Vencimentos
  'inventory',        -- Inventário
  'products',         -- Catálogo de produtos
  'sales',            -- Vendas
  'stock_movement'    -- Movimentação de estoque
);

CREATE TYPE import_file_format AS ENUM (
  'csv',
  'xlsx',
  'xls',
  'txt'
);

-- ==========================================
-- TABELA: import_templates (Templates de Importação)
-- ==========================================

CREATE TABLE IF NOT EXISTS import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  name VARCHAR(100) NOT NULL,
  description TEXT,
  import_type import_type NOT NULL,

  -- Configuração de colunas
  column_mapping JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Exemplo: [
  --   {"source": "A", "target": "ean", "required": true, "type": "string"},
  --   {"source": "B", "target": "description", "required": true, "type": "string"},
  --   {"source": "C", "target": "quantity", "required": true, "type": "number"},
  --   {"source": "D", "target": "unit_cost", "required": false, "type": "currency"},
  --   {"source": "E", "target": "loss_reason", "required": true, "type": "enum", "options": ["vencimento", "avaria", "roubo"]}
  -- ]

  -- Configurações de arquivo
  file_format import_file_format DEFAULT 'csv',
  has_header BOOLEAN DEFAULT true,
  header_row INTEGER DEFAULT 1,
  data_start_row INTEGER DEFAULT 2,
  delimiter VARCHAR(5) DEFAULT ',',
  encoding VARCHAR(20) DEFAULT 'utf-8',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',

  -- Validações customizadas
  validation_rules JSONB DEFAULT '[]'::JSONB,
  -- Exemplo: [
  --   {"field": "quantity", "rule": "positive", "message": "Quantidade deve ser positiva"},
  --   {"field": "ean", "rule": "digits", "length": 13, "message": "EAN deve ter 13 dígitos"}
  -- ]

  -- Transformações
  transformations JSONB DEFAULT '[]'::JSONB,
  -- Exemplo: [
  --   {"field": "ean", "action": "pad_left", "length": 13, "char": "0"},
  --   {"field": "description", "action": "uppercase"}
  -- ]

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Estatísticas de uso
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_template_name UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_import_templates_org ON import_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_import_templates_type ON import_templates(import_type);

COMMENT ON TABLE import_templates IS 'Templates reutilizáveis de configuração de importação';
COMMENT ON COLUMN import_templates.column_mapping IS 'Mapeamento de colunas do arquivo para campos do sistema';

-- ==========================================
-- TABELA: import_jobs (Jobs de Importação)
-- ==========================================

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID,
  template_id UUID REFERENCES import_templates(id) ON DELETE SET NULL,

  -- Informações do arquivo
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- bytes
  file_format import_file_format NOT NULL,
  file_url TEXT, -- URL no storage (se aplicável)

  -- Tipo e configuração
  import_type import_type NOT NULL,
  config JSONB DEFAULT '{}'::JSONB, -- Configuração usada (snapshot do template + overrides)

  -- Status
  status import_status DEFAULT 'pending' NOT NULL,
  status_message TEXT,

  -- Progresso
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,

  -- Estatísticas
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,

  -- Valores processados (para perdas)
  total_quantity DECIMAL(15, 3) DEFAULT 0,
  total_value DECIMAL(15, 2) DEFAULT 0,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER,

  -- Quem executou
  created_by UUID NOT NULL,

  -- Rollback
  can_rollback BOOLEAN DEFAULT true,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rolled_back_by UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON import_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_store ON import_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON import_jobs(created_by);

COMMENT ON TABLE import_jobs IS 'Histórico de importações realizadas';

-- ==========================================
-- TABELA: import_job_errors (Erros de Importação)
-- ==========================================

CREATE TABLE IF NOT EXISTS import_job_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE NOT NULL,

  row_number INTEGER NOT NULL,
  column_name VARCHAR(100),
  field_name VARCHAR(100),

  error_type VARCHAR(50) NOT NULL, -- validation, parsing, database, duplicate
  error_message TEXT NOT NULL,
  error_details JSONB,

  raw_value TEXT,
  expected_format TEXT,

  is_critical BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_job ON import_job_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_type ON import_job_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_import_errors_row ON import_job_errors(job_id, row_number);

COMMENT ON TABLE import_job_errors IS 'Detalhes de erros por linha de importação';

-- ==========================================
-- TABELA: import_job_rows (Linhas Importadas - para rollback)
-- ==========================================

CREATE TABLE IF NOT EXISTS import_job_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE NOT NULL,

  row_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, valid, invalid, processed, skipped

  -- Dados originais e processados
  raw_data JSONB NOT NULL,
  processed_data JSONB,

  -- Referência ao registro criado
  target_table VARCHAR(100),
  target_id UUID,

  -- Validação
  validation_errors JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_rows_job ON import_job_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_job_rows(job_id, status);
CREATE INDEX IF NOT EXISTS idx_import_rows_target ON import_job_rows(target_table, target_id);

-- Particionar por job_id para performance em grandes importações
COMMENT ON TABLE import_job_rows IS 'Linhas individuais processadas - usado para rollback';

-- ==========================================
-- TABELA: loss_records (Registros de Perdas)
-- ==========================================

CREATE TABLE IF NOT EXISTS loss_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID NOT NULL,

  -- Produto
  product_id UUID,
  ean VARCHAR(50),
  sku VARCHAR(50),
  product_name VARCHAR(255),
  brand VARCHAR(100),
  category VARCHAR(100),
  supplier VARCHAR(255),

  -- Perda
  quantity DECIMAL(15, 3) NOT NULL,
  unit_cost DECIMAL(15, 2),
  total_cost DECIMAL(15, 2),
  sale_price DECIMAL(15, 2),
  total_sale_value DECIMAL(15, 2),
  margin_lost DECIMAL(15, 2),

  -- Classificação
  loss_type VARCHAR(50) NOT NULL, -- vencimento, avaria, roubo, quebra, ajuste, outros
  loss_reason TEXT,
  loss_category VARCHAR(100), -- categorização interna

  -- Data da ocorrência
  occurrence_date DATE NOT NULL,
  expiry_date DATE, -- Para perdas por vencimento

  -- Origem
  source VARCHAR(50) DEFAULT 'import', -- import, manual, integration
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loss_records_org ON loss_records(org_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_store ON loss_records(store_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_product ON loss_records(product_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_ean ON loss_records(ean);
CREATE INDEX IF NOT EXISTS idx_loss_records_date ON loss_records(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_loss_records_type ON loss_records(loss_type);
CREATE INDEX IF NOT EXISTS idx_loss_records_category ON loss_records(category);
CREATE INDEX IF NOT EXISTS idx_loss_records_supplier ON loss_records(supplier);
CREATE INDEX IF NOT EXISTS idx_loss_records_import ON loss_records(import_job_id);

COMMENT ON TABLE loss_records IS 'Registros de perdas importados ou inseridos manualmente';

-- ==========================================
-- VIEWS
-- ==========================================

-- View: Resumo de perdas por período
CREATE OR REPLACE VIEW v_loss_summary AS
SELECT
  org_id,
  store_id,
  DATE_TRUNC('month', occurrence_date) AS period,
  loss_type,
  category,
  COUNT(*) AS record_count,
  SUM(quantity) AS total_quantity,
  SUM(total_cost) AS total_cost,
  SUM(total_sale_value) AS total_sale_value,
  SUM(margin_lost) AS total_margin_lost,
  COUNT(DISTINCT product_id) AS products_affected,
  COUNT(DISTINCT supplier) AS suppliers_affected
FROM loss_records
GROUP BY org_id, store_id, DATE_TRUNC('month', occurrence_date), loss_type, category;

-- View: Top produtos com perdas
CREATE OR REPLACE VIEW v_top_loss_products AS
SELECT
  org_id,
  product_id,
  ean,
  product_name,
  brand,
  category,
  COUNT(*) AS occurrence_count,
  SUM(quantity) AS total_quantity,
  SUM(total_cost) AS total_cost,
  COUNT(DISTINCT store_id) AS stores_affected
FROM loss_records
WHERE occurrence_date >= NOW() - INTERVAL '90 days'
GROUP BY org_id, product_id, ean, product_name, brand, category
ORDER BY total_cost DESC;

-- View: Top fornecedores com perdas
CREATE OR REPLACE VIEW v_top_loss_suppliers AS
SELECT
  org_id,
  supplier,
  COUNT(*) AS occurrence_count,
  COUNT(DISTINCT product_id) AS products_affected,
  SUM(quantity) AS total_quantity,
  SUM(total_cost) AS total_cost
FROM loss_records
WHERE occurrence_date >= NOW() - INTERVAL '90 days'
  AND supplier IS NOT NULL
GROUP BY org_id, supplier
ORDER BY total_cost DESC;

-- ==========================================
-- FUNÇÕES
-- ==========================================

-- Função: Criar job de importação
CREATE OR REPLACE FUNCTION create_import_job(
  p_org_id UUID,
  p_store_id UUID,
  p_import_type import_type,
  p_file_name VARCHAR,
  p_file_format import_file_format,
  p_created_by UUID,
  p_template_id UUID DEFAULT NULL,
  p_config JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO import_jobs (
    org_id, store_id, template_id, file_name, file_format,
    import_type, config, created_by, status
  ) VALUES (
    p_org_id, p_store_id, p_template_id, p_file_name, p_file_format,
    p_import_type, p_config, p_created_by, 'pending'
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Função: Atualizar progresso do job
CREATE OR REPLACE FUNCTION update_import_job_progress(
  p_job_id UUID,
  p_processed_rows INTEGER,
  p_valid_rows INTEGER DEFAULT NULL,
  p_error_rows INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE import_jobs
  SET
    processed_rows = p_processed_rows,
    valid_rows = COALESCE(p_valid_rows, valid_rows),
    error_rows = COALESCE(p_error_rows, error_rows),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Função: Finalizar job de importação
CREATE OR REPLACE FUNCTION complete_import_job(
  p_job_id UUID,
  p_status import_status,
  p_records_created INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_total_quantity DECIMAL DEFAULT 0,
  p_total_value DECIMAL DEFAULT 0,
  p_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMP;
  v_processing_time INTEGER;
BEGIN
  SELECT started_at INTO v_started_at FROM import_jobs WHERE id = p_job_id;

  IF v_started_at IS NOT NULL THEN
    v_processing_time := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
  END IF;

  UPDATE import_jobs
  SET
    status = p_status,
    status_message = p_message,
    records_created = p_records_created,
    records_updated = p_records_updated,
    total_quantity = p_total_quantity,
    total_value = p_total_value,
    completed_at = NOW(),
    processing_time_ms = v_processing_time,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Atualizar estatísticas do template
  UPDATE import_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = (SELECT template_id FROM import_jobs WHERE id = p_job_id);
END;
$$ LANGUAGE plpgsql;

-- Função: Rollback de importação
CREATE OR REPLACE FUNCTION rollback_import_job(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_job RECORD;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Buscar job
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF NOT v_job.can_rollback THEN
    RAISE EXCEPTION 'Job cannot be rolled back';
  END IF;

  IF v_job.rolled_back_at IS NOT NULL THEN
    RAISE EXCEPTION 'Job already rolled back';
  END IF;

  -- Deletar registros de perda criados por este job
  IF v_job.import_type = 'losses' THEN
    DELETE FROM loss_records WHERE import_job_id = p_job_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  -- TODO: Adicionar rollback para outros tipos

  -- Marcar job como rolled back
  UPDATE import_jobs
  SET
    rolled_back_at = NOW(),
    rolled_back_by = p_user_id,
    can_rollback = false,
    status_message = 'Rolled back: ' || v_deleted_count || ' records deleted',
    updated_at = NOW()
  WHERE id = p_job_id;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_import_templates_updated_at
  BEFORE UPDATE ON import_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loss_records_updated_at
  BEFORE UPDATE ON loss_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE loss_records ENABLE ROW LEVEL SECURITY;

-- Templates
CREATE POLICY "import_templates_select_org" ON import_templates
  FOR SELECT USING (org_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "import_templates_manage_org" ON import_templates
  FOR ALL USING (org_id = get_current_org_id() AND is_org_admin());

-- Jobs
CREATE POLICY "import_jobs_select_org" ON import_jobs
  FOR SELECT USING (org_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "import_jobs_insert_org" ON import_jobs
  FOR INSERT WITH CHECK (org_id = get_current_org_id());

CREATE POLICY "import_jobs_update_org" ON import_jobs
  FOR UPDATE USING (org_id = get_current_org_id());

-- Errors
CREATE POLICY "import_errors_select" ON import_job_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM import_jobs j
      WHERE j.id = job_id AND (j.org_id = get_current_org_id() OR is_super_admin())
    )
  );

-- Rows
CREATE POLICY "import_rows_select" ON import_job_rows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM import_jobs j
      WHERE j.id = job_id AND (j.org_id = get_current_org_id() OR is_super_admin())
    )
  );

-- Loss Records
CREATE POLICY "loss_records_select_org" ON loss_records
  FOR SELECT USING (org_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "loss_records_insert_org" ON loss_records
  FOR INSERT WITH CHECK (org_id = get_current_org_id());

CREATE POLICY "loss_records_update_org" ON loss_records
  FOR UPDATE USING (org_id = get_current_org_id());

CREATE POLICY "loss_records_delete_org" ON loss_records
  FOR DELETE USING (org_id = get_current_org_id() AND is_org_admin());

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON import_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON import_jobs TO authenticated;
GRANT SELECT ON import_job_errors TO authenticated;
GRANT SELECT ON import_job_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loss_records TO authenticated;
GRANT SELECT ON v_loss_summary TO authenticated;
GRANT SELECT ON v_top_loss_products TO authenticated;
GRANT SELECT ON v_top_loss_suppliers TO authenticated;

GRANT ALL ON import_templates TO service_role;
GRANT ALL ON import_jobs TO service_role;
GRANT ALL ON import_job_errors TO service_role;
GRANT ALL ON import_job_rows TO service_role;
GRANT ALL ON loss_records TO service_role;

GRANT EXECUTE ON FUNCTION create_import_job TO authenticated;
GRANT EXECUTE ON FUNCTION update_import_job_progress TO service_role;
GRANT EXECUTE ON FUNCTION complete_import_job TO service_role;
GRANT EXECUTE ON FUNCTION rollback_import_job TO authenticated;

-- ==========================================
-- DADOS INICIAIS: TEMPLATES PADRÃO
-- ==========================================

-- Template padrão será criado por organização quando necessário

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION create_import_job IS 'Cria um novo job de importação';
COMMENT ON FUNCTION update_import_job_progress IS 'Atualiza o progresso de um job';
COMMENT ON FUNCTION complete_import_job IS 'Marca um job como concluído';
COMMENT ON FUNCTION rollback_import_job IS 'Desfaz uma importação, deletando registros criados';
