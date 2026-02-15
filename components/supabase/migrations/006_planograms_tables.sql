-- ==========================================
-- Migration 006: Planograms Tables
-- ==========================================

-- Tabela planogram_base (planogramas mestres/templates)
CREATE TABLE IF NOT EXISTS planogram_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('normal', 'promocional', 'sazonal', 'evento')),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicado', 'em_revisao', 'arquivado')),
  total_skus INTEGER DEFAULT 0,
  modules JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela planogram_store (planogramas por loja)
CREATE TABLE IF NOT EXISTS planogram_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  base_planogram_id UUID REFERENCES planogram_base(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'expired', 'archived')),
  adjustments JSONB DEFAULT '[]'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela planogram_slots (slots de produtos nos planogramas)
CREATE TABLE IF NOT EXISTS planogram_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planogram_base_id UUID REFERENCES planogram_base(id) ON DELETE CASCADE,
  planogram_store_id UUID REFERENCES planogram_store(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shelf_id VARCHAR(100) NOT NULL,
  position_x DECIMAL(10, 2) DEFAULT 0,
  width DECIMAL(10, 2) DEFAULT 1,
  facings INTEGER DEFAULT 1,
  capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir que um slot pertence a base OU store, não ambos
  CONSTRAINT check_planogram_type CHECK (
    (planogram_base_id IS NOT NULL AND planogram_store_id IS NULL) OR
    (planogram_base_id IS NULL AND planogram_store_id IS NOT NULL)
  )
);

-- Índices para planogram_base
CREATE INDEX IF NOT EXISTS idx_planogram_base_org_id ON planogram_base(org_id);
CREATE INDEX IF NOT EXISTS idx_planogram_base_status ON planogram_base(status);
CREATE INDEX IF NOT EXISTS idx_planogram_base_category ON planogram_base(category);
CREATE INDEX IF NOT EXISTS idx_planogram_base_type ON planogram_base(type);
CREATE INDEX IF NOT EXISTS idx_planogram_base_created_by ON planogram_base(created_by);

-- Índices para planogram_store
CREATE INDEX IF NOT EXISTS idx_planogram_store_org_id ON planogram_store(org_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_store_id ON planogram_store(store_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_base_id ON planogram_store(base_planogram_id);
CREATE INDEX IF NOT EXISTS idx_planogram_store_status ON planogram_store(status);

-- Índices para planogram_slots
CREATE INDEX IF NOT EXISTS idx_planogram_slots_base_id ON planogram_slots(planogram_base_id);
CREATE INDEX IF NOT EXISTS idx_planogram_slots_store_id ON planogram_slots(planogram_store_id);
CREATE INDEX IF NOT EXISTS idx_planogram_slots_product_id ON planogram_slots(product_id);
CREATE INDEX IF NOT EXISTS idx_planogram_slots_shelf_id ON planogram_slots(shelf_id);

-- Comentários
COMMENT ON TABLE planogram_base IS 'Planogramas mestres/templates que servem de base para planogramas de lojas';
COMMENT ON TABLE planogram_store IS 'Planogramas específicos de cada loja, derivados de planogramas base';
COMMENT ON TABLE planogram_slots IS 'Slots de produtos nos planogramas (posições nas prateleiras)';

COMMENT ON COLUMN planogram_base.modules IS 'Array JSON com configuração dos módulos/prateleiras';
COMMENT ON COLUMN planogram_base.version IS 'Versão do planograma (incrementa a cada mudança nos módulos)';
COMMENT ON COLUMN planogram_store.adjustments IS 'Array JSON com ajustes aplicados ao planograma base';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_planogram_base_updated_at
  BEFORE UPDATE ON planogram_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planogram_store_updated_at
  BEFORE UPDATE ON planogram_store
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planogram_slots_updated_at
  BEFORE UPDATE ON planogram_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
