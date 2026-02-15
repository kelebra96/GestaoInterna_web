import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type ChamadoResponse = {
  id: string;
  title?: string;
  description?: string;
  createdBy?: string | null;
  createdAt: string | null;
  status: string;
  proposal: unknown;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('chamados')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
      }

      const chamado: ChamadoResponse = {
        id: data.id,
        title: data.title,
        description: data.description,
        createdBy: data.created_by ?? null,
        createdAt: data.created_at ?? null,
        status: data.status ?? 'open',
        proposal: data.proposal ?? null,
      };
      return NextResponse.json({ chamado });
    }

    const { data: chamadosData, error } = await supabaseAdmin
      .from('chamados')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chamados] Error fetching:', error);
      throw error;
    }

    const chamados: ChamadoResponse[] = (chamadosData || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at ?? null,
      status: row.status ?? 'open',
      proposal: row.proposal ?? null,
    }));

    return NextResponse.json({ chamados });
  } catch (error) {
    console.error('Erro ao listar chamados:', error);
    return NextResponse.json({ error: 'Falha ao listar chamados' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, createdBy } = body as { title?: string; description?: string; createdBy?: string };

    if (!title || !description) {
      return NextResponse.json({ error: 'Título e descrição são obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('chamados')
      .insert({
        title,
        description,
        created_by: createdBy || null,
        status: 'open',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Chamados] Error creating:', error);
      throw error;
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Erro ao criar chamado:', error);
    return NextResponse.json({ error: 'Falha ao criar chamado' }, { status: 500 });
  }
}
