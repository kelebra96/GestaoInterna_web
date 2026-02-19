-- =============================================
-- Migration 033: Tabelas Fato para Gestão de Varejo
-- Created: 2026-02-18
-- Description: Tabelas de fatos para estoque, vendas, perdas e rupturas
-- =============================================

-- ==========================================
-- FATO: fato_estoque
-- ==========================================
-- Snapshot diário de estoque por loja/produto (importação do ABC Estoque)

CREATE TABLE IF NOT EXISTS fato_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_estoque DECIMAL(15,3) DEFAULT 0,
  quantidade_reservada DECIMAL(15,3) DEFAULT 0,
  quantidade_disponivel DECIMAL(15,3) DEFAULT 0,
  quantidade_pendente_compra DECIMAL(15,3) DEFAULT 0,

  -- Valores unitários
  custo_unitario DECIMAL(15,4) DEFAULT 0,
  custo_unitario_liquido DECIMAL(15,4) DEFAULT 0,
  preco_venda DECIMAL(15,2) DEFAULT 0,

  -- Valores totais
  custo_total DECIMAL(18,2) DEFAULT 0,
  custo_total_liquido DECIMAL(18,2) DEFAULT 0,
  valor_estoque_venda DECIMAL(18,2) DEFAULT 0,

  -- Métricas de giro
  media_venda_dia DECIMAL(15,3) DEFAULT 0,
  dias_estoque DECIMAL(10,2) DEFAULT 0,
  dias_ultima_entrada INT DEFAULT 0,
  dias_ultima_venda INT DEFAULT 0,

  -- Classificação ABC
  curva_abc CHAR(1), -- A, B, C
  participacao_valor_pct DECIMAL(8,4) DEFAULT 0,
  participacao_acumulada_pct DECIMAL(8,4) DEFAULT 0,

  -- Margem
  margem_valor DECIMAL(18,2) DEFAULT 0,
  margem_percentual DECIMAL(8,4) DEFAULT 0,
  markup DECIMAL(8,4) DEFAULT 0,

  -- Impostos (detalhamento)
  icms_valor DECIMAL(15,2) DEFAULT 0,
  pis_valor DECIMAL(15,2) DEFAULT 0,
  cofins_valor DECIMAL(15,2) DEFAULT 0,

  -- Origem da importação
  import_job_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_fato_estoque UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fato_estoque_org ON fato_estoque(organization_id);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_loja ON fato_estoque(loja_id);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_produto ON fato_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_data ON fato_estoque(data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_lookup ON fato_estoque(organization_id, loja_id, data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_abc ON fato_estoque(organization_id, curva_abc, data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_estoque_dias ON fato_estoque(dias_estoque DESC) WHERE dias_estoque > 60;

COMMENT ON TABLE fato_estoque IS 'Fato de estoque - snapshot diário importado do relatório ABC de Estoque';

-- ==========================================
-- FATO: fato_vendas
-- ==========================================
-- Vendas diárias por loja/produto (importação do ABC Vendas)

CREATE TABLE IF NOT EXISTS fato_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_vendida DECIMAL(15,3) DEFAULT 0,
  peso_vendido DECIMAL(15,3) DEFAULT 0,

  -- Valores
  valor_venda DECIMAL(18,2) DEFAULT 0,
  valor_unitario_medio DECIMAL(15,4) DEFAULT 0,
  custo_total DECIMAL(18,2) DEFAULT 0,
  custo_unitario_medio DECIMAL(15,4) DEFAULT 0,

  -- Margens
  margem_valor DECIMAL(18,2) DEFAULT 0,
  margem_percentual DECIMAL(8,4) DEFAULT 0,
  contribuicao DECIMAL(18,2) DEFAULT 0,
  markup DECIMAL(8,4) DEFAULT 0,
  markdown DECIMAL(8,4) DEFAULT 0,

  -- Lucratividade
  lucratividade_valor DECIMAL(18,2) DEFAULT 0,
  lucratividade_percentual DECIMAL(8,4) DEFAULT 0,

  -- Promoções
  valor_promocao DECIMAL(18,2) DEFAULT 0,
  quantidade_promocao DECIMAL(15,3) DEFAULT 0,
  percentual_promocao DECIMAL(8,4) DEFAULT 0, -- % vendas em promoção

  -- Classificação ABC
  curva_abc CHAR(1),
  participacao_valor_pct DECIMAL(8,4) DEFAULT 0,

  -- Origem
  import_job_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_fato_vendas UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fato_vendas_org ON fato_vendas(organization_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_loja ON fato_vendas(loja_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_produto ON fato_vendas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_data ON fato_vendas(data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_lookup ON fato_vendas(organization_id, loja_id, data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_promo ON fato_vendas(organization_id, data_importacao) WHERE percentual_promocao > 0;

COMMENT ON TABLE fato_vendas IS 'Fato de vendas - dados diários importados do relatório ABC de Vendas';

-- ==========================================
-- FATO: fato_perdas
-- ==========================================
-- Perdas diárias por loja/produto (importação do ABC Perdas)

CREATE TABLE IF NOT EXISTS fato_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_perda DECIMAL(15,3) DEFAULT 0,

  -- Valores
  custo_perda DECIMAL(18,2) DEFAULT 0,
  custo_perda_liquido DECIMAL(18,2) DEFAULT 0,
  valor_venda_perdido DECIMAL(18,2) DEFAULT 0,
  margem_perdida DECIMAL(18,2) DEFAULT 0,

  -- Lucratividade
  lucratividade_perdida DECIMAL(18,2) DEFAULT 0,
  contribuicao_perdida DECIMAL(18,2) DEFAULT 0,

  -- Classificação da perda
  tipo_perda VARCHAR(50) NOT NULL DEFAULT 'outros', -- 'vencimento', 'avaria', 'quebra', 'roubo', 'ajuste', 'outros'
  motivo_perda VARCHAR(200),

  -- Margens
  margem_percentual DECIMAL(8,4) DEFAULT 0,
  markup DECIMAL(8,4) DEFAULT 0,
  markdown DECIMAL(8,4) DEFAULT 0,

  -- Impostos
  icms_perda DECIMAL(15,2) DEFAULT 0,
  pis_perda DECIMAL(15,2) DEFAULT 0,
  cofins_perda DECIMAL(15,2) DEFAULT 0,

  -- Classificação ABC
  curva_abc CHAR(1),

  -- Origem
  import_job_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_fato_perdas UNIQUE(organization_id, loja_id, produto_id, data_importacao, tipo_perda)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fato_perdas_org ON fato_perdas(organization_id);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_loja ON fato_perdas(loja_id);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_produto ON fato_perdas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_data ON fato_perdas(data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_tipo ON fato_perdas(tipo_perda);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_lookup ON fato_perdas(organization_id, loja_id, data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_perdas_custo ON fato_perdas(custo_perda DESC);

COMMENT ON TABLE fato_perdas IS 'Fato de perdas - dados diários importados do relatório ABC de Perdas';

-- ==========================================
-- FATO: fato_rupturas
-- ==========================================
-- Rupturas/vendas perdidas por loja/produto (importação do ABC Rupturas)

CREATE TABLE IF NOT EXISTS fato_rupturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Vendas perdidas
  quantidade_perdida DECIMAL(15,3) DEFAULT 0,
  valor_venda_perdida DECIMAL(18,2) DEFAULT 0,

  -- Custos
  custo_ruptura DECIMAL(18,2) DEFAULT 0,
  custo_ruptura_liquido DECIMAL(18,2) DEFAULT 0,
  custo_fiscal DECIMAL(18,2) DEFAULT 0,

  -- Margem perdida
  margem_perdida DECIMAL(18,2) DEFAULT 0,
  lucratividade_perdida DECIMAL(18,2) DEFAULT 0,

  -- Percentuais
  margem_percentual DECIMAL(8,4) DEFAULT 0,
  markup DECIMAL(8,4) DEFAULT 0,
  markdown DECIMAL(8,4) DEFAULT 0,

  -- Classificação ABC
  curva_abc CHAR(1),

  -- Origem
  import_job_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_fato_rupturas UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_org ON fato_rupturas(organization_id);
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_loja ON fato_rupturas(loja_id);
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_produto ON fato_rupturas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_data ON fato_rupturas(data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_lookup ON fato_rupturas(organization_id, loja_id, data_importacao);
CREATE INDEX IF NOT EXISTS idx_fato_rupturas_valor ON fato_rupturas(valor_venda_perdida DESC);

COMMENT ON TABLE fato_rupturas IS 'Fato de rupturas - vendas perdidas por falta de estoque';

-- ==========================================
-- TABELA: historico_importacoes_varejo
-- ==========================================
-- Controle de importações dos relatórios ABC

CREATE TABLE IF NOT EXISTS historico_importacoes_varejo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),

  -- Tipo de relatório
  tipo_relatorio VARCHAR(50) NOT NULL, -- 'estoque', 'vendas', 'perdas', 'rupturas'

  -- Referência temporal
  data_referencia DATE NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,

  -- Arquivo
  arquivo_nome VARCHAR(255),
  arquivo_tamanho_bytes INT,

  -- Estatísticas
  registros_lidos INT DEFAULT 0,
  registros_importados INT DEFAULT 0,
  registros_atualizados INT DEFAULT 0,
  registros_erro INT DEFAULT 0,
  registros_ignorados INT DEFAULT 0,

  -- Valores totais
  valor_total_processado DECIMAL(18,2) DEFAULT 0,
  quantidade_total_processada DECIMAL(18,3) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'processando', 'concluido', 'erro', 'cancelado'
  erro_mensagem TEXT,
  erro_detalhes JSONB,

  -- Timing
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  duracao_ms INT,

  -- Usuário
  usuario_id UUID,

  -- Referência ao job de importação genérico (se usado)
  import_job_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_importacao_loja_tipo_data UNIQUE(organization_id, loja_id, tipo_relatorio, data_referencia)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_hist_import_org ON historico_importacoes_varejo(organization_id);
CREATE INDEX IF NOT EXISTS idx_hist_import_loja ON historico_importacoes_varejo(loja_id);
CREATE INDEX IF NOT EXISTS idx_hist_import_tipo ON historico_importacoes_varejo(tipo_relatorio);
CREATE INDEX IF NOT EXISTS idx_hist_import_data ON historico_importacoes_varejo(data_referencia);
CREATE INDEX IF NOT EXISTS idx_hist_import_status ON historico_importacoes_varejo(status);

COMMENT ON TABLE historico_importacoes_varejo IS 'Histórico de importações dos relatórios ABC de varejo';

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_hist_import_updated_at
  BEFORE UPDATE ON historico_importacoes_varejo
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE fato_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE fato_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fato_perdas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fato_rupturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_importacoes_varejo ENABLE ROW LEVEL SECURITY;

-- fato_estoque
CREATE POLICY "fato_estoque_select_org" ON fato_estoque
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "fato_estoque_insert_org" ON fato_estoque
  FOR INSERT WITH CHECK (organization_id = get_current_org_id());

CREATE POLICY "fato_estoque_service" ON fato_estoque
  FOR ALL USING (auth.role() = 'service_role');

-- fato_vendas
CREATE POLICY "fato_vendas_select_org" ON fato_vendas
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "fato_vendas_insert_org" ON fato_vendas
  FOR INSERT WITH CHECK (organization_id = get_current_org_id());

CREATE POLICY "fato_vendas_service" ON fato_vendas
  FOR ALL USING (auth.role() = 'service_role');

-- fato_perdas
CREATE POLICY "fato_perdas_select_org" ON fato_perdas
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "fato_perdas_insert_org" ON fato_perdas
  FOR INSERT WITH CHECK (organization_id = get_current_org_id());

CREATE POLICY "fato_perdas_service" ON fato_perdas
  FOR ALL USING (auth.role() = 'service_role');

-- fato_rupturas
CREATE POLICY "fato_rupturas_select_org" ON fato_rupturas
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "fato_rupturas_insert_org" ON fato_rupturas
  FOR INSERT WITH CHECK (organization_id = get_current_org_id());

CREATE POLICY "fato_rupturas_service" ON fato_rupturas
  FOR ALL USING (auth.role() = 'service_role');

-- historico_importacoes_varejo
CREATE POLICY "hist_import_select_org" ON historico_importacoes_varejo
  FOR SELECT USING (organization_id = get_current_org_id() OR is_super_admin());

CREATE POLICY "hist_import_manage_org" ON historico_importacoes_varejo
  FOR ALL USING (organization_id = get_current_org_id());

CREATE POLICY "hist_import_service" ON historico_importacoes_varejo
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT, INSERT ON fato_estoque TO authenticated;
GRANT SELECT, INSERT ON fato_vendas TO authenticated;
GRANT SELECT, INSERT ON fato_perdas TO authenticated;
GRANT SELECT, INSERT ON fato_rupturas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON historico_importacoes_varejo TO authenticated;

GRANT ALL ON fato_estoque TO service_role;
GRANT ALL ON fato_vendas TO service_role;
GRANT ALL ON fato_perdas TO service_role;
GRANT ALL ON fato_rupturas TO service_role;
GRANT ALL ON historico_importacoes_varejo TO service_role;

-- ==========================================
-- COMENTÁRIOS ADICIONAIS
-- ==========================================

COMMENT ON COLUMN fato_estoque.dias_estoque IS 'Cobertura em dias = Estoque / Média Venda Dia';
COMMENT ON COLUMN fato_estoque.curva_abc IS 'Classificação ABC baseada em valor (A=80%, B=15%, C=5%)';
COMMENT ON COLUMN fato_vendas.percentual_promocao IS 'Percentual das vendas feitas em promoção';
COMMENT ON COLUMN fato_perdas.tipo_perda IS 'Classificação: vencimento, avaria, quebra, roubo, ajuste, outros';
COMMENT ON COLUMN fato_rupturas.valor_venda_perdida IS 'Valor de vendas não realizadas por falta de estoque';
