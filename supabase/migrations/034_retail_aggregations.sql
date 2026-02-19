-- =============================================
-- Migration 034: Agregações e Métricas Consolidadas
-- Created: 2026-02-18
-- Description: Tabelas de métricas agregadas por loja e rede
-- =============================================

-- ==========================================
-- AGREGAÇÃO: agg_metricas_loja
-- ==========================================
-- Métricas consolidadas por loja e período

CREATE TABLE IF NOT EXISTS agg_metricas_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20) NOT NULL, -- 'diario', 'semanal', 'mensal'

  -- ==========================================
  -- ESTOQUE
  -- ==========================================
  valor_estoque_total DECIMAL(18,2) DEFAULT 0,
  custo_estoque_total DECIMAL(18,2) DEFAULT 0,
  quantidade_skus INT DEFAULT 0,

  -- Giro e Cobertura
  giro_estoque DECIMAL(10,4) DEFAULT 0, -- CMV / Estoque Médio
  cobertura_dias DECIMAL(10,2) DEFAULT 0, -- Estoque / Média Venda Dia

  -- Capital
  capital_investido DECIMAL(18,2) DEFAULT 0,
  capital_parado DECIMAL(18,2) DEFAULT 0, -- Estoque > 60 dias

  -- Riscos de estoque
  estoque_acima_60_dias_pct DECIMAL(8,4) DEFAULT 0,
  estoque_acima_60_dias_valor DECIMAL(18,2) DEFAULT 0,
  estoque_morto_valor DECIMAL(18,2) DEFAULT 0, -- Sem venda > 90 dias
  estoque_morto_qtd INT DEFAULT 0,

  -- Ruptura (por estoque)
  qtd_skus_ruptura INT DEFAULT 0,
  indice_ruptura_pct DECIMAL(8,4) DEFAULT 0,

  -- ==========================================
  -- PERDAS
  -- ==========================================
  perda_valor_total DECIMAL(18,2) DEFAULT 0,
  perda_custo_total DECIMAL(18,2) DEFAULT 0,
  perda_quantidade_total DECIMAL(15,3) DEFAULT 0,

  -- Percentuais estratégicos
  perda_sobre_faturamento_pct DECIMAL(8,4) DEFAULT 0,
  perda_sobre_estoque_pct DECIMAL(8,4) DEFAULT 0,

  -- Por tipo (%)
  perda_vencimento_pct DECIMAL(8,4) DEFAULT 0,
  perda_vencimento_valor DECIMAL(18,2) DEFAULT 0,
  perda_avaria_pct DECIMAL(8,4) DEFAULT 0,
  perda_avaria_valor DECIMAL(18,2) DEFAULT 0,
  perda_quebra_pct DECIMAL(8,4) DEFAULT 0,
  perda_quebra_valor DECIMAL(18,2) DEFAULT 0,
  perda_roubo_pct DECIMAL(8,4) DEFAULT 0,
  perda_roubo_valor DECIMAL(18,2) DEFAULT 0,
  perda_outros_pct DECIMAL(8,4) DEFAULT 0,
  perda_outros_valor DECIMAL(18,2) DEFAULT 0,

  -- Margem perdida
  margem_perdida_total DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- RUPTURAS (Vendas Perdidas)
  -- ==========================================
  vendas_perdidas_valor DECIMAL(18,2) DEFAULT 0,
  vendas_perdidas_quantidade DECIMAL(15,3) DEFAULT 0,
  venda_potencial DECIMAL(18,2) DEFAULT 0,
  taxa_disponibilidade DECIMAL(8,4) DEFAULT 0, -- 1 - taxa_ruptura

  -- Recorrência
  ruptura_recorrente_qtd INT DEFAULT 0, -- Produtos com ruptura > 3x/semana
  ruptura_produtos_criticos INT DEFAULT 0,

  -- Impacto financeiro
  impacto_margem_ruptura DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- VENDAS
  -- ==========================================
  faturamento_total DECIMAL(18,2) DEFAULT 0,
  faturamento_liquido DECIMAL(18,2) DEFAULT 0,
  quantidade_vendida DECIMAL(15,3) DEFAULT 0,

  -- Margens
  margem_bruta_valor DECIMAL(18,2) DEFAULT 0,
  margem_bruta_pct DECIMAL(8,4) DEFAULT 0,
  margem_liquida_pct DECIMAL(8,4) DEFAULT 0,

  -- Ticket
  ticket_medio DECIMAL(15,2) DEFAULT 0,
  itens_por_venda DECIMAL(10,2) DEFAULT 0,

  -- ==========================================
  -- PROMOÇÕES
  -- ==========================================
  valor_promocoes DECIMAL(18,2) DEFAULT 0,
  quantidade_promocoes DECIMAL(15,3) DEFAULT 0,
  participacao_promocao_pct DECIMAL(8,4) DEFAULT 0,

  -- ROI
  roi_promocoes DECIMAL(10,4) DEFAULT 0,
  margem_pre_promocao DECIMAL(8,4) DEFAULT 0,
  margem_pos_promocao DECIMAL(8,4) DEFAULT 0,
  diferenca_margem_promocao DECIMAL(8,4) DEFAULT 0,

  -- ==========================================
  -- RFE - RISK FINANCIAL EXPOSURE
  -- ==========================================
  rfe_score DECIMAL(18,2) DEFAULT 0,
  rfe_componente_perdas DECIMAL(18,2) DEFAULT 0,
  rfe_componente_vendas_perdidas DECIMAL(18,2) DEFAULT 0,
  rfe_componente_capital_parado DECIMAL(18,2) DEFAULT 0,
  rfe_rank INT, -- Ranking entre lojas da rede
  rfe_nivel VARCHAR(20), -- 'critico', 'alto', 'medio', 'baixo'

  -- ==========================================
  -- COMPARATIVOS
  -- ==========================================
  var_faturamento_periodo_anterior DECIMAL(8,4) DEFAULT 0,
  var_perda_periodo_anterior DECIMAL(8,4) DEFAULT 0,
  var_disponibilidade_periodo_anterior DECIMAL(8,4) DEFAULT 0,
  var_rfe_periodo_anterior DECIMAL(8,4) DEFAULT 0,

  -- ==========================================
  -- METADATA
  -- ==========================================
  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  dados_origem JSONB DEFAULT '{}', -- Referências aos registros fonte

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agg_metricas_loja UNIQUE(organization_id, loja_id, periodo, tipo_periodo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agg_loja_org ON agg_metricas_loja(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_loja_loja ON agg_metricas_loja(loja_id);
CREATE INDEX IF NOT EXISTS idx_agg_loja_periodo ON agg_metricas_loja(periodo);
CREATE INDEX IF NOT EXISTS idx_agg_loja_tipo ON agg_metricas_loja(tipo_periodo);
CREATE INDEX IF NOT EXISTS idx_agg_loja_lookup ON agg_metricas_loja(organization_id, periodo, tipo_periodo);
CREATE INDEX IF NOT EXISTS idx_agg_loja_rfe ON agg_metricas_loja(organization_id, rfe_score DESC);

COMMENT ON TABLE agg_metricas_loja IS 'Métricas consolidadas por loja - base para dashboards executivos';

-- ==========================================
-- AGREGAÇÃO: agg_metricas_rede
-- ==========================================
-- Métricas consolidadas da rede (todas as lojas)

CREATE TABLE IF NOT EXISTS agg_metricas_rede (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20) NOT NULL,

  -- Totais da rede
  qtd_lojas_ativas INT DEFAULT 0,

  -- ==========================================
  -- ESTOQUE (Consolidado)
  -- ==========================================
  valor_estoque_total DECIMAL(18,2) DEFAULT 0,
  custo_estoque_total DECIMAL(18,2) DEFAULT 0,
  giro_estoque_medio DECIMAL(10,4) DEFAULT 0,
  cobertura_dias_media DECIMAL(10,2) DEFAULT 0,
  capital_parado_total DECIMAL(18,2) DEFAULT 0,
  estoque_morto_total DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- PERDAS (Consolidado)
  -- ==========================================
  perda_valor_total DECIMAL(18,2) DEFAULT 0,
  perda_sobre_faturamento_pct DECIMAL(8,4) DEFAULT 0,
  perda_sobre_estoque_pct DECIMAL(8,4) DEFAULT 0,

  -- Por tipo
  perda_vencimento_total DECIMAL(18,2) DEFAULT 0,
  perda_avaria_total DECIMAL(18,2) DEFAULT 0,
  perda_quebra_total DECIMAL(18,2) DEFAULT 0,
  perda_roubo_total DECIMAL(18,2) DEFAULT 0,
  perda_outros_total DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- RUPTURAS (Consolidado)
  -- ==========================================
  vendas_perdidas_total DECIMAL(18,2) DEFAULT 0,
  taxa_disponibilidade_media DECIMAL(8,4) DEFAULT 0,
  impacto_margem_ruptura_total DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- VENDAS (Consolidado)
  -- ==========================================
  faturamento_total DECIMAL(18,2) DEFAULT 0,
  margem_bruta_media DECIMAL(8,4) DEFAULT 0,
  ticket_medio DECIMAL(15,2) DEFAULT 0,

  -- ==========================================
  -- PROMOÇÕES (Consolidado)
  -- ==========================================
  valor_promocoes_total DECIMAL(18,2) DEFAULT 0,
  roi_promocoes_medio DECIMAL(10,4) DEFAULT 0,

  -- ==========================================
  -- RFE (Consolidado)
  -- ==========================================
  rfe_total DECIMAL(18,2) DEFAULT 0,
  rfe_medio_por_loja DECIMAL(18,2) DEFAULT 0,
  lojas_risco_critico INT DEFAULT 0,
  lojas_risco_alto INT DEFAULT 0,
  lojas_risco_medio INT DEFAULT 0,
  lojas_risco_baixo INT DEFAULT 0,

  -- ==========================================
  -- DISTRIBUIÇÃO
  -- ==========================================
  percentil_perda_p50 DECIMAL(18,2) DEFAULT 0,
  percentil_perda_p75 DECIMAL(18,2) DEFAULT 0,
  percentil_perda_p90 DECIMAL(18,2) DEFAULT 0,
  percentil_rfe_p50 DECIMAL(18,2) DEFAULT 0,
  percentil_rfe_p75 DECIMAL(18,2) DEFAULT 0,
  percentil_rfe_p90 DECIMAL(18,2) DEFAULT 0,

  -- ==========================================
  -- COMPARATIVOS
  -- ==========================================
  var_faturamento_periodo_anterior DECIMAL(8,4) DEFAULT 0,
  var_perda_periodo_anterior DECIMAL(8,4) DEFAULT 0,
  var_rfe_periodo_anterior DECIMAL(8,4) DEFAULT 0,

  -- ==========================================
  -- METADATA
  -- ==========================================
  calculado_em TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agg_metricas_rede UNIQUE(organization_id, periodo, tipo_periodo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agg_rede_org ON agg_metricas_rede(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_rede_periodo ON agg_metricas_rede(periodo);
CREATE INDEX IF NOT EXISTS idx_agg_rede_lookup ON agg_metricas_rede(organization_id, periodo, tipo_periodo);

COMMENT ON TABLE agg_metricas_rede IS 'Métricas consolidadas da rede - visão executiva geral';

-- ==========================================
-- AGREGAÇÃO: agg_metricas_produto
-- ==========================================
-- Métricas consolidadas por produto (cross-loja)

CREATE TABLE IF NOT EXISTS agg_metricas_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  produto_id UUID REFERENCES dim_produto(id),
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20) NOT NULL,

  -- Presença
  qtd_lojas_com_estoque INT DEFAULT 0,
  qtd_lojas_com_venda INT DEFAULT 0,
  qtd_lojas_com_perda INT DEFAULT 0,
  qtd_lojas_com_ruptura INT DEFAULT 0,

  -- Estoque
  estoque_total_rede DECIMAL(18,2) DEFAULT 0,
  estoque_medio_loja DECIMAL(15,2) DEFAULT 0,
  giro_medio DECIMAL(10,4) DEFAULT 0,
  cobertura_media_dias DECIMAL(10,2) DEFAULT 0,

  -- Vendas
  venda_total_rede DECIMAL(18,2) DEFAULT 0,
  venda_quantidade_total DECIMAL(15,3) DEFAULT 0,
  margem_media DECIMAL(8,4) DEFAULT 0,

  -- Perdas
  perda_total_rede DECIMAL(18,2) DEFAULT 0,
  perda_quantidade_total DECIMAL(15,3) DEFAULT 0,
  taxa_perda DECIMAL(8,4) DEFAULT 0, -- perda/venda

  -- Rupturas
  ruptura_valor_total DECIMAL(18,2) DEFAULT 0,
  frequencia_ruptura INT DEFAULT 0,

  -- Score de risco do produto
  risk_score INT DEFAULT 0, -- 0-100
  risk_level VARCHAR(20), -- 'critico', 'alto', 'medio', 'baixo'

  -- Classificação
  curva_abc CHAR(1),
  ranking_perda INT,
  ranking_ruptura INT,

  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agg_metricas_produto UNIQUE(organization_id, produto_id, periodo, tipo_periodo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agg_produto_org ON agg_metricas_produto(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_produto_produto ON agg_metricas_produto(produto_id);
CREATE INDEX IF NOT EXISTS idx_agg_produto_periodo ON agg_metricas_produto(periodo);
CREATE INDEX IF NOT EXISTS idx_agg_produto_risk ON agg_metricas_produto(organization_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_agg_produto_perda ON agg_metricas_produto(perda_total_rede DESC);

COMMENT ON TABLE agg_metricas_produto IS 'Métricas consolidadas por produto - análise cross-loja';

-- ==========================================
-- AGREGAÇÃO: agg_metricas_fornecedor
-- ==========================================
-- Métricas consolidadas por fornecedor

CREATE TABLE IF NOT EXISTS agg_metricas_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  fornecedor VARCHAR(200) NOT NULL,
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20) NOT NULL,

  -- Produtos
  qtd_produtos INT DEFAULT 0,
  qtd_produtos_com_perda INT DEFAULT 0,
  qtd_produtos_com_ruptura INT DEFAULT 0,

  -- Estoque
  valor_estoque_total DECIMAL(18,2) DEFAULT 0,
  cobertura_media_dias DECIMAL(10,2) DEFAULT 0,

  -- Vendas
  faturamento_total DECIMAL(18,2) DEFAULT 0,
  participacao_faturamento_pct DECIMAL(8,4) DEFAULT 0,
  margem_media DECIMAL(8,4) DEFAULT 0,

  -- Perdas
  perda_total DECIMAL(18,2) DEFAULT 0,
  taxa_perda DECIMAL(8,4) DEFAULT 0,
  perda_vencimento DECIMAL(18,2) DEFAULT 0,
  perda_avaria DECIMAL(18,2) DEFAULT 0,

  -- Rupturas
  ruptura_total DECIMAL(18,2) DEFAULT 0,
  taxa_ruptura DECIMAL(8,4) DEFAULT 0,

  -- Score
  risk_score INT DEFAULT 0,
  risk_level VARCHAR(20),
  ranking INT,

  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agg_metricas_fornecedor UNIQUE(organization_id, fornecedor, periodo, tipo_periodo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agg_fornecedor_org ON agg_metricas_fornecedor(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_fornecedor_periodo ON agg_metricas_fornecedor(periodo);
CREATE INDEX IF NOT EXISTS idx_agg_fornecedor_perda ON agg_metricas_fornecedor(perda_total DESC);

COMMENT ON TABLE agg_metricas_fornecedor IS 'Métricas consolidadas por fornecedor - análise de performance';

-- ==========================================
-- AGREGAÇÃO: agg_metricas_categoria
-- ==========================================
-- Métricas consolidadas por categoria

CREATE TABLE IF NOT EXISTS agg_metricas_categoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  loja_id UUID REFERENCES dim_loja(id), -- NULL = consolidado rede
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20) NOT NULL,

  -- Produtos
  qtd_skus INT DEFAULT 0,
  qtd_skus_ativos INT DEFAULT 0,

  -- Estoque
  valor_estoque DECIMAL(18,2) DEFAULT 0,
  giro_categoria DECIMAL(10,4) DEFAULT 0,
  cobertura_dias DECIMAL(10,2) DEFAULT 0,

  -- Vendas
  faturamento DECIMAL(18,2) DEFAULT 0,
  participacao_faturamento_pct DECIMAL(8,4) DEFAULT 0,
  margem_media DECIMAL(8,4) DEFAULT 0,

  -- Perdas
  perda_valor DECIMAL(18,2) DEFAULT 0,
  perda_sobre_faturamento_pct DECIMAL(8,4) DEFAULT 0,
  perda_sobre_estoque_pct DECIMAL(8,4) DEFAULT 0,

  -- Rupturas
  ruptura_valor DECIMAL(18,2) DEFAULT 0,
  taxa_disponibilidade DECIMAL(8,4) DEFAULT 0,

  -- Classificação
  curva_abc CHAR(1),
  ranking INT,

  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agg_metricas_categoria UNIQUE(organization_id, categoria, loja_id, periodo, tipo_periodo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agg_categoria_org ON agg_metricas_categoria(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_categoria_periodo ON agg_metricas_categoria(periodo);
CREATE INDEX IF NOT EXISTS idx_agg_categoria_loja ON agg_metricas_categoria(loja_id);

COMMENT ON TABLE agg_metricas_categoria IS 'Métricas consolidadas por categoria de produto';

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_agg_loja_updated_at
  BEFORE UPDATE ON agg_metricas_loja
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agg_rede_updated_at
  BEFORE UPDATE ON agg_metricas_rede
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agg_produto_updated_at
  BEFORE UPDATE ON agg_metricas_produto
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agg_fornecedor_updated_at
  BEFORE UPDATE ON agg_metricas_fornecedor
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agg_categoria_updated_at
  BEFORE UPDATE ON agg_metricas_categoria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE agg_metricas_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_metricas_rede ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_metricas_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_metricas_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_metricas_categoria ENABLE ROW LEVEL SECURITY;

-- Policies para todas as tabelas de agregação
CREATE POLICY "agg_loja_select_org" ON agg_metricas_loja
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "agg_loja_service" ON agg_metricas_loja
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "agg_rede_select_org" ON agg_metricas_rede
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "agg_rede_service" ON agg_metricas_rede
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "agg_produto_select_org" ON agg_metricas_produto
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "agg_produto_service" ON agg_metricas_produto
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "agg_fornecedor_select_org" ON agg_metricas_fornecedor
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "agg_fornecedor_service" ON agg_metricas_fornecedor
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "agg_categoria_select_org" ON agg_metricas_categoria
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "agg_categoria_service" ON agg_metricas_categoria
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT ON agg_metricas_loja TO authenticated;
GRANT SELECT ON agg_metricas_rede TO authenticated;
GRANT SELECT ON agg_metricas_produto TO authenticated;
GRANT SELECT ON agg_metricas_fornecedor TO authenticated;
GRANT SELECT ON agg_metricas_categoria TO authenticated;

GRANT ALL ON agg_metricas_loja TO service_role;
GRANT ALL ON agg_metricas_rede TO service_role;
GRANT ALL ON agg_metricas_produto TO service_role;
GRANT ALL ON agg_metricas_fornecedor TO service_role;
GRANT ALL ON agg_metricas_categoria TO service_role;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON COLUMN agg_metricas_loja.rfe_score IS 'Risk Financial Exposure = Perdas + Vendas Perdidas + (Capital Parado × Custo Capital)';
COMMENT ON COLUMN agg_metricas_loja.taxa_disponibilidade IS '1 - taxa_ruptura. Meta típica: > 95%';
COMMENT ON COLUMN agg_metricas_loja.perda_sobre_faturamento_pct IS 'Meta típica varejo: < 2%';
COMMENT ON COLUMN agg_metricas_rede.percentil_perda_p90 IS '90% das lojas têm perda abaixo deste valor';
