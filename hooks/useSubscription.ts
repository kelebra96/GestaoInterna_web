import { useState, useEffect, useCallback } from 'react';
import {
  Plan,
  Subscription,
  PlanFeatureFlags,
  UsageLimitResult,
  ApiKey,
  isSubscriptionActive,
  isSubscriptionPastDue,
} from '@/lib/types/subscription';

interface SubscriptionState {
  subscription: Subscription | null;
  features: PlanFeatureFlags | null;
  plans: Plan[];
  loading: boolean;
  error: string | null;
}

interface UsageState {
  stores: UsageLimitResult | null;
  users: UsageLimitResult | null;
  products: UsageLimitResult | null;
  imports: UsageLimitResult | null;
  loading: boolean;
}

// ==========================================
// useSubscription - Dados da assinatura atual
// ==========================================

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    features: null,
    plans: [],
    loading: true,
    error: null,
  });

  const fetchSubscription = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [subscriptionRes, plansRes] = await Promise.all([
        fetch('/api/subscription'),
        fetch('/api/subscription/plans'),
      ]);

      if (!subscriptionRes.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const subscriptionData = await subscriptionRes.json();
      const plansData = await plansRes.json();

      setState({
        subscription: subscriptionData.subscription,
        features: subscriptionData.features,
        plans: plansData.plans || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Helpers
  const isActive = state.subscription
    ? isSubscriptionActive(state.subscription.status)
    : false;

  const isPastDue = state.subscription
    ? isSubscriptionPastDue(state.subscription.status)
    : false;

  const needsUpgrade = !isActive || isPastDue;

  const canUseFeature = useCallback(
    (featureKey: keyof PlanFeatureFlags): boolean => {
      if (!state.features) return false;
      const value = state.features[featureKey];
      return typeof value === 'boolean' ? value : false;
    },
    [state.features]
  );

  const getLimit = useCallback(
    (limitKey: keyof PlanFeatureFlags['limits']): number => {
      if (!state.features?.limits) return 0;
      return state.features.limits[limitKey];
    },
    [state.features]
  );

  return {
    ...state,
    isActive,
    isPastDue,
    needsUpgrade,
    canUseFeature,
    getLimit,
    refresh: fetchSubscription,
  };
}

// ==========================================
// useUsage - Uso e limites
// ==========================================

export function useUsage() {
  const [state, setState] = useState<UsageState>({
    stores: null,
    users: null,
    products: null,
    imports: null,
    loading: true,
  });

  const fetchUsage = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const res = await fetch('/api/subscription/usage');
      if (!res.ok) throw new Error('Failed to fetch usage');

      const data = await res.json();

      setState({
        stores: data.usage.stores,
        users: data.usage.users,
        products: data.usage.products,
        imports: data.usage.imports,
        loading: false,
      });
    } catch (err) {
      console.error('Error fetching usage:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const checkLimit = useCallback(
    async (
      limitType: 'stores' | 'users' | 'products' | 'imports',
      currentCount?: number
    ): Promise<UsageLimitResult> => {
      const res = await fetch('/api/subscription/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitType, currentCount }),
      });

      return res.json();
    },
    []
  );

  const isWithinLimit = useCallback(
    (limitType: 'stores' | 'users' | 'products' | 'imports'): boolean => {
      const usage = state[limitType];
      if (!usage) return true; // Assume permitido se ainda não carregou
      return usage.allowed || usage.unlimited;
    },
    [state]
  );

  const getUsagePercent = useCallback(
    (limitType: 'stores' | 'users' | 'products' | 'imports'): number => {
      const usage = state[limitType];
      if (!usage || usage.unlimited || usage.limit <= 0) return 0;
      return Math.round((usage.current / usage.limit) * 100);
    },
    [state]
  );

  return {
    ...state,
    checkLimit,
    isWithinLimit,
    getUsagePercent,
    refresh: fetchUsage,
  };
}

// ==========================================
// useApiKeys - Gerenciamento de API Keys
// ==========================================

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/subscription/api-keys');

      if (res.status === 403) {
        setError('API access is not available in your plan');
        setApiKeys([]);
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch API keys');

      const data = await res.json();
      setApiKeys(data.apiKeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const createApiKey = useCallback(
    async (params: {
      name: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      expiresAt?: Date;
    }): Promise<{ apiKey: ApiKey; secretKey: string } | null> => {
      try {
        const res = await fetch('/api/subscription/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create API key');
        }

        const data = await res.json();

        // Atualizar lista local
        setApiKeys(prev => [data.apiKey, ...prev]);

        return { apiKey: data.apiKey, secretKey: data.secretKey };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  const revokeApiKey = useCallback(async (keyId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/subscription/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to revoke API key');

      // Remover da lista local
      setApiKeys(prev => prev.filter(k => k.id !== keyId));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    apiKeys,
    loading,
    error,
    createApiKey,
    revokeApiKey,
    refresh: fetchApiKeys,
  };
}

// ==========================================
// usePlans - Lista de planos disponíveis
// ==========================================

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscription/plans')
      .then(res => res.json())
      .then(data => {
        setPlans(data.plans || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getPlanByName = useCallback(
    (name: string): Plan | undefined => {
      return plans.find(p => p.name === name);
    },
    [plans]
  );

  const comparePlans = useCallback(
    (planA: string, planB: string): number => {
      const a = plans.find(p => p.name === planA);
      const b = plans.find(p => p.name === planB);
      if (!a || !b) return 0;
      return a.sortOrder - b.sortOrder;
    },
    [plans]
  );

  return {
    plans,
    loading,
    getPlanByName,
    comparePlans,
  };
}

// ==========================================
// useSubscriptionGuard - HOC/Guard para features
// ==========================================

export function useSubscriptionGuard(requiredFeature?: keyof PlanFeatureFlags) {
  const { features, loading, needsUpgrade, isActive } = useSubscription();

  const hasAccess = !requiredFeature
    ? isActive
    : isActive && features?.[requiredFeature] === true;

  return {
    hasAccess,
    loading,
    needsUpgrade,
    showUpgradePrompt: !loading && !hasAccess,
  };
}
