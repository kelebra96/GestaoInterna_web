import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/dashboard - Dashboard completo de ML
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dashboard = await predictionService.getDashboard(auth.orgId);

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching ML dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ML dashboard' },
      { status: 500 }
    );
  }
}
