-- =============================================
-- Dead Letter Queue (DLQ) - Sprint 2 Resiliência
-- =============================================
-- Tabela para armazenar mensagens/jobs que falharam
-- após múltiplas tentativas, permitindo análise e
-- reprocessamento manual ou automático.
-- =============================================

-- Tabela principal de DLQ
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação da origem
    source_queue TEXT NOT NULL,           -- Ex: 'fcm', 'image_processing', 'email'
    original_id TEXT,                      -- ID original do job/mensagem

    -- Payload da mensagem
    payload JSONB NOT NULL,

    -- Informações de erro
    error_message TEXT,
    error_stack TEXT,
    error_code TEXT,

    -- Controle de tentativas
    attempts INT DEFAULT 1,
    max_attempts INT DEFAULT 3,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),

    -- Resolução
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,                      -- User ID que resolveu
    resolution_type TEXT,                  -- 'reprocessed', 'ignored', 'fixed'
    resolution_notes TEXT,

    -- Metadata adicional
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved
    ON dead_letter_queue(source_queue, created_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dlq_source_queue
    ON dead_letter_queue(source_queue);

CREATE INDEX IF NOT EXISTS idx_dlq_created_at
    ON dead_letter_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlq_resolved
    ON dead_letter_queue(resolved_at)
    WHERE resolved_at IS NOT NULL;

-- Função para adicionar item na DLQ
CREATE OR REPLACE FUNCTION add_to_dlq(
    p_source_queue TEXT,
    p_payload JSONB,
    p_error_message TEXT DEFAULT NULL,
    p_error_stack TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_original_id TEXT DEFAULT NULL,
    p_attempts INT DEFAULT 1,
    p_max_attempts INT DEFAULT 3,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO dead_letter_queue (
        source_queue,
        original_id,
        payload,
        error_message,
        error_stack,
        error_code,
        attempts,
        max_attempts,
        metadata
    ) VALUES (
        p_source_queue,
        p_original_id,
        p_payload,
        p_error_message,
        p_error_stack,
        p_error_code,
        p_attempts,
        p_max_attempts,
        p_metadata
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Função para resolver item da DLQ
CREATE OR REPLACE FUNCTION resolve_dlq_item(
    p_id UUID,
    p_resolved_by TEXT,
    p_resolution_type TEXT,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE dead_letter_queue
    SET
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_type = p_resolution_type,
        resolution_notes = p_resolution_notes
    WHERE id = p_id
    AND resolved_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View para dashboard de DLQ
CREATE OR REPLACE VIEW dlq_summary AS
SELECT
    source_queue,
    COUNT(*) FILTER (WHERE resolved_at IS NULL) as pending,
    COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as resolved,
    COUNT(*) as total,
    MAX(created_at) FILTER (WHERE resolved_at IS NULL) as latest_pending,
    AVG(attempts) FILTER (WHERE resolved_at IS NULL) as avg_attempts
FROM dead_letter_queue
GROUP BY source_queue;

-- Política RLS (apenas admins podem ver/gerenciar DLQ)
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Política para admins
CREATE POLICY "dlq_admin_policy" ON dead_letter_queue
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Comentários
COMMENT ON TABLE dead_letter_queue IS 'Armazena mensagens/jobs que falharam para análise e reprocessamento';
COMMENT ON COLUMN dead_letter_queue.source_queue IS 'Fila de origem (fcm, image_processing, email, etc)';
COMMENT ON COLUMN dead_letter_queue.payload IS 'Payload original da mensagem em JSON';
COMMENT ON COLUMN dead_letter_queue.resolution_type IS 'Tipo de resolução: reprocessed, ignored, fixed';
