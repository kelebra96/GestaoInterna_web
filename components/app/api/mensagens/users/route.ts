import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/mensagens/users
 * Lista todos os usuários disponíveis para mensagens
 * Qualquer usuário autenticado pode acessar
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const currentUserId = auth.userId;

    // Buscar todos os usuários ativos (sem filtro por empresa para permitir comunicação entre empresas)
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, display_name, email, role, last_seen, active, company_id')
      .eq('active', true)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('[Mensagens/Users] Erro ao listar usuários:', error);
      return NextResponse.json({ users: [] });
    }

    // Mapear e calcular status online
    const users = (data || [])
      .filter((user: any) => user.id !== currentUserId) // Excluir usuário atual
      .map((user: any) => {
        const lastSeen = user.last_seen ? new Date(user.last_seen) : null;
        const isOnline = lastSeen ? (Date.now() - lastSeen.getTime() < 5 * 60 * 1000) : false;

        return {
          id: user.id,
          displayName: user.display_name || user.email || 'Usuário',
          email: user.email,
          role: user.role,
          active: user.active !== false,
          lastSeen: user.last_seen,
          isOnline,
        };
      })
      // Ordenar: online primeiro
      .sort((a: any, b: any) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

    // Contar usuários online
    const onlineCount = users.filter((u: any) => u.isOnline).length;

    return NextResponse.json({
      users,
      stats: {
        total: users.length,
        online: onlineCount,
      }
    });
  } catch (error: any) {
    console.error('[Mensagens/Users] Erro:', error);
    return NextResponse.json({ users: [], stats: { total: 0, online: 0 } });
  }
}
