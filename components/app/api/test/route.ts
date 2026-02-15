import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[TEST] API test called');
  return NextResponse.json({ message: 'Test API works!' });
}
