import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/subscription/usage - Retorna uso atual e limites
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Buscar limites para cada tipo
    const [stores, users, products, imports] = await Promise.all([
      subscriptionService.checkUsageLimit(auth.orgId, 'stores'),
      subscriptionService.checkUsageLimit(auth.orgId, 'users'),
      subscriptionService.checkUsageLimit(auth.orgId, 'products'),
      subscriptionService.checkUsageLimit(auth.orgId, 'imports'),
    ]);

    return NextResponse.json({
      usage: {
        stores,
        users,
        products,
        imports,
      },
      orgId: auth.orgId,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}

// POST /api/subscription/usage/check - Verifica limite específico antes de uma operação
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { limitType, currentCount } = body;

    if (!limitType || !['stores', 'users', 'products', 'imports'].includes(limitType)) {
      return NextResponse.json(
        { error: 'Invalid limit type' },
        { status: 400 }
      );
    }

    const result = await subscriptionService.checkUsageLimit(
      auth.orgId,
      limitType as 'stores' | 'users' | 'products' | 'imports',
      currentCount
    );

    if (!result.allowed) {
      return NextResponse.json(
        {
          ...result,
          upgradeUrl: '/configuracoes/planos',
        },
        { status: 402 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return NextResponse.json(
      { error: 'Failed to check usage limit' },
      { status: 500 }
    );
  }
}
