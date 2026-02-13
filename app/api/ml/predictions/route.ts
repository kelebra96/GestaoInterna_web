import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { PredictionType } from '@/lib/types/prediction';

// GET /api/ml/predictions - Lista predições
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const predictionType = searchParams.get('type') as PredictionType | null;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    const predictions = await predictionService.getPredictions(auth.orgId, {
      predictionType: predictionType || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

// POST /api/ml/predictions - Gerar novas predições
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { predictionType, horizonDays = 7 } = body;

    if (!predictionType) {
      return NextResponse.json(
        { error: 'Prediction type is required' },
        { status: 400 }
      );
    }

    const predictions = await predictionService.generatePredictions(
      auth.orgId,
      predictionType as PredictionType,
      horizonDays
    );

    return NextResponse.json({
      success: true,
      predictions,
      count: predictions.length,
    });
  } catch (error) {
    console.error('Error generating predictions:', error);
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}
