import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month'; // 'week', 'month', 'quarter'

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Aproximadamente 3 meses
      break;
    case 'month':
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_solicitacoes_por_loja_por_periodo', {
      start_date: startDate.toISOString(),
    });

    if (error) {
      // Se a função não existir, tentamos uma abordagem de fallback
      if (error.code === '42883') {
        console.warn('RPC function not found, using fallback query.');
        const fallbackData = await fallbackQuery(startDate);
        return NextResponse.json(fallbackData);
      }
      throw error;
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[CHARTS_API] Error fetching solicitacoes por loja:', error);
    try {
        console.log("Trying fallback query...")
        const fallbackData = await fallbackQuery(startDate);
        return NextResponse.json(fallbackData);
    } catch (fallbackError: any) {
        console.error('[CHARTS_API] Fallback query failed:', fallbackError);
        return NextResponse.json({
            error: 'Failed to fetch chart data',
            details: fallbackError?.message || 'Unknown error',
        }, { status: 500 });
    }
  }
}

// Fallback em JS caso a função SQL não exista
async function fallbackQuery(startDate: Date) {
    const { data: solicitacoes, error: solicitacoesError } = await supabaseAdmin
      .from('solicitacoes')
      .select('store_id')
      .neq('status', 'draft')
      .gte('created_at', startDate.toISOString());

    if (solicitacoesError) throw solicitacoesError;

    const counts: { [key: string]: number } = {};
    for (const s of solicitacoes) {
        if(s.store_id) {
            counts[s.store_id] = (counts[s.store_id] || 0) + 1;
        }
    }

    const storeIds = Object.keys(counts);
    if(storeIds.length === 0) return [];

    const { data: stores, error: storesError } = await supabaseAdmin
        .from('stores')
        .select('id, name')
        .in('id', storeIds);

    if (storesError) throw storesError;

    const storeMap = new Map(stores.map(s => [s.id, s.name]));

    return Object.entries(counts).map(([storeId, count]) => ({
        storeId,
        storeName: storeMap.get(storeId) || 'Desconhecida',
        count,
    })).sort((a,b) => b.count - a.count);
}
