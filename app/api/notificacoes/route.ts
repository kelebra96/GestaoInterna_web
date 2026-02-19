import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/notificacoes
 * Lista notificações do usuário autenticado
 * Usa tabela 'notifications' (padrão do mobile e Database Triggers)
 *
 * Query params:
 * - count=true: retorna apenas a contagem de notificações não lidas
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    console.log('❌ [GET /api/notificacoes] Sem autenticação');
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get('count') === 'true';
  const isAdmin = auth.role === Role.super_admin || auth.role === Role.admin_rede;

  // Se apenas quer a contagem de não lidas
  if (countOnly) {
    try {
      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      // Admins veem todas, outros usuários veem apenas suas notificações
      if (!isAdmin) {
        query = query.eq('user_id', auth.userId);
      }

      const { count, error } = await query;

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
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);

    // Admins veem todas as notificações, outros usuários veem apenas suas notificações
    if (!isAdmin) {
      query = query.eq('user_id', auth.userId);
    }

    const { data: notificationsData, error: notificationsError } = await query;

    // Se a tabela não existir ou houver erro, retorna lista vazia
    if (notificationsError) {
      console.error('[Notificações] Erro ao listar notificações:', notificationsError);

      // Se for erro de tabela não existente, retorna lista vazia
      if (notificationsError.code === '42P01' || notificationsError.message?.includes('does not exist')) {
        console.warn('[Notificações] Tabela notifications não existe ainda');
        return NextResponse.json({ notifications: [] });
      }

      // Para outros erros, também retorna lista vazia para não quebrar a UI
      return NextResponse.json({ notifications: [] });
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
  } catch (error: any) {
    console.error('Erro ao listar notificações:', error);
    // Retorna lista vazia em vez de erro para não quebrar a UI
    return NextResponse.json({ notifications: [] });
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
