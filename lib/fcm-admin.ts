/**
 * Firebase Cloud Messaging Admin SDK
 * Usado APENAS para envio de notificações push
 * Mantido após migração para Supabase
 */

import admin from 'firebase-admin';

// Inicializar Firebase Admin APENAS para FCM
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.warn('⚠️  FCM Admin credentials not configured. Push notifications will not work.');
    console.warn('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized for FCM');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin for FCM:', error);
    }
  }
}

/**
 * Opções para envio de notificação FCM
 */
export interface FCMNotificationOptions {
  /** Token FCM do dispositivo destinatário */
  token: string;
  /** Título da notificação */
  title: string;
  /** Corpo da mensagem */
  body: string;
  /** Dados extras (key-value pairs) */
  data?: Record<string, string>;
  /** Tipo de notificação (para channel Android) */
  notificationType?: string;
  /** URL da imagem (opcional) */
  imageUrl?: string;
  /** Badge count (iOS) */
  badge?: number;
}

/**
 * Envia notificação push via Firebase Cloud Messaging
 * @param options Opções da notificação
 * @returns Message ID do FCM
 */
export async function sendFCMNotification(options: FCMNotificationOptions): Promise<string> {
  const {
    token,
    title,
    body,
    data = {},
    notificationType = 'default',
    imageUrl,
    badge,
  } = options;

  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized. Cannot send FCM notification.');
  }

  // Construir mensagem FCM
  const message: admin.messaging.Message = {
    token,
    notification: {
      title,
      body,
      imageUrl,
    },
    data: {
      ...data,
      type: notificationType,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: notificationType,
        priority: 'high' as const,
        defaultSound: true,
        defaultVibrateTimings: true,
        imageUrl,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: badge ?? 1,
          contentAvailable: true,
        },
      },
      fcmOptions: {
        imageUrl,
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`✅ FCM notification sent successfully: ${response}`);
    return response;
  } catch (error: any) {
    console.error(`❌ Failed to send FCM notification to ${token}:`, error);

    // Melhorar mensagens de erro
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      throw new Error(`Invalid or expired FCM token: ${token}`);
    }

    throw error;
  }
}

/**
 * Envia notificações para múltiplos dispositivos (batch)
 * @param notifications Array de notificações para enviar
 * @returns Resultados do envio
 */
export async function sendBatchFCMNotifications(
  notifications: FCMNotificationOptions[]
): Promise<admin.messaging.BatchResponse> {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized. Cannot send FCM notifications.');
  }

  const messages: admin.messaging.Message[] = notifications.map(options => ({
    token: options.token,
    notification: {
      title: options.title,
      body: options.body,
      imageUrl: options.imageUrl,
    },
    data: {
      ...(options.data || {}),
      type: options.notificationType || 'default',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: options.notificationType || 'default',
        priority: 'high' as const,
        defaultSound: true,
        defaultVibrateTimings: true,
        imageUrl: options.imageUrl,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: options.badge ?? 1,
          contentAvailable: true,
        },
      },
      fcmOptions: {
        imageUrl: options.imageUrl,
      },
    },
  }));

  try {
    const response = await admin.messaging().sendEach(messages);
    console.log(`✅ Batch FCM: ${response.successCount} sent, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    console.error(`❌ Failed to send batch FCM notifications:`, error);
    throw error;
  }
}

/**
 * Valida se um token FCM é válido
 * @param token Token FCM para validar
 * @returns true se válido, false caso contrário
 */
export async function validateFCMToken(token: string): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Cannot validate FCM token.');
    return false;
  }

  try {
    // Tentar enviar uma mensagem dry-run
    await admin.messaging().send({
      token,
      notification: {
        title: 'Test',
        body: 'Test',
      },
    }, true); // dry-run mode

    return true;
  } catch (error: any) {
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return false;
    }

    // Outros erros não indicam token inválido
    return true;
  }
}

export default admin.messaging();
