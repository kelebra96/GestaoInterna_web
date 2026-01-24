import { messaging, isFirebaseInitialized } from './firebase-admin';
import { supabaseAdmin } from './supabase-admin';

export async function sendNotificationToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  if (!isFirebaseInitialized) {
    console.warn('[Notifications] Firebase não inicializado, não enviando push.');
    return false;
  }

  try {
    // Buscar token FCM do usuário
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (error || !user?.fcm_token) {
      console.log(`[Notifications] Usuário ${userId} não tem token FCM ou não encontrado.`);
      return false;
    }

    const message = {
      token: user.fcm_token,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await messaging.send(message);
    console.log('[Notifications] Mensagem enviada com sucesso:', response);
    return true;
  } catch (error) {
    console.error('[Notifications] Erro ao enviar notificação:', error);
    return false;
  }
}
