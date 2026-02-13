import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { FeedbackType } from '@/lib/types/prediction';

// POST /api/ml/recommendations/[id]/feedback - Adicionar feedback
export async function POST(
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
    const { feedbackType, comment } = body;

    if (!feedbackType || !['helpful', 'not_helpful', 'irrelevant', 'already_done'].includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Valid feedback type is required' },
        { status: 400 }
      );
    }

    await predictionService.addRecommendationFeedback(
      id,
      auth.userId,
      feedbackType as FeedbackType,
      comment
    );

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
    });
  } catch (error) {
    console.error('Error adding feedback:', error);
    return NextResponse.json(
      { error: 'Failed to add feedback' },
      { status: 500 }
    );
  }
}
