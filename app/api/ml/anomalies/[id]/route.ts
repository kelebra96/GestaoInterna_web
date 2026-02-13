import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { AnomalyStatus } from '@/lib/types/prediction';

// PUT /api/ml/anomalies/[id] - Atualizar status da anomalia
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

    if (!status || !['open', 'investigating', 'resolved', 'false_positive'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required' },
        { status: 400 }
      );
    }

    const anomaly = await predictionService.updateAnomalyStatus(
      id,
      auth.userId,
      status as AnomalyStatus,
      notes
    );

    return NextResponse.json({
      success: true,
      anomaly,
    });
  } catch (error) {
    console.error('Error updating anomaly:', error);
    return NextResponse.json(
      { error: 'Failed to update anomaly' },
      { status: 500 }
    );
  }
}
