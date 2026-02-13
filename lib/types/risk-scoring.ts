// ==========================================
// Tipos para Sistema de Score de Risco
// ==========================================

// ==========================================
// Enums
// ==========================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskTrend = 'improving' | 'stable' | 'worsening';
export type RiskEntityType = 'store' | 'product' | 'category' | 'supplier';

// ==========================================
// Configurações
// ==========================================

export const RISK_LEVEL_CONFIG = {
  low: {
    label: 'Baixo',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    icon: 'check-circle',
  },
  medium: {
    label: 'Médio',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    icon: 'alert-circle',
  },
  high: {
    label: 'Alto',
    color: '#F97316',
    bgColor: '#FFEDD5',
    icon: 'alert-triangle',
  },
  critical: {
    label: 'Crítico',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    icon: 'x-circle',
  },
} as const;

export const RISK_TREND_CONFIG = {
  improving: {
    label: 'Melhorando',
    color: '#22C55E',
    icon: 'trending-down',
    arrow: '↓',
  },
  stable: {
    label: 'Estável',
    color: '#6B7280',
    icon: 'minus',
    arrow: '→',
  },
  worsening: {
    label: 'Piorando',
    color: '#EF4444',
    icon: 'trending-up',
    arrow: '↑',
  },
} as const;

// ==========================================
// Risk Score
// ==========================================

export interface RiskScore {
  id: string;
  orgId: string;

  entityType: RiskEntityType;
  entityId: string;
  entityName: string | null;

  // Score principal (0-100)
  score: number;
  level: RiskLevel;
  trend: RiskTrend;

  // Componentes do score (0-100 cada)
  expiryScore: number;
  ruptureScore: number;
  recurrenceScore: number;
  financialScore: number;
  efficiencyScore: number;

  // Métricas detalhadas
  metrics: RiskMetrics;

  // Período
  periodStart: Date;
  periodEnd: Date;

  calculatedAt: Date;
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface RiskMetrics {
  // Métricas de loja
  reports30d?: number;
  overdueCount?: number;
  openCount?: number;
  resolvedCount?: number;
  valueAtRisk?: number;
  efficiencyRate?: number | null;
  avgResolutionHours?: number | null;
  productsAffected?: number;

  // Métricas de produto
  occurrences90d?: number;
  storesAffected?: number;
  totalQuantity?: number;
  totalValueAtRisk?: number;
  avgMonthlyOccurrences?: number;
}

// ==========================================
// Risk Alert
// ==========================================

export interface RiskAlert {
  id: string;
  orgId: string;
  storeId: string | null;

  entityType: RiskEntityType;
  entityId: string;
  entityName: string | null;

  alertType: RiskAlertType;
  severity: RiskLevel;
  title: string;
  description: string | null;

  currentScore: number | null;
  previousScore: number | null;
  scoreChange: number | null;

  isActive: boolean;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;

  metadata: Record<string, unknown>;

  createdAt: Date;
  expiresAt: Date | null;
}

export type RiskAlertType =
  | 'score_increased'
  | 'critical_level'
  | 'trend_worsening'
  | 'new_high_risk'
  | 'efficiency_dropped'
  | 'value_threshold';

// ==========================================
// Risk Thresholds
// ==========================================

export interface RiskThresholds {
  id: string;
  orgId: string;

  // Limites por nível
  lowMax: number;
  mediumMax: number;
  highMax: number;

  // Pesos dos componentes (devem somar 100)
  weightExpiry: number;
  weightRupture: number;
  weightRecurrence: number;
  weightFinancial: number;
  weightEfficiency: number;

  // Configurações de alerta
  alertOnCritical: boolean;
  alertOnScoreIncrease: number;
  alertOnTrendChange: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateThresholdsDTO {
  lowMax?: number;
  mediumMax?: number;
  highMax?: number;
  weightExpiry?: number;
  weightRupture?: number;
  weightRecurrence?: number;
  weightFinancial?: number;
  weightEfficiency?: number;
  alertOnCritical?: boolean;
  alertOnScoreIncrease?: number;
  alertOnTrendChange?: boolean;
}

// ==========================================
// History
// ==========================================

export interface RiskScoreHistory {
  id: string;
  orgId: string;
  entityType: RiskEntityType;
  entityId: string;
  score: number;
  level: RiskLevel;
  components: {
    expiryScore: number;
    ruptureScore: number;
    recurrenceScore: number;
    financialScore: number;
    efficiencyScore: number;
  };
  recordedAt: Date;
  createdAt: Date;
}

// ==========================================
// Rankings
// ==========================================

export interface StoreRiskRanking {
  rank: number;
  storeId: string;
  storeName: string;
  storeCode: string;
  score: number;
  level: RiskLevel;
  trend: RiskTrend;
  metrics: RiskMetrics;
  changeFromPrevious: number | null;
}

export interface ProductRiskRanking {
  rank: number;
  productId: string;
  sku: string;
  ean: string | null;
  productName: string;
  brand: string;
  category: string;
  score: number;
  level: RiskLevel;
  trend: RiskTrend;
  metrics: RiskMetrics;
  storesAffected: number;
}

export interface CategoryRiskRanking {
  rank: number;
  category: string;
  score: number;
  level: RiskLevel;
  productsCount: number;
  reports30d: number;
  valueAtRisk: number;
}

// ==========================================
// Dashboard Data
// ==========================================

export interface RiskDashboardData {
  summary: {
    totalEntities: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgScore: number;
    worseningCount: number;
    improvingCount: number;
  };

  storeRankings: StoreRiskRanking[];
  productRankings: ProductRiskRanking[];
  categoryRankings: CategoryRiskRanking[];

  recentAlerts: RiskAlert[];

  trendData: RiskTrendPoint[];

  lastUpdated: Date;
}

export interface RiskTrendPoint {
  date: string;
  avgScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

// ==========================================
// Score Distribution
// ==========================================

export interface ScoreDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
  percentages: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// ==========================================
// API Responses
// ==========================================

export interface RiskScoresResponse {
  success: boolean;
  data: RiskScore[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface RiskDashboardResponse {
  success: boolean;
  data: RiskDashboardData;
}

export interface RiskAlertsResponse {
  success: boolean;
  data: RiskAlert[];
  unreadCount: number;
}

// ==========================================
// Filters
// ==========================================

export interface RiskScoreFilters {
  entityType?: RiskEntityType;
  level?: RiskLevel[];
  trend?: RiskTrend[];
  minScore?: number;
  maxScore?: number;
  storeId?: string;
  category?: string;
  sortBy?: 'score' | 'trend' | 'name' | 'updated';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ==========================================
// Helpers
// ==========================================

export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

export function getRiskLevelConfig(level: RiskLevel) {
  return RISK_LEVEL_CONFIG[level];
}

export function getRiskTrendConfig(trend: RiskTrend) {
  return RISK_TREND_CONFIG[trend];
}

export function formatRiskScore(score: number): string {
  return score.toFixed(0);
}

export function getScoreColor(score: number): string {
  if (score <= 25) return RISK_LEVEL_CONFIG.low.color;
  if (score <= 50) return RISK_LEVEL_CONFIG.medium.color;
  if (score <= 75) return RISK_LEVEL_CONFIG.high.color;
  return RISK_LEVEL_CONFIG.critical.color;
}

export function calculateScoreChange(current: number, previous: number): {
  change: number;
  trend: RiskTrend;
  label: string;
} {
  const change = current - previous;

  let trend: RiskTrend;
  if (change <= -5) trend = 'improving';
  else if (change >= 5) trend = 'worsening';
  else trend = 'stable';

  const sign = change > 0 ? '+' : '';
  const label = change === 0 ? 'Sem mudança' : `${sign}${change} pontos`;

  return { change, trend, label };
}

export function sortRiskScores(
  scores: RiskScore[],
  sortBy: 'score' | 'trend' | 'name',
  order: 'asc' | 'desc' = 'desc'
): RiskScore[] {
  const sorted = [...scores].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'trend':
        const trendOrder = { worsening: 0, stable: 1, improving: 2 };
        comparison = trendOrder[a.trend] - trendOrder[b.trend];
        break;
      case 'name':
        comparison = (a.entityName || '').localeCompare(b.entityName || '');
        break;
    }

    return order === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

export function filterCriticalAndHigh(scores: RiskScore[]): RiskScore[] {
  return scores.filter(s => s.level === 'critical' || s.level === 'high');
}

export function getTopRisks(scores: RiskScore[], limit = 10): RiskScore[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
