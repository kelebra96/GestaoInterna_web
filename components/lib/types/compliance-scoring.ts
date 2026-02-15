// Tipos para Sistema de Scoring Decomposto

/**
 * Dimensões de conformidade avaliadas
 */
export type ComplianceDimension =
  | 'position'      // Posição dos produtos
  | 'facings'       // Número de facings
  | 'height'        // Altura de posicionamento
  | 'visibility'    // Visibilidade dos produtos
  | 'cleanliness'   // Limpeza da área
  | 'signage'       // Sinalização e precificação
  | 'completeness'  // Completude (todos produtos presentes)
  | 'overall';      // Score geral

/**
 * Score de uma dimensão específica
 */
export interface DimensionScore {
  dimension: ComplianceDimension;
  label: string;                    // Nome amigável da dimensão
  score: number;                    // Score 0-100
  weight: number;                   // Peso no cálculo geral (0-1)
  status: 'excellent' | 'good' | 'warning' | 'critical';
  details: {
    total: number;                  // Total de itens avaliados
    correct: number;                // Itens corretos
    incorrect: number;              // Itens incorretos
    missing?: number;               // Itens faltantes (opcional)
  };
  issues: ComplianceIssue[];        // Problemas identificados
  suggestions: string[];            // Sugestões de melhoria
}

/**
 * Problema identificado em uma dimensão
 */
export interface ComplianceIssue {
  type: 'error' | 'warning' | 'info';
  dimension: ComplianceDimension;
  message: string;
  productId?: string;
  productName?: string;
  shelfId?: string;
  severity: 'high' | 'medium' | 'low';
  expected?: any;                   // Valor esperado
  actual?: any;                     // Valor encontrado
}

/**
 * Resultado completo do scoring decomposto
 */
export interface ComplianceScoreBreakdown {
  executionId: string;
  storeId: string;
  templateId: string;
  executedAt: Date;

  // Score geral
  overallScore: number;             // 0-100
  overallStatus: 'excellent' | 'good' | 'warning' | 'critical';

  // Scores por dimensão
  dimensions: DimensionScore[];

  // Resumo
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    excellentDimensions: number;    // Dimensões com score >= 95%
    goodDimensions: number;         // Dimensões com score >= 80%
    problemDimensions: number;      // Dimensões com score < 80%
  };

  // Comparação com execuções anteriores
  trend?: {
    previousScore: number;
    change: number;                 // Diferença em pontos percentuais
    improving: boolean;
  };
}

/**
 * Configuração de pesos para cada dimensão
 */
export interface ScoringWeights {
  position: number;
  facings: number;
  height: number;
  visibility: number;
  cleanliness: number;
  signage: number;
  completeness: number;
}

/**
 * Pesos padrão (devem somar 1.0)
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  position: 0.20,      // 20%
  facings: 0.15,       // 15%
  height: 0.10,        // 10%
  visibility: 0.15,    // 15%
  cleanliness: 0.10,   // 10%
  signage: 0.15,       // 15%
  completeness: 0.15,  // 15%
};

/**
 * Labels amigáveis para as dimensões
 */
export const DIMENSION_LABELS: Record<ComplianceDimension, string> = {
  position: 'Posição',
  facings: 'Facings',
  height: 'Altura',
  visibility: 'Visibilidade',
  cleanliness: 'Limpeza',
  signage: 'Sinalização',
  completeness: 'Completude',
  overall: 'Conformidade Total',
};

/**
 * Ícones para cada dimensão (emoji ou lucide icon name)
 */
export const DIMENSION_ICONS: Record<ComplianceDimension, string> = {
  position: '📍',
  facings: '🔢',
  height: '📏',
  visibility: '👁️',
  cleanliness: '✨',
  signage: '🏷️',
  completeness: '✅',
  overall: '🎯',
};

/**
 * Thresholds para determinar status
 */
export const SCORE_THRESHOLDS = {
  excellent: 95,  // >= 95% = excellent
  good: 80,       // >= 80% = good
  warning: 60,    // >= 60% = warning
  critical: 0,    // < 60% = critical
};

/**
 * Determina o status baseado no score
 */
export function getScoreStatus(score: number): 'excellent' | 'good' | 'warning' | 'critical' {
  if (score >= SCORE_THRESHOLDS.excellent) return 'excellent';
  if (score >= SCORE_THRESHOLDS.good) return 'good';
  if (score >= SCORE_THRESHOLDS.warning) return 'warning';
  return 'critical';
}

/**
 * Retorna cor baseada no status
 */
export function getStatusColor(status: 'excellent' | 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'excellent':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'good':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

/**
 * Retorna cor da barra de progresso baseada no status
 */
export function getProgressBarColor(status: 'excellent' | 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-blue-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'critical':
      return 'bg-red-500';
  }
}

/**
 * Retorna label amigável para o status
 */
export function getStatusLabel(status: 'excellent' | 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'excellent':
      return 'Excelente';
    case 'good':
      return 'Bom';
    case 'warning':
      return 'Atenção';
    case 'critical':
      return 'Crítico';
  }
}
