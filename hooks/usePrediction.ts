import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import {
  ClusterSummary,
  ClusterType,
  Cluster,
  ClusterMember,
  ClusterRun,
  Prediction,
  PredictionType,
  PredictionAccuracy,
  PredictionModel,
  SeasonalPattern,
  CalendarEvent,
  Recommendation,
  RecommendationType,
  RecommendationPriority,
  RecommendationStatus,
  PendingRecommendationSummary,
  FeedbackType,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalySummary,
  MLDashboard,
  MLSettings,
} from '@/lib/types/prediction';

// ==========================================
// Helper para obter token de autenticação (Supabase)
// ==========================================

async function getAuthHeaders(includeContentType = false): Promise<HeadersInit> {
  const headers: HeadersInit = {};

  if (typeof window !== 'undefined') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;

        // Adicionar user payload para o backend
        const userPayload = {
          userId: session.user.id,
          orgId: '', // Será preenchido pelo backend baseado no user
          role: 'user',
          storeIds: [],
        };
        headers['x-user-payload'] = JSON.stringify(userPayload);
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
  }

  if (includeContentType) headers['Content-Type'] = 'application/json';
  return headers;
}

// ==========================================
// useMLDashboard
// ==========================================

export function useMLDashboard() {
  const [dashboard, setDashboard] = useState<MLDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/ml/dashboard', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch ML dashboard');

      const data = await res.json();
      setDashboard(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dashboard,
    loading,
    error,
    fetchDashboard,
  };
}

// ==========================================
// useClusters
// ==========================================

export function useClusters(clusterType?: ClusterType) {
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (clusterType) params.set('type', clusterType);

      const res = await fetch(`/api/ml/clusters?${params}`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch clusters');

      const data = await res.json();
      setClusters(data.clusters || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clusterType]);

  const getClusterDetails = useCallback(
    async (
      clusterId: string,
      includeMembers = false
    ): Promise<{ cluster: Cluster; members?: ClusterMember[] } | null> => {
      try {
        const params = new URLSearchParams();
        if (includeMembers) params.set('includeMembers', 'true');

        const res = await fetch(`/api/ml/clusters/${clusterId}?${params}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch cluster details');

        const data = await res.json();
        return { cluster: data.cluster, members: data.members };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  const runClustering = useCallback(
    async (
      type: ClusterType,
      numClusters = 5,
      algorithm: 'kmeans' | 'dbscan' | 'hierarchical' = 'kmeans'
    ): Promise<ClusterRun | null> => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/ml/clusters', {
          method: 'POST',
          headers: await getAuthHeaders(true),
          body: JSON.stringify({ clusterType: type, numClusters, algorithm }),
        });

        if (!res.ok) throw new Error('Failed to run clustering');

        const data = await res.json();
        return data.run;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    clusters,
    loading,
    error,
    fetchClusters,
    getClusterDetails,
    runClustering,
  };
}

// ==========================================
// usePredictions
// ==========================================

export function usePredictions(options?: {
  predictionType?: PredictionType;
  entityType?: string;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracy[]>([]);
  const [models, setModels] = useState<PredictionModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(
    async (filters?: {
      startDate?: Date;
      endDate?: Date;
      entityId?: string;
      limit?: number;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (options?.predictionType) params.set('type', options.predictionType);
        if (options?.entityType) params.set('entityType', options.entityType);
        if (filters?.startDate)
          params.set('startDate', filters.startDate.toISOString().split('T')[0]);
        if (filters?.endDate)
          params.set('endDate', filters.endDate.toISOString().split('T')[0]);
        if (filters?.entityId) params.set('entityId', filters.entityId);
        if (filters?.limit) params.set('limit', String(filters.limit));

        const res = await fetch(`/api/ml/predictions?${params}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch predictions');

        const data = await res.json();
        setPredictions(data.predictions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [options?.predictionType, options?.entityType]
  );

  const fetchAccuracy = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/predictions/accuracy', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch accuracy');

      const data = await res.json();
      setAccuracy(data.accuracy || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/predictions/models', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch models');

      const data = await res.json();
      setModels(data.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const generatePredictions = useCallback(
    async (
      predictionType: PredictionType,
      horizonDays = 7
    ): Promise<Prediction[]> => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/ml/predictions', {
          method: 'POST',
          headers: await getAuthHeaders(true),
          body: JSON.stringify({ predictionType, horizonDays }),
        });

        if (!res.ok) throw new Error('Failed to generate predictions');

        const data = await res.json();
        return data.predictions || [];
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    predictions,
    accuracy,
    models,
    loading,
    error,
    fetchPredictions,
    fetchAccuracy,
    fetchModels,
    generatePredictions,
  };
}

// ==========================================
// useSeasonality
// ==========================================

export function useSeasonality() {
  const [patterns, setPatterns] = useState<SeasonalPattern[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(
    async (options?: {
      entityType?: string;
      metricType?: string;
      minStrength?: number;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (options?.entityType) params.set('entityType', options.entityType);
        if (options?.metricType) params.set('metricType', options.metricType);
        if (options?.minStrength) params.set('minStrength', String(options.minStrength));

        const res = await fetch(`/api/ml/seasonality?${params}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch patterns');

        const data = await res.json();
        setPatterns(data.patterns || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchEvents = useCallback(async (days = 30) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/ml/seasonality/events?days=${days}`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch events');

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEvent = useCallback(
    async (event: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
      try {
        const res = await fetch('/api/ml/seasonality/events', {
          method: 'POST',
          headers: await getAuthHeaders(true),
          body: JSON.stringify(event),
        });

        if (!res.ok) throw new Error('Failed to create event');

        const data = await res.json();
        setEvents((prev) => [...prev, data.event]);
        return data.event;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  return {
    patterns,
    events,
    loading,
    error,
    fetchPatterns,
    fetchEvents,
    createEvent,
  };
}

// ==========================================
// useRecommendations
// ==========================================

export function useRecommendations(options?: {
  status?: RecommendationStatus;
  type?: RecommendationType;
  priority?: RecommendationPriority;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<PendingRecommendationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(
    async (limit = 50) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (options?.status) params.set('status', options.status);
        if (options?.type) params.set('type', options.type);
        if (options?.priority) params.set('priority', options.priority);
        params.set('limit', String(limit));

        const res = await fetch(`/api/ml/recommendations?${params}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch recommendations');

        const data = await res.json();
        setRecommendations(data.recommendations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [options?.status, options?.type, options?.priority]
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/recommendations?summary=true', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch summary');

      const data = await res.json();
      setSummary(data.summary || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const updateStatus = useCallback(
    async (
      recommendationId: string,
      status: RecommendationStatus,
      notes?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/ml/recommendations/${recommendationId}`, {
          method: 'PUT',
          headers: await getAuthHeaders(true),
          body: JSON.stringify({ status, notes }),
        });

        if (!res.ok) throw new Error('Failed to update recommendation');

        const data = await res.json();
        setRecommendations((prev) =>
          prev.map((r) => (r.id === recommendationId ? data.recommendation : r))
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    []
  );

  const addFeedback = useCallback(
    async (
      recommendationId: string,
      feedbackType: FeedbackType,
      comment?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/ml/recommendations/${recommendationId}/feedback`,
          {
            method: 'POST',
            headers: await getAuthHeaders(true),
            body: JSON.stringify({ feedbackType, comment }),
          }
        );

        if (!res.ok) throw new Error('Failed to add feedback');
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    []
  );

  const generateRecommendations = useCallback(async (): Promise<number> => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/ml/recommendations', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      if (!res.ok) throw new Error('Failed to generate recommendations');

      const data = await res.json();
      return data.count || 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    recommendations,
    summary,
    loading,
    error,
    fetchRecommendations,
    fetchSummary,
    updateStatus,
    addFeedback,
    generateRecommendations,
  };
}

// ==========================================
// useAnomalies
// ==========================================

export function useAnomalies(options?: {
  status?: AnomalyStatus;
  severity?: AnomalySeverity;
  anomalyType?: AnomalyType;
}) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnomalies = useCallback(
    async (limit = 50) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (options?.status) params.set('status', options.status);
        if (options?.severity) params.set('severity', options.severity);
        if (options?.anomalyType) params.set('type', options.anomalyType);
        params.set('limit', String(limit));

        const res = await fetch(`/api/ml/anomalies?${params}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch anomalies');

        const data = await res.json();
        setAnomalies(data.anomalies || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [options?.status, options?.severity, options?.anomalyType]
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/anomalies?summary=true', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch summary');

      const data = await res.json();
      setSummary(data.summary || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const updateStatus = useCallback(
    async (
      anomalyId: string,
      status: AnomalyStatus,
      notes?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/ml/anomalies/${anomalyId}`, {
          method: 'PUT',
          headers: await getAuthHeaders(true),
          body: JSON.stringify({ status, notes }),
        });

        if (!res.ok) throw new Error('Failed to update anomaly');

        const data = await res.json();
        setAnomalies((prev) =>
          prev.map((a) => (a.id === anomalyId ? data.anomaly : a))
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    []
  );

  const detectAnomalies = useCallback(
    async (
      entityType: string,
      metricType: string,
      threshold = 3.0
    ): Promise<number> => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/ml/anomalies', {
          method: 'POST',
          headers: await getAuthHeaders(true),
          body: JSON.stringify({ entityType, metricType, threshold }),
        });

        if (!res.ok) throw new Error('Failed to detect anomalies');

        const data = await res.json();
        return data.count || 0;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return 0;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    anomalies,
    summary,
    loading,
    error,
    fetchAnomalies,
    fetchSummary,
    updateStatus,
    detectAnomalies,
  };
}

// ==========================================
// useMLSettings
// ==========================================

export function useMLSettings() {
  const [settings, setSettings] = useState<MLSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/ml/settings', { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch settings');

      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<MLSettings>): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/ml/settings', {
          method: 'PUT',
          headers: await getAuthHeaders(true),
          body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error('Failed to update settings');

        const data = await res.json();
        setSettings(data.settings);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  };
}
