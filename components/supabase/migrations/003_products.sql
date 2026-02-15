-- ==========================================
-- MyInventory - Schema de Produtos
-- ==========================================

-- ==========================================
-- PRODUCTS (Produtos)
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ean VARCHAR(50),
  sku VARCHAR(100),
  name VARCHAR(500),
  description TEXT,
  price DECIMAL(10, 2),
  cost DECIMAL(10, 2),
  category VARCHAR(255),
  brand VARCHAR(255),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  auto_created_by_inventory UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ==========================================
-- COLUNAS EXTRAS PARA INVENTORIES
-- ==========================================
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS import_status VARCHAR(50);
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS import_total INTEGER DEFAULT 0;
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS import_processed INTEGER DEFAULT 0;
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS import_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS import_message TEXT;
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS imported_file_name VARCHAR(255);
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ==========================================
-- COLUNAS EXTRAS PARA INVENTORY_ITEMS
-- ==========================================
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS count_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS diff_quantity INTEGER DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS diff_value DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Índice para product_id
CREATE INDEX IF NOT EXISTS idx_inv_items_product_id ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_count_status ON inventory_items(count_status);
CREATE INDEX IF NOT EXISTS idx_inv_items_company_id ON inventory_items(company_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) para PRODUCTS
-- ==========================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products viewable by company users" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Products insertable by authenticated" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Products updatable by company users" ON products
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

CREATE POLICY "Products deletable by admins" ON products
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- ==========================================
-- TRIGGER para updated_at
-- ==========================================
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- COMENTÁRIOS
-- ==========================================
COMMENT ON TABLE products IS 'Cadastro de produtos da empresa';
