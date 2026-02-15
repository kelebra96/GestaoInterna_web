import {
  ComplianceScoreBreakdown,
  DimensionScore,
  ComplianceIssue,
  ComplianceDimension,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  DIMENSION_LABELS,
  getScoreStatus,
} from '@/lib/types/compliance-scoring';

/**
 * Dados de uma execução de planograma para análise
 */
export interface ExecutionData {
  executionId: string;
  storeId: string;
  templateId: string;
  executedAt: Date;

  // Produtos do template (esperado)
  expectedProducts: Array<{
    productId: string;
    productName?: string;
    shelfId: string;
    positionX: number;
    positionY?: number;
    facings: number;
    height?: number;
    visible?: boolean;
  }>;

  // Produtos detectados na execução (real)
  detectedProducts: Array<{
    productId: string;
    productName?: string;
    shelfId: string;
    positionX: number;
    positionY?: number;
    facings: number;
    height?: number;
    visible?: boolean;
    confidence?: number;
  }>;

  // Dados de qualidade da área
  areaQuality?: {
    cleanliness: number;      // 0-100
    signage: number;          // 0-100
    lighting: number;         // 0-100
  };

  // Execução anterior para comparação
  previousExecution?: {
    score: number;
    executedAt: Date;
  };
}

export class ComplianceScoringService {
  private weights: ScoringWeights;

  constructor(customWeights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...customWeights };
  }

  /**
   * Calcula o breakdown completo de conformidade
   */
  public calculateBreakdown(data: ExecutionData): ComplianceScoreBreakdown {
    const dimensions: DimensionScore[] = [];

    // Calcular cada dimensão
    dimensions.push(this.calculatePositionScore(data));
    dimensions.push(this.calculateFacingsScore(data));
    dimensions.push(this.calculateHeightScore(data));
    dimensions.push(this.calculateVisibilityScore(data));
    dimensions.push(this.calculateCleanlinessScore(data));
    dimensions.push(this.calculateSignageScore(data));
    dimensions.push(this.calculateCompletenessScore(data));

    // Calcular score geral ponderado
    const overallScore = dimensions.reduce((sum, dim) => {
      const weight = this.weights[dim.dimension as keyof ScoringWeights] || 0;
      return sum + (dim.score * weight);
    }, 0);

    const overallStatus = getScoreStatus(overallScore);

    // Calcular resumo
    const summary = {
      totalIssues: dimensions.reduce((sum, dim) => sum + dim.issues.length, 0),
      criticalIssues: dimensions.reduce((sum, dim) =>
        sum + dim.issues.filter(i => i.severity === 'high').length, 0
      ),
      warnings: dimensions.reduce((sum, dim) =>
        sum + dim.issues.filter(i => i.type === 'warning').length, 0
      ),
      excellentDimensions: dimensions.filter(d => d.status === 'excellent').length,
      goodDimensions: dimensions.filter(d => d.status === 'good').length,
      problemDimensions: dimensions.filter(d => d.status === 'warning' || d.status === 'critical').length,
    };

    // Calcular tendência se houver execução anterior
    let trend;
    if (data.previousExecution) {
      const change = overallScore - data.previousExecution.score;
      trend = {
        previousScore: data.previousExecution.score,
        change,
        improving: change > 0,
      };
    }

    return {
      executionId: data.executionId,
      storeId: data.storeId,
      templateId: data.templateId,
      executedAt: data.executedAt,
      overallScore,
      overallStatus,
      dimensions,
      summary,
      trend,
    };
  }

  /**
   * Calcula score de POSIÇÃO
   */
  private calculatePositionScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];
    let correct = 0;
    let incorrect = 0;

    const tolerance = 5; // 5cm de tolerância

    data.expectedProducts.forEach(expected => {
      const detected = data.detectedProducts.find(d => d.productId === expected.productId);

      if (!detected) {
        incorrect++;
        issues.push({
          type: 'error',
          dimension: 'position',
          message: `Produto ${expected.productName || expected.productId} não detectado`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: 'high',
          expected: { x: expected.positionX, y: expected.positionY },
          actual: null,
        });
        return;
      }

      const deltaX = Math.abs(detected.positionX - expected.positionX);
      const deltaY = expected.positionY && detected.positionY
        ? Math.abs(detected.positionY - expected.positionY)
        : 0;

      if (deltaX <= tolerance && deltaY <= tolerance) {
        correct++;
      } else {
        incorrect++;
        issues.push({
          type: 'warning',
          dimension: 'position',
          message: `Produto ${expected.productName || expected.productId} fora de posição`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: deltaX > tolerance * 2 || deltaY > tolerance * 2 ? 'high' : 'medium',
          expected: { x: expected.positionX, y: expected.positionY },
          actual: { x: detected.positionX, y: detected.positionY },
        });
      }
    });

    const total = data.expectedProducts.length;
    const score = total > 0 ? (correct / total) * 100 : 100;

    if (incorrect > 0) {
      suggestions.push('Reposicione os produtos conforme o planograma');
      if (incorrect > total * 0.3) {
        suggestions.push('Considere revisar o treinamento da equipe sobre posicionamento');
      }
    }

    return {
      dimension: 'position',
      label: DIMENSION_LABELS.position,
      score,
      weight: this.weights.position,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de FACINGS
   */
  private calculateFacingsScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];
    let correct = 0;
    let incorrect = 0;

    data.expectedProducts.forEach(expected => {
      const detected = data.detectedProducts.find(d => d.productId === expected.productId);

      if (!detected) {
        incorrect++;
        return;
      }

      if (detected.facings === expected.facings) {
        correct++;
      } else {
        incorrect++;
        const delta = detected.facings - expected.facings;
        issues.push({
          type: delta < 0 ? 'error' : 'warning',
          dimension: 'facings',
          message: `${expected.productName || expected.productId}: ${detected.facings} facings (esperado ${expected.facings})`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: Math.abs(delta) >= 2 ? 'high' : 'medium',
          expected: expected.facings,
          actual: detected.facings,
        });
      }
    });

    const total = data.expectedProducts.length;
    const score = total > 0 ? (correct / total) * 100 : 100;

    if (incorrect > 0) {
      const missingFacings = issues.filter(i => (i.actual as number) < (i.expected as number));
      const extraFacings = issues.filter(i => (i.actual as number) > (i.expected as number));

      if (missingFacings.length > 0) {
        suggestions.push('Adicione facings faltantes para produtos de alto giro');
      }
      if (extraFacings.length > 0) {
        suggestions.push('Remova facings excessivos e otimize o espaço');
      }
    }

    return {
      dimension: 'facings',
      label: DIMENSION_LABELS.facings,
      score,
      weight: this.weights.facings,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de ALTURA
   */
  private calculateHeightScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];
    let correct = 0;
    let incorrect = 0;

    const tolerance = 3; // 3cm de tolerância

    data.expectedProducts.forEach(expected => {
      if (!expected.height) {
        correct++; // Se não há altura esperada, considera correto
        return;
      }

      const detected = data.detectedProducts.find(d => d.productId === expected.productId);

      if (!detected || !detected.height) {
        incorrect++;
        issues.push({
          type: 'warning',
          dimension: 'height',
          message: `Altura não detectada para ${expected.productName || expected.productId}`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: 'low',
          expected: expected.height,
          actual: null,
        });
        return;
      }

      const delta = Math.abs(detected.height - expected.height);

      if (delta <= tolerance) {
        correct++;
      } else {
        incorrect++;
        issues.push({
          type: 'warning',
          dimension: 'height',
          message: `${expected.productName || expected.productId}: altura ${detected.height}cm (esperado ${expected.height}cm)`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: delta > tolerance * 2 ? 'medium' : 'low',
          expected: expected.height,
          actual: detected.height,
        });
      }
    });

    const total = data.expectedProducts.length;
    const score = total > 0 ? (correct / total) * 100 : 100;

    if (incorrect > 0) {
      suggestions.push('Ajuste a altura dos produtos conforme especificado');
    }

    return {
      dimension: 'height',
      label: DIMENSION_LABELS.height,
      score,
      weight: this.weights.height,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de VISIBILIDADE
   */
  private calculateVisibilityScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];
    let correct = 0;
    let incorrect = 0;

    data.expectedProducts.forEach(expected => {
      const detected = data.detectedProducts.find(d => d.productId === expected.productId);

      if (!detected) {
        incorrect++;
        return;
      }

      // Verificar visibilidade (se produto está visível e não obstruído)
      const isVisible = detected.visible !== false && (detected.confidence ?? 1) > 0.7;

      if (isVisible) {
        correct++;
      } else {
        incorrect++;
        issues.push({
          type: 'warning',
          dimension: 'visibility',
          message: `${expected.productName || expected.productId} com baixa visibilidade`,
          productId: expected.productId,
          productName: expected.productName,
          shelfId: expected.shelfId,
          severity: 'medium',
          expected: true,
          actual: false,
        });
      }
    });

    const total = data.expectedProducts.length;
    const score = total > 0 ? (correct / total) * 100 : 100;

    if (incorrect > 0) {
      suggestions.push('Remova obstruções que impedem a visibilidade dos produtos');
      suggestions.push('Certifique-se de que os rótulos estejam virados para frente');
    }

    return {
      dimension: 'visibility',
      label: DIMENSION_LABELS.visibility,
      score,
      weight: this.weights.visibility,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de LIMPEZA
   */
  private calculateCleanlinessScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];

    // Se houver dados de qualidade da área, usar
    const score = data.areaQuality?.cleanliness ?? 85; // Default 85%

    if (score < 90) {
      issues.push({
        type: 'warning',
        dimension: 'cleanliness',
        message: 'Área precisa de limpeza',
        severity: score < 70 ? 'high' : 'medium',
        expected: 90,
        actual: score,
      });
      suggestions.push('Realize limpeza das prateleiras e produtos');
    }

    if (score < 70) {
      suggestions.push('Agende limpeza profunda da área');
    }

    const total = 1;
    const correct = score >= 90 ? 1 : 0;
    const incorrect = score < 90 ? 1 : 0;

    return {
      dimension: 'cleanliness',
      label: DIMENSION_LABELS.cleanliness,
      score,
      weight: this.weights.cleanliness,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de SINALIZAÇÃO
   */
  private calculateSignageScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];

    // Se houver dados de qualidade da área, usar
    const score = data.areaQuality?.signage ?? 78; // Default 78%

    if (score < 90) {
      issues.push({
        type: 'warning',
        dimension: 'signage',
        message: 'Sinalização e precificação inadequadas',
        severity: score < 70 ? 'high' : 'medium',
        expected: 90,
        actual: score,
      });
      suggestions.push('Verifique se todos os produtos têm etiquetas de preço visíveis');
      suggestions.push('Atualize sinalizações promocionais e informativas');
    }

    if (score < 70) {
      suggestions.push('Substitua etiquetas danificadas ou ilegíveis');
    }

    const total = 1;
    const correct = score >= 90 ? 1 : 0;
    const incorrect = score < 90 ? 1 : 0;

    return {
      dimension: 'signage',
      label: DIMENSION_LABELS.signage,
      score,
      weight: this.weights.signage,
      status: getScoreStatus(score),
      details: { total, correct, incorrect },
      issues,
      suggestions,
    };
  }

  /**
   * Calcula score de COMPLETUDE
   */
  private calculateCompletenessScore(data: ExecutionData): DimensionScore {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];

    const expectedCount = data.expectedProducts.length;
    const detectedCount = data.detectedProducts.filter(d =>
      data.expectedProducts.some(e => e.productId === d.productId)
    ).length;

    const missing = expectedCount - detectedCount;
    const score = expectedCount > 0 ? (detectedCount / expectedCount) * 100 : 100;

    if (missing > 0) {
      const missingProducts = data.expectedProducts.filter(e =>
        !data.detectedProducts.some(d => d.productId === e.productId)
      );

      missingProducts.forEach(product => {
        issues.push({
          type: 'error',
          dimension: 'completeness',
          message: `Produto ausente: ${product.productName || product.productId}`,
          productId: product.productId,
          productName: product.productName,
          shelfId: product.shelfId,
          severity: 'high',
          expected: true,
          actual: false,
        });
      });

      suggestions.push(`Reabasteça ${missing} produto(s) faltante(s)`);

      if (missing > expectedCount * 0.3) {
        suggestions.push('Verifique estoque e processos de reabastecimento');
      }
    }

    return {
      dimension: 'completeness',
      label: DIMENSION_LABELS.completeness,
      score,
      weight: this.weights.completeness,
      status: getScoreStatus(score),
      details: {
        total: expectedCount,
        correct: detectedCount,
        incorrect: 0,
        missing,
      },
      issues,
      suggestions,
    };
  }

  /**
   * Identifica a dimensão com pior desempenho
   */
  public findWorstDimension(breakdown: ComplianceScoreBreakdown): DimensionScore | null {
    if (breakdown.dimensions.length === 0) return null;

    return breakdown.dimensions.reduce((worst, current) =>
      current.score < worst.score ? current : worst
    );
  }

  /**
   * Gera recomendações prioritárias baseadas no breakdown
   */
  public generatePriorityRecommendations(breakdown: ComplianceScoreBreakdown): string[] {
    const recommendations: string[] = [];

    // Dimensões críticas (score < 60%)
    const criticalDimensions = breakdown.dimensions.filter(d => d.status === 'critical');
    if (criticalDimensions.length > 0) {
      recommendations.push(
        `🚨 URGENTE: ${criticalDimensions.length} dimensão(ões) crítica(s) - ` +
        criticalDimensions.map(d => d.label).join(', ')
      );
    }

    // Dimensão com pior desempenho
    const worst = this.findWorstDimension(breakdown);
    if (worst && worst.score < 80) {
      recommendations.push(
        `⚠️ Priorize melhorias em: ${worst.label} (${worst.score.toFixed(0)}%)`
      );
      recommendations.push(...worst.suggestions.slice(0, 2));
    }

    // Problemas de completude (produtos faltando)
    const completeness = breakdown.dimensions.find(d => d.dimension === 'completeness');
    if (completeness && completeness.details.missing && completeness.details.missing > 0) {
      recommendations.push(
        `📦 Reabastecer ${completeness.details.missing} produto(s) faltante(s)`
      );
    }

    return recommendations.slice(0, 5); // Top 5 recomendações
  }
}
