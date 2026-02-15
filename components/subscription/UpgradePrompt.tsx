'use client';

import { useSubscription, usePlans } from '@/hooks/useSubscription';
import { Plan } from '@/lib/types/subscription';
import Link from 'next/link';

interface UpgradePromptProps {
  feature?: string;
  limitType?: 'stores' | 'users' | 'products' | 'imports';
  current?: number;
  limit?: number;
  variant?: 'banner' | 'card' | 'inline' | 'modal';
  onUpgrade?: () => void;
}

export function UpgradePrompt({
  feature,
  limitType,
  current,
  limit,
  variant = 'banner',
  onUpgrade,
}: UpgradePromptProps) {
  const { subscription, needsUpgrade, isPastDue } = useSubscription();
  const { plans } = usePlans();

  // Encontrar próximo plano
  const currentPlanIndex = plans.findIndex(
    p => p.id === subscription?.planId
  );
  const nextPlan = plans[currentPlanIndex + 1];

  const getMessage = () => {
    if (isPastDue) {
      return 'Sua assinatura está com pagamento pendente. Atualize seu método de pagamento para continuar usando a plataforma.';
    }

    if (limitType && current !== undefined && limit !== undefined) {
      const limitNames: Record<string, string> = {
        stores: 'lojas',
        users: 'usuários',
        products: 'produtos',
        imports: 'importações',
      };
      return `Você atingiu o limite de ${limit} ${limitNames[limitType]} do seu plano (${current}/${limit}). Faça upgrade para continuar.`;
    }

    if (feature) {
      return `A funcionalidade "${feature}" não está disponível no seu plano atual. Faça upgrade para desbloquear.`;
    }

    return 'Faça upgrade do seu plano para desbloquear mais funcionalidades.';
  };

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <p className="text-sm font-medium">{getMessage()}</p>
          </div>
          <Link
            href="/configuracoes/planos"
            className="bg-white text-amber-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-amber-50 transition-colors"
            onClick={onUpgrade}
          >
            {nextPlan ? `Upgrade para ${nextPlan.displayName}` : 'Ver planos'}
          </Link>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-amber-100 p-3 rounded-full">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Recurso Premium
            </h3>
            <p className="text-gray-600 text-sm mb-4">{getMessage()}</p>
            {nextPlan && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Recomendado:</p>
                <p className="font-semibold text-gray-900">
                  {nextPlan.displayName} - R$ {nextPlan.priceMonthly}/mês
                </p>
              </div>
            )}
            <Link
              href="/configuracoes/planos"
              className="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors"
              onClick={onUpgrade}
            >
              Ver planos disponíveis
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-amber-600 text-sm">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>{getMessage()}</span>
        <Link
          href="/configuracoes/planos"
          className="font-semibold hover:underline"
          onClick={onUpgrade}
        >
          Fazer upgrade
        </Link>
      </div>
    );
  }

  return null;
}

// ==========================================
// Componente de comparação de planos
// ==========================================

interface PlanComparisonProps {
  currentPlanId?: string;
  onSelectPlan?: (plan: Plan) => void;
}

export function PlanComparison({ currentPlanId, onSelectPlan }: PlanComparisonProps) {
  const { plans, loading } = usePlans();

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {plans.map(plan => {
        const isCurrent = plan.id === currentPlanId;
        const isPopular = plan.name === 'professional';

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-xl border-2 p-6 ${
              isPopular
                ? 'border-amber-500 shadow-lg'
                : isCurrent
                ? 'border-green-500'
                : 'border-gray-200'
            }`}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </span>
              </div>
            )}

            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  ATUAL
                </span>
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {plan.displayName}
            </h3>
            <p className="text-gray-500 text-sm mb-4">{plan.description}</p>

            <div className="mb-6">
              <span className="text-3xl font-bold text-gray-900">
                R$ {plan.priceMonthly}
              </span>
              <span className="text-gray-500">/mês</span>
            </div>

            <ul className="space-y-3 mb-6 text-sm">
              <PlanFeatureItem
                label={`${plan.maxStores === -1 ? 'Ilimitadas' : plan.maxStores} lojas`}
                included
              />
              <PlanFeatureItem
                label={`${plan.maxUsers === -1 ? 'Ilimitados' : plan.maxUsers} usuários`}
                included
              />
              <PlanFeatureItem
                label="Analytics básico"
                included={plan.hasAnalyticsBasic}
              />
              <PlanFeatureItem
                label="Analytics avançado"
                included={plan.hasAnalyticsAdvanced}
              />
              <PlanFeatureItem
                label="Score de risco"
                included={plan.hasRiskScoring}
              />
              <PlanFeatureItem
                label="Predições"
                included={plan.hasPredictions}
              />
              <PlanFeatureItem
                label="Acesso API"
                included={plan.hasApiAccess}
              />
              <PlanFeatureItem
                label="Integrações"
                included={plan.hasIntegrations}
              />
            </ul>

            <button
              onClick={() => onSelectPlan?.(plan)}
              disabled={isCurrent}
              className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
                isCurrent
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isPopular
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isCurrent ? 'Plano atual' : 'Selecionar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PlanFeatureItem({
  label,
  included,
}: {
  label: string;
  included: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      {included ? (
        <svg
          className="w-5 h-5 text-green-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-gray-300 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      <span className={included ? 'text-gray-700' : 'text-gray-400'}>
        {label}
      </span>
    </li>
  );
}

// ==========================================
// Componente de uso de limites
// ==========================================

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
  unlimited?: boolean;
}

export function UsageMeter({ label, current, limit, unlimited }: UsageMeterProps) {
  const percent = unlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={isAtLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}>
          {unlimited ? (
            <span className="text-green-600">Ilimitado</span>
          ) : (
            `${current} / ${limit}`
          )}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isAtLimit
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-amber-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
