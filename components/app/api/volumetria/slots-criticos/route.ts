// web/app/api/volumetria/slots-criticos/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  calcularCapacidadeSlot,
  analisarAbastecimentoSlot,
} from '@/lib/services/volumetriaCalculos';
import type { SlotCritico } from '@/lib/types/volumetria';

export const dynamic = 'force-dynamic';

/**
 * GET /api/volumetria/slots-criticos
 *
 * Lista slots com status "RUIM" ou com ruptura recorrente
 *
 * Query params:
 * - id_loja: ID da loja (obrigatório)
 * - periodo_dias: Período em dias para análise (padrão: 7)
 * - min_eventos_ruptura: Número mínimo de eventos de ruptura para considerar recorrente (padrão: 3)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id_loja = searchParams.get('id_loja');
    const periodo_dias = parseInt(searchParams.get('periodo_dias') || '7');
    const min_eventos_ruptura = parseInt(searchParams.get('min_eventos_ruptura') || '3');

    if (!id_loja) {
      return NextResponse.json(
        { error: 'Parâmetro id_loja é obrigatório' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodo_inicio = new Date(now.getTime() - periodo_dias * 24 * 60 * 60 * 1000);

    // 1. Buscar todas as leituras recentes da loja
    const { data: leituras, error: leiturasError } = await supabaseAdmin
      .from('leituras_estoque_gondola')
      .select('*')
      .eq('store_id', id_loja)
      .gte('data_hora_leitura', periodo_inicio.toISOString())
      .order('data_hora_leitura', { ascending: false });

    if (leiturasError) {
      console.error('[VolumetriaSlotsCriticos] Error fetching leituras:', leiturasError);
      throw leiturasError;
    }

    if (!leituras || leituras.length === 0) {
      return NextResponse.json({
        slots_criticos: [],
        message: 'Nenhuma leitura de estoque encontrada no período'
      });
    }

    // 2. Agrupar leituras por slot (pegar a mais recente de cada)
    const leiturasPorSlot = new Map();
    for (const leitura of leituras) {
      const id_slot = leitura.slot_id;
      if (!leiturasPorSlot.has(id_slot)) {
        leiturasPorSlot.set(id_slot, {
          id_leitura: leitura.id,
          id_slot: leitura.slot_id,
          id_produto: leitura.produto_id,
          id_loja: leitura.store_id,
          quantidade_atual_slot: leitura.quantidade_atual_slot,
          data_hora_leitura: new Date(leitura.data_hora_leitura),
        });
      }
    }

    // 3. Buscar eventos de ruptura no período
    const { data: rupturas } = await supabaseAdmin
      .from('eventos_ruptura')
      .select('*')
      .eq('store_id', id_loja)
      .gte('data_hora_inicio', periodo_inicio.toISOString());

    const rupturasPorSlot = new Map<string, number>();
    for (const ruptura of (rupturas || [])) {
      const id_slot = ruptura.slot_id;
      if (id_slot) {
        rupturasPorSlot.set(id_slot, (rupturasPorSlot.get(id_slot) || 0) + 1);
      }
    }

    // 4. Fetch all related data in batch
    const slotIds = Array.from(leiturasPorSlot.keys());

    const { data: slots } = await supabaseAdmin
      .from('slots_planograma')
      .select('*')
      .in('id', slotIds);

    const prateleiraIds = (slots || []).map((s: any) => s.prateleira_id);
    const produtoIds = Array.from(leiturasPorSlot.values()).map((l: any) => l.id_produto);

    const { data: prateleiras } = await supabaseAdmin
      .from('prateleiras')
      .select('*')
      .in('id', prateleiraIds);

    const { data: produtos } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('*')
      .in('id', produtoIds);

    // Create maps for quick lookup
    const slotMap = new Map((slots || []).map((s: any) => [s.id, s]));
    const prateleiraMap = new Map((prateleiras || []).map((p: any) => [p.id, p]));
    const produtoMap = new Map((produtos || []).map((p: any) => [p.id, p]));

    // 5. Analisar cada slot
    const slotsCriticos: SlotCritico[] = [];

    for (const [id_slot, leitura] of leiturasPorSlot.entries()) {
      try {
        const slotRow = slotMap.get(id_slot);
        if (!slotRow) continue;

        const prateleiraRow = prateleiraMap.get(slotRow.prateleira_id);
        if (!prateleiraRow) continue;

        const produtoRow = produtoMap.get(leitura.id_produto);
        if (!produtoRow) continue;

        const slot = {
          id_slot: slotRow.id,
          id_loja: slotRow.store_id,
          id_prateleira: slotRow.prateleira_id,
          id_produto: slotRow.produto_id,
          posicao_x_cm: slotRow.posicao_x_cm,
          largura_slot_cm: slotRow.largura_slot_cm,
          facings_definidos: slotRow.facings_definidos,
        };

        const prateleira = {
          id_prateleira: prateleiraRow.id,
          id_gondola: prateleiraRow.id_gondola,
          id_loja: prateleiraRow.store_id,
          largura_util_cm: prateleiraRow.largura_util_cm,
          profundidade_util_cm: prateleiraRow.profundidade_util_cm,
          altura_livre_cm: prateleiraRow.altura_livre_cm,
          nivel: prateleiraRow.nivel,
        };

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
        };

        // Calcular capacidade e status
        const capacidade = calcularCapacidadeSlot(produto, prateleira, slot);
        const statusAbastecimento = analisarAbastecimentoSlot(
          leitura,
          capacidade.capacidade_total_slot
        );

        const eventos_ruptura_recentes = rupturasPorSlot.get(id_slot) || 0;

        // Adicionar à lista se for crítico
        if (
          statusAbastecimento.status_abastecimento === 'RUIM' ||
          eventos_ruptura_recentes >= min_eventos_ruptura
        ) {
          slotsCriticos.push({
            id_slot,
            id_produto: leitura.id_produto,
            descricao_produto: produto.descricao,
            id_loja,
            status_abastecimento: statusAbastecimento.status_abastecimento,
            ocupacao_slot: statusAbastecimento.ocupacao_slot,
            ultima_leitura: leitura.data_hora_leitura,
            eventos_ruptura_recentes,
          });
        }
      } catch (error) {
        console.error(`Erro ao processar slot ${id_slot}:`, error);
        continue;
      }
    }

    // 5. Ordenar por criticidade (primeiro por status, depois por ocupação)
    slotsCriticos.sort((a, b) => {
      const statusOrder = { RUIM: 0, REGULAR: 1, BOM: 2 };
      const statusDiff = statusOrder[a.status_abastecimento] - statusOrder[b.status_abastecimento];
      if (statusDiff !== 0) return statusDiff;

      return a.ocupacao_slot - b.ocupacao_slot;
    });

    return NextResponse.json({
      slots_criticos: slotsCriticos,
      total_slots_criticos: slotsCriticos.length,
      periodo: {
        inicio: periodo_inicio.toISOString(),
        fim: now.toISOString(),
        dias: periodo_dias,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar slots críticos:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    );
  }
}
