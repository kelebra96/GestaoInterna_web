import { NextRequest, NextResponse } from 'next/server';
import { ProductSalesData, CategoryPlanningConfig } from '@/lib/types/category-planning';
import { analyzeCategory } from '@/lib/services/category-analysis.service';

/**
 * POST /api/category-planning/analyze
 * Analisa dados de categoria e retorna recomendações
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, config } = body as {
      products: ProductSalesData[];
      config?: Partial<CategoryPlanningConfig>;
    };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Array de produtos é obrigatório e não pode estar vazio' },
        { status: 400 }
      );
    }

    // Validar que produtos têm campos obrigatórios
    const missingFields = products.some(
      (p) =>
        !p.productId ||
        p.salesVolume === undefined ||
        p.salesRevenue === undefined ||
        p.profitMargin === undefined
    );

    if (missingFields) {
      return NextResponse.json(
        {
          error: 'Todos os produtos devem ter: productId, salesVolume, salesRevenue, profitMargin',
        },
        { status: 400 }
      );
    }

    // Executar análise
    const analysis = analyzeCategory(products, config);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Erro ao analisar categoria:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar análise' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/category-planning/analyze
 * Retorna configurações padrão e documentação
 */
export async function GET() {
  const defaultConfig: CategoryPlanningConfig = {
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
      totalWidth: 120,
      shelfLevels: 4,
      averageDepth: 40,
    },
  };

  const documentation = {
    description: 'Analisa dados de vendas e retorna recomendações de planograma',
    method: 'POST',
    endpoint: '/api/category-planning/analyze',
    requestBody: {
      products: 'Array<ProductSalesData> - Lista de produtos com dados de vendas',
      config: 'CategoryPlanningConfig (opcional) - Configurações de análise',
    },
    response: {
      success: 'boolean',
      analysis: {
        totalSalesVolume: 'number - Volume total de vendas',
        totalSalesRevenue: 'number - Receita total',
        totalProducts: 'number - Número de produtos analisados',
        products: 'Array<ProductAnalysisResult> - Análise individual de cada produto',
        recommendations: {
          layoutStrategy: 'string - Estratégia de layout recomendada',
          layoutJustification: 'string - Explicação da estratégia',
          spaceAllocation: 'Array - Alocação de espaço por produto',
          optimizations: 'Array - Sugestões de otimização',
          expectedMetrics: 'object - Métricas esperadas',
        },
      },
    },
    analysisOutputs: {
      classifications: {
        A: 'Produtos de alta performance (80% das vendas)',
        B: 'Produtos de performance média (15% das vendas)',
        C: 'Produtos de baixa performance (5% das vendas)',
      },
      layoutStrategies: {
        by_sales: 'Otimizado por volume de vendas',
        by_margin: 'Otimizado por margem de lucro',
        vertical: 'Disposição vertical por marca/subcategoria',
        horizontal: 'Disposição horizontal por categoria',
        mixed: 'Equilibra vendas, margem e outros fatores',
      },
      shelfLevels: {
        eye: 'Nível dos olhos (melhor visibilidade)',
        middle: 'Nível médio',
        top: 'Prateleira superior',
        bottom: 'Prateleira inferior',
      },
    },
    configOptions: defaultConfig,
  };

  return NextResponse.json(documentation);
}
