import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/mensagens/migrate?secret=...
 * Migra mensagens de conversations/{id}/messages para a coleção raiz 'messages'.
 * Evita duplicação usando o mesmo ID do documento da subcoleção.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const expected = process.env.MIGRATE_SECRET;

    if (expected && secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationsSnap = await db.collection('conversations').get();

    let scanned = 0;
    let copied = 0;
    let skipped = 0;
    let batch = db.batch();
    let ops = 0;

    for (const convDoc of conversationsSnap.docs) {
      const convId = convDoc.id;
      const subSnap = await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .get();

      for (const msgDoc of subSnap.docs) {
        scanned++;
        const rootRef = db.collection('messages').doc(msgDoc.id);
        const rootDoc = await rootRef.get();
        if (rootDoc.exists) {
          skipped++;
          continue;
        }

        const data = msgDoc.data() || {} as any;
        const createdAt = data.createdAt || admin.firestore.FieldValue.serverTimestamp();

        const payload = {
          conversationId: convId,
          senderId: data.senderId || '',
          senderName: data.senderName || 'Usuário',
          receiverId: data.receiverId || '',
          text: data.text || '',
          createdAt,
          read: data.read === true,
          edited: data.edited === true,
          editedAt: data.editedAt || null,
        };

        batch.set(rootRef, payload);
        copied++;
        ops++;

        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      conversations: conversationsSnap.size,
      scanned,
      copied,
      skipped,
      message: 'Migração concluída',
    });
  } catch (error) {
    console.error('Erro na migração de mensagens:', error);
    return NextResponse.json({ error: 'Falha na migração' }, { status: 500 });
  }
}

