import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { products } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto para importar.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Preparar produtos para inserção em lote
    const productsToInsert = products.map((product: any) => ({
      ativo: product.ativo !== undefined ? product.ativo : true,
      comprador: product.comprador || '',
      descricao: product.descricao || '',
      ean: product.ean || '',
      fornecedor: product.fornecedor || '',
      nome: product.nome || '',
      preco: product.preco || 0,
      sku: product.sku || '',
      unidade: product.unidade || '',
      created_at: now,
      updated_at: now,
    }));

    // Inserir em lotes de 1000 (Supabase suporta batches maiores que Firebase)
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
      const batch = productsToInsert.slice(i, i + BATCH_SIZE);

      const { error: insertError } = await supabaseAdmin
        .from('produtos')
        .insert(batch);

      if (insertError) {
        console.error('[Produtos Import] Erro ao inserir lote:', insertError);
        throw insertError;
      }

      totalInserted += batch.length;
    }

    console.log(`[Produtos Import] ${totalInserted} produtos importados com sucesso`);

    return NextResponse.json({
      message: 'Produtos importados com sucesso!',
      count: totalInserted
    });
  } catch (error: any) {
    console.error('Erro ao importar produtos:', error);
    return NextResponse.json({
      error: error.message || 'Ocorreu um erro no servidor.'
    }, { status: 500 });
  }
}
