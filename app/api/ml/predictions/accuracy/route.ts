import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/predictions/accuracy - Acurácia das predições
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accuracy = await predictionService.getPredictionAccuracy(auth.orgId);

    return NextResponse.json({
      success: true,
      accuracy,
    });
  } catch (error) {
    console.error('Error fetching prediction accuracy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prediction accuracy' },
      { status: 500 }
    );
  }
}
