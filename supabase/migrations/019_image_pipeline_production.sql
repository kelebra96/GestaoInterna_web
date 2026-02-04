-- ==========================================
-- Migration 019: Image Pipeline Production-Ready
-- Schema canônico: products
-- ==========================================

-- 1. ENUMS (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_status') THEN
    CREATE TYPE image_status AS ENUM ('ok', 'missing', 'fetching', 'needs_review', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_source') THEN
    CREATE TYPE image_source AS ENUM ('openfoodfacts', 'search_api', 'browser', 'manual');
  END IF;
END$$;

-- 2. COLUNAS em products (idempotente)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_status image_status DEFAULT 'missing';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_source image_source;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_confidence NUMERIC(4,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_candidate_urls JSONB DEFAULT '[]'::jsonb;

-- Metadados de imagem (tamanho, dimensões)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_bytes INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_mime VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_thumb_url TEXT;

-- Auditoria OpenAI
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_ai_model VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_ai_prompt_version VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_ai_reason TEXT;

-- 3. ÍNDICES em products
CREATE INDEX IF NOT EXISTS idx_products_image_status ON products(image_status);
CREATE INDEX IF NOT EXISTS idx_products_image_needs_review
  ON products(image_status) WHERE image_status = 'needs_review';

-- 4. TABELA image_jobs (idempotente)
CREATE TABLE IF NOT EXISTS image_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_status CHECK (status IN ('queued', 'running', 'done', 'failed', 'needs_review'))
);

-- Índices para image_jobs
CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_jobs(status);
CREATE INDEX IF NOT EXISTS idx_image_jobs_product_id ON image_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_image_jobs_queued ON image_jobs(created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_image_jobs_locked ON image_jobs(locked_at) WHERE locked_at IS NOT NULL;

-- UNIQUE para evitar jobs duplicados ativos por produto
DROP INDEX IF EXISTS uq_image_jobs_active;
DROP INDEX IF EXISTS uq_image_jobs_product_active;
CREATE UNIQUE INDEX uq_image_jobs_product_active
  ON image_jobs(product_id)
  WHERE status IN ('queued', 'running');

-- 5. TABELA image_validations_cache (cache de validações por URL)
CREATE TABLE IF NOT EXISTS image_validations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash VARCHAR(64) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  is_match BOOLEAN NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  reason TEXT,
  model VARCHAR(50),
  prompt_version VARCHAR(20),
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice único para cache
DROP INDEX IF EXISTS idx_validations_cache_url;
CREATE INDEX idx_validations_cache_url ON image_validations_cache(url_hash);

-- Constraint única (pode falhar se já existe, ignorar)
DO $$
BEGIN
  ALTER TABLE image_validations_cache ADD CONSTRAINT uq_validation_url UNIQUE(url_hash, product_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END$$;

-- 6. STORAGE BUCKET (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 7. STORAGE POLICIES (idempotente)
-- Remover policies existentes para recriar
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
DROP POLICY IF EXISTS product_images_service_write ON storage.objects;
DROP POLICY IF EXISTS product_images_service_update ON storage.objects;
DROP POLICY IF EXISTS product_images_service_delete ON storage.objects;

-- Policy: qualquer um pode ler (bucket público)
CREATE POLICY product_images_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

-- Policy: authenticated pode inserir
CREATE POLICY product_images_service_write ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

-- Policy: authenticated pode atualizar
CREATE POLICY product_images_service_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'product-images');

-- Policy: apenas service pode deletar
CREATE POLICY product_images_service_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'product-images');

-- 8. RLS para image_jobs
ALTER TABLE image_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS image_jobs_service_all ON image_jobs;
CREATE POLICY image_jobs_service_all ON image_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 9. Função para obter jobs com lock atômico
CREATE OR REPLACE FUNCTION claim_image_jobs(
  p_worker_id VARCHAR(100),
  p_limit INTEGER DEFAULT 5,
  p_lock_timeout_minutes INTEGER DEFAULT 30
)
RETURNS SETOF image_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  -- Liberar jobs travados há muito tempo
  UPDATE image_jobs
  SET
    status = 'queued',
    locked_at = NULL,
    locked_by = NULL,
    updated_at = NOW()
  WHERE
    status = 'running'
    AND locked_at < NOW() - (p_lock_timeout_minutes || ' minutes')::INTERVAL;

  -- Claim jobs disponíveis
  RETURN QUERY
  UPDATE image_jobs
  SET
    status = 'running',
    locked_at = NOW(),
    locked_by = p_worker_id,
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id IN (
    SELECT id FROM image_jobs
    WHERE status = 'queued'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 10. Função para completar job
CREATE OR REPLACE FUNCTION complete_image_job(
  p_job_id UUID,
  p_status VARCHAR(20),
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE image_jobs
  SET
    status = p_status,
    last_error = p_error,
    completed_at = CASE WHEN p_status IN ('done', 'failed', 'needs_review') THEN NOW() ELSE NULL END,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;
