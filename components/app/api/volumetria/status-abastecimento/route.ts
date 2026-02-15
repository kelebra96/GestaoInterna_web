// web/app/api/volumetria/status-abastecimento/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  calcularCapacidadeSlot,
  analisarAbastecimentoSlot,
} from '@/lib/services/volumetriaCalculos';
import type {
  ProdutoVolumetria,
  Prateleira,
  SlotPlanograma,
  LeituraEstoqueGondola,
} from '@/lib/types/volumetria';

export const dynamic = 'force-dynamic';

/**
 * GET /api/volumetria/status-abastecimento
 *
 * Retorna o status de abastecimento de um slot específico
 *
 * Query params:
 * - id_loja: ID da loja
 * - id_slot: ID do slot (opcional se id_produto for fornecido)
 * - id_produto: ID do produto (opcional se id_slot for fornecido)
 * - data_hora_referencia: Data/hora de referência (opcional, usa última leitura se não fornecido)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id_loja = searchParams.get('id_loja');
    const id_slot = searchParams.get('id_slot');
    const id_produto = searchParams.get('id_produto');
    const data_hora_str = searchParams.get('data_hora_referencia');

    if (!id_loja) {
      return NextResponse.json(
        { error: 'Parâmetro id_loja é obrigatório' },
        { status: 400 }
      );
    }

    if (!id_slot && !id_produto) {
      return NextResponse.json(
        { error: 'Forneça id_slot ou id_produto' },
        { status: 400 }
      );
    }

    // 1. Buscar leitura de estoque
    let leituraQuery = supabaseAdmin
      .from('leituras_estoque_gondola')
      .select('*')
      .eq('store_id', id_loja)
      .order('data_hora_leitura', { ascending: false })
      .limit(1);

    if (id_slot) {
      leituraQuery = leituraQuery.eq('slot_id', id_slot);
    } else if (id_produto) {
      leituraQuery = leituraQuery.eq('produto_id', id_produto);
    }

    if (data_hora_str) {
      const data_referencia = new Date(data_hora_str).toISOString();
      leituraQuery = leituraQuery.lte('data_hora_leitura', data_referencia);
    }

    const { data: leituras, error: leituraError } = await leituraQuery;

    if (leituraError || !leituras || leituras.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhuma leitura de estoque encontrada',
          message: 'É necessário ter leituras de estoque registradas (table: leituras_estoque_gondola)'
        },
        { status: 404 }
      );
    }

    const leituraRow = leituras[0];
    const leitura = {
      id_leitura: leituraRow.id,
      id_loja: leituraRow.store_id,
      id_slot: leituraRow.slot_id,
      id_produto: leituraRow.produto_id,
      quantidade_atual_slot: leituraRow.quantidade_atual_slot,
      origem_leitura: leituraRow.origem_leitura,
      data_hora_leitura: new Date(leituraRow.data_hora_leitura),
    } as LeituraEstoqueGondola;

    // 2. Buscar dados do slot
    const { data: slotRow, error: slotError } = await supabaseAdmin
      .from('slots_planograma')
      .select('*')
      .eq('id', leitura.id_slot)
      .single();

    if (slotError || !slotRow) {
      return NextResponse.json(
        {
          error: 'Slot não encontrado',
          message: 'É necessário ter slots de planograma cadastrados (table: slots_planograma)'
        },
        { status: 404 }
      );
    }

    const slot = {
      id_slot: slotRow.id,
      id_loja: slotRow.store_id,
      id_prateleira: slotRow.prateleira_id,
      id_produto: slotRow.produto_id,
      posicao_x_cm: slotRow.posicao_x_cm,
      largura_slot_cm: slotRow.largura_slot_cm,
      facings_definidos: slotRow.facings_definidos,
    } as SlotPlanograma;

    // 3. Buscar dados da prateleira
    const { data: prateleiraRow, error: prateleiraError } = await supabaseAdmin
      .from('prateleiras')
      .select('*')
      .eq('id', slot.id_prateleira)
      .single();

    if (prateleiraError || !prateleiraRow) {
      return NextResponse.json(
        {
          error: 'Prateleira não encontrada',
          message: 'É necessário ter prateleiras cadastradas (table: prateleiras)'
        },
        { status: 404 }
      );
    }

    const prateleira = {
      id_prateleira: prateleiraRow.id,
      id_gondola: prateleiraRow.id_gondola,
      id_loja: prateleiraRow.store_id,
      largura_util_cm: prateleiraRow.largura_util_cm,
      profundidade_util_cm: prateleiraRow.profundidade_util_cm,
      altura_livre_cm: prateleiraRow.altura_livre_cm,
      nivel: prateleiraRow.nivel,
    } as Prateleira;

    // 4. Buscar dados volumétricos do produto
    const { data: produtoRow, error: produtoError } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('*')
      .eq('id', leitura.id_produto)
      .single();

    if (produtoError || !produtoRow) {
      return NextResponse.json(
        {
          error: 'Dados volumétricos do produto não encontrados',
          message: 'É necessário ter dados volumétricos dos produtos (table: produtos_volumetria)'
        },
        { status: 404 }
      );
    }

    const produto = {
      id_produto: produtoRow.id,
      ean: produtoRow.ean,
      descricao: produtoRow.descricao,
      categoria: produtoRow.categoria,
      marca: produtoRow.marca,
      largura_cm: produtoRow.largura_cm,
      altura_cm: produtoRow.altura_cm,
      profundidade_cm: produtoRow.profundidade_cm,
      pode_empilhar: produtoRow.pode_empilhar,
      max_camadas_vertical: produtoRow.max_camadas_vertical,
      preco_venda: produtoRow.preco_venda,
      margem_percentual: produtoRow.margem_percentual,
    } as ProdutoVolumetria;

    // 5. Calcular capacidade do slot
    const capacidade = calcularCapacidadeSlot(produto, prateleira, slot);

    // 6. Analisar status de abastecimento
    const statusAbastecimento = analisarAbastecimentoSlot(
      leitura,
      capacidade.capacidade_total_slot
    );

    return NextResponse.json({
      status: statusAbastecimento,
      capacidade_detalhada: capacidade,
      produto: {
        id_produto: produto.id_produto,
        ean: produto.ean,
        descricao: produto.descricao,
      },
      slot: {
        id_slot: slot.id_slot,
        id_prateleira: slot.id_prateleira,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar status de abastecimento:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    );
  }
}
