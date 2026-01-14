-- ==========================================
-- Migration 008: Volumetria & Rupture Tables
-- ==========================================

-- Tabela produtos_volumetria (dados volumétricos de produtos)
CREATE TABLE IF NOT EXISTS produtos_volumetria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ean VARCHAR(100),
  descricao VARCHAR(500) NOT NULL,
  categoria VARCHAR(100),
  marca VARCHAR(255),
  largura_cm DECIMAL(10, 2) NOT NULL,
  altura_cm DECIMAL(10, 2) NOT NULL,
  profundidade_cm DECIMAL(10, 2) NOT NULL,
  pode_empilhar BOOLEAN DEFAULT false,
  max_camadas_vertical INTEGER DEFAULT 1,
  preco_venda DECIMAL(10, 2),
  margem_percentual DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela prateleiras (estrutura física de gôndolas)
CREATE TABLE IF NOT EXISTS prateleiras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_gondola VARCHAR(255),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  largura_util_cm DECIMAL(10, 2) NOT NULL,
  profundidade_util_cm DECIMAL(10, 2) NOT NULL,
  altura_livre_cm DECIMAL(10, 2) NOT NULL,
  nivel VARCHAR(50) CHECK (nivel IN ('olhos', 'maos', 'pes')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela slots_planograma (posições de produtos nas prateleiras)
CREATE TABLE IF NOT EXISTS slots_planograma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  prateleira_id UUID NOT NULL REFERENCES prateleiras(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos_volumetria(id) ON DELETE CASCADE,
  posicao_x_cm DECIMAL(10, 2) DEFAULT 0,
  largura_slot_cm DECIMAL(10, 2) NOT NULL,
  facings_definidos INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela leituras_estoque_gondola (leituras de estoque de gôndola)
CREATE TABLE IF NOT EXISTS leituras_estoque_gondola (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots_planograma(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos_volumetria(id) ON DELETE CASCADE,
  quantidade_atual_slot INTEGER NOT NULL DEFAULT 0,
  origem_leitura VARCHAR(50) CHECK (origem_leitura IN ('contagem_manual', 'app_mobile', 'visao_computacional')),
  data_hora_leitura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela eventos_ruptura (eventos de ruptura de estoque)
CREATE TABLE IF NOT EXISTS eventos_ruptura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos_volumetria(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES slots_planograma(id) ON DELETE SET NULL,
  data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fim TIMESTAMP WITH TIME ZONE,
  tipo_ruptura VARCHAR(50) CHECK (tipo_ruptura IN ('total', 'funcional')),
  duracao_ruptura_horas DECIMAL(10, 2),
  unidades_nao_vendidas INTEGER DEFAULT 0,
  receita_perdida DECIMAL(10, 2),
  margem_perdida DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela vendas_hora (histórico de vendas por hora)
CREATE TABLE IF NOT EXISTS vendas_hora (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos_volumetria(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora INTEGER NOT NULL CHECK (hora >= 0 AND hora <= 23),
  vendas_unidades INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para produtos_volumetria
CREATE INDEX IF NOT EXISTS idx_produtos_volumetria_ean ON produtos_volumetria(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_volumetria_categoria ON produtos_volumetria(categoria);

-- Índices para prateleiras
CREATE INDEX IF NOT EXISTS idx_prateleiras_store_id ON prateleiras(store_id);
CREATE INDEX IF NOT EXISTS idx_prateleiras_gondola ON prateleiras(id_gondola);

-- Índices para slots_planograma
CREATE INDEX IF NOT EXISTS idx_slots_planograma_store_id ON slots_planograma(store_id);
CREATE INDEX IF NOT EXISTS idx_slots_planograma_prateleira_id ON slots_planograma(prateleira_id);
CREATE INDEX IF NOT EXISTS idx_slots_planograma_produto_id ON slots_planograma(produto_id);

-- Índices para leituras_estoque_gondola
CREATE INDEX IF NOT EXISTS idx_leituras_estoque_store_id ON leituras_estoque_gondola(store_id);
CREATE INDEX IF NOT EXISTS idx_leituras_estoque_slot_id ON leituras_estoque_gondola(slot_id);
CREATE INDEX IF NOT EXISTS idx_leituras_estoque_produto_id ON leituras_estoque_gondola(produto_id);
CREATE INDEX IF NOT EXISTS idx_leituras_estoque_data_hora ON leituras_estoque_gondola(data_hora_leitura);

-- Índices para eventos_ruptura
CREATE INDEX IF NOT EXISTS idx_eventos_ruptura_store_id ON eventos_ruptura(store_id);
CREATE INDEX IF NOT EXISTS idx_eventos_ruptura_produto_id ON eventos_ruptura(produto_id);
CREATE INDEX IF NOT EXISTS idx_eventos_ruptura_slot_id ON eventos_ruptura(slot_id);
CREATE INDEX IF NOT EXISTS idx_eventos_ruptura_data_inicio ON eventos_ruptura(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_eventos_ruptura_tipo ON eventos_ruptura(tipo_ruptura);

-- Índices para vendas_hora
CREATE INDEX IF NOT EXISTS idx_vendas_hora_store_id ON vendas_hora(store_id);
CREATE INDEX IF NOT EXISTS idx_vendas_hora_produto_id ON vendas_hora(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_hora_data ON vendas_hora(data);
CREATE INDEX IF NOT EXISTS idx_vendas_hora_hora ON vendas_hora(hora);

-- Constraint: Unique vendas por loja+produto+data+hora
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_hora_unique ON vendas_hora(store_id, produto_id, data, hora);

-- Comentários
COMMENT ON TABLE produtos_volumetria IS 'Dados volumétricos de produtos (dimensões, peso, características)';
COMMENT ON TABLE prateleiras IS 'Estrutura física de prateleiras e gôndolas';
COMMENT ON TABLE slots_planograma IS 'Posições de produtos nas prateleiras (planograma volumétrico)';
COMMENT ON TABLE leituras_estoque_gondola IS 'Leituras de quantidade de produtos nas gôndolas';
COMMENT ON TABLE eventos_ruptura IS 'Eventos de ruptura de estoque (total ou funcional)';
COMMENT ON TABLE vendas_hora IS 'Histórico de vendas por hora para análise de ruptura';

COMMENT ON COLUMN produtos_volumetria.pode_empilhar IS 'Indica se o produto pode ser empilhado';
COMMENT ON COLUMN prateleiras.nivel IS 'Nível da prateleira: olhos (eye level), maos (hands), pes (feet)';
COMMENT ON COLUMN slots_planograma.facings_definidos IS 'Número de facings planejados no planograma';
COMMENT ON COLUMN eventos_ruptura.tipo_ruptura IS 'total: sem estoque, funcional: < 10% da capacidade';
COMMENT ON COLUMN vendas_hora.hora IS 'Hora do dia (0-23)';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_produtos_volumetria_updated_at
  BEFORE UPDATE ON produtos_volumetria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prateleiras_updated_at
  BEFORE UPDATE ON prateleiras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slots_planograma_updated_at
  BEFORE UPDATE ON slots_planograma
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eventos_ruptura_updated_at
  BEFORE UPDATE ON eventos_ruptura
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
