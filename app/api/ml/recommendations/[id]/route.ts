import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { RecommendationStatus } from '@/lib/types/prediction';

// PUT /api/ml/recommendations/[id] - Atualizar status da recomendação
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
    const { status, notes } = body;

    if (!status || !['pending', 'viewed', 'accepted', 'rejected', 'completed', 'expired'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required' },
        { status: 400 }
      );
    }

    const recommendation = await predictionService.updateRecommendationStatus(
      id,
      auth.userId,
      status as RecommendationStatus,
      notes
    );

    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
