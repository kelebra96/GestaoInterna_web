/**
 * API Route: /api/expiry/[id]
 * GET - Get a single expiry report
 * DELETE - Delete an expiry report (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReport, deleteReport } from '@/lib/services/expiry.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = await getReport(id);

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error fetching expiry report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await deleteReport(id);

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting expiry report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
