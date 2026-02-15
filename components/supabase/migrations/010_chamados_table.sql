-- Migration 010: Chamados (Support Tickets / AI Code Proposals)
-- Sistema de chamados com proposals de código geradas por IA

CREATE TABLE IF NOT EXISTS chamados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic information
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,

  -- Creator
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'completed')),

  -- Approval
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- AI proposal (code patches, suggestions, etc.)
  proposal JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chamados_created_by ON chamados(created_by);
CREATE INDEX idx_chamados_approved_by ON chamados(approved_by);
CREATE INDEX idx_chamados_status ON chamados(status);
CREATE INDEX idx_chamados_created_at ON chamados(created_at DESC);

-- GIN index for JSONB proposal queries
CREATE INDEX idx_chamados_proposal ON chamados USING GIN (proposal);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_chamados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chamados_updated_at
  BEFORE UPDATE ON chamados
  FOR EACH ROW
  EXECUTE FUNCTION update_chamados_updated_at();

-- Comments
COMMENT ON TABLE chamados IS 'Support tickets with AI-generated code proposals';
COMMENT ON COLUMN chamados.proposal IS 'JSONB containing AI-generated code patches, suggestions, and structured data';
COMMENT ON COLUMN chamados.status IS 'Ticket status: open (new), approved (ready for PR), rejected, completed';
COMMENT ON COLUMN chamados.approved_by IS 'Developer who approved the proposal (requires role=developer)';
