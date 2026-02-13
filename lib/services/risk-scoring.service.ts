import { createClient } from '@supabase/supabase-js';
import {
  RiskScore,
  RiskAlert,
  RiskThresholds,
  RiskScoreHistory,
  RiskDashboardData,
  StoreRiskRanking,
  ProductRiskRanking,
  CategoryRiskRanking,
  RiskTrendPoint,
  ScoreDistribution,
  RiskScoreFilters,
  UpdateThresholdsDTO,
  RiskLevel,
  RiskEntityType,
  getRiskLevelFromScore,
} from '../types/risk-scoring';

// ==========================================
// Risk Scoring Service
// ==========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export class RiskScoringService {
  // ==========================================
  // Risk Scores
  // ==========================================

  async getScores(orgId: string, filters?: RiskScoreFilters): Promise<RiskScore[]> {
    let query = supabaseAdmin
      .from('risk_scores')
      .select('*')
      .eq('org_id', orgId)
      .order('score', { ascending: false });

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters?.level && filters.level.length > 0) {
      query = query.in('level', filters.level);
    }

    if (filters?.trend && filters.trend.length > 0) {
      query = query.in('trend', filters.trend);
    }

    if (filters?.minScore !== undefined) {
      query = query.gte('score', filters.minScore);
    }

    if (filters?.maxScore !== undefined) {
      query = query.lte('score', filters.maxScore);
    }

    if (filters?.pageSize) {
      const page = filters.page || 1;
      const from = (page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch risk scores: ${error.message}`);
    return (data || []).map(this.mapScoreFromDb);
  }

  async getScoreByEntity(
    orgId: string,
    entityType: RiskEntityType,
    entityId: string
  ): Promise<RiskScore | null> {
    const { data, error } = await supabaseAdmin
      .from('risk_scores')
      .select('*')
      .eq('org_id', orgId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch risk score: ${error.message}`);
    }

    return this.mapScoreFromDb(data);
  }

  async getStoreScores(orgId: string): Promise<StoreRiskRanking[]> {
    const scores = await this.getScores(orgId, { entityType: 'store' });

    return scores.map((score, index) => ({
      rank: index + 1,
      storeId: score.entityId,
      storeName: score.entityName || 'Unknown',
      storeCode: (score.metrics as Record<string, unknown>).storeCode as string || '',
      score: score.score,
      level: score.level,
      trend: score.trend,
      metrics: score.metrics,
      changeFromPrevious: null, // TODO: Calcular baseado no histórico
    }));
  }

  async getProductScores(orgId: string, limit = 50): Promise<ProductRiskRanking[]> {
    const scores = await this.getScores(orgId, {
      entityType: 'product',
      pageSize: limit,
    });

    return scores.map((score, index) => {
      const metrics = score.metrics as Record<string, unknown>;
      return {
        rank: index + 1,
        productId: score.entityId,
        sku: metrics.sku as string || '',
        ean: metrics.ean as string | null || null,
        productName: score.entityName || 'Unknown',
        brand: metrics.brand as string || '',
        category: metrics.category as string || '',
        score: score.score,
        level: score.level,
        trend: score.trend,
        metrics: score.metrics,
        storesAffected: (metrics.storesAffected as number) || 0,
      };
    });
  }

  async getCategoryScores(orgId: string): Promise<CategoryRiskRanking[]> {
    const { data, error } = await supabaseAdmin
      .from('mv_category_risk_metrics')
      .select('*')
      .eq('org_id', orgId)
      .order('value_at_risk', { ascending: false });

    if (error) throw new Error(`Failed to fetch category metrics: ${error.message}`);

    return (data || []).map((row, index) => {
      // Calcular score baseado em métricas
      const recurrenceScore = Math.min(100, (row.reports_30d || 0) * 5);
      const financialScore = Math.min(100, (row.value_at_risk || 0) / 100);
      const efficiencyScore = row.efficiency_rate ? (100 - row.efficiency_rate) : 50;

      const score = Math.round((recurrenceScore * 40 + financialScore * 40 + efficiencyScore * 20) / 100);

      return {
        rank: index + 1,
        category: row.category,
        score,
        level: getRiskLevelFromScore(score),
        productsCount: row.products_count || 0,
        reports30d: row.reports_30d || 0,
        valueAtRisk: row.value_at_risk || 0,
      };
    });
  }

  // ==========================================
  // Dashboard
  // ==========================================

  async getDashboard(orgId: string): Promise<RiskDashboardData> {
    const [storeScores, productScores, categoryScores, alerts, trendData] = await Promise.all([
      this.getStoreScores(orgId),
      this.getProductScores(orgId, 20),
      this.getCategoryScores(orgId),
      this.getActiveAlerts(orgId, 10),
      this.getTrendData(orgId, 30),
    ]);

    const allScores = [...storeScores, ...productScores];

    const summary = {
      totalEntities: allScores.length,
      criticalCount: allScores.filter(s => s.level === 'critical').length,
      highCount: allScores.filter(s => s.level === 'high').length,
      mediumCount: allScores.filter(s => s.level === 'medium').length,
      lowCount: allScores.filter(s => s.level === 'low').length,
      avgScore: allScores.length > 0
        ? Math.round(allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length)
        : 0,
      worseningCount: allScores.filter(s => s.trend === 'worsening').length,
      improvingCount: allScores.filter(s => s.trend === 'improving').length,
    };

    return {
      summary,
      storeRankings: storeScores.slice(0, 10),
      productRankings: productScores.slice(0, 10),
      categoryRankings: categoryScores.slice(0, 10),
      recentAlerts: alerts,
      trendData,
      lastUpdated: new Date(),
    };
  }

  async getDistribution(orgId: string, entityType?: RiskEntityType): Promise<ScoreDistribution> {
    const filters: RiskScoreFilters = {};
    if (entityType) filters.entityType = entityType;

    const scores = await this.getScores(orgId, filters);

    const distribution = {
      low: scores.filter(s => s.level === 'low').length,
      medium: scores.filter(s => s.level === 'medium').length,
      high: scores.filter(s => s.level === 'high').length,
      critical: scores.filter(s => s.level === 'critical').length,
      total: scores.length,
      percentages: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    };

    if (distribution.total > 0) {
      distribution.percentages = {
        low: Math.round((distribution.low / distribution.total) * 100),
        medium: Math.round((distribution.medium / distribution.total) * 100),
        high: Math.round((distribution.high / distribution.total) * 100),
        critical: Math.round((distribution.critical / distribution.total) * 100),
      };
    }

    return distribution;
  }

  // ==========================================
  // Alerts
  // ==========================================

  async getActiveAlerts(orgId: string, limit = 20): Promise<RiskAlert[]> {
    const { data, error } = await supabaseAdmin
      .from('risk_alerts')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch alerts: ${error.message}`);
    return (data || []).map(this.mapAlertFromDb);
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('risk_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) throw new Error(`Failed to acknowledge alert: ${error.message}`);
  }

  async resolveAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('risk_alerts')
      .update({
        is_active: false,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', alertId);

    if (error) throw new Error(`Failed to resolve alert: ${error.message}`);
  }

  async createAlert(
    orgId: string,
    alert: Omit<RiskAlert, 'id' | 'createdAt' | 'isActive' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolvedAt' | 'resolvedBy'>
  ): Promise<RiskAlert> {
    const { data, error } = await supabaseAdmin
      .from('risk_alerts')
      .insert({
        org_id: orgId,
        store_id: alert.storeId,
        entity_type: alert.entityType,
        entity_id: alert.entityId,
        entity_name: alert.entityName,
        alert_type: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        current_score: alert.currentScore,
        previous_score: alert.previousScore,
        score_change: alert.scoreChange,
        metadata: alert.metadata,
        expires_at: alert.expiresAt?.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create alert: ${error.message}`);
    return this.mapAlertFromDb(data);
  }

  // ==========================================
  // History & Trends
  // ==========================================

  async getTrendData(orgId: string, days = 30): Promise<RiskTrendPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('risk_score_history')
      .select('recorded_at, score, level')
      .eq('org_id', orgId)
      .gte('recorded_at', startDate.toISOString().split('T')[0])
      .order('recorded_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch history: ${error.message}`);

    // Agrupar por data
    const grouped = new Map<string, { scores: number[]; levels: RiskLevel[] }>();

    for (const row of data || []) {
      const date = row.recorded_at;
      if (!grouped.has(date)) {
        grouped.set(date, { scores: [], levels: [] });
      }
      grouped.get(date)!.scores.push(row.score);
      grouped.get(date)!.levels.push(row.level as RiskLevel);
    }

    const trends: RiskTrendPoint[] = [];

    grouped.forEach((value, date) => {
      const avgScore = Math.round(
        value.scores.reduce((a, b) => a + b, 0) / value.scores.length
      );

      trends.push({
        date,
        avgScore,
        criticalCount: value.levels.filter(l => l === 'critical').length,
        highCount: value.levels.filter(l => l === 'high').length,
        mediumCount: value.levels.filter(l => l === 'medium').length,
        lowCount: value.levels.filter(l => l === 'low').length,
      });
    });

    return trends;
  }

  async getEntityHistory(
    orgId: string,
    entityType: RiskEntityType,
    entityId: string,
    days = 90
  ): Promise<RiskScoreHistory[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('risk_score_history')
      .select('*')
      .eq('org_id', orgId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .gte('recorded_at', startDate.toISOString().split('T')[0])
      .order('recorded_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch entity history: ${error.message}`);
    return (data || []).map(this.mapHistoryFromDb);
  }

  // ==========================================
  // Thresholds
  // ==========================================

  async getThresholds(orgId: string): Promise<RiskThresholds | null> {
    const { data, error } = await supabaseAdmin
      .from('risk_thresholds')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch thresholds: ${error.message}`);
    }

    return this.mapThresholdsFromDb(data);
  }

  async updateThresholds(orgId: string, dto: UpdateThresholdsDTO): Promise<RiskThresholds> {
    const existing = await this.getThresholds(orgId);

    const updateData: Record<string, unknown> = {};

    if (dto.lowMax !== undefined) updateData.low_max = dto.lowMax;
    if (dto.mediumMax !== undefined) updateData.medium_max = dto.mediumMax;
    if (dto.highMax !== undefined) updateData.high_max = dto.highMax;
    if (dto.weightExpiry !== undefined) updateData.weight_expiry = dto.weightExpiry;
    if (dto.weightRupture !== undefined) updateData.weight_rupture = dto.weightRupture;
    if (dto.weightRecurrence !== undefined) updateData.weight_recurrence = dto.weightRecurrence;
    if (dto.weightFinancial !== undefined) updateData.weight_financial = dto.weightFinancial;
    if (dto.weightEfficiency !== undefined) updateData.weight_efficiency = dto.weightEfficiency;
    if (dto.alertOnCritical !== undefined) updateData.alert_on_critical = dto.alertOnCritical;
    if (dto.alertOnScoreIncrease !== undefined) updateData.alert_on_score_increase = dto.alertOnScoreIncrease;
    if (dto.alertOnTrendChange !== undefined) updateData.alert_on_trend_change = dto.alertOnTrendChange;

    let data;

    if (existing) {
      const result = await supabaseAdmin
        .from('risk_thresholds')
        .update(updateData)
        .eq('org_id', orgId)
        .select()
        .single();

      if (result.error) throw new Error(`Failed to update thresholds: ${result.error.message}`);
      data = result.data;
    } else {
      const result = await supabaseAdmin
        .from('risk_thresholds')
        .insert({ org_id: orgId, ...updateData })
        .select()
        .single();

      if (result.error) throw new Error(`Failed to create thresholds: ${result.error.message}`);
      data = result.data;
    }

    return this.mapThresholdsFromDb(data);
  }

  // ==========================================
  // Refresh Scores
  // ==========================================

  async refreshScores(orgId: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('refresh_all_risk_scores', {
      p_org_id: orgId,
    });

    if (error) throw new Error(`Failed to refresh scores: ${error.message}`);
    return data as number;
  }

  async calculateStoreScore(orgId: string, storeId: string): Promise<RiskScore | null> {
    const { data, error } = await supabaseAdmin.rpc('calculate_store_risk_score', {
      p_org_id: orgId,
      p_store_id: storeId,
    });

    if (error) throw new Error(`Failed to calculate store score: ${error.message}`);

    if (!data || data.length === 0) return null;

    const result = data[0];
    return {
      id: '',
      orgId,
      entityType: 'store',
      entityId: storeId,
      entityName: null,
      score: result.score,
      level: result.level as RiskLevel,
      trend: result.trend,
      expiryScore: result.expiry_score,
      ruptureScore: result.rupture_score,
      recurrenceScore: result.recurrence_score,
      financialScore: result.financial_score,
      efficiencyScore: result.efficiency_score,
      metrics: result.metrics,
      periodStart: new Date(),
      periodEnd: new Date(),
      calculatedAt: new Date(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ==========================================
  // Mappers
  // ==========================================

  private mapScoreFromDb(data: Record<string, unknown>): RiskScore {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      entityType: data.entity_type as RiskEntityType,
      entityId: data.entity_id as string,
      entityName: data.entity_name as string | null,
      score: data.score as number,
      level: data.level as RiskLevel,
      trend: data.trend as 'improving' | 'stable' | 'worsening',
      expiryScore: (data.expiry_score as number) || 0,
      ruptureScore: (data.rupture_score as number) || 0,
      recurrenceScore: (data.recurrence_score as number) || 0,
      financialScore: (data.financial_score as number) || 0,
      efficiencyScore: (data.efficiency_score as number) || 0,
      metrics: (data.metrics as Record<string, unknown>) || {},
      periodStart: new Date(data.period_start as string),
      periodEnd: new Date(data.period_end as string),
      calculatedAt: new Date(data.calculated_at as string),
      version: (data.version as number) || 1,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapAlertFromDb(data: Record<string, unknown>): RiskAlert {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      storeId: data.store_id as string | null,
      entityType: data.entity_type as RiskEntityType,
      entityId: data.entity_id as string,
      entityName: data.entity_name as string | null,
      alertType: data.alert_type as RiskAlert['alertType'],
      severity: data.severity as RiskLevel,
      title: data.title as string,
      description: data.description as string | null,
      currentScore: data.current_score as number | null,
      previousScore: data.previous_score as number | null,
      scoreChange: data.score_change as number | null,
      isActive: data.is_active as boolean,
      acknowledgedAt: data.acknowledged_at ? new Date(data.acknowledged_at as string) : null,
      acknowledgedBy: data.acknowledged_by as string | null,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at as string) : null,
      resolvedBy: data.resolved_by as string | null,
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdAt: new Date(data.created_at as string),
      expiresAt: data.expires_at ? new Date(data.expires_at as string) : null,
    };
  }

  private mapHistoryFromDb(data: Record<string, unknown>): RiskScoreHistory {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      entityType: data.entity_type as RiskEntityType,
      entityId: data.entity_id as string,
      score: data.score as number,
      level: data.level as RiskLevel,
      components: data.components as RiskScoreHistory['components'],
      recordedAt: new Date(data.recorded_at as string),
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapThresholdsFromDb(data: Record<string, unknown>): RiskThresholds {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      lowMax: data.low_max as number,
      mediumMax: data.medium_max as number,
      highMax: data.high_max as number,
      weightExpiry: data.weight_expiry as number,
      weightRupture: data.weight_rupture as number,
      weightRecurrence: data.weight_recurrence as number,
      weightFinancial: data.weight_financial as number,
      weightEfficiency: data.weight_efficiency as number,
      alertOnCritical: data.alert_on_critical as boolean,
      alertOnScoreIncrease: data.alert_on_score_increase as number,
      alertOnTrendChange: data.alert_on_trend_change as boolean,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// Singleton export
export const riskScoringService = new RiskScoringService();
