import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/mensagens
 * Lista todas as conversas (conversations) do sistema
 * Compatível com estrutura do mobile: conversations collection
 *
 * Query params:
 * - userId: filtrar apenas conversas de um usuário específico
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  try {
    let query = supabaseAdmin.from('conversations').select('*');

    // Se userId fornecido, filtrar conversas do usuário (participants é array)
    if (userId) {
      query = query.contains('participants', [userId]);
    }

    const { data: conversationsData, error: conversationsError } = await query;

    if (conversationsError) throw conversationsError;

    // Buscar status online dos participantes
    const allParticipantIds = new Set<string>();
    (conversationsData || []).forEach((conv: any) => {
      const participants = conv?.participants || [];
      participants.forEach((id: string) => allParticipantIds.add(id));
    });

    // Buscar informações de presença dos usuários
    const onlineStatus: Record<string, boolean> = {};
    if (allParticipantIds.size > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, last_seen')
        .in('id', Array.from(allParticipantIds));

      if (!usersError && users) {
        users.forEach((user: any) => {
          const lastSeen = user.last_seen ? new Date(user.last_seen) : null;
          // Considera online se lastSeen foi nos últimos 5 minutos
          onlineStatus[user.id] = lastSeen ? (Date.now() - lastSeen.getTime() < 5 * 60 * 1000) : false;
        });
      }
    }

    // Mapear conversas
    let conversations = (conversationsData || []).map((data: any) => ({
      id: data.id,
      participants: data.participants || [],
      participantNames: data.participant_names || {},
      lastMessage: data.last_message || '',
      lastMessageAt: data.last_message_at || new Date(0).toISOString(),
      lastMessageBy: data.last_message_by || '',
      unreadCount: data.unread_count || {},
      createdAt: data.created_at || new Date(0).toISOString(),
      onlineStatus, // Status online de todos os participantes
    }));

    // Ordenar por lastMessageAt
    conversations.sort((a: any, b: any) => {
      const dateA = new Date(a.lastMessageAt).getTime();
      const dateB = new Date(b.lastMessageAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    return NextResponse.json({ error: 'Falha ao listar conversas' }, { status: 500 });
  }
}

/**
 * POST /api/mensagens
 * Cria uma nova conversa ou envia mensagem em conversa existente
 * Compatível com estrutura do mobile: conversations/{id}/messages
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const senderId = body.senderId || body.from;
    const receiverId = body.receiverId || body.to;
    const text = body.text || body.body || body.mensagem || '';
    const senderName = body.senderName;

    if (!senderId || !receiverId || (!text && !(Array.isArray(body.attachments) && body.attachments.length > 0))) {
      return NextResponse.json(
        { error: 'senderId, receiverId e text são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar ou criar conversa entre os dois usuários
    const participants = [senderId, receiverId].sort();

    const { data: existingConversations, error: searchError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('participants', participants)
      .limit(1);

    if (searchError) throw searchError;

    let conversationId: string;

    if (existingConversations && existingConversations.length > 0) {
      // Conversa já existe
      conversationId = existingConversations[0].id;
    } else {
      // Criar nova conversa - buscar nomes dos usuários
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .in('id', participants);

      if (usersError) throw usersError;

      const participantNames: Record<string, string> = {};
      users?.forEach((user: any) => {
        participantNames[user.id] = user.name || 'Usuário';
      });

      const messagePreview = (text && text.trim().length > 0)
        ? text
        : (Array.isArray(body.attachments) && body.attachments.length > 0
          ? (body.attachments[0]?.type === 'image' ? '[imagem]' : '[arquivo]')
          : '');

      const unreadCount: Record<string, number> = {};
      unreadCount[senderId] = 0;
      unreadCount[receiverId] = 1;

      const { data: newConversation, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert({
          participants,
          participant_names: participantNames,
          last_message: messagePreview,
          last_message_at: new Date().toISOString(),
          last_message_by: senderId,
          unread_count: unreadCount,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;

      conversationId = newConversation.id;
    }

    // Preparar dados da mensagem
    const messageData: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName || 'Usuário',
      receiver_id: receiverId,
      text,
      created_at: new Date().toISOString(),
      read: false,
    };

    // Adicionar attachments se fornecidos
    if (body.attachments && Array.isArray(body.attachments)) {
      messageData.attachments = body.attachments;
    }

    // Adicionar mensagem
    const { error: messageError } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData);

    if (messageError) throw messageError;

    // Atualizar conversa com última mensagem
    const messagePreview = (text && text.trim().length > 0)
      ? text
      : (Array.isArray(body.attachments) && body.attachments.length > 0
        ? (body.attachments[0]?.type === 'image' ? '[imagem]' : '[arquivo]')
        : '');

    // Buscar unread_count atual
    const { data: currentConv } = await supabaseAdmin
      .from('conversations')
      .select('unread_count')
      .eq('id', conversationId)
      .single();

    const currentUnreadCount = currentConv?.unread_count || {};
    const newUnreadCount = { ...currentUnreadCount };
    newUnreadCount[receiverId] = (newUnreadCount[receiverId] || 0) + 1;

    await supabaseAdmin
      .from('conversations')
      .update({
        last_message: messagePreview,
        last_message_at: new Date().toISOString(),
        last_message_by: senderId,
        unread_count: newUnreadCount,
      })
      .eq('id', conversationId);

    return NextResponse.json(
      {
        success: true,
        conversationId,
        message: 'Mensagem enviada com sucesso',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    return NextResponse.json({ error: 'Falha ao criar mensagem' }, { status: 500 });
  }
}
