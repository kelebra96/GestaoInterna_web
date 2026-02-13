import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { requireFeature } from '@/lib/middleware/subscription-guard';
import { RiskScoreFilters, RiskEntityType, RiskLevel, RiskTrend } from '@/lib/types/risk-scoring';

// GET /api/risk-scoring - Lista scores de risco com filtros
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

    const filters: RiskScoreFilters = {};

    const entityType = searchParams.get('entityType');
    if (entityType && ['store', 'product', 'category', 'supplier'].includes(entityType)) {
      filters.entityType = entityType as RiskEntityType;
    }

    const levels = searchParams.get('level');
    if (levels) {
      filters.level = levels.split(',') as RiskLevel[];
    }

    const trends = searchParams.get('trend');
    if (trends) {
      filters.trend = trends.split(',') as RiskTrend[];
    }

    const minScore = searchParams.get('minScore');
    if (minScore) filters.minScore = parseInt(minScore);

    const maxScore = searchParams.get('maxScore');
    if (maxScore) filters.maxScore = parseInt(maxScore);

    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    if (page) filters.page = parseInt(page);
    if (pageSize) filters.pageSize = parseInt(pageSize);

    const scores = await riskScoringService.getScores(auth.orgId, filters);

    return NextResponse.json({
      success: true,
      data: scores,
      count: scores.length,
    });
  } catch (error) {
    console.error('Error fetching risk scores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risk scores' },
      { status: 500 }
    );
  }
}

// POST /api/risk-scoring - Recalcula todos os scores
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode forçar recálculo
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can refresh scores' },
        { status: 403 }
      );
    }

    const count = await riskScoringService.refreshScores(auth.orgId);

    return NextResponse.json({
      success: true,
      message: `Refreshed ${count} risk scores`,
      count,
    });
  } catch (error) {
    console.error('Error refreshing risk scores:', error);
    return NextResponse.json(
      { error: 'Failed to refresh risk scores' },
      { status: 500 }
    );
  }
}
