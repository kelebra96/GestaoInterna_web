# Plataforma Profissional de Gestão de Estoque e Prevenção de Perdas

## Visão do Produto

Transformar o sistema atual de **técnico** para **executivo** - uma plataforma completa de Business Intelligence para gestão de rede supermercadista com foco em:

- **Gestão de Estoque** (giro, cobertura, capital parado)
- **Prevenção de Perdas** (análise, tendências, clusters)
- **Gestão de Rupturas** (disponibilidade, vendas perdidas)
- **Inteligência de Decisão** (recomendações com justificativa, BI narrativo)

---

## Arquitetura de Módulos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLATAFORMA DE GESTÃO DE VAREJO                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  MÓDULO 1   │  │  MÓDULO 2   │  │  MÓDULO 3   │  │  MÓDULO 4   │        │
│  │ Importação  │  │ BI Executivo│  │  Estoque    │  │   Perdas    │        │
│  │ & Governança│  │             │  │  & Giro     │  │  & Riscos   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │  MÓDULO 5   │  │  MÓDULO 6   │  │  MÓDULO 7   │                         │
│  │  Rupturas   │  │   Motor de  │  │ Assistente  │                         │
│  │& Oportunid. │  │Recomendações│  │ Inteligente │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Fundação de Dados (Modelagem Histórica)

### 1.1 Novas Tabelas no Supabase

```sql
-- ============================================
-- DIMENSÕES
-- ============================================

CREATE TABLE dim_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  ean VARCHAR(20),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  subcategoria VARCHAR(100),
  fornecedor VARCHAR(100),
  marca VARCHAR(100),
  unidade_medida VARCHAR(20),
  peso_liquido DECIMAL(10,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dim_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  cluster VARCHAR(50), -- 'alto_risco', 'medio_risco', 'baixo_risco'
  regiao VARCHAR(50),
  tipo VARCHAR(50), -- 'loja', 'cd', 'express'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dim_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE UNIQUE NOT NULL,
  dia_semana INT,
  semana_ano INT,
  mes INT,
  ano INT,
  trimestre INT,
  is_fim_semana BOOLEAN,
  is_feriado BOOLEAN
);

-- ============================================
-- FATOS (Importação diária por loja)
-- ============================================

CREATE TABLE fato_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_estoque DECIMAL(15,3),
  quantidade_reservada DECIMAL(15,3),
  quantidade_disponivel DECIMAL(15,3),
  quantidade_pendente_compra DECIMAL(15,3),

  -- Valores
  custo_unitario DECIMAL(15,4),
  custo_total DECIMAL(15,2),
  preco_venda DECIMAL(15,2),
  valor_estoque_venda DECIMAL(15,2),

  -- Métricas calculadas
  media_venda_dia DECIMAL(15,3),
  dias_estoque DECIMAL(10,2),
  dias_ultima_entrada INT,
  dias_ultima_venda INT,

  -- Classificação ABC
  curva_abc CHAR(1), -- A, B, C

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

CREATE TABLE fato_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_vendida DECIMAL(15,3),

  -- Valores
  valor_venda DECIMAL(15,2),
  valor_unitario_medio DECIMAL(15,4),
  custo_total DECIMAL(15,2),

  -- Margens
  margem_valor DECIMAL(15,2),
  margem_percentual DECIMAL(8,4),
  contribuicao DECIMAL(15,2),

  -- Promoções
  valor_promocao DECIMAL(15,2),
  percentual_promocao DECIMAL(8,4),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

CREATE TABLE fato_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Quantidades
  quantidade_perda DECIMAL(15,3),

  -- Valores
  custo_perda DECIMAL(15,2),
  valor_venda_perdido DECIMAL(15,2),
  margem_perdida DECIMAL(15,2),

  -- Classificação
  tipo_perda VARCHAR(50), -- 'vencimento', 'avaria', 'quebra', 'roubo', 'ajuste'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, loja_id, produto_id, data_importacao, tipo_perda)
);

CREATE TABLE fato_rupturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  produto_id UUID REFERENCES dim_produto(id),
  periodo_id UUID REFERENCES dim_periodo(id),
  data_importacao DATE NOT NULL,

  -- Vendas perdidas
  quantidade_perdida DECIMAL(15,3),
  valor_venda_perdida DECIMAL(15,2),
  margem_perdida DECIMAL(15,2),

  -- Custos
  custo_ruptura DECIMAL(15,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, loja_id, produto_id, data_importacao)
);

-- ============================================
-- AGREGAÇÕES (Pré-calculadas para performance)
-- ============================================

CREATE TABLE agg_metricas_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20), -- 'diario', 'semanal', 'mensal'

  -- ESTOQUE
  valor_estoque_total DECIMAL(18,2),
  giro_estoque DECIMAL(10,4),
  cobertura_dias DECIMAL(10,2),
  capital_parado DECIMAL(18,2),
  estoque_acima_60_dias_pct DECIMAL(8,4),
  estoque_morto_valor DECIMAL(18,2),
  qtd_skus_ruptura INT,

  -- PERDAS
  perda_valor_total DECIMAL(18,2),
  perda_sobre_faturamento_pct DECIMAL(8,4),
  perda_sobre_estoque_pct DECIMAL(8,4),
  perda_vencimento_pct DECIMAL(8,4),
  perda_avaria_pct DECIMAL(8,4),
  perda_roubo_pct DECIMAL(8,4),

  -- RUPTURAS
  taxa_disponibilidade DECIMAL(8,4),
  vendas_perdidas_valor DECIMAL(18,2),
  ruptura_recorrente_qtd INT,
  impacto_margem_ruptura DECIMAL(18,2),

  -- VENDAS
  faturamento_total DECIMAL(18,2),
  margem_media_pct DECIMAL(8,4),
  ticket_medio DECIMAL(15,2),

  -- PROMOÇÕES
  valor_promocoes DECIMAL(18,2),
  roi_promocoes DECIMAL(10,4),
  margem_pre_promocao DECIMAL(8,4),
  margem_pos_promocao DECIMAL(8,4),

  -- SCORE FINANCEIRO (RFE)
  rfe_score DECIMAL(18,2),
  rfe_rank INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, loja_id, periodo, tipo_periodo)
);

CREATE TABLE agg_metricas_rede (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  periodo DATE NOT NULL,
  tipo_periodo VARCHAR(20),

  -- Todas as mesmas métricas consolidadas para a rede
  -- (mesma estrutura de agg_metricas_loja)

  valor_estoque_total DECIMAL(18,2),
  giro_estoque DECIMAL(10,4),
  cobertura_dias DECIMAL(10,2),
  capital_parado DECIMAL(18,2),
  perda_valor_total DECIMAL(18,2),
  perda_sobre_faturamento_pct DECIMAL(8,4),
  vendas_perdidas_valor DECIMAL(18,2),
  taxa_disponibilidade DECIMAL(8,4),
  faturamento_total DECIMAL(18,2),
  margem_media_pct DECIMAL(8,4),
  rfe_total DECIMAL(18,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, periodo, tipo_periodo)
);

-- ============================================
-- HISTÓRICO DE IMPORTAÇÕES
-- ============================================

CREATE TABLE historico_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loja_id UUID REFERENCES dim_loja(id),
  tipo_relatorio VARCHAR(50), -- 'estoque', 'vendas', 'perdas', 'rupturas'
  data_referencia DATE NOT NULL,
  arquivo_nome VARCHAR(255),
  registros_importados INT,
  registros_erro INT,
  status VARCHAR(20), -- 'pendente', 'processando', 'concluido', 'erro'
  erro_mensagem TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_fato_estoque_lookup ON fato_estoque(organization_id, loja_id, data_importacao);
CREATE INDEX idx_fato_vendas_lookup ON fato_vendas(organization_id, loja_id, data_importacao);
CREATE INDEX idx_fato_perdas_lookup ON fato_perdas(organization_id, loja_id, data_importacao);
CREATE INDEX idx_fato_rupturas_lookup ON fato_rupturas(organization_id, loja_id, data_importacao);
CREATE INDEX idx_agg_metricas_loja_lookup ON agg_metricas_loja(organization_id, periodo, tipo_periodo);
```

### 1.2 Cálculo do RFE (Risk Financial Exposure)

```sql
-- Função para calcular RFE
CREATE OR REPLACE FUNCTION calcular_rfe(
  p_organization_id UUID,
  p_loja_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE,
  p_custo_capital DECIMAL DEFAULT 0.12 -- 12% ao ano
)
RETURNS DECIMAL AS $$
DECLARE
  v_perdas DECIMAL;
  v_vendas_perdidas DECIMAL;
  v_estoque_excessivo DECIMAL;
  v_dias_periodo INT;
  v_rfe DECIMAL;
BEGIN
  -- Período em dias
  v_dias_periodo := p_periodo_fim - p_periodo_inicio;

  -- Total de perdas no período
  SELECT COALESCE(SUM(custo_perda), 0) INTO v_perdas
  FROM fato_perdas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- Vendas perdidas por ruptura
  SELECT COALESCE(SUM(valor_venda_perdida), 0) INTO v_vendas_perdidas
  FROM fato_rupturas
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- Estoque excessivo (acima de 60 dias)
  SELECT COALESCE(SUM(custo_total), 0) INTO v_estoque_excessivo
  FROM fato_estoque
  WHERE organization_id = p_organization_id
    AND loja_id = p_loja_id
    AND data_importacao = p_periodo_fim
    AND dias_estoque > 60;

  -- RFE = Perdas + Vendas Perdidas + (Estoque Excessivo × custo capital proporcional)
  v_rfe := v_perdas + v_vendas_perdidas + (v_estoque_excessivo * (p_custo_capital * v_dias_periodo / 365));

  RETURN v_rfe;
END;
$$ LANGUAGE plpgsql;
```

---

## FASE 2: APIs de Métricas de Varejo

### 2.1 Estrutura de APIs

```
/api/relatorios/
├── importar/                 # Importação de relatórios
│   ├── estoque/             # POST - Importa ABC Estoque
│   ├── vendas/              # POST - Importa ABC Vendas
│   ├── perdas/              # POST - Importa ABC Perdas
│   └── rupturas/            # POST - Importa ABC Rupturas
│
├── metricas/
│   ├── estoque/             # GET - Métricas de estoque
│   ├── perdas/              # GET - Métricas de perdas
│   ├── rupturas/            # GET - Métricas de rupturas
│   ├── vendas/              # GET - Métricas de vendas
│   └── rfe/                 # GET - Risk Financial Exposure
│
├── consolidado/
│   ├── loja/[id]/           # GET - Métricas consolidadas por loja
│   ├── rede/                # GET - Métricas consolidadas da rede
│   └── comparativo/         # GET - Comparativo período anterior
│
└── exportar/
    ├── pdf/                 # POST - Gera relatório PDF
    └── excel/               # POST - Exporta para Excel
```

### 2.2 Interfaces TypeScript

```typescript
// lib/types/metricas-varejo.ts

// ============================================
// MÉTRICAS DE ESTOQUE
// ============================================
export interface MetricasEstoque {
  // Valores absolutos
  valorTotalEstoque: number;
  quantidadeSkus: number;

  // Giro e Cobertura
  giroEstoque: number;           // Vendas / Estoque médio
  coberturaDias: number;         // Dias de estoque

  // Capital
  capitalInvestido: number;
  capitalParado: number;         // Estoque > 60 dias
  custoOportunidade: number;     // Capital parado × taxa

  // Risco
  estoqueAcima60DiasPct: number;
  estoqueMortoValor: number;     // Sem venda > 90 dias
  estoqueMortoQtd: number;

  // Ruptura
  indiceRupturaPorCategoria: Record<string, number>;
  skusEmRuptura: number;

  // Comparativo
  variacaoVsPeriodoAnterior: number;
}

// ============================================
// MÉTRICAS DE PERDAS
// ============================================
export interface MetricasPerdas {
  // Valores absolutos
  perdaTotal: number;
  quantidadeItens: number;

  // Percentuais estratégicos
  perdaSobreFaturamento: number;
  perdaSobreEstoque: number;

  // Por tipo (%)
  perdaPorTipo: {
    vencimento: number;
    avaria: number;
    quebra: number;
    roubo: number;
    ajuste: number;
    outros: number;
  };

  // Análise
  perdaPorFornecedor: Array<{
    fornecedor: string;
    valor: number;
    percentual: number;
  }>;

  perdaPorClusterLoja: Array<{
    cluster: string;
    valor: number;
    percentual: number;
  }>;

  // Tendência
  tendenciaMensal: Array<{
    mes: string;
    valor: number;
    variacao: number;
  }>;

  // Margem perdida
  margemPerdidaTotal: number;
}

// ============================================
// MÉTRICAS DE RUPTURA
// ============================================
export interface MetricasRuptura {
  // Taxa principal
  taxaDisponibilidade: number;   // 1 - taxa_ruptura
  taxaRuptura: number;

  // Vendas perdidas
  vendasPerdidasValor: number;
  vendasPerdidasQuantidade: number;
  vendaPotencial: number;
  percentualVendaPerdida: number; // Vendas perdidas / venda potencial

  // Recorrência
  rupturaRecorrente: number;     // Produtos com ruptura > 3x/semana
  produtosCriticos: Array<{
    produto: string;
    codigo: string;
    frequenciaRuptura: number;
    vendasPerdidas: number;
  }>;

  // Impacto financeiro
  impactoMargem: number;
  custoReabastecimento: number;
}

// ============================================
// MÉTRICAS DE PROMOÇÕES
// ============================================
export interface MetricasPromocao {
  valorTotalPromocoes: number;

  // ROI
  roiReal: number;               // (Incremento vendas - Desconto) / Desconto

  // Margens
  margemAntes: number;
  margemDepois: number;
  diferencaMargem: number;

  // Canibalização
  efeitoCanbalizacao: number;    // Queda em produtos similares

  // Lift
  liftVolume: number;            // Aumento real de volume
  liftValor: number;
}

// ============================================
// RFE - RISK FINANCIAL EXPOSURE
// ============================================
export interface RFEScore {
  // Score total
  rfe: number;

  // Componentes
  componentePerdas: number;
  componenteVendasPerdidas: number;
  componenteEstoqueExcessivo: number;
  custoCapitalAplicado: number;

  // Ranking
  rankingRede: number;
  totalLojas: number;

  // Classificação
  nivel: 'critico' | 'alto' | 'medio' | 'baixo';

  // Comparativo
  variacaoVsPeriodoAnterior: number;
  tendencia: 'piorando' | 'estavel' | 'melhorando';
}

// ============================================
// DASHBOARD EXECUTIVO CONSOLIDADO
// ============================================
export interface DashboardExecutivo {
  periodo: {
    inicio: string;
    fim: string;
    diasAnalisados: number;
  };

  // Visão rápida
  kpis: {
    faturamentoTotal: number;
    margemMedia: number;
    perdaTotal: number;
    perdaSobreFaturamento: number;
    vendasPerdidas: number;
    taxaDisponibilidade: number;
    rfeTotal: number;
  };

  // Detalhes por módulo
  estoque: MetricasEstoque;
  perdas: MetricasPerdas;
  rupturas: MetricasRuptura;
  promocoes: MetricasPromocao;

  // Rankings
  rankingLojasPorRFE: Array<{
    loja: string;
    rfe: number;
    nivel: string;
    principalProblema: string;
  }>;

  // Alertas críticos
  alertas: Array<{
    tipo: 'perda' | 'ruptura' | 'estoque' | 'rfe';
    severidade: 'critical' | 'high' | 'medium';
    mensagem: string;
    loja?: string;
    produto?: string;
    valor?: number;
  }>;
}
```

### 2.3 Service de Cálculo de Métricas

```typescript
// lib/services/metricas-varejo.service.ts

export class MetricasVarejoService {

  // ============================================
  // ESTOQUE
  // ============================================

  async calcularMetricasEstoque(
    organizationId: string,
    lojaId?: string,
    periodo: { inicio: Date; fim: Date }
  ): Promise<MetricasEstoque> {

    // Giro = CMV / Estoque Médio
    const giro = await this.calcularGiroEstoque(organizationId, lojaId, periodo);

    // Cobertura = Estoque Atual / Média Venda Dia
    const cobertura = await this.calcularCobertura(organizationId, lojaId, periodo);

    // Capital parado = Estoque com > 60 dias
    const capitalParado = await this.calcularCapitalParado(organizationId, lojaId);

    // Estoque morto = Sem venda > 90 dias
    const estoqueMorto = await this.calcularEstoqueMorto(organizationId, lojaId);

    // Ruptura por categoria
    const rupturaCategoria = await this.calcularRupturaPorCategoria(organizationId, lojaId);

    return {
      valorTotalEstoque: /* query */,
      quantidadeSkus: /* query */,
      giroEstoque: giro,
      coberturaDias: cobertura,
      capitalInvestido: /* query */,
      capitalParado: capitalParado.valor,
      custoOportunidade: capitalParado.valor * 0.12, // 12% ao ano
      estoqueAcima60DiasPct: capitalParado.percentual,
      estoqueMortoValor: estoqueMorto.valor,
      estoqueMortoQtd: estoqueMorto.quantidade,
      indiceRupturaPorCategoria: rupturaCategoria,
      skusEmRuptura: /* query */,
      variacaoVsPeriodoAnterior: /* comparativo */
    };
  }

  // ============================================
  // PERDAS
  // ============================================

  async calcularMetricasPerdas(
    organizationId: string,
    lojaId?: string,
    periodo: { inicio: Date; fim: Date }
  ): Promise<MetricasPerdas> {

    // Perda sobre faturamento
    const faturamento = await this.getFaturamento(organizationId, lojaId, periodo);
    const perdaTotal = await this.getPerdaTotal(organizationId, lojaId, periodo);
    const perdaSobreFaturamento = (perdaTotal / faturamento) * 100;

    // Perda sobre estoque
    const estoqueValor = await this.getEstoqueValor(organizationId, lojaId);
    const perdaSobreEstoque = (perdaTotal / estoqueValor) * 100;

    // Por tipo
    const perdaPorTipo = await this.getPerdaPorTipo(organizationId, lojaId, periodo);

    // Por fornecedor
    const perdaPorFornecedor = await this.getPerdaPorFornecedor(organizationId, lojaId, periodo);

    // Tendência mensal
    const tendencia = await this.getTendenciaPerdas(organizationId, lojaId, 6); // 6 meses

    return {
      perdaTotal,
      quantidadeItens: /* query */,
      perdaSobreFaturamento,
      perdaSobreEstoque,
      perdaPorTipo,
      perdaPorFornecedor,
      perdaPorClusterLoja: /* query */,
      tendenciaMensal: tendencia,
      margemPerdidaTotal: /* query */
    };
  }

  // ============================================
  // RFE - Risk Financial Exposure
  // ============================================

  async calcularRFE(
    organizationId: string,
    lojaId: string,
    periodo: { inicio: Date; fim: Date },
    custoCapital: number = 0.12
  ): Promise<RFEScore> {

    const diasPeriodo = differenceInDays(periodo.fim, periodo.inicio);

    // Componentes do RFE
    const perdas = await this.getPerdaTotal(organizationId, lojaId, periodo);
    const vendasPerdidas = await this.getVendasPerdidas(organizationId, lojaId, periodo);
    const estoqueExcessivo = await this.getEstoqueExcessivo(organizationId, lojaId);

    // Custo do capital parado proporcional ao período
    const custoCapitalProporcional = estoqueExcessivo * (custoCapital * diasPeriodo / 365);

    // RFE Total
    const rfe = perdas + vendasPerdidas + custoCapitalProporcional;

    // Ranking entre lojas
    const ranking = await this.getRankingRFE(organizationId, lojaId);

    // Classificação
    const nivel = this.classificarRFE(rfe, ranking.mediaRede);

    // Tendência
    const rfePeriodoAnterior = await this.getRFEPeriodoAnterior(organizationId, lojaId, periodo);
    const variacao = ((rfe - rfePeriodoAnterior) / rfePeriodoAnterior) * 100;

    return {
      rfe,
      componentePerdas: perdas,
      componenteVendasPerdidas: vendasPerdidas,
      componenteEstoqueExcessivo: estoqueExcessivo,
      custoCapitalAplicado: custoCapitalProporcional,
      rankingRede: ranking.posicao,
      totalLojas: ranking.total,
      nivel,
      variacaoVsPeriodoAnterior: variacao,
      tendencia: variacao > 5 ? 'piorando' : variacao < -5 ? 'melhorando' : 'estavel'
    };
  }

  private classificarRFE(rfe: number, mediaRede: number): string {
    const ratio = rfe / mediaRede;
    if (ratio > 1.5) return 'critico';
    if (ratio > 1.2) return 'alto';
    if (ratio > 0.8) return 'medio';
    return 'baixo';
  }
}
```

---

## FASE 3: Módulos de Interface

### 3.1 Estrutura de Rotas

```
/inteligencia/
├── page.tsx                     # Dashboard ML (atual - manter)
├── executivo/
│   └── page.tsx                 # NOVO - Visão Executiva Consolidada
├── estoque/
│   └── page.tsx                 # NOVO - Gestão de Estoque & Giro
├── perdas/
│   └── page.tsx                 # NOVO - Prevenção de Perdas
├── rupturas/
│   └── page.tsx                 # NOVO - Gestão de Rupturas
├── vendas/
│   └── page.tsx                 # NOVO - Análise de Vendas
├── rfe/
│   └── page.tsx                 # NOVO - Risk Financial Exposure
├── assistente/
│   └── page.tsx                 # NOVO - Assistente LLM
├── produtos/
│   └── page.tsx                 # Manter - Análise de produtos
├── recomendacoes/
│   └── page.tsx                 # Manter - Gestão de recomendações
├── configuracoes/
│   └── page.tsx                 # Manter - Configurações ML
└── importar/
    └── page.tsx                 # Atualizar - Importação multi-relatório
```

### 3.2 Dashboard Executivo (/inteligencia/executivo)

```tsx
// app/inteligencia/executivo/page.tsx

export default function DashboardExecutivo() {
  return (
    <div className="space-y-8">
      {/* Header com filtros globais */}
      <PageHeader
        icon={BarChart3}
        title="Visão Executiva"
        subtitle="Indicadores consolidados de performance"
        actions={<FiltrosGlobais />}
      />

      {/* Seletor: Rede vs Loja específica */}
      <SeletorEscopo onChangeEscopo={setEscopo} />

      {/* KPIs Principais - 5 cards */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard
          title="Faturamento"
          value={formatCurrency(data.kpis.faturamentoTotal)}
          icon={DollarSign}
          trend={data.comparativo.faturamento}
          sparklineData={data.evolucao.faturamento}
        />
        <KPICard
          title="Margem Média"
          value={`${data.kpis.margemMedia.toFixed(1)}%`}
          icon={TrendingUp}
          trend={data.comparativo.margem}
          color="success"
        />
        <KPICard
          title="Perda s/ Fat."
          value={`${data.kpis.perdaSobreFaturamento.toFixed(2)}%`}
          icon={AlertTriangle}
          trend={data.comparativo.perda}
          color="warning"
          invertTrend
        />
        <KPICard
          title="Disponibilidade"
          value={`${data.kpis.taxaDisponibilidade.toFixed(1)}%`}
          icon={Package}
          trend={data.comparativo.disponibilidade}
          color="info"
        />
        <KPICard
          title="RFE Total"
          value={formatCurrency(data.kpis.rfeTotal)}
          icon={Shield}
          trend={data.comparativo.rfe}
          color="accent"
          invertTrend
        />
      </section>

      {/* Gráficos principais */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução Financeira */}
        <Card className="lg:col-span-2">
          <CardHeader>Evolução de Performance</CardHeader>
          <EvolucaoFinanceiraChart data={data.evolucao} />
        </Card>

        {/* Composição de Perdas */}
        <Card>
          <CardHeader>Composição de Perdas</CardHeader>
          <PerdaPorTipoChart data={data.perdas.perdaPorTipo} />
        </Card>
      </section>

      {/* Ranking RFE de Lojas */}
      <section>
        <Card>
          <CardHeader>
            Ranking de Lojas por Exposição ao Risco (RFE)
          </CardHeader>
          <RFERankingTable
            data={data.rankingLojasPorRFE}
            onSelectLoja={handleSelectLoja}
          />
        </Card>
      </section>

      {/* Alertas Críticos */}
      <section>
        <AlertasExecutivos alertas={data.alertas} />
      </section>

      {/* Narrativa Executiva (LLM) */}
      <section>
        <Card>
          <CardHeader icon={Brain}>
            Análise Executiva Automática
          </CardHeader>
          <NarrativaExecutiva
            metricas={data}
            periodo={periodo}
          />
        </Card>
      </section>
    </div>
  );
}
```

### 3.3 Dashboard de Estoque (/inteligencia/estoque)

```tsx
// app/inteligencia/estoque/page.tsx

export default function DashboardEstoque() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Package}
        title="Gestão de Estoque"
        subtitle="Giro, cobertura e otimização de capital"
      />

      {/* KPIs de Estoque - 6 cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Valor em Estoque" value={...} icon={DollarSign} />
        <KPICard title="Giro de Estoque" value={...} icon={RefreshCw} />
        <KPICard title="Cobertura (dias)" value={...} icon={Calendar} />
        <KPICard title="Capital Parado" value={...} icon={Lock} color="warning" />
        <KPICard title="Estoque Morto" value={...} icon={XCircle} color="error" />
        <KPICard title="SKUs em Ruptura" value={...} icon={AlertCircle} color="error" />
      </section>

      {/* Visualizações */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap de Cobertura por Categoria */}
        <Card>
          <CardHeader>Cobertura por Categoria</CardHeader>
          <CoberturaHeatmap data={data.coberturaPorCategoria} />
        </Card>

        {/* Treemap de Valor em Estoque */}
        <Card>
          <CardHeader>Distribuição de Capital</CardHeader>
          <EstoqueTreemap data={data.distribuicaoCapital} />
        </Card>
      </section>

      {/* Curva ABC */}
      <section>
        <Card>
          <CardHeader>Curva ABC de Estoque</CardHeader>
          <CurvaABCChart data={data.curvaABC} />
        </Card>
      </section>

      {/* Tabela de Produtos Críticos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>Top 20 - Lento Movimento</CardHeader>
          <ProdutosLentoMovimentoTable data={data.lentoMovimento} />
        </Card>

        <Card>
          <CardHeader>Produtos em Ruptura</CardHeader>
          <ProdutosRupturaTable data={data.produtosRuptura} />
        </Card>
      </section>
    </div>
  );
}
```

### 3.4 Dashboard de Perdas (/inteligencia/perdas)

```tsx
// app/inteligencia/perdas/page.tsx

export default function DashboardPerdas() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={AlertTriangle}
        title="Prevenção de Perdas"
        subtitle="Análise, tendências e ações corretivas"
      />

      {/* KPIs de Perdas */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard title="Perda Total" value={...} icon={DollarSign} color="error" />
        <KPICard title="% s/ Faturamento" value={...} icon={Percent} />
        <KPICard title="% s/ Estoque" value={...} icon={Package} />
        <KPICard title="Margem Perdida" value={...} icon={TrendingDown} />
        <KPICard title="Itens Afetados" value={...} icon={Hash} />
        <KPICard title="Tendência" value={...} icon={Activity} />
      </section>

      {/* Composição de Perdas */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>Evolução Mensal de Perdas</CardHeader>
          <TendenciaPerdaChart data={data.tendenciaMensal} />
        </Card>

        <Card>
          <CardHeader>Composição por Tipo</CardHeader>
          <PerdaPorTipoPieChart data={data.perdaPorTipo} />
        </Card>
      </section>

      {/* Análise por Dimensão */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>Perda por Fornecedor</CardHeader>
          <PerdaPorFornecedorChart data={data.perdaPorFornecedor} />
        </Card>

        <Card>
          <CardHeader>Perda por Cluster de Loja</CardHeader>
          <PerdaPorClusterChart data={data.perdaPorCluster} />
        </Card>
      </section>

      {/* Pareto de Produtos */}
      <section>
        <Card>
          <CardHeader>Pareto - Top 20 Produtos com Maior Perda</CardHeader>
          <ParetoChart data={data.paretoTop20} />
        </Card>
      </section>

      {/* Tabela detalhada */}
      <section>
        <Card>
          <CardHeader>Detalhamento de Perdas</CardHeader>
          <PerdaDetalhamentoTable
            data={data.detalhamento}
            onExportPDF={handleExportPDF}
          />
        </Card>
      </section>
    </div>
  );
}
```

### 3.5 Dashboard RFE (/inteligencia/rfe)

```tsx
// app/inteligencia/rfe/page.tsx

export default function DashboardRFE() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Shield}
        title="Risk Financial Exposure"
        subtitle="Score unificado de risco financeiro por loja"
      />

      {/* Fórmula do RFE */}
      <Card className="bg-gradient-to-r from-primary-700 to-primary-900 text-white">
        <div className="text-center py-6">
          <h3 className="text-lg font-medium mb-4">Fórmula RFE</h3>
          <code className="text-2xl font-mono">
            RFE = Perdas + Vendas Perdidas + (Estoque Excessivo × Custo Capital)
          </code>
        </div>
      </Card>

      {/* KPI Principal */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 bg-gradient-to-br from-error-50 to-error-100">
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">RFE Total da Rede</p>
            <p className="text-4xl font-bold text-error-700">
              {formatCurrency(data.rfeTotal)}
            </p>
            <Badge variant={data.tendencia === 'melhorando' ? 'success' : 'error'}>
              {data.variacao > 0 ? '+' : ''}{data.variacao.toFixed(1)}% vs anterior
            </Badge>
          </div>
        </Card>

        <Card className="md:col-span-3">
          <div className="grid grid-cols-3 divide-x">
            <div className="text-center py-6">
              <p className="text-sm text-text-secondary">Componente Perdas</p>
              <p className="text-2xl font-bold">{formatCurrency(data.componentePerdas)}</p>
              <p className="text-xs text-text-tertiary">
                {((data.componentePerdas / data.rfeTotal) * 100).toFixed(0)}% do total
              </p>
            </div>
            <div className="text-center py-6">
              <p className="text-sm text-text-secondary">Vendas Perdidas</p>
              <p className="text-2xl font-bold">{formatCurrency(data.componenteVendasPerdidas)}</p>
              <p className="text-xs text-text-tertiary">
                {((data.componenteVendasPerdidas / data.rfeTotal) * 100).toFixed(0)}% do total
              </p>
            </div>
            <div className="text-center py-6">
              <p className="text-sm text-text-secondary">Custo Capital Parado</p>
              <p className="text-2xl font-bold">{formatCurrency(data.componenteCapital)}</p>
              <p className="text-xs text-text-tertiary">
                {((data.componenteCapital / data.rfeTotal) * 100).toFixed(0)}% do total
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Ranking de Lojas */}
      <section>
        <Card>
          <CardHeader>Ranking de Lojas por RFE</CardHeader>
          <RFERankingTable
            data={data.ranking}
            columns={[
              'posicao',
              'loja',
              'rfeScore',
              'nivel',
              'componentePerdas',
              'componenteRuptura',
              'componenteCapital',
              'tendencia',
              'principalProblema'
            ]}
          />
        </Card>
      </section>

      {/* Mapa de Calor por Loja */}
      <section>
        <Card>
          <CardHeader>Mapa de Exposição ao Risco</CardHeader>
          <RFEHeatmap data={data.heatmapLojas} />
        </Card>
      </section>

      {/* Ações Recomendadas */}
      <section>
        <Card>
          <CardHeader icon={Lightbulb}>
            Ações Prioritárias para Redução do RFE
          </CardHeader>
          <AcoesRFEList acoes={data.acoesRecomendadas} />
        </Card>
      </section>
    </div>
  );
}
```

---

## FASE 4: Motor de Recomendações Aprimorado

### 4.1 Recomendações com Justificativa Completa

```typescript
// lib/services/recomendacoes-inteligentes.service.ts

interface RecomendacaoInteligente {
  id: string;
  tipo: TipoRecomendacao;
  prioridade: 'critical' | 'high' | 'medium' | 'low';

  // Ação clara
  titulo: string;
  descricao: string;
  acaoSugerida: string;

  // JUSTIFICATIVA COMPLETA (o que faltava!)
  justificativa: {
    metricas: {
      coberturaDias?: number;
      giro?: number;
      taxaPerda?: number;
      margemProduto?: number;
      frequenciaRuptura?: number;
    };
    comparativos: {
      vsMediaCategoria?: number;
      vsMediaRede?: number;
      vsPeriodoAnterior?: number;
    };
    contexto: string; // Explicação narrativa
  };

  // Impacto estimado
  impactoFinanceiro: {
    economiaEstimada?: number;
    reducaoRisco?: number;
    aumentoVendas?: number;
  };

  // Referências
  produto?: { codigo: string; nome: string };
  loja?: { id: string; nome: string };
  categoria?: string;
}

// Exemplo de recomendação gerada:
const exemploRecomendacao: RecomendacaoInteligente = {
  id: 'rec_001',
  tipo: 'REDUZIR_PEDIDO',
  prioridade: 'high',

  titulo: 'Reduzir pedido de Mamão Formosa',
  descricao: 'Produto com excesso de estoque e alta taxa de perda por vencimento.',
  acaoSugerida: 'Reduzir próximo pedido em 40% (de 100 para 60 unidades)',

  justificativa: {
    metricas: {
      coberturaDias: 78,
      giro: 0.3,
      taxaPerda: 6.2,
      margemProduto: 12.5
    },
    comparativos: {
      vsMediaCategoria: 2.1, // 2.1x acima da média de cobertura
      vsMediaRede: 1.8,
      vsPeriodoAnterior: 15 // 15% mais perda que mês anterior
    },
    contexto: 'Produto com 78 dias de cobertura (ideal: 7-14 dias), giro baixo (0.3x), ' +
              'taxa de perda de 6.2% por vencimento (3x acima da meta), margem de 12.5%. ' +
              'Risco financeiro alto. Estoque atual representa R$ 2.340 em capital parado.'
  },

  impactoFinanceiro: {
    economiaEstimada: 1404, // 60% do capital parado recuperado
    reducaoRisco: 936       // Redução de 40% na perda projetada
  },

  produto: { codigo: '7891234567890', nome: 'Mamão Formosa' },
  loja: { id: 'loja_12', nome: 'Loja Centro' },
  categoria: 'Hortifruti'
};
```

### 4.2 Gerador de Recomendações Baseado em Regras de Varejo

```typescript
// lib/services/gerador-recomendacoes.service.ts

const REGRAS_RECOMENDACAO = [
  {
    id: 'COBERTURA_ALTA_PERDA_ALTA',
    tipo: 'REDUZIR_PEDIDO',
    condicao: (m: MetricasProduto) => m.coberturaDias > 30 && m.taxaPerda > 3,
    prioridade: (m: MetricasProduto) => m.coberturaDias > 60 ? 'critical' : 'high',
    gerarJustificativa: (m: MetricasProduto) => ({
      contexto: `Cobertura de ${m.coberturaDias} dias com ${m.taxaPerda.toFixed(1)}% de perda. ` +
                `Capital parado: ${formatCurrency(m.valorEstoque)}.`,
      acaoSugerida: `Reduzir pedido em ${Math.min(60, m.coberturaDias - 14)}%`
    })
  },
  {
    id: 'RUPTURA_FREQUENTE_MARGEM_ALTA',
    tipo: 'AUMENTAR_PEDIDO',
    condicao: (m: MetricasProduto) => m.frequenciaRuptura > 3 && m.margem > 25,
    prioridade: () => 'critical',
    gerarJustificativa: (m: MetricasProduto) => ({
      contexto: `Produto com ruptura ${m.frequenciaRuptura}x/semana e margem de ${m.margem.toFixed(1)}%. ` +
                `Vendas perdidas estimadas: ${formatCurrency(m.vendasPerdidas)}.`,
      acaoSugerida: `Aumentar estoque de segurança em 50%`
    })
  },
  {
    id: 'PROMOCAO_MARGEM_NEGATIVA',
    tipo: 'REVISAR_PROMOCAO',
    condicao: (m: MetricasProduto) => m.percentualPromocao > 50 && m.margemEfetiva < 5,
    prioridade: () => 'high',
    gerarJustificativa: (m: MetricasProduto) => ({
      contexto: `${m.percentualPromocao.toFixed(0)}% das vendas em promoção com margem efetiva de apenas ` +
                `${m.margemEfetiva.toFixed(1)}%. Margem pré-promoção era ${m.margemOriginal.toFixed(1)}%.`,
      acaoSugerida: `Revisar política promocional - margem mínima sugerida: 15%`
    })
  },
  {
    id: 'ESTOQUE_MORTO',
    tipo: 'LIQUIDAR_ESTOQUE',
    condicao: (m: MetricasProduto) => m.diasSemVenda > 90,
    prioridade: () => 'medium',
    gerarJustificativa: (m: MetricasProduto) => ({
      contexto: `Sem venda há ${m.diasSemVenda} dias. Capital imobilizado: ${formatCurrency(m.valorEstoque)}.`,
      acaoSugerida: `Criar ação de liquidação ou transferir para loja com demanda`
    })
  },
  {
    id: 'FORNECEDOR_ALTO_RISCO',
    tipo: 'REVISAR_FORNECEDOR',
    condicao: (m: MetricasFornecedor) => m.taxaPerdaMedia > 5 && m.qtdProdutos > 10,
    prioridade: () => 'high',
    gerarJustificativa: (m: MetricasFornecedor) => ({
      contexto: `Fornecedor ${m.nome} com taxa de perda média de ${m.taxaPerdaMedia.toFixed(1)}% ` +
                `em ${m.qtdProdutos} produtos. Perda total: ${formatCurrency(m.perdaTotal)}.`,
      acaoSugerida: `Agendar reunião com fornecedor para revisão de qualidade/validade`
    })
  }
];
```

---

## FASE 5: Assistente Inteligente (LLM)

### 5.1 Integração com Claude API

```typescript
// lib/services/assistente-llm.service.ts

import Anthropic from '@anthropic-ai/sdk';

export class AssistenteLLMService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  // ============================================
  // NARRATIVA EXECUTIVA AUTOMÁTICA
  // ============================================

  async gerarNarrativaExecutiva(
    metricas: DashboardExecutivo,
    periodo: { inicio: Date; fim: Date }
  ): Promise<string> {

    const prompt = `
Você é um analista de BI especializado em varejo supermercadista.
Analise os dados abaixo e gere uma narrativa executiva clara e acionável.

## Período Analisado
De ${format(periodo.inicio, 'dd/MM/yyyy')} a ${format(periodo.fim, 'dd/MM/yyyy')}

## Métricas Principais
- Faturamento: ${formatCurrency(metricas.kpis.faturamentoTotal)}
- Margem Média: ${metricas.kpis.margemMedia.toFixed(1)}%
- Perda sobre Faturamento: ${metricas.kpis.perdaSobreFaturamento.toFixed(2)}%
- Taxa de Disponibilidade: ${metricas.kpis.taxaDisponibilidade.toFixed(1)}%
- RFE Total: ${formatCurrency(metricas.kpis.rfeTotal)}

## Composição de Perdas
${JSON.stringify(metricas.perdas.perdaPorTipo, null, 2)}

## Top 5 Lojas por RFE (Maior Risco)
${metricas.rankingLojasPorRFE.slice(0, 5).map(l =>
  `- ${l.loja}: RFE ${formatCurrency(l.rfe)} - ${l.principalProblema}`
).join('\n')}

## Alertas Críticos
${metricas.alertas.filter(a => a.severidade === 'critical').map(a =>
  `- ${a.mensagem}`
).join('\n')}

Gere uma análise executiva de 3-4 parágrafos com:
1. Visão geral do período (destaques positivos e negativos)
2. Principais pontos de atenção com números específicos
3. Recomendações prioritárias de ação
4. Projeção de impacto se as ações forem tomadas

Use linguagem profissional e direta. Inclua valores monetários e percentuais.
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }

  // ============================================
  // PERGUNTA NATURAL
  // ============================================

  async responderPergunta(
    pergunta: string,
    contexto: DashboardExecutivo
  ): Promise<string> {

    const systemPrompt = `
Você é um assistente de BI para gestão de varejo supermercadista.
Você tem acesso aos seguintes dados consolidados da rede:

${JSON.stringify(contexto, null, 2)}

Responda perguntas sobre:
- Performance de lojas
- Análise de perdas
- Gestão de estoque
- Rupturas e disponibilidade
- Recomendações de ação

Seja conciso, use dados específicos e forneça insights acionáveis.
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: pergunta }]
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }

  // ============================================
  // JUSTIFICATIVA DE RECOMENDAÇÃO
  // ============================================

  async gerarJustificativaRecomendacao(
    recomendacao: RecomendacaoInteligente
  ): Promise<string> {

    const prompt = `
Gere uma justificativa executiva para a seguinte recomendação de gestão de estoque:

Tipo: ${recomendacao.tipo}
Produto: ${recomendacao.produto?.nome}
Loja: ${recomendacao.loja?.nome}

Métricas do produto:
- Cobertura: ${recomendacao.justificativa.metricas.coberturaDias} dias
- Giro: ${recomendacao.justificativa.metricas.giro}x
- Taxa de Perda: ${recomendacao.justificativa.metricas.taxaPerda}%
- Margem: ${recomendacao.justificativa.metricas.margemProduto}%

Comparativos:
- vs Média da Categoria: ${recomendacao.justificativa.comparativos.vsMediaCategoria}x
- vs Período Anterior: ${recomendacao.justificativa.comparativos.vsPeriodoAnterior}%

Impacto Estimado:
- Economia: ${formatCurrency(recomendacao.impactoFinanceiro.economiaEstimada || 0)}
- Redução de Risco: ${formatCurrency(recomendacao.impactoFinanceiro.reducaoRisco || 0)}

Gere uma justificativa em 2-3 frases que explique:
1. O problema identificado com números
2. Por que a ação é necessária
3. O benefício esperado

Exemplo de tom:
"Produto com 78 dias de cobertura, giro baixo (0.3), perda 6%, margem 12%. Risco financeiro alto."
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }
}
```

### 5.2 Componente de Chat (/inteligencia/assistente)

```tsx
// app/inteligencia/assistente/page.tsx

export default function AssistenteInteligente() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const perguntasSugeridas = [
    'Qual loja tem maior risco financeiro?',
    'Quais produtos devo reduzir pedido?',
    'Onde estou perdendo mais margem?',
    'Qual a tendência de perdas por vencimento?',
    'Quais fornecedores têm maior taxa de perda?',
    'Resumo executivo do último mês'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <PageHeader
        icon={MessageSquare}
        title="Assistente de Gestão"
        subtitle="Pergunte sobre seu negócio em linguagem natural"
      />

      {/* Sugestões */}
      <div className="flex flex-wrap gap-2 mb-4">
        {perguntasSugeridas.map((sugestao, i) => (
          <Button
            key={i}
            variant="ghost"
            size="sm"
            onClick={() => handlePergunta(sugestao)}
          >
            {sugestao}
          </Button>
        ))}
      </div>

      {/* Histórico de mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {mensagens.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'p-4 rounded-lg max-w-[80%]',
              msg.tipo === 'usuario'
                ? 'ml-auto bg-primary-100'
                : 'bg-gray-100'
            )}
          >
            <p className="whitespace-pre-wrap">{msg.conteudo}</p>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-text-secondary">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Analisando dados...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePergunta(pergunta)}
          placeholder="Faça uma pergunta sobre seu negócio..."
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <Button onClick={() => handlePergunta(pergunta)} disabled={isLoading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## FASE 6: Sistema de Importação Multi-Relatório

### 6.1 Atualização do Importador

```typescript
// app/inteligencia/importar/page.tsx

const TIPOS_RELATORIO = [
  {
    id: 'estoque',
    nome: 'ABC de Estoque',
    arquivo: 'Analise ABC do Estoque.csv',
    colunas: ['CODIGO', 'DESCCOMPLETA', 'QUANTIDADE_ESTOQUE', ...],
    tabela: 'fato_estoque'
  },
  {
    id: 'vendas',
    nome: 'ABC de Vendas',
    arquivo: 'Analise ABC Venda Varejo.csv',
    colunas: ['CODIGO', 'VENDA_QUANTIDADE', 'VENDA_VALOR', ...],
    tabela: 'fato_vendas'
  },
  {
    id: 'perdas',
    nome: 'ABC de Perdas',
    arquivo: 'Analise ABC de Perdas.csv',
    colunas: ['CODIGO', 'QUANTIDADE_PERDA', 'TOT_PERDA_LIQUIDO', ...],
    tabela: 'fato_perdas'
  },
  {
    id: 'rupturas',
    nome: 'ABC de Rupturas',
    arquivo: 'Analise ABC de Rupturas.csv',
    colunas: ['CODIGO', 'VDA_PERDIDA_QUANTIDADE', 'VDA_PERDIDA_VALOR', ...],
    tabela: 'fato_rupturas'
  }
];

export default function ImportarRelatorios() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Upload}
        title="Importação de Relatórios"
        subtitle="Importe dados diários por loja para análise consolidada"
      />

      {/* Seleção de Loja e Data */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectLoja value={lojaId} onChange={setLojaId} />
          <DatePicker value={dataReferencia} onChange={setDataReferencia} />
          <div className="flex items-end">
            <Badge variant="info">
              Importação para: {lojaId ? lojaNome : 'Selecione'} - {format(dataReferencia, 'dd/MM/yyyy')}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Upload por tipo de relatório */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TIPOS_RELATORIO.map((tipo) => (
          <Card key={tipo.id}>
            <CardHeader>{tipo.nome}</CardHeader>
            <FileUploadZone
              tipo={tipo.id}
              onFileSelect={(file) => handleFileSelect(tipo.id, file)}
              status={uploadStatus[tipo.id]}
            />
            {previews[tipo.id] && (
              <PreviewTable data={previews[tipo.id]} />
            )}
          </Card>
        ))}
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-4">
        <Button variant="ghost" onClick={handleLimpar}>
          Limpar
        </Button>
        <Button
          onClick={handleImportar}
          disabled={!canImport}
          loading={isImporting}
        >
          Importar Todos
        </Button>
      </div>

      {/* Resultado */}
      {resultado && (
        <Card>
          <CardHeader icon={CheckCircle}>Importação Concluída</CardHeader>
          <ImportResultSummary resultado={resultado} />

          {/* Trigger de cálculo de métricas */}
          <div className="mt-4 pt-4 border-t">
            <Button onClick={handleCalcularMetricas}>
              Recalcular Métricas Consolidadas
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
```

---

## Resumo da Implementação

### Arquivos a Criar

```
Banco de Dados (Supabase):
├── migrations/
│   ├── 001_create_dimensions.sql
│   ├── 002_create_facts.sql
│   ├── 003_create_aggregations.sql
│   ├── 004_create_functions.sql
│   └── 005_create_indexes.sql

APIs (Next.js):
├── app/api/
│   ├── relatorios/
│   │   ├── importar/
│   │   │   ├── estoque/route.ts
│   │   │   ├── vendas/route.ts
│   │   │   ├── perdas/route.ts
│   │   │   └── rupturas/route.ts
│   │   ├── metricas/
│   │   │   ├── estoque/route.ts
│   │   │   ├── perdas/route.ts
│   │   │   ├── rupturas/route.ts
│   │   │   ├── vendas/route.ts
│   │   │   └── rfe/route.ts
│   │   └── consolidado/
│   │       ├── loja/[id]/route.ts
│   │       ├── rede/route.ts
│   │       └── comparativo/route.ts
│   └── assistente/
│       └── chat/route.ts

Services:
├── lib/services/
│   ├── metricas-varejo.service.ts
│   ├── importacao-relatorios.service.ts
│   ├── gerador-recomendacoes.service.ts
│   ├── calculador-rfe.service.ts
│   └── assistente-llm.service.ts

Types:
├── lib/types/
│   └── metricas-varejo.ts

Pages:
├── app/inteligencia/
│   ├── executivo/page.tsx
│   ├── estoque/page.tsx
│   ├── perdas/page.tsx
│   ├── rupturas/page.tsx
│   ├── vendas/page.tsx
│   ├── rfe/page.tsx
│   └── assistente/page.tsx

Components:
├── components/
│   ├── dashboards/
│   │   ├── KPICardExecutivo.tsx
│   │   ├── RFERankingTable.tsx
│   │   ├── RFEHeatmap.tsx
│   │   └── NarrativaExecutiva.tsx
│   ├── charts/
│   │   ├── CoberturaHeatmap.tsx
│   │   ├── EstoqueTreemap.tsx
│   │   ├── CurvaABCChart.tsx
│   │   ├── TendenciaPerdaChart.tsx
│   │   └── PerdaPorTipoPieChart.tsx
│   └── importacao/
│       ├── FileUploadZone.tsx
│       └── ImportResultSummary.tsx
```

### Ordem de Implementação

1. **Fase 1**: Modelagem de dados (SQL migrations)
2. **Fase 2**: APIs de importação e métricas
3. **Fase 3**: Services de cálculo
4. **Fase 4**: Dashboards de UI
5. **Fase 5**: Motor de recomendações aprimorado
6. **Fase 6**: Integração com LLM

---

Deseja que eu comece a implementação? Posso iniciar pela Fase 1 (modelagem de dados) ou por qualquer outra fase que preferir.
