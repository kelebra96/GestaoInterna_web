/**
 * Tipos e Interfaces para o Módulo de Analytics de Vencimentos
 * MyInventory - Sistema de Gestão de Inventário
 */

// ============================================================================
// ENUMS E CONSTANTES
// ============================================================================

export type ExpiryWindow = 'D0' | 'D1' | 'D3' | 'D7' | 'overdue' | 'all';
export type ExpiryStatus = 'reported' | 'watching' | 'confirmed' | 'resolved' | 'ignored' | 'canceled';
export type PeriodFilter = '7d' | '14d' | '30d' | '90d' | 'custom';

export const EXPIRY_WINDOWS = {
  D0: { label: 'Vence Hoje', days: 0, color: '#E82129' },
  D1: { label: 'Vence Amanhã', days: 1, color: '#FF9800' },
  D3: { label: 'Próximos 3 dias', days: 3, color: '#FFB74D' },
  D7: { label: 'Próximos 7 dias', days: 7, color: '#FFC107' },
  overdue: { label: 'Vencidos', days: -1, color: '#B71C1C' },
} as const;

export const STATUS_CONFIG = {
  reported: { label: 'Reportado', color: '#5C94CC', bgColor: '#E3EFFF' },
  watching: { label: 'Monitorando', color: '#FF9800', bgColor: '#FFF3E0' },
  confirmed: { label: 'Confirmado', color: '#E82129', bgColor: '#FFEBEE' },
  resolved: { label: 'Resolvido', color: '#4CAF50', bgColor: '#E8F5E9' },
  ignored: { label: 'Ignorado', color: '#757575', bgColor: '#F5F5F5' },
  canceled: { label: 'Cancelado', color: '#9E9E9E', bgColor: '#FAFAFA' },
} as const;

// ============================================================================
// FILTROS
// ============================================================================

export interface ExpiryAnalyticsFilters {
  period: PeriodFilter;
  startDate?: string; // ISO format YYYY-MM-DD
  endDate?: string;   // ISO format YYYY-MM-DD
  storeId?: string;
  storeIds?: string[];
  status?: ExpiryStatus[];
  expiryWindow?: ExpiryWindow;
  category?: string;
  brand?: string;
  productId?: string;
}

// ============================================================================
// KPIs
// ============================================================================

export interface RiskBacklogKPIs {
  d0Count: number;      // Vence hoje
  d1Count: number;      // Vence amanhã
  d7Count: number;      // Próximos 7 dias
  overdueCount: number; // Vencidos ainda abertos
  totalOpen: number;    // Total aberto
  totalQuantity: number;
  valueAtRisk: number;  // R$ em risco (se price disponível)
  marginAtRisk: number; // Margem em risco
  // Trends (vs período anterior)
  d0Trend?: number;
  d7Trend?: number;
  overdueTrend?: number;
}

export interface EfficiencyKPIs {
  resolvedTotal: number;
  resolvedBeforeExpiry: number;
  efficiencyRate: number;    // % resolvido antes do vencimento
  overdueRate: number;       // % vencidos ainda abertos
  valueRecovered: number;    // R$ recuperado (resolvido antes de vencer)
  // Trends
  efficiencyTrend?: number;
  overdueRateTrend?: number;
}

export interface SLAKPIs {
  p50ResolutionHours: number | null;  // Mediana de tempo até resolução
  p90ResolutionHours: number | null;  // P90
  avgTimeToFirstAction: number | null; // Tempo médio até 1ª ação
  // Trends
  p50Trend?: number;
}

export interface EngagementKPIs {
  totalReports: number;
  watchCount: number;
  confirmCount: number;
  watchRate: number;    // % que recebeu watch
  confirmRate: number;  // % que foi confirmado
  avgTimeToConfirm: number | null; // Horas até confirmação
}

export interface QualityKPIs {
  noPhotoCount: number;
  noPhotoRate: number;    // % sem foto
  duplicatesCount: number;
  invalidDateCount: number;
}

export interface AllKPIs {
  risk: RiskBacklogKPIs;
  efficiency: EfficiencyKPIs;
  sla: SLAKPIs;
  engagement: EngagementKPIs;
  quality: QualityKPIs;
  period: {
    start: string;
    end: string;
    days: number;
  };
  refreshedAt: string;
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export interface TrendDataPoint {
  date: string;       // YYYY-MM-DD
  reported: number;
  resolved: number;
  open: number;
  overdue: number;
  d0: number;
  d1: number;
  valueAtRisk: number;
}

export interface StoreRanking {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalReports: number;
  openCount: number;
  overdueCount: number;
  efficiencyRate: number;
  valueAtRisk: number;
  p50Hours: number | null;
}

export interface SKURanking {
  productId: string;
  sku: string;
  ean: string | null;
  productName: string;
  brand: string;
  category: string;
  occurrenceCount: number;
  storesAffected: number;
  totalQuantity: number;
  totalValueAtRisk: number;
  storeNames: string[];
}

export interface FunnelData {
  reported: number;
  watched: number;
  confirmed: number;
  resolved: number;
  watchRate: number;
  confirmRate: number;
  resolveRate: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  quantity: number;
  valueAtRisk: number;
  percentage: number;
}

// ============================================================================
// REPORT DETAILS
// ============================================================================

export interface ExpiryReportDetail {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  productId: string;
  productSku: string;
  productEan: string | null;
  productName: string;
  productBrand: string;
  productCategory: string;
  productPrice: number;
  quantity: number;
  expiryDate: string;
  daysToExpiry: number;
  photoPath: string | null;
  status: ExpiryStatus;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionHours: number | null;
  resolvedBeforeExpiry: boolean;
  valueAtRisk: number;
  actions: ReportAction[];
}

export interface ReportAction {
  id: string;
  userId: string;
  userName: string;
  actionType: 'watch' | 'confirmed' | 'ignored' | 'resolved' | 'canceled';
  createdAt: string;
}

// ============================================================================
// INSIGHTS
// ============================================================================

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success';
export type InsightCategory = 'risk' | 'efficiency' | 'quality' | 'trend';

export interface AutoInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: string;
  value?: number | string;
  action?: string;
  storeId?: string;
  productId?: string;
  createdAt: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface KPIsResponse {
  success: boolean;
  data: AllKPIs;
}

export interface TrendsResponse {
  success: boolean;
  data: TrendDataPoint[];
}

export interface StoreRankingsResponse {
  success: boolean;
  data: StoreRanking[];
}

export interface SKURankingsResponse {
  success: boolean;
  data: SKURanking[];
}

export interface FunnelResponse {
  success: boolean;
  data: FunnelData;
  byStore?: Record<string, FunnelData>;
}

export interface ReportsListResponse {
  success: boolean;
  data: ExpiryReportDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface InsightsResponse {
  success: boolean;
  data: AutoInsight[];
}

// ============================================================================
// STORE SCORECARD
// ============================================================================

export interface StoreScorecard {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalReports: number;
  totalQuantity: number;
  openCount: number;
  resolvedCount: number;
  overdueCount: number;
  efficiencyRate: number;
  overdueRate: number;
  p50Hours: number | null;
  p90Hours: number | null;
  valueAtRisk: number;
  valueRecovered: number;
  noPhotoRate: number;
  // Comparativo
  efficiencyVsNetwork: number; // diferença vs média da rede
  overdueVsNetwork: number;
}

// ============================================================================
// EXPORT OPTIONS
// ============================================================================

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  includeFields: string[];
  filters: ExpiryAnalyticsFilters;
  reportType: 'kpis' | 'reports' | 'rankings' | 'full';
}
