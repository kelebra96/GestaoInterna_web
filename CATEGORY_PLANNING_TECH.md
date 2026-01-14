# PLANEJAMENTO DE CATEGORIA - DOCUMENTAÇÃO TÉCNICA

## 📁 ESTRUTURA DE ARQUIVOS

```
web/
├── lib/
│   ├── types/
│   │   └── category-planning.ts          # Tipos TypeScript
│   └── services/
│       └── category-analysis.service.ts   # Serviço de análise
│
├── app/
│   └── api/
│       └── category-planning/
│           ├── import/
│           │   └── route.ts               # API de importação
│           └── analyze/
│               └── route.ts               # API de análise
│
├── components/
│   └── category-planning/
│       ├── DataUploader.tsx               # Upload de dados
│       └── CategoryAnalysisView.tsx       # Visualização de análise
│
└── app/
    └── planogramas/
        └── templates/
            └── [id]/
                └── planejamento/
                    └── page.tsx           # Página principal
```

---

## 🏗️ ARQUITETURA

### Fluxo de Dados

```
┌─────────────┐
│  Frontend   │
│   Upload    │
└──────┬──────┘
       │
       v
┌─────────────────────┐
│  API Import         │
│  /api/category-     │
│  planning/import    │
└──────┬──────────────┘
       │
       v
┌─────────────────────┐
│  Validação          │
│  - Campos obrig.    │
│  - Tipos corretos   │
└──────┬──────────────┘
       │
       v
┌─────────────────────┐
│  API Analyze        │
│  /api/category-     │
│  planning/analyze   │
└──────┬──────────────┘
       │
       v
┌─────────────────────┐
│  CategoryAnalysis   │
│  Service            │
│  - Curva ABC        │
│  - Facings          │
│  - Layout           │
│  - Otimizações      │
└──────┬──────────────┘
       │
       v
┌─────────────────────┐
│  Frontend           │
│  CategoryAnalysis   │
│  View               │
└─────────────────────┘
```

---

## 📦 TIPOS E INTERFACES

### `ProductSalesData`
Dados de entrada de cada produto.

```typescript
interface ProductSalesData {
  // Obrigatórios
  productId: string;
  salesVolume: number;
  salesRevenue: number;
  profitMargin: number;

  // Opcionais
  productName?: string;
  ean?: string;
  seasonalityIndex?: number;
  seasonalPeaks?: string[];
  width?: number;
  height?: number;
  depth?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
}
```

### `ProductAnalysisResult`
Resultado da análise de cada produto.

```typescript
interface ProductAnalysisResult extends ProductSalesData {
  // Métricas calculadas
  salesPercentage: number;
  revenuePercentage: number;
  profitContribution: number;

  // Classificação
  classification: 'A' | 'B' | 'C';
  priority: 'high' | 'medium' | 'low';

  // Recomendações
  recommendedFacings: number;
  recommendedShelfSpace: number;
  recommendedPosition: {
    level: 'eye' | 'top' | 'middle' | 'bottom';
    sequence: number;
  };
}
```

### `CategoryAnalysis`
Resultado completo da análise.

```typescript
interface CategoryAnalysis {
  totalSalesVolume: number;
  totalSalesRevenue: number;
  totalProducts: number;
  products: ProductAnalysisResult[];
  recommendations: CategoryRecommendations;
  analyzedAt: Date;
  period?: {
    start: Date;
    end: Date;
  };
}
```

---

## 🔧 ALGORITMOS

### 1. Classificação ABC

```typescript
private applyABCClassification(products: ProductAnalysisResult[]): ProductAnalysisResult[] {
  let cumulativePercentage = 0;

  return products.map((product) => {
    cumulativePercentage += product.salesPercentage;

    let classification: 'A' | 'B' | 'C';
    if (cumulativePercentage <= 80) {        // Classe A: até 80%
      classification = 'A';
    } else if (cumulativePercentage <= 95) {  // Classe B: 80-95%
      classification = 'B';
    } else {                                   // Classe C: 95-100%
      classification = 'C';
    }

    return { ...product, classification };
  });
}
```

**Base teórica**: Princípio de Pareto (regra 80/20)

### 2. Cálculo de Facings

```typescript
private calculateRecommendedFacings(
  salesPercentage: number,
  profitMargin: number,
  seasonalityIndex: number
): number {
  // Score base (0-100)
  let baseScore = salesPercentage * 0.6 + profitMargin * 0.4;

  // Ajuste por sazonalidade
  baseScore *= seasonalityIndex;

  // Converter para facings (1-12)
  let facings = Math.round((baseScore / 100) * 12);
  facings = Math.max(1, Math.min(12, facings));

  return facings;
}
```

**Fórmula**:
```
facings = round(((salesPct * 0.6 + margin * 0.4) * seasonality / 100) * 12)
```

### 3. Estratégia de Layout

```typescript
private determineLayoutStrategy(
  products: ProductAnalysisResult[]
): 'vertical' | 'horizontal' | 'by_margin' | 'by_sales' | 'mixed' {
  // Calcular coeficiente de variação
  const marginVariation = this.calculateVariation(products.map(p => p.profitMargin));
  const salesVariation = this.calculateVariation(products.map(p => p.salesPercentage));

  if (config.prioritizeMargin && marginVariation > 0.3) {
    return 'by_margin';
  }

  if (salesVariation > 0.4) {
    return 'by_sales';
  }

  return 'mixed';
}
```

**Coeficiente de Variação**:
```
CV = σ / μ
onde:
  σ = desvio padrão
  μ = média
```

### 4. Posicionamento nas Prateleiras

```typescript
private assignShelfPositions(
  products: ProductAnalysisResult[],
  strategy: string
): ProductAnalysisResult[] {
  // Ordenar baseado na estratégia
  const sorted = [...products].sort((a, b) => {
    if (strategy === 'by_margin') return b.profitMargin - a.profitMargin;
    if (strategy === 'by_sales') return b.salesVolume - a.salesVolume;
    // mixed
    const scoreA = a.salesPercentage * 0.5 + a.profitMargin * 0.5;
    const scoreB = b.salesPercentage * 0.5 + b.profitMargin * 0.5;
    return scoreB - scoreA;
  });

  // Distribuir por nível
  const eyeLevelCount = Math.floor(sorted.length * 0.3);  // 30% no nível dos olhos
  const middleCount = Math.floor(sorted.length * 0.3);    // 30% no meio

  return sorted.map((product, index) => {
    let level: 'eye' | 'top' | 'middle' | 'bottom';

    if (index < eyeLevelCount) {
      level = 'eye';
    } else if (index < eyeLevelCount + middleCount) {
      level = 'middle';
    } else if (index % 2 === 0) {
      level = 'top';
    } else {
      level = 'bottom';
    }

    return {
      ...product,
      recommendedPosition: { level, sequence: index + 1 }
    };
  });
}
```

---

## 🔌 API ENDPOINTS

### POST `/api/category-planning/import`

Importa dados de vendas.

**Request Body**:
```json
{
  "format": "csv" | "json" | "xlsx",
  "data": "string" | Array<ProductSalesData>,
  "templateId": "string" (opcional)
}
```

**Response**:
```json
{
  "success": true,
  "recordsImported": 150,
  "errors": ["Linha 5: salesVolume inválido"],
  "preview": [...],  // Primeiros 5 produtos
  "data": [...]      // Todos os produtos validados
}
```

**Validações**:
- `productId`: Não vazio
- `salesVolume`: >= 0
- `salesRevenue`: >= 0
- `profitMargin`: 0 <= x <= 100
- `seasonalityIndex`: >= 0 (se fornecido)
- `width/height/depth`: > 0 (se fornecidos)

### POST `/api/category-planning/analyze`

Analisa categoria e retorna recomendações.

**Request Body**:
```json
{
  "products": Array<ProductSalesData>,
  "config": {
    "abcCurveThresholds": {
      "classA": 80,
      "classB": 95
    },
    "facingsRules": {
      "minFacings": 1,
      "maxFacings": 12,
      "baseCalculation": "mixed"
    },
    "layoutPreferences": {
      "prioritizeMargin": false,
      "considerSeasonality": true,
      "eyeLevelReservedFor": "mixed"
    },
    "availableSpace": {
      "totalWidth": 120,
      "shelfLevels": 4,
      "averageDepth": 40
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "totalSalesVolume": 10000,
    "totalSalesRevenue": 35000.00,
    "totalProducts": 25,
    "products": [...],
    "recommendations": {
      "layoutStrategy": "mixed",
      "layoutJustification": "...",
      "spaceAllocation": [...],
      "optimizations": [...],
      "expectedMetrics": {
        "totalSpaceUtilization": 95.5,
        "averageSalesPerFacing": 250,
        "totalProfitPotential": 12000.00
      }
    },
    "analyzedAt": "2025-01-21T10:00:00Z"
  }
}
```

### GET `/api/category-planning/import`

Retorna templates e documentação.

**Response**:
```json
{
  "documentation": {...},
  "templates": {
    "csv": "productId,productName,...",
    "json": [...]
  }
}
```

---

## 🧪 TESTES

### Teste de Importação CSV

```typescript
const csvData = `productId,salesVolume,salesRevenue,profitMargin
PROD001,1500,4500.00,35.5
PROD002,1200,3300.00,32.0`;

const response = await fetch('/api/category-planning/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ format: 'csv', data: csvData })
});

const result = await response.json();
expect(result.recordsImported).toBe(2);
```

### Teste de Análise

```typescript
const products = [
  { productId: 'A', salesVolume: 1000, salesRevenue: 3000, profitMargin: 30 },
  { productId: 'B', salesVolume: 500, salesRevenue: 1500, profitMargin: 25 },
];

const response = await fetch('/api/category-planning/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ products })
});

const result = await response.json();
expect(result.analysis.products[0].classification).toBe('A');
```

---

## 🔐 SEGURANÇA

### Validação de Entrada
- Todos os campos são validados antes do processamento
- Limites de tamanho de arquivo (10MB)
- Sanitização de strings

### Autenticação
- Todas as rotas requerem autenticação Firebase
- Token validado via `Authorization: Bearer ${token}`

### Rate Limiting
- Implementar limite de requisições por usuário
- Recomendado: 10 análises por minuto

---

## 📊 PERFORMANCE

### Otimizações Implementadas

1. **Processamento em Memória**
   - CSV parseado diretamente (sem libs externas)
   - Análise em O(n log n) devido à ordenação

2. **Caching**
   - Considerar cache de análises por hash de dados
   - TTL recomendado: 1 hora

3. **Limites**
   - Máximo de 1000 produtos por análise
   - Timeout de 30 segundos

### Complexidade Algorítmica

| Operação | Complexidade | Notas |
|----------|--------------|-------|
| Importação CSV | O(n) | Linear no número de linhas |
| Validação | O(n) | Uma passagem por produto |
| Análise individual | O(n) | Cálculos por produto |
| Curva ABC | O(n log n) | Devido à ordenação |
| Posicionamento | O(n log n) | Devido à ordenação |
| Total | O(n log n) | Dominado pela ordenação |

---

## 🚀 DEPLOY

### Variáveis de Ambiente

Nenhuma variável específica necessária. Usa configurações do Firebase existentes.

### Build

```bash
cd web
npm install
npm run build
```

### Dependências Adicionadas

Nenhuma! A implementação usa apenas:
- TypeScript (tipos)
- Next.js (API routes)
- React (componentes)

---

## 🔄 FUTURAS MELHORIAS

### Curto Prazo
1. ✅ Suporte completo a XLSX (usando biblioteca `xlsx`)
2. ✅ Aplicação automática de recomendações ao template
3. ✅ Exportar análise em PDF

### Médio Prazo
4. ⬜ Integração com APIs externas de vendas (ERP, CRM)
5. ⬜ Machine Learning para predição de vendas
6. ⬜ Análise histórica de performance de planogramas
7. ⬜ A/B testing de layouts

### Longo Prazo
8. ⬜ Otimização multi-objetivo (vendas + margem + sustentabilidade)
9. ⬜ Simulação 3D de planogramas
10. ⬜ Recomendações baseadas em IoT (sensores de prateleira)

---

## 📚 REFERÊNCIAS

### Artigos Acadêmicos
- Curran, R. (2003). "Retail Space Management: A Fresh Approach"
- Cox, K. (1970). "The Effect of Shelf Space upon Sales of Branded Products"

### Metodologias
- Princípio de Pareto (Curva ABC)
- Category Management Best Practices
- Planogram Optimization Techniques

### Ferramentas de Mercado
- Nielsen Spaceman
- JDA Space Planning
- Shelf Logic

---

## 🤝 CONTRIBUINDO

Para adicionar novas funcionalidades:

1. Adicionar tipos em `lib/types/category-planning.ts`
2. Implementar lógica em `lib/services/category-analysis.service.ts`
3. Criar/atualizar API routes em `app/api/category-planning/`
4. Atualizar componentes em `components/category-planning/`
5. Documentar mudanças neste arquivo

---

## 📞 CONTATO

Para questões técnicas ou bugs:
- Criar issue no repositório
- Contatar equipe de desenvolvimento

---

**Última atualização**: 2025-01-21
**Versão**: 1.0
**Autor**: Sistema de Planejamento de Categoria
