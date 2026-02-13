import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/settings - Configurações de ML
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await predictionService.getSettings(auth.orgId);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error fetching ML settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ML settings' },
      { status: 500 }
    );
  }
}

// PUT /api/ml/settings - Atualizar configurações
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissão de admin
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can update ML settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const settings = await predictionService.updateSettings(auth.orgId, body);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error updating ML settings:', error);
    return NextResponse.json(
      { error: 'Failed to update ML settings' },
      { status: 500 }
    );
  }
}
