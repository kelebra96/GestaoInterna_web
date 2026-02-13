import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Role } from '@prisma/client';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type Status = 'pending' | 'batched' | 'closed';

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type SolicitacaoDTO = {
  id: string;
  status: Status;
  createdAt: string;
  userId: string | null;
  userName: string;
  storeId: string | null;
  storeName: string;
  companyId: string | null;
  companyName?: string;
  items?: number;
  total?: number;
};

const getUserName = async (userId?: string): Promise<string> => {
  if (!userId) return 'Desconhecido';
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .single();

    if (error) return 'Desconhecido';
    return data?.display_name || 'Desconhecido';
  } catch {
    return 'Desconhecido';
  }
};

const getStoreName = async (storeId?: string): Promise<string> => {
  if (!storeId) return 'Desconhecida';
  try {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single();

    if (error) return 'Desconhecida';
    return data?.name || 'Desconhecida';
  } catch {
    return 'Desconhecida';
  }
};

const getCompanyName = async (companyId?: string): Promise<string | undefined> => {
  if (!companyId) return undefined;
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    if (error) return undefined;
    return data?.name;
  } catch {
    return undefined;
  }
};

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    console.log('❌ [GET /api/solicitacoes] Sem autenticação');
    return NextResponse.json({ error: 'Não autorizado - faça login novamente' }, { status: 403 });
  }

  try {
    console.log('🔍 [GET /api/solicitacoes] Auth:', {
      userId: auth.userId,
      role: auth.role,
      orgId: auth.orgId,
      storeIds: auth.storeIds,
    });

    // Buscar solicitações com base nas permissões do usuário (excluindo rascunhos)
    let query = supabaseAdmin.from('solicitacoes').select('*').neq('status', 'draft');

    const isStoreScoped = auth.role === Role.gestor_loja || auth.role === Role.repositor;

    // Se o usuário é limitado por loja, filtrar por storeIds
    if (isStoreScoped && auth.storeIds && auth.storeIds.length > 0) {
      console.log('🔍 Buscando solicitações das lojas:', auth.storeIds);

      // Supabase não tem limite de 10 itens no IN, então não precisa de chunking!
      query = query.in('store_id', auth.storeIds);
    } else if (auth.role !== Role.super_admin && auth.orgId) {
      // Usuário sem lojas específicas - filtrar por companyId
      if (auth.orgId === 'unknown-org') {
        console.warn('⚠️ [GET /api/solicitacoes] orgId desconhecido; ignorando filtro por empresa');
      } else if (auth.role === Role.admin_rede) {
        // Admins veem a empresa e registros legados sem company_id
        console.log('🔍 Buscando solicitações da empresa (incluindo sem company_id):', auth.orgId);
        query = query.or(`company_id.eq.${auth.orgId},company_id.is.null`);
      } else {
        console.log('🔍 Buscando solicitações da empresa:', auth.orgId);
        query = query.eq('company_id', auth.orgId);
      }
    }

    const { data: solicitacoesData, error: solicitacoesError } = await query;

    if (solicitacoesError) {
      console.error('❌ Erro ao buscar solicitações:', solicitacoesError);
      throw solicitacoesError;
    }

    const solicitacoes: SolicitacaoDTO[] = [];

    for (const data of solicitacoesData || []) {
      let status: Status = ['pending', 'batched', 'closed'].includes(String(data.status))
        ? (data.status as Status)
        : 'pending';

      // Converter createdAt (já vem como string ISO do Supabase)
      const createdAt = new Date(data.created_at || new Date());

      let buyerId: string | null = data.buyer_id || data.created_by || null;
      let userName: string | null = null;
      const storeName = await getStoreName(data.store_id);
      const companyId = data.company_id || null;
      const companyName = await getCompanyName(companyId || undefined);

      let items: number | undefined;
      let total: number | undefined;
      let shouldUpdateStatus = false;

      let itensData: any[] | null = null;
      try {
        // Buscar itens da solicitação (substituindo subcollection por foreign key)
        const { data: itensDataResult, error: itensError } = await supabaseAdmin
          .from('solicitacao_itens')
          .select('*')
          .eq('solicitacao_id', data.id);

        if (!itensError && itensDataResult) {
          itensData = itensDataResult;
          items = itensDataResult.length;

          // Verificar se todos os itens foram processados
          if (items && items > 0) {
            const allProcessed = itensDataResult.every((item: any) => {
              const itemStatus = item.status;
              return itemStatus === 'approved' || itemStatus === 'rejected';
            });

            // Se todos os itens foram processados e o status da solicitação está como 'pending', corrigir
            if (allProcessed && status === 'pending') {
              status = 'batched';
              shouldUpdateStatus = true;
            }
          }

          // Calcular total
          let sum = 0;
          for (const it of itensDataResult) {
            const qtd = it.qtd ?? 0;
            const precoAtual = it.preco_atual ?? 0;
            if (typeof qtd === 'number' && typeof precoAtual === 'number') {
              sum += qtd * precoAtual;
            }
          }
          if (sum > 0) total = sum;
        }
      } catch {
        // Ignorar erros de itens individuais para evitar quebrar listagem
      }

      const isUuidLike = (value: string) => value.length > 20 || value.includes('-');

      if (!buyerId && itensData && itensData.length > 0) {
        const rawBuyer =
          itensData.find((item: any) => item.comprador || item.comprador_id || item.buyer_id)?.comprador ||
          itensData.find((item: any) => item.comprador || item.comprador_id || item.buyer_id)?.comprador_id ||
          itensData.find((item: any) => item.comprador || item.comprador_id || item.buyer_id)?.buyer_id;

        if (rawBuyer) {
          const rawValue = String(rawBuyer).trim();
          if (rawValue) {
            if (isUuidLike(rawValue)) {
              buyerId = rawValue;
              userName = await getUserName(buyerId);
            } else {
              buyerId = `buyer:${rawValue}`;
              userName = rawValue;
            }
          }
        }
      }

      if (!userName) {
        const fallbackId = buyerId || data.created_by || null;
        buyerId = buyerId || fallbackId;
        userName = await getUserName(fallbackId || undefined);
      }

      // Persistir buyer_id se inferido e ainda estiver nulo no banco
      if (!data.buyer_id && buyerId && !buyerId.startsWith('buyer:')) {
        (async () => {
          try {
            await supabaseAdmin
              .from('solicitacoes')
              .update({ buyer_id: buyerId })
              .eq('id', data.id);
          } catch (err) {
            console.error('Erro ao atualizar buyer_id da solicitacao:', data.id, err);
          }
        })();
      }

      // Atualizar o status no banco de dados se necessário (em background, não bloqueia a resposta)
      if (shouldUpdateStatus) {
        (async () => {
          try {
            await supabaseAdmin
              .from('solicitacoes')
              .update({
                status: 'batched',
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id);
          } catch (err) {
            console.error('Erro ao atualizar status da solicitação:', data.id, err);
          }
        })();
      }

      solicitacoes.push({
        id: data.id,
        status,
        createdAt: createdAt.toISOString(),
        userId: buyerId,
        userName,
        storeId: data.store_id || null,
        storeName,
        companyId,
        companyName,
        items,
        total,
      });
    }

    console.log(`✅ [GET /api/solicitacoes] Encontradas ${solicitacoes.length} solicitações`);
    return NextResponse.json({ solicitacoes });
  } catch (error: any) {
    console.error('❌ [GET /api/solicitacoes] Erro ao listar:', error);
    return NextResponse.json({
      error: error?.message || 'Falha ao listar solicitacoes',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
