-- ==========================================
-- Migration 005: Estender campos da tabela products
-- ==========================================

-- Adicionar campos faltantes usados pelo import-csv
ALTER TABLE products ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width DECIMAL(10, 2); -- cm
ALTER TABLE products ADD COLUMN IF NOT EXISTS height DECIMAL(10, 2); -- cm
ALTER TABLE products ADD COLUMN IF NOT EXISTS depth DECIMAL(10, 2); -- cm
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin DECIMAL(5, 2); -- %

-- Tornar EAN opcional (nem todos produtos têm EAN)
ALTER TABLE products ALTER COLUMN ean DROP NOT NULL;

-- Criar índice para org_id
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(org_id, sku);

-- Comentários
COMMENT ON COLUMN products.org_id IS 'Organização dona do produto (NULL = produto global)';
COMMENT ON COLUMN products.width IS 'Largura do produto em centímetros';
COMMENT ON COLUMN products.height IS 'Altura do produto em centímetros';
COMMENT ON COLUMN products.depth IS 'Profundidade do produto em centímetros';
COMMENT ON COLUMN products.margin IS 'Margem de lucro em percentual (0-100)';
