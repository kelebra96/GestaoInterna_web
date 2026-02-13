import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/predictions/models - Modelos ativos
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const models = await predictionService.getActiveModels(auth.orgId);

    return NextResponse.json({
      success: true,
      models,
    });
  } catch (error) {
    console.error('Error fetching prediction models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prediction models' },
      { status: 500 }
    );
  }
}
