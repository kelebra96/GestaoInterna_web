// web/app/api/volumetria/ruptura-horario/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calcularTaxaRuptura } from '@/lib/services/volumetriaCalculos';
import type { RupturaPorHorario } from '@/lib/types/volumetria';

export const dynamic = 'force-dynamic';

/**
 * GET /api/volumetria/ruptura-horario
 *
 * Painel de ruptura agrupado por hora do dia ou dia da semana
 *
 * Query params:
 * - id_loja: ID da loja (obrigatório)
 * - periodo_dias: Período em dias para análise (padrão: 30)
 * - agrupar_por: 'hora' | 'dia_semana' (padrão: 'hora')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id_loja = searchParams.get('id_loja');
    const periodo_dias = parseInt(searchParams.get('periodo_dias') || '30');
    const agrupar_por = searchParams.get('agrupar_por') || 'hora';

    if (!id_loja) {
      return NextResponse.json(
        { error: 'Parâmetro id_loja é obrigatório' },
        { status: 400 }
      );
    }

    if (agrupar_por !== 'hora' && agrupar_por !== 'dia_semana') {
      return NextResponse.json(
        { error: 'Parâmetro agrupar_por deve ser "hora" ou "dia_semana"' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodo_inicio = new Date(now.getTime() - periodo_dias * 24 * 60 * 60 * 1000);

    // 1. Buscar todas as leituras de estoque no período
    const { data: leituras, error: leiturasError } = await supabaseAdmin
      .from('leituras_estoque_gondola')
      .select('*')
      .eq('store_id', id_loja)
      .gte('data_hora_leitura', periodo_inicio.toISOString());

    if (leiturasError) {
      console.error('[VolumetriaRupturaHorario] Error fetching leituras:', leiturasError);
      throw leiturasError;
    }

    if (!leituras || leituras.length === 0) {
      return NextResponse.json({
        ruptura_por_horario: [],
        message: 'Nenhuma leitura de estoque encontrada no período'
      });
    }

    // 2. Buscar dados de capacidade dos slots (necessário para detectar ruptura)
    const uniqueSlotIds = Array.from(new Set(leituras.map((l: any) => l.slot_id)));
    const uniqueProdutoIds = Array.from(new Set(leituras.map((l: any) => l.produto_id)));

    const { data: slots } = await supabaseAdmin
      .from('slots_planograma')
      .select('*')
      .in('id', uniqueSlotIds);

    const prateleiraIds = (slots || []).map((s: any) => s.prateleira_id);

    const { data: prateleiras } = await supabaseAdmin
      .from('prateleiras')
      .select('*')
      .in('id', prateleiraIds);

    const { data: produtos } = await supabaseAdmin
      .from('produtos_volumetria')
      .select('*')
      .in('id', uniqueProdutoIds);

    // Create maps for quick lookup
    const slotMap = new Map((slots || []).map((s: any) => [s.id, s]));
    const prateleiraMap = new Map((prateleiras || []).map((p: any) => [p.id, p]));
    const produtoMap = new Map((produtos || []).map((p: any) => [p.id, p]));

    // Calculate capacity for each slot
    const slotsCapacidade = new Map<string, number>();

    for (const slot of (slots || [])) {
      try {
        const prateleira = prateleiraMap.get(slot.prateleira_id);
        if (!prateleira) continue;

        const produto = produtoMap.get(slot.produto_id);
        if (!produto) continue;

        // Calcular capacidade simplificada
        const largura_slot = slot.largura_slot_cm || 0;
        const largura_produto = produto.largura_cm || 1;
        const profundidade_prateleira = prateleira.profundidade_util_cm || 0;
        const profundidade_produto = produto.profundidade_cm || 1;
        const altura_livre = prateleira.altura_livre_cm || 0;
        const altura_produto = produto.altura_cm || 1;

        const facings = Math.floor(largura_slot / largura_produto);
        const prof = Math.floor(profundidade_prateleira / profundidade_produto);
        const camadas = produto.pode_empilhar
          ? Math.floor(altura_livre / altura_produto)
          : 1;

        const capacidade = facings * prof * camadas;
        slotsCapacidade.set(slot.id, capacidade);
      } catch (error) {
        console.error(`Erro ao calcular capacidade do slot ${slot.id}:`, error);
        continue;
      }
    }

    // 3. Agrupar leituras e detectar rupturas
    const grupos = new Map<number, { total: number; rupturas: number }>();

    for (const leitura of leituras) {
      const data_leitura = new Date(leitura.data_hora_leitura);
      const quantidade = leitura.quantidade_atual_slot || 0;
      const capacidade = slotsCapacidade.get(leitura.slot_id) || 1;

      let chave: number;
      if (agrupar_por === 'hora') {
        chave = data_leitura.getHours(); // 0-23
      } else {
        chave = data_leitura.getDay(); // 0-6 (0=domingo)
      }

      if (!grupos.has(chave)) {
        grupos.set(chave, { total: 0, rupturas: 0 });
      }

      const grupo = grupos.get(chave)!;
      grupo.total += 1;

      // Detectar ruptura (total ou funcional < 10% da capacidade)
      const ocupacao = quantidade / capacidade;
      if (quantidade === 0 || ocupacao < 0.10) {
        grupo.rupturas += 1;
      }
    }

    // 4. Montar resultado
    const rupturaPorHorario: RupturaPorHorario[] = [];

    for (const [chave, grupo] of grupos.entries()) {
      const taxa = calcularTaxaRuptura(grupo.rupturas, grupo.total);

      if (agrupar_por === 'hora') {
        rupturaPorHorario.push({
          hora: chave,
          total_verificacoes: grupo.total,
          verificacoes_com_ruptura: grupo.rupturas,
          taxa_ruptura: taxa,
        });
      } else {
        rupturaPorHorario.push({
          hora: 0, // Não usado para agrupamento por dia da semana
          dia_semana: chave,
          total_verificacoes: grupo.total,
          verificacoes_com_ruptura: grupo.rupturas,
          taxa_ruptura: taxa,
        });
      }
    }

    // 5. Ordenar
    if (agrupar_por === 'hora') {
      rupturaPorHorario.sort((a, b) => a.hora - b.hora);
    } else {
      rupturaPorHorario.sort((a, b) => (a.dia_semana || 0) - (b.dia_semana || 0));
    }

    // 6. Calcular média geral
    const total_verificacoes = rupturaPorHorario.reduce(
      (sum, r) => sum + r.total_verificacoes,
      0
    );
    const total_rupturas = rupturaPorHorario.reduce(
      (sum, r) => sum + r.verificacoes_com_ruptura,
      0
    );
    const taxa_ruptura_media = calcularTaxaRuptura(total_rupturas, total_verificacoes);

    return NextResponse.json({
      ruptura_por_horario: rupturaPorHorario,
      agrupamento: agrupar_por,
      resumo: {
        total_verificacoes,
        total_rupturas,
        taxa_ruptura_media,
      },
      periodo: {
        inicio: periodo_inicio.toISOString(),
        fim: now.toISOString(),
        dias: periodo_dias,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar ruptura por horário:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    );
  }
}
