import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '../services/subscription.service';
import { isSubscriptionActive, isSubscriptionPastDue } from '../types/subscription';

// ==========================================
// Subscription Guard Middleware
// ==========================================

export interface SubscriptionContext {
  orgId: string;
  planName: string;
  status: string;
  features: {
    canUseBasicAnalytics: boolean;
    canUseAdvancedAnalytics: boolean;
    canUseRiskScoring: boolean;
    canUsePredictions: boolean;
    canUseApiAccess: boolean;
  };
  limits: {
    maxStores: number;
    maxUsers: number;
    maxProducts: number;
    maxMonthlyImports: number;
    maxApiCallsPerDay: number;
  };
}

/**
 * Verifica se a organização tem uma assinatura ativa
 */
export async function requireActiveSubscription(
  orgId: string
): Promise<{ valid: boolean; error?: string; context?: SubscriptionContext }> {
  try {
    const subscription = await subscriptionService.getSubscription(orgId);

    if (!subscription) {
      return {
        valid: false,
        error: 'No active subscription found. Please subscribe to a plan.',
      };
    }

    if (!isSubscriptionActive(subscription.status)) {
      if (isSubscriptionPastDue(subscription.status)) {
        return {
          valid: false,
          error: 'Your subscription payment is past due. Please update your payment method.',
        };
      }
      return {
        valid: false,
        error: `Subscription is ${subscription.status}. Please reactivate your subscription.`,
      };
    }

    const features = await subscriptionService.getFeatureFlags(orgId);

    return {
      valid: true,
      context: {
        orgId,
        planName: subscription.plan?.name || 'unknown',
        status: subscription.status,
        features: {
          canUseBasicAnalytics: features.canUseBasicAnalytics,
          canUseAdvancedAnalytics: features.canUseAdvancedAnalytics,
          canUseRiskScoring: features.canUseRiskScoring,
          canUsePredictions: features.canUsePredictions,
          canUseApiAccess: features.canUseApiAccess,
        },
        limits: features.limits,
      },
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    return {
      valid: false,
      error: 'Failed to verify subscription status.',
    };
  }
}

/**
 * Verifica se a organização tem acesso a uma feature específica
 */
export async function requireFeature(
  orgId: string,
  featureKey: string
): Promise<{ allowed: boolean; error?: string }> {
  try {
    // Primeiro verificar se tem assinatura ativa
    const subscriptionCheck = await requireActiveSubscription(orgId);
    if (!subscriptionCheck.valid) {
      return { allowed: false, error: subscriptionCheck.error };
    }

    const hasFeature = await subscriptionService.hasFeature(orgId, featureKey);

    if (!hasFeature) {
      return {
        allowed: false,
        error: `This feature requires a higher plan. Please upgrade to access ${featureKey}.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Feature check error:', error);
    return {
      allowed: false,
      error: 'Failed to verify feature access.',
    };
  }
}

/**
 * Verifica se a organização está dentro do limite de uso
 */
export async function requireWithinLimit(
  orgId: string,
  limitType: 'stores' | 'users' | 'products' | 'imports',
  currentCount?: number
): Promise<{ allowed: boolean; error?: string; limit?: number; current?: number }> {
  try {
    // Primeiro verificar se tem assinatura ativa
    const subscriptionCheck = await requireActiveSubscription(orgId);
    if (!subscriptionCheck.valid) {
      return { allowed: false, error: subscriptionCheck.error };
    }

    const result = await subscriptionService.checkUsageLimit(orgId, limitType, currentCount);

    if (!result.allowed) {
      const limitNames: Record<string, string> = {
        stores: 'lojas',
        users: 'usuários',
        products: 'produtos',
        imports: 'importações mensais',
      };

      return {
        allowed: false,
        error: `Você atingiu o limite de ${result.limit} ${limitNames[limitType]} do seu plano. Faça upgrade para continuar.`,
        limit: result.limit,
        current: result.current,
      };
    }

    return {
      allowed: true,
      limit: result.limit,
      current: result.current,
    };
  } catch (error) {
    console.error('Limit check error:', error);
    return {
      allowed: false,
      error: 'Failed to verify usage limits.',
    };
  }
}

// ==========================================
// Response Helpers
// ==========================================

export function subscriptionErrorResponse(error: string, statusCode = 402): NextResponse {
  return NextResponse.json(
    {
      error,
      code: 'SUBSCRIPTION_ERROR',
      upgradeUrl: '/configuracoes/planos',
    },
    { status: statusCode }
  );
}

export function featureNotAvailableResponse(feature: string): NextResponse {
  return NextResponse.json(
    {
      error: `This feature (${feature}) is not available in your current plan.`,
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeUrl: '/configuracoes/planos',
    },
    { status: 403 }
  );
}

export function limitExceededResponse(
  limitType: string,
  current: number,
  limit: number
): NextResponse {
  return NextResponse.json(
    {
      error: `You have reached the ${limitType} limit of your plan.`,
      code: 'LIMIT_EXCEEDED',
      current,
      limit,
      upgradeUrl: '/configuracoes/planos',
    },
    { status: 402 }
  );
}

// ==========================================
// HOC para API Routes
// ==========================================

type ApiHandler = (
  request: NextRequest,
  context: { params: Record<string, string>; subscription: SubscriptionContext }
) => Promise<NextResponse>;

/**
 * Wrapper para API routes que requerem assinatura ativa
 */
export function withSubscription(handler: ApiHandler) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    // Extrair orgId do JWT ou header
    const orgId = request.headers.get('x-org-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const subscriptionCheck = await requireActiveSubscription(orgId);

    if (!subscriptionCheck.valid) {
      return subscriptionErrorResponse(subscriptionCheck.error!);
    }

    return handler(request, {
      params: context.params,
      subscription: subscriptionCheck.context!,
    });
  };
}

/**
 * Wrapper para API routes que requerem feature específica
 */
export function withFeature(featureKey: string, handler: ApiHandler) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const orgId = request.headers.get('x-org-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const featureCheck = await requireFeature(orgId, featureKey);

    if (!featureCheck.allowed) {
      return featureNotAvailableResponse(featureKey);
    }

    const subscriptionCheck = await requireActiveSubscription(orgId);

    return handler(request, {
      params: context.params,
      subscription: subscriptionCheck.context!,
    });
  };
}
