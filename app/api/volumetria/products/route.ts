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

    if (!code) {
      // List all products from Supabase (produtos_volumetria + products)
      const { data: volumetriaData } = await supabaseAdmin
        .from('produtos_volumetria')
        .select('*');

      const { data: productsData } = await supabaseAdmin
        .from('products')
        .select('*');

      const map = new Map<string, any>();

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

      const upsertProduct = (id: string, data: any) => {
        if (!id) return;
        const current = map.get(id) || {};
        map.set(id, {
          id,
          name: current.name || data.name || data.descricao || data.nome || id,
          ean: current.ean || data.ean || data.barcode,
          sku: current.sku || data.sku,
          volumetry: current.volumetry || null,
          hasVolumetry: current.hasVolumetry || false,
        });
      };

      // Process products from products table
      (productsData || []).forEach((row: any) => {
        upsertProduct(row.id, row);
      });

      // Process volumetric data
      (volumetriaData || []).forEach((row: any) => {
        const vol = buildVol(row);
        const ean = row.ean;
        let key = row.id;
        if (ean) {
          const byEan = Array.from(map.values()).find((p) => p.ean === ean);
          if (byEan) key = byEan.id;
        }
        const current = map.get(key) || { id: key };
        map.set(key, {
          ...current,
          volumetry: vol,
          hasVolumetry: hasVolumetry(vol),
          ean: current.ean || ean,
          name: current.name || row.descricao || row.nome || key,
        });
      });

      const products = Array.from(map.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );

      return NextResponse.json({ products });
    }

    // 1) Try by ID
    let { data: product, error } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('*')
      .eq('id', code)
      .single();

    // 2) If not found, try by EAN
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
