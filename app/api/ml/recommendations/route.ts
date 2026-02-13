import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import {
  RecommendationType,
  RecommendationPriority,
  RecommendationStatus,
} from '@/lib/types/prediction';

// GET /api/ml/recommendations - Lista recomendações
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RecommendationStatus | null;
    const type = searchParams.get('type') as RecommendationType | null;
    const priority = searchParams.get('priority') as RecommendationPriority | null;
    const entityType = searchParams.get('entityType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const summaryData = await predictionService.getPendingRecommendationsSummary(
        auth.orgId
      );
      return NextResponse.json({
        success: true,
        summary: summaryData,
      });
    }

    const recommendations = await predictionService.getRecommendations(auth.orgId, {
      status: status || undefined,
      type: type || undefined,
      priority: priority || undefined,
      entityType: entityType || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

// POST /api/ml/recommendations - Gerar novas recomendações
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await predictionService.generateRecommendations(auth.orgId);

    return NextResponse.json({
      success: true,
      message: `Generated ${count} new recommendations`,
      count,
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
