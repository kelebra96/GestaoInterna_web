import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/notificacoes/[id]
 * Busca uma notificação específica
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const isAdmin = auth.role === Role.super_admin || auth.role === Role.admin_rede;

  try {
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id);

    // Se não for admin, verificar se a notificação pertence ao usuário
    if (!isAdmin) {
      query = query.eq('user_id', auth.userId);
    }

    const { data: notificationData, error: notificationError } = await query.single();

    if (notificationError || !notificationData) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    const sentAt = notificationData.sent_at
      ? new Date(notificationData.sent_at).toISOString()
      : new Date(0).toISOString();

    const notification = {
      id: notificationData.id,
      userId: notificationData.user_id || '',
      solicitacaoId: notificationData.solicitacao_id || '',
      type: notificationData.type || 'info',
      sentAt,
      fcmResponse: notificationData.fcm_response || '',
      summary: notificationData.summary || null,
    };

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Erro ao buscar notificação:', error);
    return NextResponse.json({ error: 'Falha ao buscar notificação' }, { status: 500 });
  }
}

/**
 * PATCH /api/notificacoes/[id]
 * Atualiza o status de leitura de uma notificação
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const isAdmin = auth.role === Role.super_admin || auth.role === Role.admin_rede;

  try {
    const body = await req.json().catch(() => ({}));
    const read = body?.read;

    if (typeof read !== 'boolean') {
      return NextResponse.json({ error: 'Campo "read" é obrigatório e deve ser boolean' }, { status: 400 });
    }

    // Verificar se notificação existe e pertence ao usuário
    let checkQuery = supabaseAdmin
      .from('notifications')
      .select('id, user_id')
      .eq('id', id);

    if (!isAdmin) {
      checkQuery = checkQuery.eq('user_id', auth.userId);
    }

    const { data: existingNotification, error: checkError } = await checkQuery.single();

    if (checkError || !existingNotification) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    // Atualizar status de leitura
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({
        read,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Notificações] Erro ao atualizar notificação:', updateError);
      throw updateError;
    }

    // Buscar notificação atualizada
    const { data: updatedData, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !updatedData) {
      throw fetchError || new Error('Notificação não encontrada após atualização');
    }

    const sentAt = updatedData.sent_at
      ? new Date(updatedData.sent_at).toISOString()
      : new Date(0).toISOString();

    return NextResponse.json({
      notificacao: {
        id: updatedData.id,
        userId: updatedData.user_id || '',
        solicitacaoId: updatedData.solicitacao_id || '',
        itemId: updatedData.item_id || '',
        type: updatedData.type || 'info',
        sentAt,
        read: updatedData.read || false,
        motivoRejeicao: updatedData.motivo_rejeicao || '',
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error);
    return NextResponse.json({ error: 'Falha ao atualizar notificação' }, { status: 500 });
  }
}

/**
 * DELETE /api/notificacoes/[id]
 * Remove uma notificação
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const isAdmin = auth.role === Role.super_admin || auth.role === Role.admin_rede;

  try {
    // Verificar se notificação existe e pertence ao usuário
    let checkQuery = supabaseAdmin
      .from('notifications')
      .select('id, user_id')
      .eq('id', id);

    if (!isAdmin) {
      checkQuery = checkQuery.eq('user_id', auth.userId);
    }

    const { data: existingNotification, error: checkError } = await checkQuery.single();

    if (checkError || !existingNotification) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    // Deletar notificação
    const { error: deleteError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Notificações] Erro ao deletar notificação:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Notificação removida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao remover notificação:', error);
    return NextResponse.json({ error: 'Falha ao remover notificação' }, { status: 500 });
  }
}
