import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import {
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
} from '@/lib/types/prediction';

// GET /api/ml/anomalies - Lista anomalias
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as AnomalyStatus | null;
    const severity = searchParams.get('severity') as AnomalySeverity | null;
    const anomalyType = searchParams.get('type') as AnomalyType | null;
    const entityType = searchParams.get('entityType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const summaryData = await predictionService.getOpenAnomaliesSummary(auth.orgId);
      return NextResponse.json({
        success: true,
        summary: summaryData,
      });
    }

    const anomalies = await predictionService.getAnomalies(auth.orgId, {
      status: status || undefined,
      severity: severity || undefined,
      anomalyType: anomalyType || undefined,
      entityType: entityType || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      anomalies,
    });
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anomalies' },
      { status: 500 }
    );
  }
}

// POST /api/ml/anomalies - Detectar novas anomalias
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, metricType, threshold = 3.0 } = body;

    if (!entityType || !metricType) {
      return NextResponse.json(
        { error: 'Entity type and metric type are required' },
        { status: 400 }
      );
    }

    const count = await predictionService.detectAnomalies(
      auth.orgId,
      entityType,
      metricType,
      threshold
    );

    return NextResponse.json({
      success: true,
      message: `Detected ${count} anomalies`,
      count,
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}
