import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlags, updateFeatureFlags } from '@/lib/featureFlags';

/**
 * GET /api/features
 * Retorna todas as feature flags
 */
export async function GET() {
  try {
    const features = await getFeatureFlags();
    return NextResponse.json(features);
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features
 * Atualiza feature flags
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Validar campos
    const allowedFields = ['allowUserRegistration', 'userManagementCard'];
    const updates: any = {};

    for (const field of allowedFields) {
      if (field in body && typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    await updateFeatureFlags(updates);

    const updatedFeatures = await getFeatureFlags();
    return NextResponse.json(updatedFeatures);
  } catch (error) {
    console.error('Error updating features:', error);
    return NextResponse.json(
      { error: 'Failed to update features' },
      { status: 500 }
    );
  }
}
