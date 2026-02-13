import { NextRequest, NextResponse } from 'next/server';
import { riskScoringService } from '@/lib/services/risk-scoring.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/risk-scoring/thresholds - Obtém configurações de thresholds
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const thresholds = await riskScoringService.getThresholds(auth.orgId);

    // Se não existir, retornar defaults
    const defaults = {
      lowMax: 25,
      mediumMax: 50,
      highMax: 75,
      weightExpiry: 30,
      weightRupture: 20,
      weightRecurrence: 20,
      weightFinancial: 15,
      weightEfficiency: 15,
      alertOnCritical: true,
      alertOnScoreIncrease: 15,
      alertOnTrendChange: true,
    };

    return NextResponse.json({
      success: true,
      data: thresholds || defaults,
      isDefault: !thresholds,
    });
  } catch (error) {
    console.error('Error fetching thresholds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thresholds' },
      { status: 500 }
    );
  }
}

// PUT /api/risk-scoring/thresholds - Atualiza configurações
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode alterar thresholds
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can modify thresholds' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validar que pesos somam 100
    const weights = [
      body.weightExpiry,
      body.weightRupture,
      body.weightRecurrence,
      body.weightFinancial,
      body.weightEfficiency,
    ].filter(w => w !== undefined);

    if (weights.length === 5) {
      const sum = weights.reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        return NextResponse.json(
          { error: 'Weight values must sum to 100' },
          { status: 400 }
        );
      }
    }

    // Validar thresholds ordenados
    if (body.lowMax !== undefined && body.mediumMax !== undefined && body.highMax !== undefined) {
      if (!(body.lowMax < body.mediumMax && body.mediumMax < body.highMax)) {
        return NextResponse.json(
          { error: 'Thresholds must be in ascending order: lowMax < mediumMax < highMax' },
          { status: 400 }
        );
      }
    }

    const thresholds = await riskScoringService.updateThresholds(auth.orgId, body);

    return NextResponse.json({
      success: true,
      data: thresholds,
      message: 'Thresholds updated successfully',
    });
  } catch (error) {
    console.error('Error updating thresholds:', error);
    return NextResponse.json(
      { error: 'Failed to update thresholds' },
      { status: 500 }
    );
  }
}
