import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { requireFeature } from '@/lib/middleware/subscription-guard';

// GET /api/risk-scoring/products - Ranking de produtos por risco
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const rankings = await riskScoringService.getProductScores(auth.orgId, limit);

    return NextResponse.json({
      success: true,
      data: rankings,
      count: rankings.length,
    });
  } catch (error) {
    console.error('Error fetching product risk rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product risk rankings' },
      { status: 500 }
    );
  }
}
