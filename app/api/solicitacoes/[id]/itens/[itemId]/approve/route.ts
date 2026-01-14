import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
};

export async function POST(
  _req: NextRequest,
  { params }: Params
) {
  const { id, itemId } = await params;
  try {
    // 1. Buscar a solicitação para pegar o createdBy
    const { data: solicitacaoData, error: solicitacaoError } = await supabaseAdmin
      .from('solicitacoes')
      .select('*')
      .eq('id', id)
      .single();

    if (solicitacaoError || !solicitacaoData) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const createdBy = solicitacaoData.created_by;
    const storeId = solicitacaoData.store_id;

    // 2. Atualizar status do item para approved
    const { error: updateError } = await supabaseAdmin
      .from('solicitacao_itens')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('solicitacao_id', id);

    if (updateError) throw updateError;

    // 2.1 Verificar se todos os itens foram processados
    const { data: allItens, error: itensError } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('status')
      .eq('solicitacao_id', id);

    if (!itensError && allItens) {
      const allProcessed = allItens.every((item: any) => {
        const status = item.status;
        return status === 'approved' || status === 'rejected';
      });

      // Se todos os itens foram processados, atualizar status da solicitação
      if (allProcessed && allItens.length > 0) {
        await supabaseAdmin
          .from('solicitacoes')
          .update({
            status: 'batched',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }
    }

    // 3. Buscar dados do item atualizado
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('solicitacao_itens')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      throw new Error('Item não encontrado após aprovação');
    }

    const descricao = itemData.descricao || 'Item';

    // 4. Enviar notificação FCM via queue para o usuário que criou a solicitação
    if (createdBy) {
      try {
        // Buscar usuário para pegar o fcmToken
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('fcm_token')
          .eq('id', createdBy)
          .single();

        if (!userError && userData && userData.fcm_token) {
          // Buscar nome da loja
          let storeName = storeId;
          if (storeId) {
            const { data: storeData } = await supabaseAdmin
              .from('stores')
              .select('name')
              .eq('id', storeId)
              .single();

            if (storeData) {
              storeName = storeData.name || storeId;
            }
          }

          // Inserir na fila FCM (o worker enviará a notificação)
          await supabaseAdmin.from('fcm_queue').insert({
            user_id: createdBy,
            fcm_token: userData.fcm_token,
            notification_type: 'item_approved',
            title: '✅ Item Aprovado',
            body: `O item "${descricao}" da ${storeName} foi aprovado!`,
            data: {
              type: 'item_approved',
              solicitacaoId: id,
              itemId: itemId,
              allowActions: 'true',
            },
            status: 'pending',
            created_at: new Date().toISOString(),
          });

          console.log('✅ Notificação FCM adicionada à fila');
        } else {
          console.log('⚠️ Usuário não tem FCM token registrado');
        }
      } catch (notifError) {
        // Não bloquear a aprovação se a notificação falhar
        console.error('Erro ao adicionar notificação à fila:', notifError);
      }
    }

    // 5. Retornar item atualizado
    const createdAt = new Date(itemData.created_at || 0);
    const validade = itemData.validade ? new Date(itemData.validade) : new Date(0);

    return NextResponse.json({
      item: {
        id: itemData.id,
        ean: itemData.ean,
        sku: itemData.sku,
        descricao: itemData.descricao,
        precoAtual: itemData.preco_atual,
        validade: validade.toISOString(),
        qtd: itemData.qtd,
        status: 'approved',
        createdAt: createdAt.toISOString(),
      },
      message: 'Item aprovado com sucesso e notificação enfileirada',
    });
  } catch (error) {
    console.error('Erro ao aprovar item:', error);
    return NextResponse.json({ error: 'Falha ao aprovar item' }, { status: 500 });
  }
}
