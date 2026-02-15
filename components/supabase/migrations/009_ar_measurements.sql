-- Migration 009: AR Measurements Table
-- Tabela para armazenar medições AR (Augmented Reality) de produtos

CREATE TABLE IF NOT EXISTS ar_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Measurement data
  length NUMERIC(10, 2) NOT NULL,
  width NUMERIC(10, 2) NOT NULL,
  height NUMERIC(10, 2) NOT NULL,
  volume NUMERIC(12, 2) NOT NULL,
  volume_m3 NUMERIC(12, 6) NOT NULL,

  -- Product association (optional)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  product_ean VARCHAR(50),

  -- Store association (optional)
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  store_name VARCHAR(255),

  -- Metadata
  notes TEXT,
  image_url TEXT,
  points_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ar_measurements_user_id ON ar_measurements(user_id);
CREATE INDEX idx_ar_measurements_product_id ON ar_measurements(product_id);
CREATE INDEX idx_ar_measurements_store_id ON ar_measurements(store_id);
CREATE INDEX idx_ar_measurements_created_at ON ar_measurements(created_at DESC);

-- Composite index for user + timestamp queries
CREATE INDEX idx_ar_measurements_user_created ON ar_measurements(user_id, created_at DESC);

-- Composite index for product + timestamp queries
CREATE INDEX idx_ar_measurements_product_created ON ar_measurements(product_id, created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ar_measurements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ar_measurements_updated_at
  BEFORE UPDATE ON ar_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_ar_measurements_updated_at();

-- Comments
COMMENT ON TABLE ar_measurements IS 'AR (Augmented Reality) product measurements';
COMMENT ON COLUMN ar_measurements.length IS 'Length in centimeters';
COMMENT ON COLUMN ar_measurements.width IS 'Width in centimeters';
COMMENT ON COLUMN ar_measurements.height IS 'Height in centimeters';
COMMENT ON COLUMN ar_measurements.volume IS 'Volume in cubic centimeters';
COMMENT ON COLUMN ar_measurements.volume_m3 IS 'Volume in cubic meters';
COMMENT ON COLUMN ar_measurements.points_count IS 'Number of AR points used for measurement';
