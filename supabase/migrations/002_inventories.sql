-- ==========================================
-- MyInventory - Schema de Inventários
-- ==========================================

-- ==========================================
-- INVENTORIES (Inventários)
-- ==========================================
CREATE TABLE IF NOT EXISTS inventories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'preparation',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Datas importantes
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  imported_at TIMESTAMP WITH TIME ZONE,

  -- Métricas
  total_addresses INTEGER DEFAULT 0,
  addresses_completed INTEGER DEFAULT 0,
  total_items_expected INTEGER DEFAULT 0,
  total_items_counted INTEGER DEFAULT 0,
  total_discrepancies INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_inventory_status CHECK (status IN ('preparation', 'in_progress', 'completed', 'cancelled'))
);

-- Índices para inventories
CREATE INDEX IF NOT EXISTS idx_inventories_store_id ON inventories(store_id);
CREATE INDEX IF NOT EXISTS idx_inventories_company_id ON inventories(company_id);
CREATE INDEX IF NOT EXISTS idx_inventories_status ON inventories(status);
CREATE INDEX IF NOT EXISTS idx_inventories_created_at ON inventories(created_at);
CREATE INDEX IF NOT EXISTS idx_inventories_created_by ON inventories(created_by);

-- ==========================================
-- INVENTORY_ADDRESSES (Endereços do Inventário)
-- ==========================================
CREATE TABLE IF NOT EXISTS inventory_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventories(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  address_code VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  -- Atribuição
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_user_name VARCHAR(255),
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- Métricas
  items_counted INTEGER DEFAULT 0,
  items_expected INTEGER DEFAULT 0,

  -- Datas
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_address_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT unique_address_per_inventory UNIQUE (inventory_id, address_code)
);

-- Índices para inventory_addresses
CREATE INDEX IF NOT EXISTS idx_inv_addresses_inventory_id ON inventory_addresses(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inv_addresses_store_id ON inventory_addresses(store_id);
CREATE INDEX IF NOT EXISTS idx_inv_addresses_status ON inventory_addresses(status);
CREATE INDEX IF NOT EXISTS idx_inv_addresses_assigned_user ON inventory_addresses(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_inv_addresses_address_code ON inventory_addresses(address_code);

-- ==========================================
-- INVENTORY_ITEMS (Itens do Inventário)
-- ==========================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventories(id) ON DELETE CASCADE,
  address_id UUID REFERENCES inventory_addresses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- Identificação do produto
  ean VARCHAR(50),
  internal_code VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2),

  -- Contagem
  expected_quantity INTEGER DEFAULT 0,
  counted_quantity INTEGER DEFAULT 0,
  diff_type VARCHAR(20),

  -- Quem contou
  counted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  counted_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_diff_type CHECK (diff_type IS NULL OR diff_type IN ('missing', 'excess', 'ok'))
);

-- Índices para inventory_items
CREATE INDEX IF NOT EXISTS idx_inv_items_inventory_id ON inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_address_id ON inventory_items(address_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_ean ON inventory_items(ean);
CREATE INDEX IF NOT EXISTS idx_inv_items_internal_code ON inventory_items(internal_code);
CREATE INDEX IF NOT EXISTS idx_inv_items_diff_type ON inventory_items(diff_type);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS nas tabelas de inventário
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policies para INVENTORIES
CREATE POLICY "Inventories viewable by company users" ON inventories
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Inventories insertable by authenticated" ON inventories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Inventories updatable by company users" ON inventories
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Inventories deletable by admins" ON inventories
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- Policies para INVENTORY_ADDRESSES
CREATE POLICY "Addresses viewable by company users" ON inventory_addresses
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Addresses insertable by authenticated" ON inventory_addresses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Addresses updatable by company users" ON inventory_addresses
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Addresses deletable by admins" ON inventory_addresses
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- Policies para INVENTORY_ITEMS
CREATE POLICY "Items viewable by company users" ON inventory_items
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      store_id IN (
        SELECT store_id FROM inventories WHERE id = inventory_id
      )
    )
  );

CREATE POLICY "Items insertable by authenticated" ON inventory_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Items updatable by authenticated" ON inventory_items
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Items deletable by admins" ON inventory_items
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_inventories_updated_at BEFORE UPDATE ON inventories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_addresses_updated_at BEFORE UPDATE ON inventory_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- COMENTÁRIOS
-- ==========================================
COMMENT ON TABLE inventories IS 'Inventários realizados nas lojas';
COMMENT ON TABLE inventory_addresses IS 'Endereços/localizações dentro de cada inventário';
COMMENT ON TABLE inventory_items IS 'Itens contados em cada endereço do inventário';
