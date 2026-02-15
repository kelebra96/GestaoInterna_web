import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, approverId } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (!approverId) {
      return NextResponse.json({ error: 'approverId é obrigatório' }, { status: 400 });
    }

    // Check if chamado exists
    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from('chamados')
      .select('id')
      .eq('id', id)
      .single();

    if (chamadoError || !chamado) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
    }

    // Check if approver exists and has developer role
    const { data: approver, error: approverError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', approverId)
      .single();

    if (approverError || !approver) {
      return NextResponse.json({ error: 'Aprovador não encontrado' }, { status: 404 });
    }

    if (approver.role !== 'developer') {
      return NextResponse.json(
        { error: 'Somente usuários com role "developer" podem aprovar' },
        { status: 403 }
      );
    }

    // Update chamado
    const { error: updateError } = await supabaseAdmin
      .from('chamados')
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[ChamadosApprove] Error updating:', updateError);
      throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao aprovar chamado:', error);
    return NextResponse.json({ error: 'Falha ao aprovar chamado' }, { status: 500 });
  }
}
