-- ==========================================
-- MÓDULO DE IMPORTAÇÃO - VERSÃO SIMPLIFICADA
-- Sem ENUMs, RLS ou funções complexas
-- Execute no Supabase SQL Editor
-- ==========================================

-- ==========================================
-- TABELA: import_templates
-- ==========================================

CREATE TABLE IF NOT EXISTS import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  import_type TEXT NOT NULL CHECK (import_type IN ('losses', 'expiry', 'inventory', 'products', 'sales', 'stock_movement')),
  column_mapping JSONB NOT NULL DEFAULT '[]'::JSONB,
  file_format TEXT DEFAULT 'csv' CHECK (file_format IN ('csv', 'xlsx', 'xls', 'txt')),
  has_header BOOLEAN DEFAULT true,
  header_row INTEGER DEFAULT 1,
  data_start_row INTEGER DEFAULT 2,
  delimiter VARCHAR(5) DEFAULT ',',
  encoding VARCHAR(20) DEFAULT 'utf-8',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  validation_rules JSONB DEFAULT '[]'::JSONB,
  transformations JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_templates_org ON import_templates(org_id);

-- ==========================================
-- TABELA: import_jobs
-- ==========================================

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID,
  template_id UUID REFERENCES import_templates(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  file_format TEXT NOT NULL CHECK (file_format IN ('csv', 'xlsx', 'xls', 'txt')),
  file_url TEXT,
  import_type TEXT NOT NULL CHECK (import_type IN ('losses', 'expiry', 'inventory', 'products', 'sales', 'stock_movement')),
  config JSONB DEFAULT '{}'::JSONB,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'validating', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  status_message TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  total_quantity DECIMAL(15, 3) DEFAULT 0,
  total_value DECIMAL(15, 2) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  created_by UUID NOT NULL,
  can_rollback BOOLEAN DEFAULT true,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON import_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_store ON import_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- ==========================================
-- TABELA: import_job_errors
-- ==========================================

CREATE TABLE IF NOT EXISTS import_job_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE NOT NULL,
  row_number INTEGER NOT NULL,
  column_name VARCHAR(100),
  field_name VARCHAR(100),
  error_type VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  raw_value TEXT,
  expected_format TEXT,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_job ON import_job_errors(job_id);

-- ==========================================
-- TABELA: import_job_rows (para rollback)
-- ==========================================

CREATE TABLE IF NOT EXISTS import_job_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE NOT NULL,
  row_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  raw_data JSONB NOT NULL,
  processed_data JSONB,
  target_table VARCHAR(100),
  target_id UUID,
  validation_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_rows_job ON import_job_rows(job_id);

-- ==========================================
-- TABELA: loss_records (registros de perdas)
-- ==========================================

CREATE TABLE IF NOT EXISTS loss_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID NOT NULL,
  product_id UUID,
  ean VARCHAR(50),
  sku VARCHAR(50),
  product_name VARCHAR(255),
  brand VARCHAR(100),
  category VARCHAR(100),
  supplier VARCHAR(255),
  quantity DECIMAL(15, 3) NOT NULL,
  unit_cost DECIMAL(15, 2),
  total_cost DECIMAL(15, 2),
  sale_price DECIMAL(15, 2),
  total_sale_value DECIMAL(15, 2),
  margin_lost DECIMAL(15, 2),
  loss_type VARCHAR(50) NOT NULL,
  loss_reason TEXT,
  loss_category VARCHAR(100),
  occurrence_date DATE NOT NULL,
  expiry_date DATE,
  source VARCHAR(50) DEFAULT 'import',
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loss_records_org ON loss_records(org_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_store ON loss_records(store_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_date ON loss_records(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_loss_records_type ON loss_records(loss_type);
CREATE INDEX IF NOT EXISTS idx_loss_records_import ON loss_records(import_job_id);

-- ==========================================
-- FUNÇÃO: complete_import_job
-- ==========================================

CREATE OR REPLACE FUNCTION complete_import_job(
  p_job_id UUID,
  p_status TEXT,
  p_records_created INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_total_quantity DECIMAL DEFAULT 0,
  p_total_value DECIMAL DEFAULT 0,
  p_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
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

-- ==========================================
-- GRANTS (permitir acesso service_role)
-- ==========================================

GRANT ALL ON import_templates TO service_role;
GRANT ALL ON import_jobs TO service_role;
GRANT ALL ON import_job_errors TO service_role;
GRANT ALL ON import_job_rows TO service_role;
GRANT ALL ON loss_records TO service_role;
GRANT EXECUTE ON FUNCTION complete_import_job TO service_role;

-- Também dar acesso para authenticated users
GRANT SELECT, INSERT, UPDATE ON import_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON import_jobs TO authenticated;
GRANT SELECT ON import_job_errors TO authenticated;
GRANT SELECT ON import_job_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON loss_records TO authenticated;
