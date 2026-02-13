import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/ml/clusters/[id] - Detalhes do cluster
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeMembers = searchParams.get('includeMembers') === 'true';
    const memberLimit = parseInt(searchParams.get('memberLimit') || '50');

    const cluster = await predictionService.getClusterById(id);

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    if (cluster.orgId !== auth.orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let members;
    if (includeMembers) {
      members = await predictionService.getClusterMembers(id, memberLimit);
    }

    return NextResponse.json({
      success: true,
      cluster,
      members,
    });
  } catch (error) {
    console.error('Error fetching cluster:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster' },
      { status: 500 }
    );
  }
}
