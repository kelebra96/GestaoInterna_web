/**
 * API Route: /api/expiry/[id]/resolve
 * POST - Mark an expiry report as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveReport } from '@/lib/services/expiry.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolvedBy } = body;

    if (!resolvedBy) {
      return NextResponse.json(
        { success: false, error: 'resolvedBy is required' },
        { status: 400 }
      );
    }

    await resolveReport(id, resolvedBy);

    return NextResponse.json({
      success: true,
      message: 'Report resolved successfully',
    });
  } catch (error: any) {
    console.error('Error resolving expiry report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
