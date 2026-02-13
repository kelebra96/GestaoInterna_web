import { createClient } from '@supabase/supabase-js';
import {
  Plan,
  Subscription,
  SubscriptionStatus,
  UsageTracking,
  UsageLimitResult,
  PlanFeatureFlags,
  CreateSubscriptionDTO,
  UpdateSubscriptionDTO,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CustomLimits,
  getEffectiveLimit,
  isUnlimited,
} from '../types/subscription';
import crypto from 'crypto';

// ==========================================
// Subscription Service
// ==========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente com service role para operações administrativas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export class SubscriptionService {
  // ==========================================
  // Plans
  // ==========================================

  async getPlans(includePrivate = false): Promise<Plan[]> {
    let query = supabaseAdmin
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!includePrivate) {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch plans: ${error.message}`);
    return (data || []).map(this.mapPlanFromDb);
  }

  async getPlanById(planId: string): Promise<Plan | null> {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }

    return this.mapPlanFromDb(data);
  }

  async getPlanByName(name: string): Promise<Plan | null> {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }

    return this.mapPlanFromDb(data);
  }

  // ==========================================
  // Subscriptions
  // ==========================================

  async getSubscription(orgId: string): Promise<Subscription | null> {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('org_id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    return this.mapSubscriptionFromDb(data);
  }

  async createSubscription(dto: CreateSubscriptionDTO): Promise<Subscription> {
    const plan = await this.getPlanById(dto.planId);
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const trialDays = dto.trialDays ?? 14;
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        org_id: dto.orgId,
        plan_id: dto.planId,
        status: trialDays > 0 ? 'trialing' : 'active',
        billing_cycle: dto.billingCycle || 'monthly',
        trial_start: trialDays > 0 ? now.toISOString() : null,
        trial_end: trialDays > 0 ? trialEnd.toISOString() : null,
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
        custom_limits: dto.customLimits || {},
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create subscription: ${error.message}`);

    // Log de auditoria
    await this.logAudit(dto.orgId, 'subscription.created', 'subscription', data.id, null, data);

    return this.mapSubscriptionFromDb(data);
  }

  async updateSubscription(
    orgId: string,
    dto: UpdateSubscriptionDTO
  ): Promise<Subscription> {
    const current = await this.getSubscription(orgId);
    if (!current) throw new Error('Subscription not found');

    const updateData: Record<string, unknown> = {};

    if (dto.planId) updateData.plan_id = dto.planId;
    if (dto.billingCycle) updateData.billing_cycle = dto.billingCycle;
    if (dto.customLimits) updateData.custom_limits = dto.customLimits;
    if (dto.status) updateData.status = dto.status;

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update subscription: ${error.message}`);

    // Log de auditoria
    await this.logAudit(orgId, 'subscription.updated', 'subscription', data.id, current, data);

    return this.mapSubscriptionFromDb(data);
  }

  async cancelSubscription(
    orgId: string,
    immediately = false
  ): Promise<Subscription> {
    const current = await this.getSubscription(orgId);
    if (!current) throw new Error('Subscription not found');

    const updateData: Record<string, unknown> = {
      canceled_at: new Date().toISOString(),
    };

    if (immediately) {
      updateData.status = 'canceled';
      updateData.ended_at = new Date().toISOString();
    }
    // Se não for imediato, mantém ativo até o fim do período

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel subscription: ${error.message}`);

    await this.logAudit(orgId, 'subscription.canceled', 'subscription', data.id, current, data);

    return this.mapSubscriptionFromDb(data);
  }

  // ==========================================
  // Usage & Limits
  // ==========================================

  async checkUsageLimit(
    orgId: string,
    limitType: 'stores' | 'users' | 'products' | 'imports',
    currentCount?: number
  ): Promise<UsageLimitResult> {
    const { data, error } = await supabaseAdmin.rpc('check_usage_limit', {
      p_org_id: orgId,
      p_limit_type: limitType,
      p_current_count: currentCount ?? null,
    });

    if (error) throw new Error(`Failed to check usage limit: ${error.message}`);
    return data as UsageLimitResult;
  }

  async hasFeature(orgId: string, featureKey: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('has_feature', {
      p_org_id: orgId,
      p_feature_key: featureKey,
    });

    if (error) throw new Error(`Failed to check feature: ${error.message}`);
    return data as boolean;
  }

  async getFeatureFlags(orgId: string): Promise<PlanFeatureFlags> {
    const subscription = await this.getSubscription(orgId);

    if (!subscription || !subscription.plan) {
      return this.getDefaultFeatureFlags();
    }

    const plan = subscription.plan;

    return {
      canUseBasicAnalytics: plan.hasAnalyticsBasic,
      canUseAdvancedAnalytics: plan.hasAnalyticsAdvanced,
      canUseRiskScoring: plan.hasRiskScoring,
      canUsePredictions: plan.hasPredictions,
      canUseCustomReports: plan.hasCustomReports,
      canExportPdf: plan.hasAnalyticsAdvanced,
      canExportApi: plan.hasApiAccess,
      canUseApiAccess: plan.hasApiAccess,
      canUseIntegrations: plan.hasIntegrations,
      canUseRealtimeAlerts: plan.hasRealtimeAlerts,
      hasDedicatedSupport: plan.hasDedicatedSupport,
      hasWhiteLabel: plan.hasWhiteLabel,
      limits: {
        maxStores: getEffectiveLimit(subscription, plan, 'maxStores'),
        maxUsers: getEffectiveLimit(subscription, plan, 'maxUsers'),
        maxProducts: getEffectiveLimit(subscription, plan, 'maxProducts'),
        maxMonthlyImports: getEffectiveLimit(subscription, plan, 'maxMonthlyImports'),
        maxApiCallsPerDay: getEffectiveLimit(subscription, plan, 'maxApiCallsPerDay'),
        dataRetentionMonths: plan.dataRetentionMonths,
      },
    };
  }

  async trackUsage(
    orgId: string,
    metrics: Partial<Omit<UsageTracking, 'id' | 'orgId' | 'periodStart' | 'periodEnd' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { error } = await supabaseAdmin
      .from('usage_tracking')
      .upsert(
        {
          org_id: orgId,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          ...this.mapUsageToDb(metrics),
        },
        {
          onConflict: 'org_id,period_start',
        }
      );

    if (error) throw new Error(`Failed to track usage: ${error.message}`);
  }

  async incrementUsage(
    orgId: string,
    metric: keyof Pick<UsageTracking, 'importsCount' | 'apiCallsCount' | 'analyticsQueries' | 'reportsGenerated' | 'alertsSent'>,
    amount = 1
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const columnMap: Record<string, string> = {
      importsCount: 'imports_count',
      apiCallsCount: 'api_calls_count',
      analyticsQueries: 'analytics_queries',
      reportsGenerated: 'reports_generated',
      alertsSent: 'alerts_sent',
    };

    const column = columnMap[metric];

    // Usar raw SQL para increment atômico
    const { error } = await supabaseAdmin.rpc('increment_usage_counter', {
      p_org_id: orgId,
      p_period_start: periodStart.toISOString().split('T')[0],
      p_column_name: column,
      p_amount: amount,
    });

    // Se a RPC não existir, fazer upsert manual
    if (error && error.message.includes('function')) {
      await this.trackUsage(orgId, { [metric]: amount });
    } else if (error) {
      throw new Error(`Failed to increment usage: ${error.message}`);
    }
  }

  // ==========================================
  // API Keys
  // ==========================================

  async createApiKey(
    orgId: string,
    userId: string,
    dto: CreateApiKeyRequest
  ): Promise<CreateApiKeyResponse> {
    // Gerar chave única
    const secretKey = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(secretKey).digest('hex');
    const keyPrefix = secretKey.substring(0, 12);

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        org_id: orgId,
        name: dto.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: dto.scopes || ['read'],
        rate_limit_per_minute: dto.rateLimitPerMinute || 60,
        rate_limit_per_day: dto.rateLimitPerDay,
        expires_at: dto.expiresAt?.toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create API key: ${error.message}`);

    await this.logAudit(orgId, 'api_key.created', 'api_key', data.id, null, { name: dto.name });

    return {
      apiKey: this.mapApiKeyFromDb(data),
      secretKey, // Retornado apenas uma vez!
    };
  }

  async listApiKeys(orgId: string): Promise<ApiKey[]> {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list API keys: ${error.message}`);
    return (data || []).map(this.mapApiKeyFromDb);
  }

  async revokeApiKey(orgId: string, keyId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to revoke API key: ${error.message}`);

    await this.logAudit(orgId, 'api_key.revoked', 'api_key', keyId, null, null);
  }

  async validateApiKey(secretKey: string): Promise<{ valid: boolean; orgId?: string; scopes?: string[] }> {
    const keyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('org_id, scopes, is_active, expires_at')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      return { valid: false };
    }

    if (!data.is_active) {
      return { valid: false };
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false };
    }

    // Atualizar last_used_at
    await supabaseAdmin
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: supabaseAdmin.rpc('increment', { x: 1 }),
      })
      .eq('key_hash', keyHash);

    return {
      valid: true,
      orgId: data.org_id,
      scopes: data.scopes,
    };
  }

  // ==========================================
  // Audit Log
  // ==========================================

  private async logAudit(
    orgId: string,
    action: string,
    resourceType: string | null,
    resourceId: string | null,
    oldValues: unknown,
    newValues: unknown,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await supabaseAdmin.from('audit_log').insert({
        org_id: orgId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: oldValues,
        new_values: newValues,
        metadata,
      });
    } catch {
      // Não falhar a operação principal por erro de audit
      console.error('Failed to log audit:', action);
    }
  }

  // ==========================================
  // Helpers - Mappers
  // ==========================================

  private mapPlanFromDb(data: Record<string, unknown>): Plan {
    return {
      id: data.id as string,
      name: data.name as string,
      displayName: data.display_name as string,
      description: data.description as string | null,
      priceMonthly: Number(data.price_monthly),
      priceYearly: data.price_yearly ? Number(data.price_yearly) : null,
      currency: data.currency as string,
      maxStores: data.max_stores as number,
      maxUsers: data.max_users as number,
      maxProducts: data.max_products as number,
      maxMonthlyImports: data.max_monthly_imports as number,
      maxApiCallsPerDay: data.max_api_calls_per_day as number,
      hasAnalyticsBasic: data.has_analytics_basic as boolean,
      hasAnalyticsAdvanced: data.has_analytics_advanced as boolean,
      hasRiskScoring: data.has_risk_scoring as boolean,
      hasPredictions: data.has_predictions as boolean,
      hasApiAccess: data.has_api_access as boolean,
      hasCustomReports: data.has_custom_reports as boolean,
      hasRealtimeAlerts: data.has_realtime_alerts as boolean,
      hasIntegrations: data.has_integrations as boolean,
      hasDedicatedSupport: data.has_dedicated_support as boolean,
      hasWhiteLabel: data.has_white_label as boolean,
      dataRetentionMonths: data.data_retention_months as number,
      isActive: data.is_active as boolean,
      isPublic: data.is_public as boolean,
      sortOrder: data.sort_order as number,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapSubscriptionFromDb(data: Record<string, unknown>): Subscription {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      planId: data.plan_id as string,
      status: data.status as SubscriptionStatus,
      trialStart: data.trial_start ? new Date(data.trial_start as string) : null,
      trialEnd: data.trial_end ? new Date(data.trial_end as string) : null,
      currentPeriodStart: data.current_period_start ? new Date(data.current_period_start as string) : null,
      currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end as string) : null,
      canceledAt: data.canceled_at ? new Date(data.canceled_at as string) : null,
      endedAt: data.ended_at ? new Date(data.ended_at as string) : null,
      billingCycle: data.billing_cycle as 'monthly' | 'yearly',
      nextBillingDate: data.next_billing_date ? new Date(data.next_billing_date as string) : null,
      paymentGateway: data.payment_gateway as string | null,
      gatewaySubscriptionId: data.gateway_subscription_id as string | null,
      gatewayCustomerId: data.gateway_customer_id as string | null,
      customLimits: (data.custom_limits as CustomLimits) || {},
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
      plan: data.plan ? this.mapPlanFromDb(data.plan as Record<string, unknown>) : undefined,
    };
  }

  private mapApiKeyFromDb(data: Record<string, unknown>): ApiKey {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      name: data.name as string,
      keyPrefix: data.key_prefix as string,
      scopes: data.scopes as string[],
      rateLimitPerMinute: data.rate_limit_per_minute as number,
      rateLimitPerDay: data.rate_limit_per_day as number | null,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : null,
      usageCount: data.usage_count as number,
      isActive: data.is_active as boolean,
      expiresAt: data.expires_at ? new Date(data.expires_at as string) : null,
      createdBy: data.created_by as string | null,
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapUsageToDb(
    metrics: Partial<Omit<UsageTracking, 'id' | 'orgId' | 'periodStart' | 'periodEnd' | 'createdAt' | 'updatedAt'>>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (metrics.storesCount !== undefined) result.stores_count = metrics.storesCount;
    if (metrics.usersCount !== undefined) result.users_count = metrics.usersCount;
    if (metrics.productsCount !== undefined) result.products_count = metrics.productsCount;
    if (metrics.importsCount !== undefined) result.imports_count = metrics.importsCount;
    if (metrics.apiCallsCount !== undefined) result.api_calls_count = metrics.apiCallsCount;
    if (metrics.storageBytes !== undefined) result.storage_bytes = metrics.storageBytes;
    if (metrics.analyticsQueries !== undefined) result.analytics_queries = metrics.analyticsQueries;
    if (metrics.reportsGenerated !== undefined) result.reports_generated = metrics.reportsGenerated;
    if (metrics.alertsSent !== undefined) result.alerts_sent = metrics.alertsSent;

    return result;
  }

  private getDefaultFeatureFlags(): PlanFeatureFlags {
    return {
      canUseBasicAnalytics: false,
      canUseAdvancedAnalytics: false,
      canUseRiskScoring: false,
      canUsePredictions: false,
      canUseCustomReports: false,
      canExportPdf: false,
      canExportApi: false,
      canUseApiAccess: false,
      canUseIntegrations: false,
      canUseRealtimeAlerts: false,
      hasDedicatedSupport: false,
      hasWhiteLabel: false,
      limits: {
        maxStores: 0,
        maxUsers: 0,
        maxProducts: 0,
        maxMonthlyImports: 0,
        maxApiCallsPerDay: 0,
        dataRetentionMonths: 0,
      },
    };
  }
}

// Singleton export
export const subscriptionService = new SubscriptionService();
