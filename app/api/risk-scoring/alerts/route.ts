import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/risk-scoring/alerts - Lista alertas ativos
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const alerts = await riskScoringService.getActiveAlerts(auth.orgId, limit);

    return NextResponse.json({
      success: true,
      data: alerts,
      count: alerts.length,
      unreadCount: alerts.filter(a => !a.acknowledgedAt).length,
    });
  } catch (error) {
    console.error('Error fetching risk alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risk alerts' },
      { status: 500 }
    );
  }
}
