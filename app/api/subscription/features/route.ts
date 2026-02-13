import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/subscription/features - Retorna features disponíveis para a organização
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const features = await subscriptionService.getFeatureFlags(auth.orgId);

    return NextResponse.json({
      features,
      orgId: auth.orgId,
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}
