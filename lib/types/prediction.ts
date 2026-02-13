// =============================================
// TIPOS DO MÓDULO DE PREDIÇÃO E ML
// =============================================

// =============================================
// CLUSTERS
// =============================================

export type ClusterType = 'store' | 'product' | 'category';

export interface Cluster {
  id: string;
  orgId: string;
  clusterType: ClusterType;
  clusterName: string;
  clusterLabel?: string;
  centroid: Record<string, number>;
  featureWeights: Record<string, number>;
  memberCount: number;
  avgRiskScore?: number;
  characteristics: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterMember {
  id: string;
  clusterId: string;
  entityType: ClusterType;
  entityId: string;
  distanceToCentroid?: number;
  membershipScore?: number;
  features: Record<string, number>;
  assignedAt: Date;
}

export interface ClusterRun {
  id: string;
  orgId: string;
  clusterType: ClusterType;
  algorithm: 'kmeans' | 'dbscan' | 'hierarchical';
  parameters: Record<string, unknown>;
  numClusters: number;
  silhouetteScore?: number;
  inertia?: number;
  totalMembers: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface ClusterSummary extends Cluster {
  currentMembers: number;
  avgMembershipScore: number;
  avgDistance: number;
}

// =============================================
// PREDIÇÕES
// =============================================

export type PredictionModelType =
  | 'risk_prediction'
  | 'demand_forecast'
  | 'loss_prediction'
  | 'expiry_prediction'
  | 'rupture_prediction';

export type PredictionType =
  | 'risk_score'
  | 'demand_quantity'
  | 'loss_amount'
  | 'loss_volume'
  | 'loss_value'
  | 'expiry_count'
  | 'expiry_risk'
  | 'demand'
  | 'rupture_probability';

export type ModelAlgorithm =
  | 'linear_regression'
  | 'random_forest'
  | 'gradient_boost'
  | 'arima'
  | 'prophet'
  | 'exponential_smoothing';

export interface PredictionModel {
  id: string;
  orgId: string;
  modelType: PredictionModelType;
  modelName: string;
  modelVersion: string;
  algorithm: ModelAlgorithm;
  features: string[];
  hyperparameters: Record<string, unknown>;
  metrics: ModelMetrics;
  isActive: boolean;
  trainedAt?: Date;
  trainingSamples?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelMetrics {
  mae?: number; // Mean Absolute Error
  rmse?: number; // Root Mean Squared Error
  mape?: number; // Mean Absolute Percentage Error
  r2?: number; // R-squared
  accuracy?: number;
}

export interface Prediction {
  id: string;
  orgId: string;
  modelId?: string;
  predictionType: PredictionType;
  entityType: 'store' | 'product' | 'category' | 'organization';
  entityId?: string;
  targetDate: Date;
  horizonDays: number;
  predictedValue: number;
  confidenceLower?: number;
  confidenceUpper?: number;
  confidenceLevel: number;
  actualValue?: number;
  error?: number;
  featuresUsed: Record<string, unknown>;
  createdAt: Date;
}

export interface PredictionAccuracy {
  orgId: string;
  predictionType: PredictionType;
  entityType: string;
  algorithm?: ModelAlgorithm;
  week: Date;
  totalPredictions: number;
  evaluatedPredictions: number;
  meanAbsoluteError?: number;
  meanSquaredError?: number;
  accuracyRate?: number;
}

// =============================================
// SAZONALIDADE
// =============================================

export type SeasonalPatternType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'holiday'
  | 'event';

export interface SeasonalPattern {
  id: string;
  orgId: string;
  patternType: SeasonalPatternType;
  entityType: 'store' | 'product' | 'category' | 'organization';
  entityId?: string;
  metricType: string;
  patternData: SeasonalPatternData;
  strength: number; // 0-1
  confidence: number; // 0-1
  periodStart?: Date;
  periodEnd?: Date;
  detectedAt: Date;
  updatedAt: Date;
}

export interface SeasonalPatternData {
  // Para padrões semanais
  dayOfWeek?: Record<number, number>; // 0-6 → valor

  // Para padrões mensais
  dayOfMonth?: Record<number, number>; // 1-31 → valor

  // Para padrões anuais
  monthOfYear?: Record<number, number>; // 1-12 → valor

  // Para padrões diários
  hourOfDay?: Record<number, number>; // 0-23 → valor

  // Tendência geral
  trend?: 'increasing' | 'decreasing' | 'stable';
  trendSlope?: number;

  // Decomposição
  seasonal?: number[];
  residual?: number[];
}

export type CalendarEventType = 'holiday' | 'promotion' | 'season' | 'custom';

export interface CalendarEvent {
  id: string;
  orgId?: string;
  eventName: string;
  eventType: CalendarEventType;
  eventDate?: Date;
  recurrence: 'none' | 'yearly' | 'monthly' | 'weekly';
  impactFactor: number;
  affectsCategories: string[];
  notes?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface TimeSeriesDataPoint {
  id: string;
  orgId: string;
  entityType: string;
  entityId?: string;
  metricType: string;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

// =============================================
// RECOMENDAÇÕES
// =============================================

export type RecommendationType =
  | 'reorder'
  | 'markdown'
  | 'transfer'
  | 'investigation'
  | 'process_change'
  | 'supplier_review'
  | 'storage_adjustment'
  | 'training'
  | 'audit';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';

export type RecommendationStatus =
  | 'pending'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'expired';

export interface Recommendation {
  id: string;
  orgId: string;
  recommendationType: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  rationale?: string;
  entityType?: 'store' | 'product' | 'category' | 'supplier';
  entityId?: string;
  entityName?: string;

  // Impacto estimado
  estimatedSavings?: number;
  estimatedLossReduction?: number;
  confidenceScore?: number;

  // Ação sugerida
  suggestedAction: Record<string, unknown>;
  actionDeadline?: Date;

  // Status
  status: RecommendationStatus;
  viewedAt?: Date;
  viewedBy?: string;
  actionTakenAt?: Date;
  actionTakenBy?: string;
  actionNotes?: string;
  actualSavings?: number;

  // Metadados
  sourceData: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FeedbackType = 'helpful' | 'not_helpful' | 'irrelevant' | 'already_done';

export interface RecommendationFeedback {
  id: string;
  recommendationId: string;
  userId: string;
  feedbackType: FeedbackType;
  comment?: string;
  createdAt: Date;
}

export interface PendingRecommendationSummary {
  orgId: string;
  recommendationType: RecommendationType;
  priority: RecommendationPriority;
  count: number;
  totalPotentialSavings?: number;
  avgConfidence?: number;
  nearestDeadline?: Date;
}

// =============================================
// ANOMALIAS
// =============================================

export type AnomalyType =
  | 'spike'
  | 'drop'
  | 'trend_change'
  | 'pattern_break'
  | 'outlier'
  | 'missing_data'
  | 'correlation_break';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

export interface Anomaly {
  id: string;
  orgId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  entityType: string;
  entityId?: string;
  entityName?: string;
  metricType: string;
  detectedValue: number;
  expectedValue?: number;
  expectedRangeLower?: number;
  expectedRangeUpper?: number;
  deviationScore?: number;
  detectionMethod?: string;
  detectedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;

  // Status e resolução
  status: AnomalyStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;

  // Vinculação
  recommendationId?: string;

  metadata: Record<string, unknown>;
}

export interface AnomalySummary {
  orgId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  entityType: string;
  count: number;
  avgDeviation?: number;
  latestDetection?: Date;
}

// =============================================
// DASHBOARD E INSIGHTS
// =============================================

export interface MLDashboard {
  clusters: {
    stores: ClusterSummary[];
    products: ClusterSummary[];
  };
  predictions: {
    upcoming: Prediction[];
    accuracy: PredictionAccuracy[];
  };
  seasonality: {
    activePatterns: SeasonalPattern[];
    upcomingEvents: CalendarEvent[];
  };
  recommendations: {
    pending: PendingRecommendationSummary[];
    recent: Recommendation[];
    impactTotal: number;
  };
  anomalies: {
    open: AnomalySummary[];
    recent: Anomaly[];
  };
}

export interface InsightCard {
  id: string;
  type: 'prediction' | 'pattern' | 'recommendation' | 'anomaly';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metric?: {
    label: string;
    value: number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
  };
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  source: string;
  createdAt: Date;
}

// =============================================
// CONFIGURAÇÕES
// =============================================

export interface MLSettings {
  clustering: {
    enabled: boolean;
    autoRefresh: boolean;
    refreshIntervalDays: number;
    defaultNumClusters: number;
    algorithm: 'kmeans' | 'dbscan' | 'hierarchical';
  };
  predictions: {
    enabled: boolean;
    horizonDays: number[];
    confidenceLevel: number;
    autoTrain: boolean;
    minTrainingSamples: number;
  };
  seasonality: {
    enabled: boolean;
    detectPatterns: boolean;
    minPatternStrength: number;
  };
  recommendations: {
    enabled: boolean;
    autoGenerate: boolean;
    minConfidence: number;
    expirationDays: number;
  };
  anomalies: {
    enabled: boolean;
    zscoreThreshold: number;
    autoAlert: boolean;
    alertSeverities: AnomalySeverity[];
  };
}

export const DEFAULT_ML_SETTINGS: MLSettings = {
  clustering: {
    enabled: true,
    autoRefresh: true,
    refreshIntervalDays: 7,
    defaultNumClusters: 5,
    algorithm: 'kmeans',
  },
  predictions: {
    enabled: true,
    horizonDays: [7, 14, 30],
    confidenceLevel: 0.95,
    autoTrain: true,
    minTrainingSamples: 100,
  },
  seasonality: {
    enabled: true,
    detectPatterns: true,
    minPatternStrength: 0.3,
  },
  recommendations: {
    enabled: true,
    autoGenerate: true,
    minConfidence: 0.7,
    expirationDays: 14,
  },
  anomalies: {
    enabled: true,
    zscoreThreshold: 3.0,
    autoAlert: true,
    alertSeverities: ['high', 'critical'],
  },
};

// =============================================
// CONSTANTES DE UI
// =============================================

export const RECOMMENDATION_TYPE_CONFIG: Record<
  RecommendationType,
  { label: string; icon: string; color: string }
> = {
  reorder: { label: 'Reabastecimento', icon: 'Package', color: 'blue' },
  markdown: { label: 'Redução de Preço', icon: 'Tag', color: 'orange' },
  transfer: { label: 'Transferência', icon: 'ArrowLeftRight', color: 'purple' },
  investigation: { label: 'Investigação', icon: 'Search', color: 'yellow' },
  process_change: { label: 'Mudança de Processo', icon: 'Settings', color: 'gray' },
  supplier_review: { label: 'Revisar Fornecedor', icon: 'Truck', color: 'red' },
  storage_adjustment: { label: 'Ajuste de Armazenamento', icon: 'Box', color: 'cyan' },
  training: { label: 'Treinamento', icon: 'GraduationCap', color: 'green' },
  audit: { label: 'Auditoria', icon: 'ClipboardCheck', color: 'indigo' },
};

export const PRIORITY_CONFIG: Record<
  RecommendationPriority,
  { label: string; color: string; bgColor: string }
> = {
  low: { label: 'Baixa', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  medium: { label: 'Média', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { label: 'Crítica', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const ANOMALY_TYPE_CONFIG: Record<
  AnomalyType,
  { label: string; icon: string; description: string }
> = {
  spike: { label: 'Pico', icon: 'TrendingUp', description: 'Aumento anormal repentino' },
  drop: { label: 'Queda', icon: 'TrendingDown', description: 'Diminuição anormal repentina' },
  trend_change: { label: 'Mudança de Tendência', icon: 'Activity', description: 'Alteração no padrão de tendência' },
  pattern_break: { label: 'Quebra de Padrão', icon: 'AlertTriangle', description: 'Desvio do padrão esperado' },
  outlier: { label: 'Outlier', icon: 'Target', description: 'Valor fora do intervalo normal' },
  missing_data: { label: 'Dados Faltantes', icon: 'FileQuestion', description: 'Ausência de dados esperados' },
  correlation_break: { label: 'Quebra de Correlação', icon: 'Unlink', description: 'Relacionamento esperado quebrado' },
};

export const SEVERITY_CONFIG: Record<
  AnomalySeverity,
  { label: string; color: string; bgColor: string; priority: number }
> = {
  low: { label: 'Baixa', color: 'text-gray-600', bgColor: 'bg-gray-100', priority: 1 },
  medium: { label: 'Média', color: 'text-yellow-600', bgColor: 'bg-yellow-100', priority: 2 },
  high: { label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100', priority: 3 },
  critical: { label: 'Crítica', color: 'text-red-600', bgColor: 'bg-red-100', priority: 4 },
};
