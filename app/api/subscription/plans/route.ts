import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';

// GET /api/subscription/plans - Lista todos os planos públicos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includePrivate = searchParams.get('includePrivate') === 'true';

    const plans = await subscriptionService.getPlans(includePrivate);

    return NextResponse.json({
      plans,
      count: plans.length,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
