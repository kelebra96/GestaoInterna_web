import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/subscription/api-keys - Lista API keys da organização
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verificar se tem acesso a API
    const features = await subscriptionService.getFeatureFlags(auth.orgId);
    if (!features.canUseApiAccess) {
      return NextResponse.json(
        {
          error: 'API access is not available in your current plan',
          upgradeUrl: '/configuracoes/planos',
        },
        { status: 403 }
      );
    }

    const apiKeys = await subscriptionService.listApiKeys(auth.orgId);

    return NextResponse.json({
      apiKeys,
      count: apiKeys.length,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/subscription/api-keys - Cria nova API key
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId || !auth.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apenas admin pode criar API keys
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can create API keys' },
        { status: 403 }
      );
    }

    // Verificar se tem acesso a API
    const features = await subscriptionService.getFeatureFlags(auth.orgId);
    if (!features.canUseApiAccess) {
      return NextResponse.json(
        {
          error: 'API access is not available in your current plan',
          upgradeUrl: '/configuracoes/planos',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, scopes, rateLimitPerMinute, rateLimitPerDay, expiresAt } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const result = await subscriptionService.createApiKey(auth.orgId, auth.userId, {
      name,
      scopes,
      rateLimitPerMinute,
      rateLimitPerDay,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({
      apiKey: result.apiKey,
      secretKey: result.secretKey,
      message: 'API key created successfully. Save the secret key - it will not be shown again!',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
