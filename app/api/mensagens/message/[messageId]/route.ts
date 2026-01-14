import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Desabilitar cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE /api/mensagens/message/[messageId]
 * Soft delete: adiciona userId ao array deletedBy
 * Hard delete: marca deletedForEveryone = true (apenas remetente, 30min)
 *
 * Query params:
 *   - forEveryone: true para deletar para todos (apenas remetente, 30min)
 *
 * Body:
 *   - userId: ID do usuário que está deletando
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await context.params;
  const { searchParams } = new URL(req.url);
  const forEveryone = searchParams.get('forEveryone') === 'true';

  console.log('🗑️ DELETE API chamada para messageId:', messageId, 'forEveryone:', forEveryone);

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    console.log('🗑️ DELETE - userId recebido:', userId);

    if (!userId) {
      console.error('🗑️ DELETE - ERRO: userId não fornecido');
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Buscar a mensagem
    console.log('🗑️ DELETE - Buscando mensagem no Supabase...');
    const { data: messageData, error: fetchError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    console.log('🗑️ DELETE - Mensagem existe?', !!messageData);

    if (fetchError || !messageData) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    const createdAt = new Date(messageData.created_at);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    console.log('🗑️ DELETE - Dados da mensagem:', {
      senderId: messageData.sender_id,
      receiverId: messageData.receiver_id,
      deletedFor: messageData.deleted_for,
      createdAt,
      timeDiffMinutes: timeDiffMinutes.toFixed(2)
    });

    // Verificar se o usuário pode deletar (apenas quem enviou ou recebeu)
    if (messageData.sender_id !== userId && messageData.receiver_id !== userId) {
      console.error('🗑️ DELETE - ERRO: Usuário sem permissão');
      return NextResponse.json(
        { error: 'Você não tem permissão para deletar esta mensagem' },
        { status: 403 }
      );
    }

    // DELETAR PARA TODOS (apenas remetente, dentro de 30 minutos)
    if (forEveryone) {
      // Verificar se é o remetente
      if (messageData.sender_id !== userId) {
        console.error('🗑️ DELETE - ERRO: Apenas o remetente pode deletar para todos');
        return NextResponse.json(
          { error: 'Apenas o remetente pode deletar para todos' },
          { status: 403 }
        );
      }

      // Verificar janela de 30 minutos
      if (timeDiffMinutes > 30) {
        console.error('🗑️ DELETE - ERRO: Tempo excedido (30 minutos)');
        return NextResponse.json(
          { error: 'Só é possível deletar para todos dentro de 30 minutos após o envio' },
          { status: 400 }
        );
      }

      // Marcar como deletada para todos
      console.log('🗑️ DELETE - Marcando como deleted_for_all');
      const { error: updateError } = await supabaseAdmin
        .from('chat_messages')
        .update({
          deleted_for_all: true,
          deleted_for_everyone_at: new Date().toISOString(),
          deleted_for_everyone_by: userId,
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('🗑️ DELETE - ERRO ao atualizar:', updateError);
        throw updateError;
      }

      console.log('🗑️ DELETE - Mensagem deletada para todos com sucesso!');
      return NextResponse.json({
        success: true,
        message: 'Mensagem deletada para todos',
        forEveryone: true,
      });
    }

    // DELETAR APENAS PARA MIM (soft delete)
    const deletedFor = messageData.deleted_for || [];

    if (deletedFor.includes(userId)) {
      console.error('🗑️ DELETE - ERRO: Mensagem já deletada');
      return NextResponse.json(
        { error: 'Mensagem já foi deletada' },
        { status: 400 }
      );
    }

    console.log('🗑️ DELETE - Atualizando documento com deleted_for:', [...deletedFor, userId]);
    const { error: updateError } = await supabaseAdmin
      .from('chat_messages')
      .update({
        deleted_for: [...deletedFor, userId],
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('🗑️ DELETE - ERRO ao atualizar:', updateError);
      throw updateError;
    }

    console.log('🗑️ DELETE - Mensagem deletada com sucesso!');
    return NextResponse.json({
      success: true,
      message: 'Mensagem deletada com sucesso',
      forEveryone: false,
    });
  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    return NextResponse.json(
      { error: 'Falha ao deletar mensagem' },
      { status: 500 }
    );
  }
}
