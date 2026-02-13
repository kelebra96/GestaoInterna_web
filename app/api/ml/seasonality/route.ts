import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/seasonality - Padrões sazonais
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const metricType = searchParams.get('metricType');
    const minStrength = parseFloat(searchParams.get('minStrength') || '0');

    const patterns = await predictionService.getSeasonalPatterns(auth.orgId, {
      entityType: entityType || undefined,
      metricType: metricType || undefined,
      minStrength: minStrength || undefined,
    });

    return NextResponse.json({
      success: true,
      patterns,
    });
  } catch (error) {
    console.error('Error fetching seasonal patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasonal patterns' },
      { status: 500 }
    );
  }
}
