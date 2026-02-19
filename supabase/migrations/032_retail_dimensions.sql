-- =============================================
-- Migration 032: Dimensões para Gestão de Varejo
-- Created: 2026-02-18
-- Description: Tabelas de dimensões para análise de estoque, perdas e rupturas
-- =============================================

-- ==========================================
-- FUNÇÕES HELPER (necessárias para RLS)
-- ==========================================
-- Criar se não existir (caso migration 021 não tenha sido executada)

CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt()->>'orgId')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(auth.jwt()->>'role', '') IN ('super_admin', 'developer');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(auth.jwt()->>'role', '') IN ('super_admin', 'developer', 'admin_rede');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função update_updated_at_column (comum em muitas tabelas)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- DIMENSÃO: dim_produto
-- ==========================================
-- Catálogo normalizado de produtos para análise

CREATE TABLE IF NOT EXISTS dim_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  -- Identificadores
  codigo VARCHAR(50) NOT NULL,
  ean VARCHAR(20),
  sku VARCHAR(50),

  -- Descrição
  nome VARCHAR(255) NOT NULL,
  nome_completo VARCHAR(500),

  -- Classificação
  categoria VARCHAR(100),
  subcategoria VARCHAR(100),
  departamento VARCHAR(100),
  secao VARCHAR(100),

  -- Fornecedor/Marca
  fornecedor VARCHAR(200),
  marca VARCHAR(100),
  comprador VARCHAR(200),

  -- Unidades
  unidade_medida VARCHAR(20) DEFAULT 'UN',
  embalagem VARCHAR(50),
  peso_liquido DECIMAL(10,3),

  -- Fiscal
  ncm VARCHAR(10),
  cest VARCHAR(10),

  -- Status
  ativo BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_dim_produto_org_codigo UNIQUE(organization_id, codigo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dim_produto_org ON dim_produto(organization_id);
CREATE INDEX IF NOT EXISTS idx_dim_produto_ean ON dim_produto(ean);
CREATE INDEX IF NOT EXISTS idx_dim_produto_codigo ON dim_produto(codigo);
CREATE INDEX IF NOT EXISTS idx_dim_produto_categoria ON dim_produto(categoria);
CREATE INDEX IF NOT EXISTS idx_dim_produto_fornecedor ON dim_produto(fornecedor);
CREATE INDEX IF NOT EXISTS idx_dim_produto_ativo ON dim_produto(organization_id, ativo) WHERE ativo = true;

COMMENT ON TABLE dim_produto IS 'Dimensão de produtos - catálogo normalizado para análises';

-- ==========================================
-- DIMENSÃO: dim_loja
-- ==========================================
-- Lojas com classificação para análise de cluster

CREATE TABLE IF NOT EXISTS dim_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- Identificadores
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(100) NOT NULL,
  nome_fantasia VARCHAR(100),

  -- Classificação
  cluster VARCHAR(50), -- 'alto_risco', 'medio_risco', 'baixo_risco', 'a', 'b', 'c'
  regiao VARCHAR(50),
  uf VARCHAR(2),
  cidade VARCHAR(100),

  -- Tipo
  tipo VARCHAR(50) DEFAULT 'loja', -- 'loja', 'cd', 'express', 'atacado'
  formato VARCHAR(50), -- 'supermercado', 'hipermercado', 'vizinhanca'

  -- Métricas de referência
  faturamento_medio_mensal DECIMAL(18,2),
  area_venda_m2 DECIMAL(10,2),
  qtd_checkouts INT,

  -- Status
  ativo BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_dim_loja_org_codigo UNIQUE(organization_id, codigo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dim_loja_org ON dim_loja(organization_id);
CREATE INDEX IF NOT EXISTS idx_dim_loja_store ON dim_loja(store_id);
CREATE INDEX IF NOT EXISTS idx_dim_loja_cluster ON dim_loja(cluster);
CREATE INDEX IF NOT EXISTS idx_dim_loja_regiao ON dim_loja(regiao);
CREATE INDEX IF NOT EXISTS idx_dim_loja_ativo ON dim_loja(organization_id, ativo) WHERE ativo = true;

COMMENT ON TABLE dim_loja IS 'Dimensão de lojas - classificação e clusters para análises';

-- ==========================================
-- DIMENSÃO: dim_periodo
-- ==========================================
-- Calendário para análises temporais

CREATE TABLE IF NOT EXISTS dim_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Data
  data DATE UNIQUE NOT NULL,

  -- Componentes
  dia INT NOT NULL,
  mes INT NOT NULL,
  ano INT NOT NULL,
  trimestre INT NOT NULL,
  semestre INT NOT NULL,

  -- Semana
  dia_semana INT NOT NULL, -- 0 = domingo, 6 = sábado
  dia_semana_nome VARCHAR(20) NOT NULL,
  semana_ano INT NOT NULL,
  semana_mes INT NOT NULL,

  -- Flags
  is_fim_semana BOOLEAN NOT NULL DEFAULT false,
  is_feriado BOOLEAN NOT NULL DEFAULT false,
  nome_feriado VARCHAR(100),

  -- Períodos fiscais
  mes_fiscal INT,
  ano_fiscal INT,

  -- Período formatado
  ano_mes VARCHAR(7), -- '2026-02'
  ano_semana VARCHAR(8), -- '2026-W07'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dim_periodo_data ON dim_periodo(data);
CREATE INDEX IF NOT EXISTS idx_dim_periodo_ano_mes ON dim_periodo(ano, mes);
CREATE INDEX IF NOT EXISTS idx_dim_periodo_feriado ON dim_periodo(is_feriado) WHERE is_feriado = true;

COMMENT ON TABLE dim_periodo IS 'Dimensão de tempo - calendário para análises temporais';

-- ==========================================
-- FUNÇÃO: Preencher dim_periodo
-- ==========================================
-- Gera registros de calendário para um intervalo de datas

CREATE OR REPLACE FUNCTION populate_dim_periodo(
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_data DATE;
  v_count INTEGER := 0;
  v_dia_semana INT;
  v_dia_semana_nome VARCHAR(20);
BEGIN
  v_data := p_data_inicio;

  WHILE v_data <= p_data_fim LOOP
    v_dia_semana := EXTRACT(DOW FROM v_data)::INT;

    v_dia_semana_nome := CASE v_dia_semana
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda'
      WHEN 2 THEN 'Terça'
      WHEN 3 THEN 'Quarta'
      WHEN 4 THEN 'Quinta'
      WHEN 5 THEN 'Sexta'
      WHEN 6 THEN 'Sábado'
    END;

    INSERT INTO dim_periodo (
      data,
      dia, mes, ano, trimestre, semestre,
      dia_semana, dia_semana_nome, semana_ano, semana_mes,
      is_fim_semana,
      ano_mes, ano_semana
    ) VALUES (
      v_data,
      EXTRACT(DAY FROM v_data)::INT,
      EXTRACT(MONTH FROM v_data)::INT,
      EXTRACT(YEAR FROM v_data)::INT,
      EXTRACT(QUARTER FROM v_data)::INT,
      CASE WHEN EXTRACT(MONTH FROM v_data) <= 6 THEN 1 ELSE 2 END,
      v_dia_semana,
      v_dia_semana_nome,
      EXTRACT(WEEK FROM v_data)::INT,
      CEIL(EXTRACT(DAY FROM v_data) / 7.0)::INT,
      v_dia_semana IN (0, 6),
      TO_CHAR(v_data, 'YYYY-MM'),
      TO_CHAR(v_data, 'IYYY-"W"IW')
    )
    ON CONFLICT (data) DO NOTHING;

    v_count := v_count + 1;
    v_data := v_data + INTERVAL '1 day';
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Preencher calendário de 2024 a 2027
SELECT populate_dim_periodo('2024-01-01'::DATE, '2027-12-31'::DATE);

-- ==========================================
-- FUNÇÃO: Marcar feriados brasileiros
-- ==========================================

CREATE OR REPLACE FUNCTION marcar_feriados_brasil(p_ano INT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_pascoa DATE;
  v_carnaval DATE;
  v_sexta_santa DATE;
  v_corpus_christi DATE;
BEGIN
  -- Calcular Páscoa (algoritmo de Meeus/Jones/Butcher)
  DECLARE
    a INT := p_ano % 19;
    b INT := p_ano / 100;
    c INT := p_ano % 100;
    d INT := b / 4;
    e INT := b % 4;
    f INT := (b + 8) / 25;
    g INT := (b - f + 1) / 3;
    h INT := (19 * a + b - d - g + 15) % 30;
    i INT := c / 4;
    k INT := c % 4;
    l INT := (32 + 2 * e + 2 * i - h - k) % 7;
    m INT := (a + 11 * h + 22 * l) / 451;
    mes INT := (h + l - 7 * m + 114) / 31;
    dia INT := ((h + l - 7 * m + 114) % 31) + 1;
  BEGIN
    v_pascoa := MAKE_DATE(p_ano, mes, dia);
  END;

  v_carnaval := v_pascoa - INTERVAL '47 days';
  v_sexta_santa := v_pascoa - INTERVAL '2 days';
  v_corpus_christi := v_pascoa + INTERVAL '60 days';

  -- Feriados fixos
  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Confraternização Universal'
  WHERE data = MAKE_DATE(p_ano, 1, 1);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Tiradentes'
  WHERE data = MAKE_DATE(p_ano, 4, 21);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Dia do Trabalho'
  WHERE data = MAKE_DATE(p_ano, 5, 1);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Independência do Brasil'
  WHERE data = MAKE_DATE(p_ano, 9, 7);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Nossa Senhora Aparecida'
  WHERE data = MAKE_DATE(p_ano, 10, 12);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Finados'
  WHERE data = MAKE_DATE(p_ano, 11, 2);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Proclamação da República'
  WHERE data = MAKE_DATE(p_ano, 11, 15);

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Natal'
  WHERE data = MAKE_DATE(p_ano, 12, 25);

  -- Feriados móveis
  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Carnaval'
  WHERE data = v_carnaval::DATE;

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Carnaval'
  WHERE data = (v_carnaval + INTERVAL '1 day')::DATE;

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Sexta-feira Santa'
  WHERE data = v_sexta_santa::DATE;

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Páscoa'
  WHERE data = v_pascoa;

  UPDATE dim_periodo SET is_feriado = true, nome_feriado = 'Corpus Christi'
  WHERE data = v_corpus_christi::DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Marcar feriados para 2024-2027
SELECT marcar_feriados_brasil(2024);
SELECT marcar_feriados_brasil(2025);
SELECT marcar_feriados_brasil(2026);
SELECT marcar_feriados_brasil(2027);

-- ==========================================
-- FUNÇÃO: Sincronizar dim_loja com stores
-- ==========================================

CREATE OR REPLACE FUNCTION sync_dim_loja_from_stores(p_organization_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO dim_loja (
    organization_id,
    store_id,
    codigo,
    nome,
    ativo
  )
  SELECT
    s.company_id,
    s.id,
    COALESCE(s.code, s.id::VARCHAR),
    s.name,
    true
  FROM stores s
  WHERE s.company_id = p_organization_id
  ON CONFLICT (organization_id, codigo)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    store_id = EXCLUDED.store_id,
    updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para updated_at (DROP IF EXISTS para idempotência)
DROP TRIGGER IF EXISTS update_dim_produto_updated_at ON dim_produto;
CREATE TRIGGER update_dim_produto_updated_at
  BEFORE UPDATE ON dim_produto
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_loja_updated_at ON dim_loja;
CREATE TRIGGER update_dim_loja_updated_at
  BEFORE UPDATE ON dim_loja
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE dim_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_periodo ENABLE ROW LEVEL SECURITY;

-- dim_produto
CREATE POLICY "dim_produto_select_org" ON dim_produto
  FOR SELECT USING (
    organization_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "dim_produto_manage_org" ON dim_produto
  FOR ALL USING (
    organization_id = get_current_org_id()
  );

CREATE POLICY "dim_produto_service" ON dim_produto
  FOR ALL USING (auth.role() = 'service_role');

-- dim_loja
CREATE POLICY "dim_loja_select_org" ON dim_loja
  FOR SELECT USING (
    organization_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "dim_loja_manage_org" ON dim_loja
  FOR ALL USING (
    organization_id = get_current_org_id()
  );

CREATE POLICY "dim_loja_service" ON dim_loja
  FOR ALL USING (auth.role() = 'service_role');

-- dim_periodo (público, apenas leitura)
CREATE POLICY "dim_periodo_select_all" ON dim_periodo
  FOR SELECT USING (true);

CREATE POLICY "dim_periodo_service" ON dim_periodo
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- GRANTS
-- ==========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON dim_produto TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dim_loja TO authenticated;
GRANT SELECT ON dim_periodo TO authenticated;

GRANT ALL ON dim_produto TO service_role;
GRANT ALL ON dim_loja TO service_role;
GRANT ALL ON dim_periodo TO service_role;

GRANT EXECUTE ON FUNCTION populate_dim_periodo TO service_role;
GRANT EXECUTE ON FUNCTION marcar_feriados_brasil TO service_role;
GRANT EXECUTE ON FUNCTION sync_dim_loja_from_stores TO authenticated;

-- Grants para funções helper (caso não existam)
GRANT EXECUTE ON FUNCTION get_current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION populate_dim_periodo IS 'Preenche a dimensão de período com datas do intervalo especificado';
COMMENT ON FUNCTION marcar_feriados_brasil IS 'Marca feriados nacionais brasileiros para um ano específico';
COMMENT ON FUNCTION sync_dim_loja_from_stores IS 'Sincroniza dim_loja com a tabela stores existente';
