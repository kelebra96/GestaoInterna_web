// ==========================================
// Tipos para Sistema de Planos e Assinaturas
// ==========================================

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'expired';

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export type BillingCycle = 'monthly' | 'yearly';

// ==========================================
// Plan (Plano)
// ==========================================

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;

  // Limites
  maxStores: number; // -1 = ilimitado
  maxUsers: number;
  maxProducts: number;
  maxMonthlyImports: number;
  maxApiCallsPerDay: number;

  // Features
  hasAnalyticsBasic: boolean;
  hasAnalyticsAdvanced: boolean;
  hasRiskScoring: boolean;
  hasPredictions: boolean;
  hasApiAccess: boolean;
  hasCustomReports: boolean;
  hasRealtimeAlerts: boolean;
  hasIntegrations: boolean;
  hasDedicatedSupport: boolean;
  hasWhiteLabel: boolean;

  // Retenção
  dataRetentionMonths: number;

  // Status
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  featureValue: unknown;
  description: string | null;
  createdAt: Date;
}

// ==========================================
// Subscription (Assinatura)
// ==========================================

export interface Subscription {
  id: string;
  orgId: string;
  planId: string;

  status: SubscriptionStatus;

  // Datas
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;

  // Billing
  billingCycle: BillingCycle;
  nextBillingDate: Date | null;

  // Gateway
  paymentGateway: string | null;
  gatewaySubscriptionId: string | null;
  gatewayCustomerId: string | null;

  // Customizações
  customLimits: CustomLimits;

  // Metadata
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;

  // Relations (populated)
  plan?: Plan;
}

export interface CustomLimits {
  maxStores?: number;
  maxUsers?: number;
  maxProducts?: number;
  maxMonthlyImports?: number;
  maxApiCallsPerDay?: number;
}

// ==========================================
// Usage Tracking
// ==========================================

export interface UsageTracking {
  id: string;
  orgId: string;

  periodStart: Date;
  periodEnd: Date;

  storesCount: number;
  usersCount: number;
  productsCount: number;
  importsCount: number;
  apiCallsCount: number;
  storageBytes: number;

  analyticsQueries: number;
  reportsGenerated: number;
  alertsSent: number;

  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Invoice (Fatura)
// ==========================================

export interface Invoice {
  id: string;
  orgId: string;
  subscriptionId: string | null;

  invoiceNumber: string;
  status: InvoiceStatus;

  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;

  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;

  paymentGateway: string | null;
  gatewayInvoiceId: string | null;
  paymentMethod: string | null;

  lineItems: InvoiceLineItem[];
  billingDetails: BillingDetails;

  pdfUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BillingDetails {
  name?: string;
  email?: string;
  taxId?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

// ==========================================
// API Key
// ==========================================

export interface ApiKey {
  id: string;
  orgId: string;

  name: string;
  keyPrefix: string; // Primeiros caracteres para identificação
  // keyHash nunca é retornado ao cliente

  scopes: string[];

  rateLimitPerMinute: number;
  rateLimitPerDay: number | null;

  lastUsedAt: Date | null;
  usageCount: number;

  isActive: boolean;
  expiresAt: Date | null;

  createdBy: string | null;
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  secretKey: string; // Retornado apenas uma vez!
}

// ==========================================
// Organization Subscription Status (View)
// ==========================================

export interface OrgSubscriptionStatus {
  orgId: string;
  orgName: string;
  orgSlug: string;

  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;

  planName: string | null;
  planDisplayName: string | null;

  maxStores: number | null;
  maxUsers: number | null;
  maxProducts: number | null;

  effectiveMaxStores: number | null;
  effectiveMaxUsers: number | null;
  effectiveMaxProducts: number | null;

  trialEnd: Date | null;
  currentPeriodEnd: Date | null;

  needsAttention: boolean;
}

// ==========================================
// Usage Limit Check Result
// ==========================================

export interface UsageLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining?: number;
  unlimited: boolean;
}

// ==========================================
// DTOs para APIs
// ==========================================

export interface CreateSubscriptionDTO {
  orgId: string;
  planId: string;
  billingCycle?: BillingCycle;
  trialDays?: number;
  customLimits?: CustomLimits;
}

export interface UpdateSubscriptionDTO {
  planId?: string;
  billingCycle?: BillingCycle;
  customLimits?: CustomLimits;
  status?: SubscriptionStatus;
}

export interface UpgradeDowngradePreview {
  currentPlan: Plan;
  newPlan: Plan;
  proratedAmount: number;
  newMonthlyPrice: number;
  effectiveDate: Date;
  changes: {
    feature: string;
    from: unknown;
    to: unknown;
    type: 'upgrade' | 'downgrade' | 'unchanged';
  }[];
}

// ==========================================
// Feature Flags baseados em Plano
// ==========================================

export interface PlanFeatureFlags {
  // Analytics
  canUseBasicAnalytics: boolean;
  canUseAdvancedAnalytics: boolean;
  canUseRiskScoring: boolean;
  canUsePredictions: boolean;

  // Relatórios
  canUseCustomReports: boolean;
  canExportPdf: boolean;
  canExportApi: boolean;

  // Integrações
  canUseApiAccess: boolean;
  canUseIntegrations: boolean;
  canUseRealtimeAlerts: boolean;

  // Premium
  hasDedicatedSupport: boolean;
  hasWhiteLabel: boolean;

  // Limites efetivos (considerando custom_limits)
  limits: {
    maxStores: number;
    maxUsers: number;
    maxProducts: number;
    maxMonthlyImports: number;
    maxApiCallsPerDay: number;
    dataRetentionMonths: number;
  };
}

// ==========================================
// Audit Log
// ==========================================

export interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string | null;

  action: string;
  resourceType: string | null;
  resourceId: string | null;

  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown>;

  ipAddress: string | null;
  userAgent: string | null;

  createdAt: Date;
}

// ==========================================
// Helpers
// ==========================================

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

export function isSubscriptionPastDue(status: SubscriptionStatus): boolean {
  return status === 'past_due' || status === 'unpaid';
}

export function canAccessFeature(
  subscription: Subscription | null,
  plan: Plan | null,
  feature: keyof Plan
): boolean {
  if (!subscription || !plan) return false;
  if (!isSubscriptionActive(subscription.status)) return false;
  return Boolean(plan[feature]);
}

export function getEffectiveLimit(
  subscription: Subscription,
  plan: Plan,
  limitKey: keyof CustomLimits
): number {
  const customLimit = subscription.customLimits?.[limitKey];
  if (customLimit !== undefined) return customLimit;

  const planLimitMap: Record<keyof CustomLimits, keyof Plan> = {
    maxStores: 'maxStores',
    maxUsers: 'maxUsers',
    maxProducts: 'maxProducts',
    maxMonthlyImports: 'maxMonthlyImports',
    maxApiCallsPerDay: 'maxApiCallsPerDay',
  };

  return plan[planLimitMap[limitKey]] as number;
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}
