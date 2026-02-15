-- Migration 011: Promotions and Seasonality
-- Sistema de promoções, eventos e sazonalidade para planogramas

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic information
  name VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('promocao', 'evento', 'sazonalidade')),

  -- Date range
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Associated stores (multiple stores can have same promotion)
  store_ids TEXT[] NOT NULL,

  -- Optional planogram base association
  planogram_base_id UUID REFERENCES planogram_base(id) ON DELETE SET NULL,

  -- Promoted products with details (JSONB array)
  -- Each item: { productId, productName?, discountPercent?, highlightColor? }
  promoted_products JSONB,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Organization
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Creator tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validation
  CONSTRAINT check_dates CHECK (end_date > start_date)
);

-- Indexes
CREATE INDEX idx_promotions_company_id ON promotions(company_id);
CREATE INDEX idx_promotions_planogram_base_id ON promotions(planogram_base_id);
CREATE INDEX idx_promotions_created_by ON promotions(created_by);
CREATE INDEX idx_promotions_type ON promotions(type);
CREATE INDEX idx_promotions_active ON promotions(active);
CREATE INDEX idx_promotions_start_date ON promotions(start_date DESC);
CREATE INDEX idx_promotions_end_date ON promotions(end_date);

-- GIN index for store_ids array queries
CREATE INDEX idx_promotions_store_ids ON promotions USING GIN (store_ids);

-- GIN index for JSONB promoted_products
CREATE INDEX idx_promotions_promoted_products ON promotions USING GIN (promoted_products);

-- Composite index for common queries
CREATE INDEX idx_promotions_company_active ON promotions(company_id, active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

-- Comments
COMMENT ON TABLE promotions IS 'Promotions, events and seasonal campaigns for planograms';
COMMENT ON COLUMN promotions.type IS 'Type: promocao (promotion), evento (event), sazonalidade (seasonal)';
COMMENT ON COLUMN promotions.store_ids IS 'Array of store IDs where this promotion applies';
COMMENT ON COLUMN promotions.promoted_products IS 'JSONB array of promoted products with discount and highlight info';
COMMENT ON COLUMN promotions.planogram_base_id IS 'Optional associated planogram template';
