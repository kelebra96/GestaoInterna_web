-- ==========================================
-- MyInventory - Schema de Volumetria
-- ==========================================

-- ==========================================
-- PRODUTOS_VOLUMETRIA (Dados dimensionais dos produtos)
-- ==========================================
CREATE TABLE IF NOT EXISTS produtos_volumetria (
  id VARCHAR(100) PRIMARY KEY,
  ean VARCHAR(50),
  descricao VARCHAR(500),
  nome VARCHAR(500),
  largura_cm DECIMAL(10, 2),
  altura_cm DECIMAL(10, 2),
  profundidade_cm DECIMAL(10, 2),
  comprimento_cm DECIMAL(10, 2),
  peso_kg DECIMAL(10, 3),
  peso_bruto_kg DECIMAL(10, 3),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_volumetria_ean ON produtos_volumetria(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_volumetria_company_id ON produtos_volumetria(company_id);

-- RLS
ALTER TABLE produtos_volumetria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Volumetria viewable by all authenticated" ON produtos_volumetria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Volumetria insertable by authenticated" ON produtos_volumetria
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Volumetria updatable by authenticated" ON produtos_volumetria
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger
CREATE TRIGGER update_produtos_volumetria_updated_at BEFORE UPDATE ON produtos_volumetria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE produtos_volumetria IS 'Dados dimensionais e de peso dos produtos para cálculos de espaço';
