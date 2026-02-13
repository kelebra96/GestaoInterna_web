import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { requireFeature } from '@/lib/middleware/subscription-guard';

// GET /api/risk-scoring/stores - Ranking de lojas por risco
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se tem acesso a risk scoring
    const featureCheck = await requireFeature(auth.orgId, 'has_risk_scoring');
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Risk scoring requires Professional plan or higher',
          upgradeUrl: '/configuracoes/planos',
        },
        { status: 403 }
      );
    }

    const rankings = await riskScoringService.getStoreScores(auth.orgId);

    return NextResponse.json({
      success: true,
      data: rankings,
      count: rankings.length,
    });
  } catch (error) {
    console.error('Error fetching store risk rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store risk rankings' },
      { status: 500 }
    );
  }
}
