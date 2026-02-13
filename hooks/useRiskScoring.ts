import { useState, useEffect, useCallback } from 'react';
import {
  RiskScore,
  RiskAlert,
  RiskDashboardData,
  StoreRiskRanking,
  ProductRiskRanking,
  RiskThresholds,
  RiskScoreFilters,
  ScoreDistribution,
  RiskTrendPoint,
  RiskScoreHistory,
} from '@/lib/types/risk-scoring';

// ==========================================
// useRiskDashboard - Dashboard completo
// ==========================================

export function useRiskDashboard() {
  const [dashboard, setDashboard] = useState<RiskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/risk-scoring/dashboard');

      if (res.status === 403) {
        setError('Risk scoring requires Professional plan or higher');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch dashboard');

      const data = await res.json();
      setDashboard(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
  };
}

// ==========================================
// useRiskScores - Lista de scores
// ==========================================

export function useRiskScores(filters?: RiskScoreFilters) {
  const [scores, setScores] = useState<RiskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.entityType) params.set('entityType', filters.entityType);
      if (filters?.level) params.set('level', filters.level.join(','));
      if (filters?.trend) params.set('trend', filters.trend.join(','));
      if (filters?.minScore !== undefined) params.set('minScore', String(filters.minScore));
      if (filters?.maxScore !== undefined) params.set('maxScore', String(filters.maxScore));
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));

      const res = await fetch(`/api/risk-scoring?${params}`);

      if (!res.ok) throw new Error('Failed to fetch scores');

      const data = await res.json();
      setScores(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters?.entityType, filters?.level, filters?.trend, filters?.minScore, filters?.maxScore, filters?.page, filters?.pageSize]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const refreshScores = useCallback(async () => {
    try {
      setLoading(true);
      await fetch('/api/risk-scoring', { method: 'POST' });
      await fetchScores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [fetchScores]);

  return {
    scores,
    loading,
    error,
    refresh: fetchScores,
    refreshScores,
  };
}

// ==========================================
// useStoreRiskRanking - Ranking de lojas
// ==========================================

export function useStoreRiskRanking() {
  const [rankings, setRankings] = useState<StoreRiskRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/risk-scoring/stores');

      if (res.status === 403) {
        setError('Risk scoring requires Professional plan or higher');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch store rankings');

      const data = await res.json();
      setRankings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return {
    rankings,
    loading,
    error,
    refresh: fetchRankings,
  };
}

// ==========================================
// useProductRiskRanking - Ranking de produtos
// ==========================================

export function useProductRiskRanking(limit = 50) {
  const [rankings, setRankings] = useState<ProductRiskRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/risk-scoring/products?limit=${limit}`);

      if (res.status === 403) {
        setError('Risk scoring requires Professional plan or higher');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch product rankings');

      const data = await res.json();
      setRankings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return {
    rankings,
    loading,
    error,
    refresh: fetchRankings,
  };
}

// ==========================================
// useStoreRiskDetail - Detalhes de uma loja
// ==========================================

export function useStoreRiskDetail(storeId: string | null) {
  const [score, setScore] = useState<RiskScore | null>(null);
  const [history, setHistory] = useState<RiskScoreHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/risk-scoring/stores/${storeId}?includeHistory=true`);

      if (!res.ok) throw new Error('Failed to fetch store detail');

      const data = await res.json();
      setScore(data.data);
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    score,
    history,
    loading,
    error,
    refresh: fetchDetail,
  };
}

// ==========================================
// useRiskAlerts - Alertas de risco
// ==========================================

export function useRiskAlerts(limit = 20) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/risk-scoring/alerts?limit=${limit}`);

      if (!res.ok) throw new Error('Failed to fetch alerts');

      const data = await res.json();
      setAlerts(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const res = await fetch(`/api/risk-scoring/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      });

      if (!res.ok) throw new Error('Failed to acknowledge alert');

      // Atualizar lista local
      setAlerts(prev =>
        prev.map(a =>
          a.id === alertId
            ? { ...a, acknowledgedAt: new Date() }
            : a
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const res = await fetch(`/api/risk-scoring/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });

      if (!res.ok) throw new Error('Failed to resolve alert');

      // Remover da lista local
      setAlerts(prev => prev.filter(a => a.id !== alertId));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    alerts,
    unreadCount,
    loading,
    error,
    acknowledgeAlert,
    resolveAlert,
    refresh: fetchAlerts,
  };
}

// ==========================================
// useRiskThresholds - Configurações
// ==========================================

export function useRiskThresholds() {
  const [thresholds, setThresholds] = useState<RiskThresholds | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/risk-scoring/thresholds');

      if (!res.ok) throw new Error('Failed to fetch thresholds');

      const data = await res.json();
      setThresholds(data.data);
      setIsDefault(data.isDefault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const updateThresholds = useCallback(
    async (updates: Partial<RiskThresholds>): Promise<boolean> => {
      try {
        const res = await fetch('/api/risk-scoring/thresholds', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update thresholds');
        }

        const data = await res.json();
        setThresholds(data.data);
        setIsDefault(false);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    []
  );

  return {
    thresholds,
    isDefault,
    loading,
    error,
    updateThresholds,
    refresh: fetchThresholds,
  };
}

// ==========================================
// useRiskDistribution - Distribuição de scores
// ==========================================

export function useRiskDistribution() {
  const { dashboard, loading, error } = useRiskDashboard();

  const distribution: ScoreDistribution | null = dashboard
    ? {
        low: dashboard.summary.lowCount,
        medium: dashboard.summary.mediumCount,
        high: dashboard.summary.highCount,
        critical: dashboard.summary.criticalCount,
        total: dashboard.summary.totalEntities,
        percentages: {
          low: Math.round((dashboard.summary.lowCount / dashboard.summary.totalEntities) * 100) || 0,
          medium: Math.round((dashboard.summary.mediumCount / dashboard.summary.totalEntities) * 100) || 0,
          high: Math.round((dashboard.summary.highCount / dashboard.summary.totalEntities) * 100) || 0,
          critical: Math.round((dashboard.summary.criticalCount / dashboard.summary.totalEntities) * 100) || 0,
        },
      }
    : null;

  return {
    distribution,
    loading,
    error,
  };
}
