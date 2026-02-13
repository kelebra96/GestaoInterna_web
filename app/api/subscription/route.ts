import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/subscription - Retorna a assinatura da organização atual
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscription = await subscriptionService.getSubscription(auth.orgId);

    if (!subscription) {
      return NextResponse.json(
        {
          subscription: null,
          message: 'No active subscription',
          plans: await subscriptionService.getPlans(),
        },
        { status: 200 }
      );
    }

    const features = await subscriptionService.getFeatureFlags(auth.orgId);

    return NextResponse.json({
      subscription,
      features,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// POST /api/subscription - Cria uma nova assinatura (trial)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verificar se já tem assinatura
    const existing = await subscriptionService.getSubscription(auth.orgId);
    if (existing) {
      return NextResponse.json(
        { error: 'Organization already has a subscription' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle, trialDays } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const subscription = await subscriptionService.createSubscription({
      orgId: auth.orgId,
      planId,
      billingCycle: billingCycle || 'monthly',
      trialDays: trialDays ?? 14,
    });

    return NextResponse.json({
      subscription,
      message: 'Subscription created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

// PUT /api/subscription - Atualiza a assinatura (upgrade/downgrade)
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apenas admin pode alterar assinatura
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can modify subscriptions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle, customLimits } = body;

    const subscription = await subscriptionService.updateSubscription(auth.orgId, {
      planId,
      billingCycle,
      customLimits,
    });

    return NextResponse.json({
      subscription,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE /api/subscription - Cancela a assinatura
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apenas admin pode cancelar
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can cancel subscriptions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const immediately = searchParams.get('immediately') === 'true';

    const subscription = await subscriptionService.cancelSubscription(
      auth.orgId,
      immediately
    );

    return NextResponse.json({
      subscription,
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the billing period',
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
