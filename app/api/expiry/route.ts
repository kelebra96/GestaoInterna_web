/**
 * API Route: /api/expiry
 * GET - List expiry reports for a store
 * POST - Create a new expiry report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStoreReports, createReport } from '@/lib/services/expiry.service';
import type { ExpiryDaysFilter } from '@/lib/types/expiry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const daysFilterParam = searchParams.get('daysFilter');
    const includeResolved = searchParams.get('includeResolved') === 'true';

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'storeId is required' },
        { status: 400 }
      );
    }

    const daysFilter: ExpiryDaysFilter | null = daysFilterParam !== null
      ? parseInt(daysFilterParam, 10) as ExpiryDaysFilter
      : null;

    const reports = await getStoreReports(storeId, daysFilter ?? undefined, includeResolved);

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Error fetching expiry reports:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { barcode, productName, expiryDate, quantity, photoUrl, storeId, companyId, createdBy, location, notes } = body;

    if (!barcode || !expiryDate || !storeId || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: barcode, expiryDate, storeId, createdBy' },
        { status: 400 }
      );
    }

    const id = await createReport({
      barcode,
      productName,
      expiryDate,
      quantity: quantity || 1,
      photoUrl,
      storeId,
      companyId,
      createdBy,
      location,
      notes,
    });

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error: any) {
    console.error('Error creating expiry report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
