import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/images/review
 *
 * Lista produtos que precisam de revisão manual.
 * Retorna informações completas para a UI de moderação.
 *
 * Query params:
 *   - limit: número de itens (default: 50, max: 100)
 *   - offset: paginação
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== Role.super_admin && auth.role !== Role.admin_rede)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);
  const offset = Number(searchParams.get('offset') || 0);

  try {
    // Buscar produtos needs_review
    const { data, error, count } = await supabaseAdmin
      .from('products')
      .select(
        `
        id,
        name,
        description,
        ean,
        sku,
        image_status,
        image_source,
        image_confidence,
        image_candidate_urls,
        image_ai_model,
        image_ai_prompt_version,
        image_ai_reason,
        image_updated_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('image_status', 'needs_review')
      .order('image_updated_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to UI format (nome/descricao for compatibility)
    const items = (data || []).map((p: any) => ({
      ...p,
      nome: p.name,
      descricao: p.description,
    }));

    return NextResponse.json({
      items,
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error: any) {
    console.error('[review] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
