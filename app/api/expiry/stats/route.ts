/**
 * API Route: /api/expiry/stats
 * GET - Get expiry statistics for a store
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStoreStats } from '@/lib/services/expiry.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'storeId is required' },
        { status: 400 }
      );
    }

    const stats = await getStoreStats(storeId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching expiry stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
