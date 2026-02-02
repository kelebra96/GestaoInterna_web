import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

const CallNotificationSchema = z.object({
  callerId: z.string().optional(),
  callerName: z.string().optional(),
  receiverId: z.string(),
  conversationId: z.string().optional(),
  callType: z.enum(['voice', 'video']).optional(),
  status: z.enum(['received', 'missed']).optional(),
});

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let payload: z.infer<typeof CallNotificationSchema>;
  try {
    payload = CallNotificationSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  if (payload.receiverId !== auth.userId) {
    return NextResponse.json({ error: 'Destino inválido' }, { status: 403 });
  }

  const callLabel = payload.callType === 'video' ? 'Chamada de vídeo' : 'Chamada de voz';
  const callerLabel = payload.callerName || payload.callerId || 'Usuário';
  const isMissed = payload.status === 'missed';
  const title = isMissed ? `❗ Chamada perdida` : `📞 ${callLabel}`;
  const message = isMissed
    ? `Você perdeu uma ${callLabel.toLowerCase()} de ${callerLabel}.`
    : `Recebendo ${callLabel.toLowerCase()} de ${callerLabel}.`;
  const link = payload.conversationId ? `/mensagens/${payload.conversationId}` : undefined;

  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: payload.receiverId,
    title,
    message,
    type: isMissed ? 'warning' : 'info',
    link,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[Notificações] Erro ao registrar chamada:', error);
    return NextResponse.json({ error: 'Falha ao registrar notificação' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
