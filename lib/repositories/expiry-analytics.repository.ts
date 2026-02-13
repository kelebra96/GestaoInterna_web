/**
 * Repositório de Queries para Analytics de Vencimentos
 * Camada de acesso a dados usando Prisma
 *
 * NOTA: Este repositório depende do modelo ExpiryReport no Prisma.
 * Atualmente retorna dados vazios porque o modelo não está definido.
 */

import {
  ExpiryAnalyticsFilters,
  RiskBacklogKPIs,
  EfficiencyKPIs,
  SLAKPIs,
  EngagementKPIs,
  QualityKPIs,
  TrendDataPoint,
  StoreRanking,
  SKURanking,
  FunnelData,
  ExpiryReportDetail,
  StoreScorecard,
  AllKPIs,
} from '@/lib/types/expiry-analytics';

// Default empty values
const emptyRiskBacklogKPIs: RiskBacklogKPIs = {
  d0Count: 0,
  d1Count: 0,
  d7Count: 0,
  overdueCount: 0,
  totalOpen: 0,
  totalQuantity: 0,
  valueAtRisk: 0,
  marginAtRisk: 0,
};

const emptyEfficiencyKPIs: EfficiencyKPIs = {
  resolvedTotal: 0,
  resolvedBeforeExpiry: 0,
  efficiencyRate: 0,
  overdueRate: 0,
  valueRecovered: 0,
};

const emptySLAKPIs: SLAKPIs = {
  p50ResolutionHours: null,
  p90ResolutionHours: null,
  avgTimeToFirstAction: null,
};

const emptyEngagementKPIs: EngagementKPIs = {
  totalReports: 0,
  watchCount: 0,
  confirmCount: 0,
  watchRate: 0,
  confirmRate: 0,
  avgTimeToConfirm: null,
};

const emptyQualityKPIs: QualityKPIs = {
  noPhotoCount: 0,
  noPhotoRate: 0,
  duplicatesCount: 0,
  invalidDateCount: 0,
};

// ============================================================================
// EXPORTED FUNCTIONS - All return empty data
// ============================================================================

export async function getRiskBacklogKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<RiskBacklogKPIs> {
  return emptyRiskBacklogKPIs;
}

export async function getEfficiencyKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<EfficiencyKPIs> {
  return emptyEfficiencyKPIs;
}

export async function getSLAKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<SLAKPIs> {
  return emptySLAKPIs;
}

export async function getEngagementKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<EngagementKPIs> {
  return emptyEngagementKPIs;
}

export async function getQualityKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<QualityKPIs> {
  return emptyQualityKPIs;
}

export async function getAllKPIs(
  _filters: ExpiryAnalyticsFilters
): Promise<AllKPIs> {
  const now = new Date();
  return {
    risk: emptyRiskBacklogKPIs,
    efficiency: emptyEfficiencyKPIs,
    sla: emptySLAKPIs,
    engagement: emptyEngagementKPIs,
    quality: emptyQualityKPIs,
    period: {
      start: now.toISOString(),
      end: now.toISOString(),
      days: 0,
    },
    refreshedAt: now.toISOString(),
  };
}

export async function getTrendData(
  _filters: ExpiryAnalyticsFilters,
  _metric: 'reports' | 'units' | 'loss' | 'resolution_time'
): Promise<TrendDataPoint[]> {
  return [];
}

export async function getStoreRankings(
  _filters: ExpiryAnalyticsFilters,
  _metric: 'reports' | 'resolution_rate' | 'avg_time' | 'loss',
  _limit?: number
): Promise<StoreRanking[]> {
  return [];
}

export async function getSKURankings(
  _filters: ExpiryAnalyticsFilters,
  _limit?: number
): Promise<SKURanking[]> {
  return [];
}

export async function getFunnelData(
  _filters: ExpiryAnalyticsFilters
): Promise<FunnelData> {
  return {
    reported: 0,
    watched: 0,
    confirmed: 0,
    resolved: 0,
    watchRate: 0,
    confirmRate: 0,
    resolveRate: 0,
  };
}

export async function getReportDetails(
  _filters: ExpiryAnalyticsFilters,
  _page?: number,
  _pageSize?: number
): Promise<{ reports: ExpiryReportDetail[]; total: number }> {
  return { reports: [], total: 0 };
}

export async function getStoreScorecard(
  _storeId: string,
  _filters: ExpiryAnalyticsFilters
): Promise<StoreScorecard | null> {
  return null;
}
