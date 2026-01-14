import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/notificacoes
 * Lista todas as notificações do sistema
 * Usa tabela 'notifications' (padrão do mobile e Database Triggers)
 *
 * Query params:
 * - count=true: retorna apenas a contagem de notificações não lidas
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get('count') === 'true';

  // Se apenas quer a contagem de não lidas
  if (countOnly) {
    try {
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      if (error) {
        console.error('[Notificações] Erro ao contar notificações:', error);
        return NextResponse.json({ count: 0 });
      }

      return NextResponse.json({ count: count || 0 });
    } catch (error) {
      console.error('Erro ao contar notificações:', error);
      return NextResponse.json({ count: 0 });
    }
  }

  try {
    const { data: notificationsData, error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (notificationsError) {
      console.error('[Notificações] Erro ao listar notificações:', notificationsError);
      throw notificationsError;
    }

    const notifications = (notificationsData || []).map((data: any) => {
      const sentAt = data.sent_at ? new Date(data.sent_at).toISOString() : new Date(0).toISOString();

      return {
        id: data.id,
        userId: data.user_id || '',
        solicitacaoId: data.solicitacao_id || '',
        itemId: data.item_id || '',
        type: data.type || 'info',
        sentAt,
        read: data.read || false,
        fcmResponse: data.fcm_response || '',
        summary: data.summary || null,
        motivoRejeicao: data.motivo_rejeicao || '',
        // Para notificações de nova solicitação
        createdBy: data.created_by || '',
        storeId: data.store_id || '',
        sentTo: data.sent_to || '',
        adminCount: data.admin_count || 0,
        successCount: data.success_count || 0,
        failCount: data.fail_count || 0,
        // Para notificações de mensagens
        messageId: data.message_id || '',
        conversationId: data.conversation_id || '',
        senderId: data.sender_id || '',
        receiverId: data.receiver_id || '',
      };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    return NextResponse.json({ error: 'Falha ao listar notificações' }, { status: 500 });
  }
}

/**
 * POST /api/notificacoes
 * Endpoint desabilitado - notificações devem ser criadas pelos Database Triggers
 * Notificações são criadas automaticamente ao:
 * - Criar nova solicitação (trigger notify_solicitacao_created)
 * - Fechar solicitação (trigger notify_solicitacao_closed)
 * - Enviar mensagem (trigger notify_message_created)
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Notificações são criadas automaticamente pelos Database Triggers',
      message: 'Use as operações de solicitações, itens e mensagens para gerar notificações',
    },
    { status: 405 }
  );
}
