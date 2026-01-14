import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data: produtosFromDb, error: produtosError } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .order('created_at', { ascending: false });

    if (produtosError) {
      console.error('[Produtos] Erro ao listar produtos:', produtosError);
      throw produtosError;
    }

    const produtos = (produtosFromDb || []).map((data: any) => ({
      id: data.id,
      name: data.nome || 'Sem nome',
      ean: data.ean,
      buyer: data.comprador,
      supplier: data.fornecedor,
      description: data.descricao,
      preco: data.preco != null ? Number(data.preco) : undefined,
      sku: data.sku,
      unidade: data.unidade,
      active: data.ativo === true,
      createdAt: data.created_at || new Date().toISOString(),
    }));

    return NextResponse.json({ produtos });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    return NextResponse.json({ error: 'Falha ao listar produtos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const nome = (typeof body.nome === 'string' ? body.nome : typeof body.name === 'string' ? body.name : '').trim();
    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const toCreate: any = {
      nome,
      ean: (typeof body.ean === 'string' ? body.ean : undefined)?.trim(),
      comprador: (typeof body.comprador === 'string' ? body.comprador : typeof body.buyer === 'string' ? body.buyer : undefined)?.trim(),
      fornecedor: (typeof body.fornecedor === 'string' ? body.fornecedor : typeof body.supplier === 'string' ? body.supplier : undefined)?.trim(),
      descricao: (typeof body.descricao === 'string' ? body.descricao : typeof body.description === 'string' ? body.description : undefined)?.trim(),
      preco: body.preco != null ? Number(body.preco) : undefined,
      sku: (typeof body.sku === 'string' ? body.sku : undefined)?.trim(),
      unidade: (typeof body.unidade === 'string' ? body.unidade : undefined)?.trim(),
      ativo: typeof body.ativo === 'boolean' ? body.ativo : typeof body.active === 'boolean' ? body.active : true,
      created_at: now,
      updated_at: now,
    };

    const { data: newDoc, error: insertError } = await supabaseAdmin
      .from('produtos')
      .insert(toCreate)
      .select()
      .single();

    if (insertError) {
      console.error('[Produtos] Erro ao criar produto:', insertError);
      throw insertError;
    }

    return NextResponse.json({
      produto: {
        id: newDoc.id,
        name: toCreate.nome,
        ean: toCreate.ean,
        buyer: toCreate.comprador,
        supplier: toCreate.fornecedor,
        description: toCreate.descricao,
        active: toCreate.ativo,
        createdAt: newDoc.created_at || now,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return NextResponse.json({ error: 'Falha ao criar produto' }, { status: 500 });
  }
}
