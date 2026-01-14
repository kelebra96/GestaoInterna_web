import {
  ProductSalesData,
  CategoryAnalysis,
  ProductAnalysisResult,
  CategoryRecommendations,
  CategoryPlanningConfig,
} from '@/lib/types/category-planning';

// Configuração padrão
const DEFAULT_CONFIG: CategoryPlanningConfig = {
  abcCurveThresholds: {
    classA: 80,
    classB: 95,
  },
  facingsRules: {
    minFacings: 1,
    maxFacings: 12,
    baseCalculation: 'mixed',
  },
  layoutPreferences: {
    prioritizeMargin: false,
    considerSeasonality: true,
    eyeLevelReservedFor: 'mixed',
  },
  availableSpace: {
    totalWidth: 120, // 120cm padrão
    shelfLevels: 4,
    averageDepth: 40,
  },
};

export class CategoryAnalysisService {
  private config: CategoryPlanningConfig;

  constructor(config?: Partial<CategoryPlanningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analisa dados de categoria e retorna recomendações
   */
  public analyzeCategoryData(products: ProductSalesData[]): CategoryAnalysis {
    // Validar dados
    if (!products || products.length === 0) {
      throw new Error('Nenhum produto fornecido para análise');
    }

    // Calcular totais
    const totalSalesVolume = products.reduce((sum, p) => sum + p.salesVolume, 0);
    const totalSalesRevenue = products.reduce((sum, p) => sum + p.salesRevenue, 0);

    // Analisar cada produto
    const productsAnalysis = products.map((product) =>
      this.analyzeProduct(product, totalSalesVolume, totalSalesRevenue)
    );

    // Ordenar por vendas (decrescente) para curva ABC
    productsAnalysis.sort((a, b) => b.salesVolume - a.salesVolume);

    // Aplicar classificação ABC
    const productsWithABC = this.applyABCClassification(productsAnalysis);

    // Calcular recomendações
    const recommendations = this.generateRecommendations(productsWithABC);

    return {
      totalSalesVolume,
      totalSalesRevenue,
      totalProducts: products.length,
      products: productsWithABC,
      recommendations,
      analyzedAt: new Date(),
    };
  }

  /**
   * Analisa um produto individual
   */
  private analyzeProduct(
    product: ProductSalesData,
    totalSalesVolume: number,
    totalSalesRevenue: number
  ): ProductAnalysisResult {
    // Calcular percentuais
    const salesPercentage = (product.salesVolume / totalSalesVolume) * 100;
    const revenuePercentage = (product.salesRevenue / totalSalesRevenue) * 100;

    // Calcular contribuição para lucro
    const profitValue = product.salesRevenue * (product.profitMargin / 100);
    const totalProfit = totalSalesRevenue * 0.3; // Estimativa (será recalculado depois)
    const profitContribution = (profitValue / totalProfit) * 100;

    // Determinar prioridade inicial
    const priority = this.determinePriority(salesPercentage, product.profitMargin);

    // Calcular facings recomendados (inicial)
    const recommendedFacings = this.calculateRecommendedFacings(
      salesPercentage,
      product.profitMargin,
      product.seasonalityIndex || 1.0
    );

    // Calcular espaço recomendado
    const productWidth = product.width || 10; // 10cm padrão
    const recommendedShelfSpace = recommendedFacings * productWidth;

    return {
      ...product,
      salesPercentage,
      revenuePercentage,
      profitContribution,
      profitValue,
      classification: 'B', // Será atualizado na curva ABC
      priority,
      recommendedFacings,
      recommendedShelfSpace,
      recommendedPosition: {
        level: 'middle',
        sequence: 0,
      },
    };
  }

  /**
   * Aplica classificação ABC (Curva de Pareto)
   */
  private applyABCClassification(products: ProductAnalysisResult[]): ProductAnalysisResult[] {
    let cumulativePercentage = 0;

    return products.map((product) => {
      cumulativePercentage += product.salesPercentage;

      let classification: 'A' | 'B' | 'C';
      if (cumulativePercentage <= this.config.abcCurveThresholds.classA) {
        classification = 'A';
      } else if (cumulativePercentage <= this.config.abcCurveThresholds.classB) {
        classification = 'B';
      } else {
        classification = 'C';
      }

      return {
        ...product,
        classification,
      };
    });
  }

  /**
   * Determina prioridade do produto
   */
  private determinePriority(
    salesPercentage: number,
    profitMargin: number
  ): 'high' | 'medium' | 'low' {
    const score = this.config.layoutPreferences.prioritizeMargin
      ? profitMargin * 0.6 + salesPercentage * 0.4
      : salesPercentage * 0.6 + profitMargin * 0.4;

    if (score >= 30) return 'high';
    if (score >= 15) return 'medium';
    return 'low';
  }

  /**
   * Calcula número recomendado de facings
   */
  private calculateRecommendedFacings(
    salesPercentage: number,
    profitMargin: number,
    seasonalityIndex: number
  ): number {
    const { minFacings, maxFacings, baseCalculation } = this.config.facingsRules;

    let baseScore = 0;
    if (baseCalculation === 'sales') {
      baseScore = salesPercentage;
    } else if (baseCalculation === 'profit') {
      baseScore = profitMargin;
    } else {
      // mixed
      baseScore = salesPercentage * 0.6 + profitMargin * 0.4;
    }

    // Ajustar por sazonalidade
    if (this.config.layoutPreferences.considerSeasonality) {
      baseScore *= seasonalityIndex;
    }

    // Converter score para facings (1-12)
    let facings = Math.round((baseScore / 100) * maxFacings);
    facings = Math.max(minFacings, Math.min(maxFacings, facings));

    return facings;
  }

  /**
   * Gera recomendações de layout
   */
  private generateRecommendations(products: ProductAnalysisResult[]): CategoryRecommendations {
    // Determinar estratégia de layout
    const layoutStrategy = this.determineLayoutStrategy(products);

    // Posicionar produtos nas prateleiras
    const productsWithPositions = this.assignShelfPositions(products, layoutStrategy);

    // Calcular alocação de espaço
    const spaceAllocation = productsWithPositions.map((product) => ({
      productId: product.productId,
      recommendedFacings: product.recommendedFacings,
      spacePercentage: (product.recommendedShelfSpace / this.config.availableSpace.totalWidth) * 100,
      shelfLevel: product.recommendedPosition.level,
    }));

    // Gerar otimizações
    const optimizations = this.generateOptimizations(productsWithPositions);

    // Calcular métricas esperadas
    const totalSpaceUsed = productsWithPositions.reduce(
      (sum, p) => sum + p.recommendedShelfSpace,
      0
    );
    const totalSpaceUtilization = (totalSpaceUsed / this.config.availableSpace.totalWidth) * 100;

    const totalFacings = productsWithPositions.reduce(
      (sum, p) => sum + p.recommendedFacings,
      0
    );
    const averageSalesPerFacing =
      productsWithPositions.reduce((sum, p) => sum + p.salesVolume, 0) / totalFacings;

    const totalProfitPotential = productsWithPositions.reduce(
      (sum, p) => sum + (p.profitValue || 0),
      0
    );

    return {
      layoutStrategy,
      layoutJustification: this.getLayoutJustification(layoutStrategy, products),
      spaceAllocation,
      optimizations,
      expectedMetrics: {
        totalSpaceUtilization,
        averageSalesPerFacing,
        totalProfitPotential,
      },
    };
  }

  /**
   * Determina estratégia de layout
   */
  private determineLayoutStrategy(
    products: ProductAnalysisResult[]
  ): 'vertical' | 'horizontal' | 'by_margin' | 'by_sales' | 'mixed' {
    const { prioritizeMargin, eyeLevelReservedFor } = this.config.layoutPreferences;

    // Análise de variação
    const marginVariation = this.calculateVariation(products.map(p => p.profitMargin));
    const salesVariation = this.calculateVariation(products.map(p => p.salesPercentage));

    if (prioritizeMargin && marginVariation > 0.3) {
      return 'by_margin';
    }

    if (salesVariation > 0.4) {
      return 'by_sales';
    }

    if (eyeLevelReservedFor === 'mixed') {
      return 'mixed';
    }

    // Padrão: horizontal (por categoria)
    return 'horizontal';
  }

  /**
   * Calcula coeficiente de variação
   */
  private calculateVariation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean === 0 ? 0 : stdDev / mean;
  }

  /**
   * Atribui posições nas prateleiras
   */
  private assignShelfPositions(
    products: ProductAnalysisResult[],
    strategy: string
  ): ProductAnalysisResult[] {
    const positioned = [...products];

    // Ordenar baseado na estratégia
    if (strategy === 'by_margin') {
      positioned.sort((a, b) => b.profitMargin - a.profitMargin);
    } else if (strategy === 'by_sales') {
      positioned.sort((a, b) => b.salesVolume - a.salesVolume);
    } else if (strategy === 'mixed') {
      positioned.sort((a, b) => {
        const scoreA = a.salesPercentage * 0.5 + a.profitMargin * 0.5;
        const scoreB = b.salesPercentage * 0.5 + b.profitMargin * 0.5;
        return scoreB - scoreA;
      });
    }

    // Distribuir produtos por nível de prateleira
    const eyeLevelProducts = Math.floor(positioned.length * 0.3);
    const middleProducts = Math.floor(positioned.length * 0.3);

    return positioned.map((product, index) => {
      let level: 'eye' | 'top' | 'middle' | 'bottom';

      if (index < eyeLevelProducts) {
        level = 'eye'; // Produtos mais importantes no nível dos olhos
      } else if (index < eyeLevelProducts + middleProducts) {
        level = 'middle';
      } else if (index % 2 === 0) {
        level = 'top';
      } else {
        level = 'bottom';
      }

      return {
        ...product,
        recommendedPosition: {
          level,
          sequence: index + 1,
        },
      };
    });
  }

  /**
   * Gera otimizações específicas
   */
  private generateOptimizations(products: ProductAnalysisResult[]): CategoryRecommendations['optimizations'] {
    const optimizations: CategoryRecommendations['optimizations'] = [];

    products.forEach((product) => {
      // Aumentar facings para produtos classe A com alto giro
      if (product.classification === 'A' && product.recommendedFacings < 4) {
        optimizations.push({
          type: 'increase_facings',
          productId: product.productId,
          productName: product.productName,
          currentValue: product.recommendedFacings,
          recommendedValue: Math.min(6, product.recommendedFacings + 2),
          reasoning: 'Produto classe A com alto volume de vendas merece mais visibilidade',
          expectedImpact: 'Aumento de 15-20% nas vendas',
        });
      }

      // Reposicionar produtos classe A que não estão no nível dos olhos
      if (product.classification === 'A' && product.recommendedPosition.level !== 'eye') {
        optimizations.push({
          type: 'reposition',
          productId: product.productId,
          productName: product.productName,
          recommendedValue: 0,
          reasoning: 'Produto classe A deve estar no nível dos olhos para maximizar vendas',
          expectedImpact: 'Aumento de 10-15% nas vendas',
        });
      }

      // Reduzir facings para produtos classe C com baixo giro
      if (product.classification === 'C' && product.recommendedFacings > 2) {
        optimizations.push({
          type: 'decrease_facings',
          productId: product.productId,
          productName: product.productName,
          currentValue: product.recommendedFacings,
          recommendedValue: 1,
          reasoning: 'Produto classe C com baixo giro está ocupando espaço demais',
          expectedImpact: 'Liberação de espaço para produtos mais rentáveis',
        });
      }

      // Considerar sazonalidade
      if (product.seasonalityIndex && product.seasonalityIndex > 1.5) {
        optimizations.push({
          type: 'increase_facings',
          productId: product.productId,
          productName: product.productName,
          currentValue: product.recommendedFacings,
          recommendedValue: Math.min(12, Math.round(product.recommendedFacings * 1.5)),
          reasoning: 'Produto está em período de alta sazonalidade',
          expectedImpact: 'Evitar rupturas durante pico de demanda',
        });
      }
    });

    return optimizations;
  }

  /**
   * Retorna justificativa para estratégia de layout
   */
  private getLayoutJustification(
    strategy: string,
    products: ProductAnalysisResult[]
  ): string {
    const classACount = products.filter(p => p.classification === 'A').length;
    const avgMargin = products.reduce((sum, p) => sum + p.profitMargin, 0) / products.length;

    switch (strategy) {
      case 'by_margin':
        return `Layout otimizado por margem de lucro. ${classACount} produtos de alta margem (média ${avgMargin.toFixed(1)}%) posicionados estrategicamente.`;

      case 'by_sales':
        return `Layout otimizado por volume de vendas. Produtos com maior giro posicionados no nível dos olhos para maximizar conversão.`;

      case 'vertical':
        return `Layout vertical por marca/subcategoria. Facilita navegação do cliente e comparação de produtos similares.`;

      case 'horizontal':
        return `Layout horizontal por categoria. Distribuição equilibrada entre prateleiras para melhor aproveitamento visual.`;

      case 'mixed':
        return `Layout misto equilibrando vendas e margem. ${classACount} produtos classe A priorizados, considerando rentabilidade e giro.`;

      default:
        return 'Layout otimizado baseado na análise de categoria.';
    }
  }
}

/**
 * Função auxiliar para análise rápida
 */
export function analyzeCategory(
  products: ProductSalesData[],
  config?: Partial<CategoryPlanningConfig>
): CategoryAnalysis {
  const service = new CategoryAnalysisService(config);
  return service.analyzeCategoryData(products);
}
