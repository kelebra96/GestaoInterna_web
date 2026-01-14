import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/mensagens/[id]
 * Busca uma conversa específica e lista todas as suas mensagens
 * Compatível com estrutura do mobile: conversations/{id}/messages
 * Query params:
 *   - userId: opcional, filtra mensagens deletadas por este usuário
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(_req.url);
  const userId = searchParams.get('userId');

  console.log('📨 GET /api/mensagens/[id] - conversationId:', id, 'userId:', userId);

  try {
    // Buscar conversa
    const { data: conversationData, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (conversationError || !conversationData) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // Buscar status online dos participantes
    const participants = conversationData.participants || [];
    const onlineStatus: Record<string, boolean> = {};

    if (participants.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, last_seen')
        .in('id', participants);

      if (!usersError && users) {
        users.forEach((user: any) => {
          const lastSeen = user.last_seen ? new Date(user.last_seen) : null;
          // Considera online se lastSeen foi nos últimos 5 minutos
          onlineStatus[user.id] = lastSeen ? (Date.now() - lastSeen.getTime() < 5 * 60 * 1000) : false;
        });
      }
    }

    const conversation = {
      id: conversationData.id,
      participants,
      participantNames: conversationData.participant_names || {},
      lastMessage: conversationData.last_message || '',
      lastMessageAt: conversationData.last_message_at || new Date(0).toISOString(),
      lastMessageBy: conversationData.last_message_by || '',
      unreadCount: conversationData.unread_count || {},
      createdAt: conversationData.created_at || new Date(0).toISOString(),
      onlineStatus, // Status online dos participantes
    };

    // Buscar mensagens da conversa
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Mensagens] Erro ao buscar mensagens:', messagesError);
    }

    const allMessages = (messagesData || []).map((data: any) => ({
      id: data.id,
      conversationId: data.conversation_id || id,
      senderId: data.sender_id || '',
      senderName: data.sender_name || 'Usuário',
      receiverId: data.receiver_id || '',
      text: data.text || '',
      createdAt: data.created_at || new Date(0).toISOString(),
      read: data.read === true,
      edited: data.edited === true,
      editedAt: data.edited_at || null,
      attachments: data.attachments || [],
      deletedBy: data.deleted_by || [],
      deletedForEveryone: data.deleted_for_everyone === true,
      deletedForEveryoneAt: data.deleted_for_everyone_at || null,
    }));

    console.log('📨 GET - Total mensagens no Supabase:', allMessages.length);
    console.log('📨 GET - Mensagens com deletedBy:', allMessages.filter((m: any) => m.deletedBy && m.deletedBy.length > 0).length);
    console.log('📨 GET - Mensagens deletedForEveryone:', allMessages.filter((m: any) => m.deletedForEveryone).length);

    // Filtrar mensagens deletadas pelo usuário (se userId fornecido)
    const messages = allMessages
      .filter((msg: any) => {
        // Se foi deletada para todos, mostrar apenas placeholder (manter na lista)
        if (msg.deletedForEveryone) {
          return true; // Mantém na lista para mostrar placeholder
        }

        if (!userId) {
          console.log('📨 GET - Sem filtro de userId, retornando todas');
          return true;
        }

        const isDeleted = msg.deletedBy.includes(userId);
        if (isDeleted) {
          console.log('📨 GET - Filtrando mensagem deletada:', msg.id);
        }
        return !isDeleted;
      })
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    console.log('📨 GET - Mensagens após filtro:', messages.length);

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error('Erro ao buscar conversa:', error);
    return NextResponse.json({ error: 'Falha ao buscar conversa' }, { status: 500 });
  }
}

/**
 * PATCH /api/mensagens/[id]
 * Marca todas as mensagens de uma conversa como lidas para um usuário
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Verificar se conversa existe
    const { data: conversationData, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (conversationError || !conversationData) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // Marcar todas as mensagens não lidas como lidas
    const { data: unreadMessages, error: updateError } = await supabaseAdmin
      .from('chat_messages')
      .update({ read: true })
      .eq('conversation_id', id)
      .eq('receiver_id', userId)
      .eq('read', false)
      .select('id');

    if (updateError) {
      console.error('[Mensagens] Erro ao marcar como lidas:', updateError);
    }

    const updatedCount = unreadMessages?.length || 0;

    // Zerar contador de não lidas na conversa
    const currentUnreadCount = conversationData.unread_count || {};
    const newUnreadCount = { ...currentUnreadCount };
    newUnreadCount[userId] = 0;

    await supabaseAdmin
      .from('conversations')
      .update({
        unread_count: newUnreadCount,
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      message: 'Mensagens marcadas como lidas',
      updatedCount,
    });
  } catch (error) {
    console.error('Erro ao atualizar conversa:', error);
    return NextResponse.json({ error: 'Falha ao atualizar conversa' }, { status: 500 });
  }
}
