// web/lib/ImageComplianceService.ts
/**
 * Serviço de análise de conformidade de planograma usando Google Cloud Vision API
 * Implementação REAL conforme especificação - SEM MOCKS
 */
import * as vision from '@google-cloud/vision';
import { GondolaModule, PlanogramSlot } from './types/planogram';

export interface AIAnalysisResult {
  score: number; // Overall compliance score (0-100)
  findings: {
    type: 'missing' | 'misplaced' | 'extra' | 'low_stock_facing' | 'correct';
    expectedProductSku?: string;
    detectedProductSku?: string;
    positionExpected?: { x: number; y: number; width: number; height: number };
    positionDetected?: { x: number; y: number; width: number; height: number };
    reason?: string;
    confidence?: number;
  }[];
}

interface PlanogramData {
  id: string;
  basePlanogramId?: string;
  modules?: GondolaModule[];
  slots?: PlanogramSlot[];
  [key: string]: any;
}

export class ImageComplianceService {
  private static visionClient: vision.ImageAnnotatorClient | null = null;

  /**
   * Obtém o cliente do Google Cloud Vision API
   * Usa credenciais do GOOGLE_APPLICATION_CREDENTIALS env var
   */
  private static getVisionClient(): vision.ImageAnnotatorClient {
    if (!this.visionClient) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credPath) {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS não configurado. Configure a variável de ambiente com o caminho para o arquivo JSON de credenciais do Google Cloud.'
        );
      }

      this.visionClient = new vision.ImageAnnotatorClient({
        keyFilename: credPath,
      });
    }
    return this.visionClient;
  }

  /**
   * Analisa uma imagem de prateleira contra um planograma para determinar conformidade.
   * Usa Google Cloud Vision API REAL - SEM MOCKS
   *
   * @param imageBuffer - Conteúdo da imagem como Buffer
   * @param planogram - Dados do planograma store-specific
   * @param moduleId - ID do módulo sendo analisado (opcional)
   * @returns Resultado da análise com score e findings
   */
  static async analyzeShelfImage(
    imageBuffer: Buffer,
    planogram: PlanogramData,
    moduleId?: string
  ): Promise<AIAnalysisResult> {
    try {
      const client = this.getVisionClient();

      // Detectar objetos na imagem usando Google Cloud Vision
      const [objectsResult] = await client.objectLocalization!({
        image: { content: imageBuffer.toString('base64') },
      });

      const objects = objectsResult.localizedObjectAnnotations || [];

      // Detectar texto/labels na imagem para identificar produtos
      const [labelsResult] = await client.labelDetection!({
        image: { content: imageBuffer.toString('base64') },
      });

      const labels = labelsResult.labelAnnotations || [];

      // Opcional: OCR para ler textos/códigos de barras
      const [textResult] = await client.textDetection!({
        image: { content: imageBuffer.toString('base64') },
      });

      const texts = textResult.textAnnotations || [];

      // Processar planograma esperado
      const expectedSlots = this.extractExpectedSlots(planogram, moduleId);

      // Mapear objetos detectados para produtos conhecidos
      const detectedProducts = this.mapDetectedObjects(objects, labels, texts, expectedSlots);

      // Calcular conformidade comparando esperado vs detectado
      const findings = this.calculateCompliance(expectedSlots, detectedProducts);

      // Calcular score geral
      const score = this.calculateScore(findings, expectedSlots.length);

      return {
        score: Math.round(score),
        findings,
      };
    } catch (error) {
      console.error('Erro ao analisar imagem com Google Cloud Vision:', error);
      throw new Error(
        `Falha na análise de conformidade: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  /**
   * Extrai slots esperados do planograma
   */
  private static extractExpectedSlots(
    planogram: PlanogramData,
    moduleId?: string
  ): PlanogramSlot[] {
    if (!planogram.slots) return [];

    // Se moduleId especificado, filtrar apenas slots desse módulo
    if (moduleId) {
      return planogram.slots.filter(slot => slot.moduleId === moduleId);
    }

    return planogram.slots;
  }

  /**
   * Mapeia objetos detectados pelo Vision API para produtos conhecidos
   */
  private static mapDetectedObjects(
    objects: vision.protos.google.cloud.vision.v1.ILocalizedObjectAnnotation[],
    labels: vision.protos.google.cloud.vision.v1.IEntityAnnotation[],
    texts: vision.protos.google.cloud.vision.v1.IEntityAnnotation[],
    expectedSlots: PlanogramSlot[]
  ): Array<{
    name: string;
    confidence: number;
    boundingBox: { x: number; y: number; width: number; height: number };
    matchedProductId?: string;
  }> {
    const detected: Array<{
      name: string;
      confidence: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      matchedProductId?: string;
    }> = [];

    // Processar objetos detectados
    for (const obj of objects) {
      if (!obj.name || !obj.score || !obj.boundingPoly?.normalizedVertices) continue;

      const vertices = obj.boundingPoly.normalizedVertices;
      const box = {
        x: vertices[0].x || 0,
        y: vertices[0].y || 0,
        width: (vertices[2].x || 0) - (vertices[0].x || 0),
        height: (vertices[2].y || 0) - (vertices[0].y || 0),
      };

      // Tentar matchear com produtos esperados usando labels e texto OCR
      const matchedProduct = this.findMatchingProduct(
        obj.name,
        labels,
        texts,
        expectedSlots
      );

      detected.push({
        name: obj.name,
        confidence: obj.score,
        boundingBox: box,
        matchedProductId: matchedProduct?.productId,
      });
    }

    return detected;
  }

  /**
   * Tenta encontrar produto correspondente baseado em nome, labels e textos
   */
  private static findMatchingProduct(
    objectName: string,
    labels: vision.protos.google.cloud.vision.v1.IEntityAnnotation[],
    texts: vision.protos.google.cloud.vision.v1.IEntityAnnotation[],
    expectedSlots: PlanogramSlot[]
  ): PlanogramSlot | undefined {
    // Estratégia simples: buscar por nome do produto ou EAN no texto OCR
    const allText = texts.map(t => t.description?.toLowerCase() || '').join(' ');

    return expectedSlots.find(slot => {
      const productName = slot.productName?.toLowerCase() || '';
      const ean = slot.ean?.toLowerCase() || '';

      // Match por nome ou EAN
      return (
        allText.includes(productName) ||
        (ean && allText.includes(ean)) ||
        objectName.toLowerCase().includes(productName)
      );
    });
  }

  /**
   * Calcula conformidade comparando esperado vs detectado
   */
  private static calculateCompliance(
    expectedSlots: PlanogramSlot[],
    detectedProducts: Array<{
      name: string;
      confidence: number;
      boundingBox: any;
      matchedProductId?: string;
    }>
  ): AIAnalysisResult['findings'] {
    const findings: AIAnalysisResult['findings'] = [];

    // Verificar produtos esperados
    for (const slot of expectedSlots) {
      const detected = detectedProducts.find(d => d.matchedProductId === slot.productId);

      if (!detected) {
        // Produto faltando
        findings.push({
          type: 'missing',
          expectedProductSku: slot.productId,
          reason: `Produto ${slot.productName || slot.productId} não detectado na posição esperada`,
          confidence: 90,
        });
      } else {
        // Produto encontrado
        findings.push({
          type: 'correct',
          expectedProductSku: slot.productId,
          detectedProductSku: detected.matchedProductId,
          reason: `Produto ${slot.productName || slot.productId} detectado corretamente`,
          confidence: Math.round(detected.confidence * 100),
        });
      }
    }

    // Verificar produtos extras (não esperados)
    for (const detected of detectedProducts) {
      if (!detected.matchedProductId) {
        findings.push({
          type: 'extra',
          detectedProductSku: detected.name,
          reason: `Produto não esperado detectado: ${detected.name}`,
          confidence: Math.round(detected.confidence * 100),
        });
      }
    }

    return findings;
  }

  /**
   * Calcula score geral de conformidade
   */
  private static calculateScore(
    findings: AIAnalysisResult['findings'],
    totalExpected: number
  ): number {
    if (totalExpected === 0) return 100;

    const correct = findings.filter(f => f.type === 'correct').length;
    const missing = findings.filter(f => f.type === 'missing').length;
    const extra = findings.filter(f => f.type === 'extra').length;
    const misplaced = findings.filter(f => f.type === 'misplaced').length;

    // Fórmula de score:
    // - Produtos corretos: +100 pontos cada
    // - Produtos faltando: -10 pontos cada
    // - Produtos extras: -5 pontos cada
    // - Produtos mal posicionados: -3 pontos cada

    const maxPoints = totalExpected * 100;
    const points = correct * 100 - missing * 10 - extra * 5 - misplaced * 3;

    const score = Math.max(0, Math.min(100, (points / maxPoints) * 100));
    return score;
  }
}
