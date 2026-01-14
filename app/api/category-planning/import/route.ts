import { NextRequest, NextResponse } from 'next/server';
import { ProductSalesData } from '@/lib/types/category-planning';

/**
 * POST /api/category-planning/import
 * Importa dados de vendas de diferentes formatos
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, data, templateId } = body;

    if (!format || !data) {
      return NextResponse.json(
        { error: 'Formato e dados são obrigatórios' },
        { status: 400 }
      );
    }

    let products: ProductSalesData[] = [];
    const errors: string[] = [];

    // Processar baseado no formato
    switch (format) {
      case 'json':
        products = await processJSON(data);
        break;

      case 'csv':
        products = await processCSV(data);
        break;

      case 'xlsx':
        // Para XLSX, esperamos que os dados já venham processados do frontend
        // (usando biblioteca como xlsx no cliente)
        if (Array.isArray(data)) {
          products = data;
        } else {
          throw new Error('Formato XLSX inválido. Envie array de objetos.');
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Formato não suportado. Use: json, csv ou xlsx' },
          { status: 400 }
        );
    }

    // Validar produtos
    const { validProducts, validationErrors } = validateProducts(products);
    errors.push(...validationErrors);

    if (validProducts.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum produto válido encontrado',
          errors,
        },
        { status: 400 }
      );
    }

    // Se templateId foi fornecido, salvar dados no banco
    if (templateId) {
      // TODO: Salvar no Firestore ou PostgreSQL
      // await saveCategoryData(templateId, validProducts);
    }

    return NextResponse.json({
      success: true,
      recordsImported: validProducts.length,
      errors: errors.length > 0 ? errors : undefined,
      preview: validProducts.slice(0, 5), // Retorna preview dos primeiros 5
      data: validProducts, // Retorna todos os dados validados
    });
  } catch (error: any) {
    console.error('Erro ao importar dados:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar importação' },
      { status: 500 }
    );
  }
}

/**
 * Processa dados JSON
 */
function processJSON(data: any): ProductSalesData[] {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!Array.isArray(data)) {
    throw new Error('JSON deve ser um array de produtos');
  }

  return data;
}

/**
 * Processa dados CSV
 */
function processCSV(csvData: string): ProductSalesData[] {
  const lines = csvData.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV deve ter pelo menos cabeçalho e uma linha de dados');
  }

  // Primeira linha é o cabeçalho
  const headers = lines[0].split(',').map(h => h.trim());

  // Mapear índices dos campos obrigatórios
  const productIdIndex = headers.indexOf('productId');
  const salesVolumeIndex = headers.indexOf('salesVolume');
  const salesRevenueIndex = headers.indexOf('salesRevenue');
  const profitMarginIndex = headers.indexOf('profitMargin');

  if (productIdIndex === -1 || salesVolumeIndex === -1 ||
      salesRevenueIndex === -1 || profitMarginIndex === -1) {
    throw new Error(
      'CSV deve conter campos obrigatórios: productId, salesVolume, salesRevenue, profitMargin'
    );
  }

  // Processar linhas
  const products: ProductSalesData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());

    const product: ProductSalesData = {
      productId: values[productIdIndex],
      salesVolume: parseFloat(values[salesVolumeIndex]) || 0,
      salesRevenue: parseFloat(values[salesRevenueIndex]) || 0,
      profitMargin: parseFloat(values[profitMarginIndex]) || 0,
    };

    // Campos opcionais
    const productNameIndex = headers.indexOf('productName');
    if (productNameIndex !== -1 && values[productNameIndex]) {
      product.productName = values[productNameIndex];
    }

    const eanIndex = headers.indexOf('ean');
    if (eanIndex !== -1 && values[eanIndex]) {
      product.ean = values[eanIndex];
    }

    const seasonalityIndex = headers.indexOf('seasonalityIndex');
    if (seasonalityIndex !== -1 && values[seasonalityIndex]) {
      product.seasonalityIndex = parseFloat(values[seasonalityIndex]) || 1.0;
    }

    const widthIndex = headers.indexOf('width');
    if (widthIndex !== -1 && values[widthIndex]) {
      product.width = parseFloat(values[widthIndex]);
    }

    const heightIndex = headers.indexOf('height');
    if (heightIndex !== -1 && values[heightIndex]) {
      product.height = parseFloat(values[heightIndex]);
    }

    const depthIndex = headers.indexOf('depth');
    if (depthIndex !== -1 && values[depthIndex]) {
      product.depth = parseFloat(values[depthIndex]);
    }

    const categoryIndex = headers.indexOf('category');
    if (categoryIndex !== -1 && values[categoryIndex]) {
      product.category = values[categoryIndex];
    }

    const subcategoryIndex = headers.indexOf('subcategory');
    if (subcategoryIndex !== -1 && values[subcategoryIndex]) {
      product.subcategory = values[subcategoryIndex];
    }

    const brandIndex = headers.indexOf('brand');
    if (brandIndex !== -1 && values[brandIndex]) {
      product.brand = values[brandIndex];
    }

    products.push(product);
  }

  return products;
}

/**
 * Valida produtos importados
 */
function validateProducts(products: ProductSalesData[]): {
  validProducts: ProductSalesData[];
  validationErrors: string[];
} {
  const validProducts: ProductSalesData[] = [];
  const validationErrors: string[] = [];

  products.forEach((product, index) => {
    const errors: string[] = [];

    // Validações obrigatórias
    if (!product.productId || product.productId.trim() === '') {
      errors.push(`Linha ${index + 1}: productId é obrigatório`);
    }

    if (product.salesVolume === undefined || product.salesVolume < 0) {
      errors.push(`Linha ${index + 1}: salesVolume inválido`);
    }

    if (product.salesRevenue === undefined || product.salesRevenue < 0) {
      errors.push(`Linha ${index + 1}: salesRevenue inválido`);
    }

    if (product.profitMargin === undefined || product.profitMargin < 0 || product.profitMargin > 100) {
      errors.push(`Linha ${index + 1}: profitMargin deve estar entre 0 e 100`);
    }

    // Validações opcionais
    if (product.seasonalityIndex !== undefined && product.seasonalityIndex < 0) {
      errors.push(`Linha ${index + 1}: seasonalityIndex deve ser positivo`);
    }

    if (product.width !== undefined && product.width <= 0) {
      errors.push(`Linha ${index + 1}: width deve ser positivo`);
    }

    if (errors.length === 0) {
      validProducts.push(product);
    } else {
      validationErrors.push(...errors);
    }
  });

  return { validProducts, validationErrors };
}

/**
 * GET /api/category-planning/import
 * Retorna templates e exemplos de importação
 */
export async function GET() {
  const csvTemplate = `productId,productName,ean,salesVolume,salesRevenue,profitMargin,seasonalityIndex,width,height,depth,category,subcategory,brand
PROD001,Coca-Cola 2L,7894900011517,1500,4500.00,35.5,1.2,12,30,8,Bebidas,Refrigerantes,Coca-Cola
PROD002,Guaraná 2L,7891991010344,1200,3300.00,32.0,1.0,12,30,8,Bebidas,Refrigerantes,Ambev
PROD003,Pepsi 2L,7894900530315,800,2200.00,30.0,0.9,12,30,8,Bebidas,Refrigerantes,PepsiCo`;

  const jsonTemplate = [
    {
      productId: 'PROD001',
      productName: 'Coca-Cola 2L',
      ean: '7894900011517',
      salesVolume: 1500,
      salesRevenue: 4500.0,
      profitMargin: 35.5,
      seasonalityIndex: 1.2,
      width: 12,
      height: 30,
      depth: 8,
      category: 'Bebidas',
      subcategory: 'Refrigerantes',
      brand: 'Coca-Cola',
    },
    {
      productId: 'PROD002',
      productName: 'Guaraná 2L',
      ean: '7891991010344',
      salesVolume: 1200,
      salesRevenue: 3300.0,
      profitMargin: 32.0,
      seasonalityIndex: 1.0,
      width: 12,
      height: 30,
      depth: 8,
      category: 'Bebidas',
      subcategory: 'Refrigerantes',
      brand: 'Ambev',
    },
  ];

  const documentation = {
    formats: ['csv', 'json', 'xlsx'],
    requiredFields: ['productId', 'salesVolume', 'salesRevenue', 'profitMargin'],
    optionalFields: [
      'productName',
      'ean',
      'seasonalityIndex',
      'seasonalPeaks',
      'width',
      'height',
      'depth',
      'category',
      'subcategory',
      'brand',
    ],
    notes: [
      'productId: Identificador único do produto',
      'salesVolume: Volume de vendas em unidades',
      'salesRevenue: Receita total de vendas (R$)',
      'profitMargin: Margem de lucro em percentual (0-100)',
      'seasonalityIndex: Índice de sazonalidade (1.0 = normal, >1.0 = alta demanda)',
      'width/height/depth: Dimensões do produto em centímetros',
    ],
  };

  return NextResponse.json({
    documentation,
    templates: {
      csv: csvTemplate,
      json: jsonTemplate,
    },
  });
}
