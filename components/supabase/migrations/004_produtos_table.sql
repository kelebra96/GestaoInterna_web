-- ==========================================
-- Migration 004: Tabela Produtos (português - sistema legado)
-- ==========================================

-- Tabela produtos (português) - Diferente da tabela products (inglês)
-- Esta tabela é usada pelo sistema legado através do databaseService
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  ean VARCHAR(50),
  sku VARCHAR(50),
  descricao TEXT,
  comprador VARCHAR(255),
  fornecedor VARCHAR(255),
  preco DECIMAL(10, 2),
  unidade VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_ean ON produtos(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

COMMENT ON TABLE produtos IS 'Produtos do sistema legado (português) - diferente da tabela products';

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
