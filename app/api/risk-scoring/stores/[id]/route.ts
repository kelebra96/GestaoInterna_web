import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/risk-scoring/stores/[id] - Score detalhado de uma loja
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const score = await riskScoringService.getScoreByEntity(auth.orgId, 'store', id);

    if (!score) {
      // Tentar calcular em tempo real
      const calculated = await riskScoringService.calculateStoreScore(auth.orgId, id);

      if (!calculated) {
        return NextResponse.json(
          { error: 'Store not found or no data available' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: calculated,
        calculated: true,
      });
    }

    const result: { success: boolean; data: typeof score; history?: unknown[] } = {
      success: true,
      data: score,
    };

    if (includeHistory) {
      const history = await riskScoringService.getEntityHistory(auth.orgId, 'store', id);
      result.history = history;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching store risk score:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store risk score' },
      { status: 500 }
    );
  }
}
