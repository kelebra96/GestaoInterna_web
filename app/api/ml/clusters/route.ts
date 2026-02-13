import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { ClusterType } from '@/lib/types/prediction';

// GET /api/ml/clusters - Lista clusters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clusterType = searchParams.get('type') as ClusterType | null;

    const clusters = await predictionService.getClusters(
      auth.orgId,
      clusterType || undefined
    );

    return NextResponse.json({
      success: true,
      clusters,
    });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clusters' },
      { status: 500 }
    );
  }
}

// POST /api/ml/clusters - Executar clusterização
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clusterType, numClusters = 5, algorithm = 'kmeans' } = body;

    if (!clusterType || !['store', 'product', 'category'].includes(clusterType)) {
      return NextResponse.json(
        { error: 'Valid cluster type is required (store, product, category)' },
        { status: 400 }
      );
    }

    console.log(`[CLUSTERS] Running clustering for org ${auth.orgId}, type: ${clusterType}`);

    const run = await predictionService.runClustering(
      auth.orgId,
      clusterType as ClusterType,
      numClusters,
      algorithm
    );

    console.log(`[CLUSTERS] Clustering completed:`, run);

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error) {
    console.error('Error running clustering:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run clustering' },
      { status: 500 }
    );
  }
}
