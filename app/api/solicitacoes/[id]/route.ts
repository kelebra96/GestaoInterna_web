import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Status = 'pending' | 'batched' | 'closed';
type Params = { params: Promise<{ id: string }> };

// Desabilitar cache para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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

const toHttp = async (ref: string): Promise<string | null> => {
  try {
    if (/^https?:\/\//i.test(ref)) return ref;

    // Supabase Storage URL handling
    // Format: solicitacoes/path/to/file.jpg
    const objectPath = ref.replace(/^\/+/, '');

    // Get signed URL from Supabase Storage (valid for 24 hours)
    const { data, error } = await supabaseAdmin.storage
      .from('solicitacoes')
      .createSignedUrl(objectPath, 24 * 60 * 60);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error in toHttp:', err);
    return null;
  }
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

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitacoes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Solicitacao nao encontrada' }, { status: 404 });
    }

    const createdAt = new Date(data.created_at || new Date());
    const status: string = data.status || 'pending';

    // Coletar fotos (http e paths do Storage) e assinar URLs quando necessário
    const candidates: string[] = [];
    const pushIfString = (v: any) => {
      if (typeof v === 'string' && v.trim().length > 0) candidates.push(v.trim());
    };
    pushIfString(data.photo_url);
    pushIfString(data.image_url);
    pushIfString(data.image);
    pushIfString(data.foto);
    if (Array.isArray(data.attachments)) {
      for (const x of data.attachments) pushIfString(x);
    }

    const resolved = await Promise.all(candidates.map(toHttp));
    const photos = Array.from(new Set(resolved.filter((u): u is string => !!u)));
    const photoUrl = photos[0];

    const userName = await getUserName(data.created_by);
    const storeName = await getStoreName(data.store_id);
    const companyId = data.company_id || null;
    const companyName = await getCompanyName(companyId || undefined);

    let items: number | undefined;
    let total: number | undefined;
    let currentStatus = status;
    let shouldUpdateStatus = false;

    try {
      const { data: itensData, error: itensError } = await supabaseAdmin
        .from('solicitacao_itens')
        .select('*')
        .eq('solicitacao_id', id);

      if (!itensError && itensData) {
        items = itensData.length;

        // Verificar se todos os itens foram processados
        if (items && items > 0) {
          const allProcessed = itensData.every((item: any) => {
            const itemStatus = item.status;
            return itemStatus === 'approved' || itemStatus === 'rejected';
          });

          // Se todos os itens foram processados e o status da solicitação está como 'pending', corrigir
          if (allProcessed && status === 'pending') {
            currentStatus = 'batched';
            shouldUpdateStatus = true;
          }
        }

        let sum = 0;
        for (const it of itensData) {
          const qtd = it.qtd ?? 0;
          const precoAtual = it.preco_atual ?? 0;
          if (typeof qtd === 'number' && typeof precoAtual === 'number') {
            sum += qtd * precoAtual;
          }
        }
        if (sum > 0) total = sum;
      }
    } catch {}

    // Atualizar o status no banco de dados se necessário (em background)
    if (shouldUpdateStatus) {
      supabaseAdmin
        .from('solicitacoes')
        .update({
          status: 'batched',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then(() => {})
        .catch((err: any) => console.error('Erro ao atualizar status da solicitação:', id, err));
    }

    return NextResponse.json({
      solicitacao: {
        id: data.id,
        status: currentStatus,
        createdAt: createdAt.toISOString(),
        userName,
        storeName,
        companyId,
        companyName,
        items,
        total,
        photoUrl,
        photos,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar solicitacao:', error);
    return NextResponse.json({ error: 'Falha ao buscar solicitacao' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nextStatus = body?.status as Status | undefined;
  if (!nextStatus) {
    return NextResponse.json({ error: 'status e obrigatorio' }, { status: 400 });
  }

  try {
    const { error: updateError } = await supabaseAdmin
      .from('solicitacoes')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    const { data, error } = await supabaseAdmin
      .from('solicitacoes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Solicitacao nao encontrada apos update' }, { status: 404 });
    }

    const createdAt = new Date(data.created_at || new Date());
    const userName = await getUserName(data.created_by);
    const storeName = await getStoreName(data.store_id);

    let items: number | undefined;
    try {
      const { data: itensData } = await supabaseAdmin
        .from('solicitacao_itens')
        .select('id')
        .eq('solicitacao_id', id);

      items = itensData?.length;
    } catch {}

    return NextResponse.json({
      solicitacao: {
        id: data.id,
        status: nextStatus,
        createdAt: createdAt.toISOString(),
        userName,
        storeName,
        companyId: data.company_id || null,
        items,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return NextResponse.json({ error: 'Falha ao atualizar status' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Delete itens first (foreign key cascade should handle this, but being explicit)
    const { error: itensError } = await supabaseAdmin
      .from('solicitacao_itens')
      .delete()
      .eq('solicitacao_id', id);

    if (itensError) {
      console.error('Erro ao deletar itens:', itensError);
      // Continue anyway - cascade should handle it
    }

    // Delete solicitacao
    const { error: solicitacaoError } = await supabaseAdmin
      .from('solicitacoes')
      .delete()
      .eq('id', id);

    if (solicitacaoError) throw solicitacaoError;

    return NextResponse.json({ message: 'Solicitacao deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar solicitacao:', error);
    return NextResponse.json({ error: 'Falha ao deletar solicitacao' }, { status: 500 });
  }
}
