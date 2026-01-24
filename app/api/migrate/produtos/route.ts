import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { db as firestoreDb } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { Role } from '@prisma/client';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MigrationStats = {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseTimestamp(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parsePrice(value: any): number | undefined {
  if (value == null || value === '') return undefined;
  let normalized = value;
  if (typeof normalized === 'string') {
    normalized = normalized.replace(',', '.');
  }
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function cleanText(value: any): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== Role.super_admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  if (!firestoreDb) {
    return NextResponse.json({ error: 'Firestore não configurado' }, { status: 500 });
  }

  try {
    const produtosSnapshot = await firestoreDb.collection('produtos').get();
    const total = produtosSnapshot.size;

    const { data: existingProducts, error: fetchError } = await supabaseAdmin
      .from('produtos')
      .select('*');

    if (fetchError) {
      console.error('[migração produtos] Falha ao buscar produtos existentes:', fetchError);
      throw fetchError;
    }

    const byEan = new Map<string, any>();
    const bySku = new Map<string, any>();

    (existingProducts || []).forEach((product: any) => {
      if (product.ean) {
        byEan.set(String(product.ean).trim(), product);
      }
      if (product.sku) {
        bySku.set(String(product.sku).trim(), product);
      }
    });

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    let skipped = 0;

    produtosSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data() || {};
      const ean = cleanText(data.ean) || cleanText(doc.id);
      const sku = cleanText(data.sku);

      if (!ean && !sku) {
        skipped++;
        return;
      }

      const createdAt = parseTimestamp(data.createdAt);
      const updatedAt = parseTimestamp(data.updatedAt);
      const preco = parsePrice(data.preco);
      const payload: any = {
        nome: cleanText(data.nome) || cleanText(data.name) || cleanText(data.descricao) || doc.id,
        descricao: cleanText(data.descricao) || cleanText(data.description) || undefined,
        ean: ean,
        sku: sku,
        comprador: cleanText(data.comprador) || cleanText(data.buyer),
        fornecedor: cleanText(data.fornecedor) || cleanText(data.supplier),
        preco,
        unidade: cleanText(data.unidade) || cleanText(data.unit),
        ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      Object.keys(payload).forEach((key) => (payload[key] === undefined ? delete payload[key] : null));

      const existing = (ean && byEan.get(ean)) || (sku && bySku.get(sku));
      if (existing) {
        toUpdate.push({ ...payload, id: existing.id });
      } else {
        toInsert.push(payload);
      }
    });

    const batchSize = 40;
    let inserted = 0;
    let updated = 0;

    for (const batch of chunkArray(toUpdate, batchSize)) {
      if (!batch.length) continue;
      const { error: updateError } = await supabaseAdmin
        .from('produtos')
        .upsert(batch, { onConflict: 'id' });

      if (updateError) {
        console.error('[migração produtos] Erro ao atualizar lote:', updateError);
        throw updateError;
      }

      updated += batch.length;
    }

    for (const batch of chunkArray(toInsert, batchSize)) {
      if (!batch.length) continue;
      const { error: insertError } = await supabaseAdmin
        .from('produtos')
        .insert(batch);

      if (insertError) {
        console.error('[migração produtos] Erro ao inserir lote:', insertError);
        throw insertError;
      }

      inserted += batch.length;
    }

    const stats: MigrationStats = {
      total,
      inserted,
      updated,
      skipped,
    };

    return NextResponse.json({
      success: true,
      stats,
      message: `Migração concluída (${inserted} novos, ${updated} atualizados, ${skipped} ignorados).`,
    });
  } catch (error) {
    console.error('[migração produtos]', error);
    return NextResponse.json({ error: 'Falha ao migrar produtos' }, { status: 500 });
  }
}
