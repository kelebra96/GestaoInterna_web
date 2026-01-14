import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from('user_activities')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[UserActivities] Error fetching:', error);
      throw error;
    }

    const activities = (data || []).map((row) => ({
      id: row.id,
      type: row.type || 'info',
      message: row.message || '',
      createdAt: row.created_at,
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Erro ao listar atividades do usuário:', error);
    return NextResponse.json({ error: 'Falha ao listar atividades' }, { status: 500 });
  }
}

