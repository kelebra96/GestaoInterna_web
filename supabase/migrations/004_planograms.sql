-- ==========================================
-- MyInventory - Schema de Planogramas
-- ==========================================

-- ==========================================
-- PLANOGRAM_BASE (Templates de Planogramas)
-- ==========================================
CREATE TABLE IF NOT EXISTS planogram_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'normal',
  category VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
  modules JSONB DEFAULT '[]'::jsonb,
  total_skus INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_planogram_type CHECK (type IN ('normal', 'promocional', 'sazonal', 'evento')),
  CONSTRAINT valid_planogram_status CHECK (status IN ('rascunho', 'publicado', 'em_revisao', 'arquivado'))
);

-- Índices para planogram_base
CREATE INDEX IF NOT EXISTS idx_planogram_base_org_id ON planogram_base(org_id);
CREATE INDEX IF NOT EXISTS idx_planogram_base_status ON planogram_base(status);
CREATE INDEX IF NOT EXISTS idx_planogram_base_type ON planogram_base(type);
CREATE INDEX IF NOT EXISTS idx_planogram_base_category ON planogram_base(category);
CREATE INDEX IF NOT EXISTS idx_planogram_base_created_at ON planogram_base(created_at);

-- ==========================================
-- PLANOGRAM_SLOTS (Posições nos Planogramas)
-- ==========================================
CREATE TABLE IF NOT EXISTS planogram_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planogram_id UUID REFERENCES planogram_base(id) ON DELETE CASCADE,
  module_index INTEGER NOT NULL,
  shelf_index INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_ean VARCHAR(50),
  product_name VARCHAR(500),
  facings INTEGER DEFAULT 1,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para planogram_slots
CREATE INDEX IF NOT EXISTS idx_planogram_slots_planogram_id ON planogram_slots(planogram_id);
CREATE INDEX IF NOT EXISTS idx_planogram_slots_product_id ON planogram_slots(product_id);

-- ==========================================
-- PLANOGRAM_STORE (Planogramas por Loja)
-- ==========================================
CREATE TABLE IF NOT EXISTS planogram_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_id UUID REFERENCES planogram_base(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  compliance_score DECIMAL(5, 2),
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_store_planogram_status CHECK (status IN ('pending', 'active', 'inactive', 'archived'))
);

-- Índices para planogram_store
CREATE INDEX IF NOT EXISTS idx_planogram_store_base_id ON planogram_store(base_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_store_id ON planogram_store(store_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_company_id ON planogram_store(company_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_status ON planogram_store(status);

-- ==========================================
-- PLANOGRAM_EXECUTIONS (Execuções/Verificações)
-- ==========================================
CREATE TABLE IF NOT EXISTS planogram_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  executed_by_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  compliance_score DECIMAL(5, 2),
  total_slots INTEGER DEFAULT 0,
  compliant_slots INTEGER DEFAULT 0,
  non_compliant_slots INTEGER DEFAULT 0,
  empty_slots INTEGER DEFAULT 0,
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_execution_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Índices para planogram_executions
CREATE INDEX IF NOT EXISTS idx_planogram_exec_store_id ON planogram_executions(planogram_store_id);
CREATE INDEX IF NOT EXISTS idx_planogram_exec_executed_by ON planogram_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_planogram_exec_status ON planogram_executions(status);
CREATE INDEX IF NOT EXISTS idx_planogram_exec_created_at ON planogram_executions(created_at);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE planogram_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE planogram_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE planogram_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE planogram_executions ENABLE ROW LEVEL SECURITY;

-- Policies para planogram_base
CREATE POLICY "Planogram base viewable by org users" ON planogram_base
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      org_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Planogram base insertable by authenticated" ON planogram_base
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Planogram base updatable by org users" ON planogram_base
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      org_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Planogram base deletable by admins" ON planogram_base
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_planogram_base_updated_at BEFORE UPDATE ON planogram_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planogram_slots_updated_at BEFORE UPDATE ON planogram_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planogram_store_updated_at BEFORE UPDATE ON planogram_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planogram_executions_updated_at BEFORE UPDATE ON planogram_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- COMENTÁRIOS
-- ==========================================
COMMENT ON TABLE planogram_base IS 'Templates base de planogramas';
COMMENT ON TABLE planogram_slots IS 'Posições de produtos nos planogramas';
COMMENT ON TABLE planogram_store IS 'Associação de planogramas às lojas';
COMMENT ON TABLE planogram_executions IS 'Execuções e verificações de planogramas';
