// Tipos para Planejamento de Categoria

export interface ProductSalesData {
  productId: string;
  productName?: string;
  ean?: string;

  // Dados de vendas
  salesVolume: number; // Volume de vendas em unidades
  salesRevenue: number; // Receita em valor monetário
  salesPercentage?: number; // % de vendas (calculado)

  // Margem
  profitMargin: number; // Margem de lucro em %
  profitValue?: number; // Valor de lucro (calculado)

  // Sazonalidade
  seasonalityIndex?: number; // Índice de sazonalidade (1.0 = normal)
  seasonalPeaks?: string[]; // Meses de pico (ex: ["12", "01"])

  // Dimensões do produto
  width?: number; // Largura em cm
  height?: number; // Altura em cm
  depth?: number; // Profundidade em cm

  // Metadados
  category?: string;
  subcategory?: string;
  brand?: string;
}

export interface CategoryAnalysis {
  // Análise de vendas
  totalSalesVolume: number;
  totalSalesRevenue: number;
  totalProducts: number;

  // Produtos analisados
  products: ProductAnalysisResult[];

  // Recomendações gerais
  recommendations: CategoryRecommendations;

  // Metadados
  analyzedAt: Date;
  period?: {
    start: Date;
    end: Date;
  };
}

export interface ProductAnalysisResult extends ProductSalesData {
  // Métricas calculadas
  salesPercentage: number; // % de vendas do total
  revenuePercentage: number; // % de receita do total
  profitContribution: number; // Contribuição para lucro total (%)

  // Classificação
  classification: 'A' | 'B' | 'C'; // Curva ABC
  priority: 'high' | 'medium' | 'low';

  // Recomendações individuais
  recommendedFacings: number;
  recommendedShelfSpace: number; // em cm
  recommendedPosition: {
    level: 'eye' | 'top' | 'middle' | 'bottom';
    sequence: number; // Ordem de exibição
  };
}

export interface CategoryRecommendations {
  // Layout sugerido
  layoutStrategy: 'vertical' | 'horizontal' | 'by_margin' | 'by_sales' | 'mixed';
  layoutJustification: string;

  // Distribuição de espaço
  spaceAllocation: {
    productId: string;
    recommendedFacings: number;
    spacePercentage: number;
    shelfLevel: 'eye' | 'top' | 'middle' | 'bottom';
  }[];

  // Otimizações
  optimizations: {
    type: 'increase_facings' | 'decrease_facings' | 'reposition' | 'remove' | 'add';
    productId: string;
    productName?: string;
    currentValue?: number;
    recommendedValue: number;
    reasoning: string;
    expectedImpact?: string;
  }[];

  // Métricas esperadas
  expectedMetrics: {
    totalSpaceUtilization: number; // % de espaço utilizado
    averageSalesPerFacing: number;
    totalProfitPotential: number;
  };
}

export interface CategoryPlanningConfig {
  // Configurações de análise
  abcCurveThresholds: {
    classA: number; // % acumulada para classe A (padrão: 80%)
    classB: number; // % acumulada para classe B (padrão: 95%)
  };

  // Regras de facings
  facingsRules: {
    minFacings: number; // Mínimo de facings por produto
    maxFacings: number; // Máximo de facings por produto
    baseCalculation: 'sales' | 'profit' | 'mixed'; // Base para cálculo
  };

  // Preferências de layout
  layoutPreferences: {
    prioritizeMargin: boolean; // Priorizar margem sobre vendas
    considerSeasonality: boolean; // Considerar sazonalidade
    eyeLevelReservedFor: 'high_margin' | 'high_sales' | 'mixed';
  };

  // Espaço disponível
  availableSpace: {
    totalWidth: number; // Largura total disponível em cm
    shelfLevels: number; // Número de prateleiras
    averageDepth: number; // Profundidade média em cm
  };
}

export interface ImportDataRequest {
  format: 'csv' | 'json' | 'xlsx';
  data: string | ProductSalesData[]; // String para CSV/Base64, array para JSON
  config?: Partial<CategoryPlanningConfig>;
}

export interface ImportDataResponse {
  success: boolean;
  recordsImported: number;
  errors?: string[];
  preview?: ProductSalesData[];
}

// Estrutura esperada para importação CSV
export const CSV_TEMPLATE = {
  headers: [
    'productId',      // Obrigatório
    'productName',    // Opcional
    'ean',           // Opcional
    'salesVolume',   // Obrigatório
    'salesRevenue',  // Obrigatório
    'profitMargin',  // Obrigatório (%)
    'seasonalityIndex', // Opcional (1.0 = normal)
    'width',         // Opcional (cm)
    'height',        // Opcional (cm)
    'depth',         // Opcional (cm)
    'category',      // Opcional
    'subcategory',   // Opcional
    'brand',         // Opcional
  ],
  example: [
    'PROD001,Coca-Cola 2L,7894900011517,1500,4500.00,35.5,1.2,12,30,8,Bebidas,Refrigerantes,Coca-Cola',
    'PROD002,Guaraná 2L,7891991010344,1200,3300.00,32.0,1.0,12,30,8,Bebidas,Refrigerantes,Ambev',
  ]
};

// Estrutura esperada para importação JSON
export const JSON_TEMPLATE: ProductSalesData = {
  productId: 'PROD001',
  productName: 'Coca-Cola 2L',
  ean: '7894900011517',
  salesVolume: 1500,
  salesRevenue: 4500.00,
  profitMargin: 35.5,
  seasonalityIndex: 1.2,
  seasonalPeaks: ['12', '01'],
  width: 12,
  height: 30,
  depth: 8,
  category: 'Bebidas',
  subcategory: 'Refrigerantes',
  brand: 'Coca-Cola',
};

// Estrutura para API externa
export interface ExternalAPIConfig {
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    credentials: string;
  };
  mapping: {
    productId: string;
    productName?: string;
    salesVolume: string;
    salesRevenue: string;
    profitMargin: string;
    // ... outros campos opcionais
  };
}
