import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type ProductVolumetry = {
  id: string;
  ean?: string;
  descricao?: string;
  largura_cm?: number;
  altura_cm?: number;
  profundidade_cm?: number;
  peso_kg?: number;
};

export async function GET(request: Request) {
  // Auth is optional for leitura de catálogo
  const auth = await getAuthFromRequest(request).catch(() => null);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    const search = searchParams.get('search')?.trim();

    if (!code) {
      // Buscar produtos com filtro de pesquisa server-side
      let query = supabaseAdmin
        .from('produtos')
        .select('id, nome, ean, sku, descricao');

      // Aplicar filtro de busca se fornecido
      if (search && search.length >= 2) {
        // Detectar padrão de busca:
        // "termo%" = começa com
        // "%termo%" = contém (em qualquer lugar)
        // "%termo" = termina com
        // "termo" = contém (padrão)
        let pattern: string;

        if (search.startsWith('%') && search.endsWith('%')) {
          // %termo% - contém
          pattern = search;
        } else if (search.endsWith('%') && !search.startsWith('%')) {
          // termo% - começa com
          pattern = search;
        } else if (search.startsWith('%') && !search.endsWith('%')) {
          // %termo - termina com
          pattern = search;
        } else {
          // termo - padrão: contém
          pattern = `%${search}%`;
        }

        query = query.or(`nome.ilike.${pattern},ean.ilike.${pattern},descricao.ilike.${pattern}`);
      }

      const { data: productsData } = await query
        .order('nome', { ascending: true })
        .limit(200); // Limitar resultados para performance

      // Buscar volumetria para os produtos encontrados
      const eans = (productsData || []).map((p: any) => p.ean).filter(Boolean);
      let volumetriaMap = new Map<string, any>();

      if (eans.length > 0) {
        const { data: volumetriaData } = await supabaseAdmin
          .from('produtos_volumetria')
          .select('*')
          .in('ean', eans);

        (volumetriaData || []).forEach((v: any) => {
          if (v.ean) volumetriaMap.set(v.ean, v);
        });
      }

      const buildVol = (data: any) => ({
        largura_cm: data?.largura_cm ?? data?.largura ?? null,
        altura_cm: data?.altura_cm ?? data?.altura ?? null,
        profundidade_cm: data?.profundidade_cm ?? data?.comprimento_cm ?? data?.profundidade ?? null,
        peso_kg: data?.peso_kg ?? data?.peso ?? data?.peso_bruto_kg ?? null,
      });

      const hasVolumetry = (vol: any) =>
        !!vol &&
        vol.largura_cm &&
        vol.altura_cm &&
        vol.profundidade_cm &&
        vol.peso_kg;

      const products = (productsData || []).map((row: any) => {
        const volData = row.ean ? volumetriaMap.get(row.ean) : null;
        const vol = volData ? buildVol(volData) : null;
        return {
          id: row.id,
          name: row.nome || row.descricao || row.id,
          ean: row.ean,
          sku: row.sku,
          volumetry: vol,
          hasVolumetry: hasVolumetry(vol),
        };
      });

      return NextResponse.json({
        products,
        total: products.length,
        hasMore: products.length === 200,
      });
    }

    // 1) Try produtos_volumetria by ID
    let { data: product, error } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('*')
      .eq('id', code)
      .single();

    // 2) If not found, try produtos_volumetria by EAN
    if (error || !product) {
      const { data: byEan } = await supabaseAdmin
        .from('produtos_volumetria')
        .select('*')
        .eq('ean', code)
        .limit(1)
        .single();

      if (byEan) {
        product = byEan;
      }
    }

    // 3) If still not found, try main produtos table by EAN
    if (!product) {
      const { data: produtoData } = await supabaseAdmin
        .from('produtos')
        .select('*')
        .eq('ean', code)
        .limit(1)
        .single();

      if (produtoData) {
        // Map to expected format
        product = {
          id: produtoData.id,
          ean: produtoData.ean,
          descricao: produtoData.nome || produtoData.descricao,
          nome: produtoData.nome,
          // Volumetria pode não existir
          largura_cm: null,
          altura_cm: null,
          profundidade_cm: null,
          peso_kg: null,
        };
      }
    }

    if (!product) {
      return NextResponse.json({ product: null });
    }

    const productVolumetry: ProductVolumetry = {
      id: product.id,
      ean: product.ean,
      descricao: product.descricao,
      largura_cm: product.largura_cm,
      altura_cm: product.altura_cm,
      profundidade_cm: product.profundidade_cm,
      peso_kg: product.peso_kg,
    };

    return NextResponse.json({ product: productVolumetry });
  } catch (error) {
    console.error('Error fetching volumetry product:', error);
    return NextResponse.json({ products: [], error: 'Failed to fetch product' }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { ean, descricao, largura_cm, altura_cm, profundidade_cm, peso_kg, id } = body || {};

    if (!ean || !descricao || !largura_cm || !altura_cm || !profundidade_cm || !peso_kg) {
      return NextResponse.json({ error: 'Campos obrigatórios: ean, descricao, largura_cm, altura_cm, profundidade_cm, peso_kg' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const productId = id || ean;

    // Upsert (insert or update)
    const { error: upsertError } = await supabaseAdmin
      .from('produtos_volumetria')
      .upsert({
        id: productId,
        ean,
        descricao,
        largura_cm: Number(largura_cm),
        altura_cm: Number(altura_cm),
        profundidade_cm: Number(profundidade_cm),
        peso_kg: Number(peso_kg),
        updated_at: now,
      }, {
        onConflict: 'id',
      });

    if (upsertError) {
      console.error('[VolumetriaProducts] Error upserting product:', upsertError);
      throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving volumetry product:', error);
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}
