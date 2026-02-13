import { NextRequest, NextResponse } from 'next/server';
import { lossAnalysisService } from '@/lib/services/loss-analysis.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// POST /api/ml/analyze - Executa análise de dados de perdas
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parâmetro opcional: importJobId para analisar apenas dados de um import específico
    let importJobId: string | undefined;
    try {
      const body = await request.json();
      importJobId = body.importJobId;
    } catch {
      // Body vazio é OK - analisa todos os dados
    }

    const result = await lossAnalysisService.analyzeImportedData(auth.orgId, importJobId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Análise concluída: ${result.recommendationsCreated} recomendações, ${result.anomaliesDetected} anomalias, ${result.clustersCreated} clusters, ${result.predictionsGenerated} predições.`,
    });
  } catch (error) {
    console.error('Error running ML analysis:', error);
    return NextResponse.json(
      { error: 'Failed to run ML analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
