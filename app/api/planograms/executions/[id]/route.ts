import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/planograms/executions/[id]
 * Retorna dados de uma execução de planograma
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params;

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      );
    }

    // TODO: Validar token e buscar dados reais do Firestore/Prisma
    // const token = authHeader.split(' ')[1];
    // const decodedToken = await admin.auth().verifyIdToken(token);

    // Por enquanto, retornar dados mockados para demonstração
    const mockData = {
      executionId,
      storeId: 'store-001',
      storeName: 'Loja Centro',
      templateId: 'template-001',
      templateName: 'Planograma Biscoitos',
      executedAt: new Date().toISOString(),
      executedBy: 'João Silva',
      status: 'completed',
      overallScore: 87.5,

      // Dados adicionais que podem ser úteis
      duration: 1250, // segundos
      photosCount: 15,
      productsDetected: 45,
      productsExpected: 50,
    };

    return NextResponse.json(mockData);

  } catch (error: any) {
    console.error('Erro ao buscar execução:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar execução' },
      { status: 500 }
    );
  }
}
