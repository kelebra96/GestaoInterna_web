import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// DELETE /api/subscription/api-keys/[id] - Revoga uma API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apenas admin pode revogar API keys
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can revoke API keys' },
        { status: 403 }
      );
    }

    await subscriptionService.revokeApiKey(auth.orgId, id);

    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
