-- ==========================================
-- Migration 018: Pipeline de imagens de produtos
-- ==========================================

-- Enums de status/source
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_status') THEN
    CREATE TYPE image_status AS ENUM ('ok', 'missing', 'fetching', 'needs_review', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_source') THEN
    CREATE TYPE image_source AS ENUM ('openfoodfacts', 'search_api', 'browser', 'manual');
  END IF;
END$$;

-- Produtos (português) - tabela principal do catálogo legado
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_status image_status;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_source image_source;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_confidence NUMERIC;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS image_candidate_urls JSONB;

CREATE INDEX IF NOT EXISTS idx_produtos_image_status ON produtos(image_status);

-- Products (inglês) - tabela alternativa usada por outros módulos
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_status image_status;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_source image_source;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_confidence NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_candidate_urls JSONB;

CREATE INDEX IF NOT EXISTS idx_products_image_status ON products(image_status);

-- Fila de jobs
CREATE TABLE IF NOT EXISTS image_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_jobs(status);
CREATE INDEX IF NOT EXISTS idx_image_jobs_product_id ON image_jobs(product_id);

-- Evitar jobs duplicados ativos (queued/running)
CREATE UNIQUE INDEX IF NOT EXISTS uq_image_jobs_active
  ON image_jobs(product_id)
  WHERE status IN ('queued', 'running');

-- Bucket do Supabase Storage (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
