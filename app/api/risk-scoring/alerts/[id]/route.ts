import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// PUT /api/risk-scoring/alerts/[id] - Acknowledges ou resolve um alerta
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!['acknowledge', 'resolve'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "acknowledge" or "resolve"' },
        { status: 400 }
      );
    }

    if (action === 'acknowledge') {
      await riskScoringService.acknowledgeAlert(id, auth.userId);
    } else {
      await riskScoringService.resolveAlert(id, auth.userId);
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
