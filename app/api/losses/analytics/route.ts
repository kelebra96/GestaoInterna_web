import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/services/import.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/losses/analytics - Analytics de perdas
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [summary, topProducts, topSuppliers] = await Promise.all([
      importService.getLossSummary(auth.orgId, storeId || undefined),
      importService.getTopLossProducts(auth.orgId, limit),
      importService.getTopLossSuppliers(auth.orgId, limit),
    ]);

    // Calcular totais
    const totals = summary.reduce(
      (acc, s) => ({
        recordCount: acc.recordCount + s.recordCount,
        totalQuantity: acc.totalQuantity + s.totalQuantity,
        totalCost: acc.totalCost + s.totalCost,
        totalSaleValue: acc.totalSaleValue + s.totalSaleValue,
        totalMarginLost: acc.totalMarginLost + s.totalMarginLost,
      }),
      {
        recordCount: 0,
        totalQuantity: 0,
        totalCost: 0,
        totalSaleValue: 0,
        totalMarginLost: 0,
      }
    );

    // Agrupar por tipo de perda
    const byLossType = summary.reduce(
      (acc, s) => {
        if (!acc[s.lossType]) {
          acc[s.lossType] = {
            recordCount: 0,
            totalCost: 0,
          };
        }
        acc[s.lossType].recordCount += s.recordCount;
        acc[s.lossType].totalCost += s.totalCost;
        return acc;
      },
      {} as Record<string, { recordCount: number; totalCost: number }>
    );

    // Agrupar por categoria
    const byCategory = summary.reduce(
      (acc, s) => {
        if (!acc[s.category]) {
          acc[s.category] = {
            recordCount: 0,
            totalCost: 0,
          };
        }
        acc[s.category].recordCount += s.recordCount;
        acc[s.category].totalCost += s.totalCost;
        return acc;
      },
      {} as Record<string, { recordCount: number; totalCost: number }>
    );

    return NextResponse.json({
      success: true,
      data: {
        totals,
        byLossType,
        byCategory,
        topProducts,
        topSuppliers,
        monthlySummary: summary,
      },
    });
  } catch (error) {
    console.error('Error fetching loss analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loss analytics' },
      { status: 500 }
    );
  }
}
