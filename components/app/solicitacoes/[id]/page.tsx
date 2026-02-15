'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Clock3, Archive, RefreshCw } from 'lucide-react';
import { Solicitacao as SolicitacaoType } from '@/lib/types/business';

type Status = 'pending' | 'batched' | 'closed';
type ItemStatus = 'pending' | 'approved' | 'rejected';

interface Solicitacao extends SolicitacaoType {
  userName: string;
  storeName: string;
  companyName?: string;
  items?: number;
  total?: number;
  photoUrl?: string;
  photos?: string[];
}

interface Item {
  id: string;
  ean?: string;
  sku?: string;
  descricao: string;
  precoAtual: number;
  validade: string;
  qtd: number;
  loja: string;
  comprador?: string;
  localizacao?: string;
  lote?: string;
  fotoUrl: string[];
  sugestaoDescontoPercent?: number;
  precoSugerido?: number;
  observacao?: string;
  status: ItemStatus;
  motivoRejeicao?: string;
  createdAt: string;
}

const statusLabels: Record<Status, string> = {
  pending: 'Pendente',
  batched: 'Agrupada',
  closed: 'Fechada',
};

const statusStyles: Record<Status, string> = {
  pending: 'bg-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30',
  batched: 'bg-[#3B9797]/10 text-[#3B9797] border-[#3B9797]/30',
  closed: 'bg-[#132440]/10 text-[#132440] border-[#132440]/30',
};

const statusIcon = {
  pending: <Clock3 className="w-4 h-4" />,
  batched: <CheckCircle2 className="w-4 h-4" />,
  closed: <Archive className="w-4 h-4" />,
} as const;

export default function SolicitacaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<Solicitacao | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItens, setLoadingItens] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingItem, setApprovingItem] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) throw new Error('Falha ao carregar solicitação');
      const json = await res.json();
      setData(json.solicitacao);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchItens = async () => {
    if (!id) return;
    try {
      setLoadingItens(true);
      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}/itens`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) throw new Error('Falha ao carregar itens');
      const json = await res.json();
      setItens(json.itens || []);
    } catch (e: any) {
      console.error('Erro ao buscar itens:', e);
    } finally {
      setLoadingItens(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchItens();
  }, [id]);

  const updateStatus = async (status: Status) => {
    if (!id || !data) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar status');
      const json = await res.json();
      setData(json.solicitacao);
    } catch (e) {
      console.error(e);
      // mantém o estado anterior, mas poderia exibir toast
    } finally {
      setSaving(false);
    }
  };

  const approveItem = async (itemId: string) => {
    if (!id) return;
    try {
      setApprovingItem(itemId);
      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Falha ao aprovar item');
      // Recarregar itens E solicitação para atualizar a lista e o status
      await Promise.all([fetchItens(), fetchData()]);
      alert('Item aprovado com sucesso! Notificação enviada ao usuário.');
    } catch (e) {
      console.error(e);
      alert('Erro ao aprovar item');
    } finally {
      setApprovingItem(null);
    }
  };

  const openRejectModal = (itemId: string) => {
    setRejectItemId(itemId);
    setMotivoRejeicao('');
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setRejectItemId(null);
    setMotivoRejeicao('');
  };

  const rejectItem = async () => {
    if (!id || !rejectItemId || !motivoRejeicao.trim()) {
      alert('Por favor, informe o motivo da rejeição');
      return;
    }
    try {
      setRejectingItem(rejectItemId);
      const res = await fetch(`/api/solicitacoes/${encodeURIComponent(id)}/itens/${encodeURIComponent(rejectItemId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoRejeicao: motivoRejeicao.trim() }),
      });
      if (!res.ok) throw new Error('Falha ao rejeitar item');
      // Recarregar itens E solicitação para atualizar a lista e o status
      await Promise.all([fetchItens(), fetchData()]);
      closeRejectModal();
      alert('Item rejeitado com sucesso! Notificação enviada ao usuário.');
    } catch (e) {
      console.error(e);
      alert('Erro ao rejeitar item');
    } finally {
      setRejectingItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Header aprimorado */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#757575] mb-4">
            <Link href="/solicitacoes" className="hover:text-[#16476A] transition-colors">Solicitações</Link>
            <span>/</span>
            <span className="text-[#212121] font-medium">Detalhes</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2.5 rounded-xl border border-[#E0E0E0] bg-white hover:bg-[#F5F5F5] hover:border-[#16476A] transition-all duration-200 shadow-sm"
              >
                <ArrowLeft className="w-5 h-5 text-[#212121]" />
              </button>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#212121] mb-1">Detalhes da Solicitação</h1>
                <p className="text-[#757575]">Visualize e gerencie os itens solicitados</p>
              </div>
            </div>

            <Link
              href="/solicitacoes"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E0E0E0] text-[#16476A] rounded-xl font-semibold hover:bg-[#E0E7EF] hover:border-[#16476A] transition-all duration-200 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar à lista
            </Link>
          </div>
        </div>

        {/* Estado de Loading - Redesenhado */}
        {loading && (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-lg overflow-hidden">
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-full mb-6">
                <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando Solicitação</h3>
              <p className="text-[#757575]">Aguarde enquanto buscamos os dados...</p>
            </div>
          </div>
        )}

        {/* Estado de Erro - Redesenhado */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border-2 border-[#BF092F] shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] px-6 py-5 border-b border-[#BF092F]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#BF092F] rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#BF092F]">Erro ao Carregar</h3>
                  <p className="text-[#BF092F]/80 text-sm">Não foi possível buscar os dados da solicitação</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#757575] mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-[#BF092F] text-white rounded-xl font-semibold hover:bg-[#BF092F] transition-all inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            {/* Overview Card - Redesenhado */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-lg overflow-hidden">
              {/* Header do Card */}
              <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 sm:px-8 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-[#E0E7EF] text-sm font-medium mb-1">ID da Solicitação</div>
                    <div className="font-mono text-xl sm:text-2xl font-bold text-white">{data.id}</div>
                  </div>
                  <span className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border-2 bg-white ${statusStyles[data.status]}`}>
                    {statusIcon[data.status]}
                    {statusLabels[data.status as Status]}
                  </span>
                </div>
              </div>

              {/* Conteúdo do Card */}
              <div className="p-6 sm:p-8">
                {/* Ações da Solicitação */}
                {data.status === 'batched' && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-[#E0E7EF] to-[#F8F9FA] rounded-xl border border-[#16476A]/20">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-[#212121] mb-1">Fechar Solicitação</h3>
                        <p className="text-sm text-[#757575]">Todos os itens foram processados. Você pode fechar esta solicitação.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateStatus('closed')}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#132440] text-white rounded-xl font-bold hover:bg-[#132440]/90 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Archive className="w-5 h-5" />
                        {saving ? 'Fechando...' : 'Fechar Solicitação'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Stats destacados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] p-6 border border-[#16476A]/20 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-[#16476A] font-semibold uppercase tracking-wide mb-2">Total de Itens</div>
                        <div className="text-4xl font-bold text-[#16476A]">{data.items ?? '-'}</div>
                      </div>
                      <div className="w-16 h-16 bg-[#16476A]/10 rounded-full flex items-center justify-center">
                        <Archive className="w-8 h-8 text-[#16476A]" />
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] p-6 border border-[#3B9797]/20 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-[#16476A] font-semibold uppercase tracking-wide mb-2">Valor Total</div>
                        <div className="text-3xl font-bold text-[#16476A]">
                          {data.total ? data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </div>
                      </div>
                      <div className="w-16 h-16 bg-[#3B9797]/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl">💰</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informações adicionais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E0E0E0] hover:shadow-md transition-shadow">
                    <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-2">Usuário</div>
                    <div className="text-[#212121] font-semibold text-lg">{data.userName}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E0E0E0] hover:shadow-md transition-shadow">
                    <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-2">Loja</div>
                    <div className="text-[#212121] font-semibold text-lg">{data.storeName}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E0E0E0] hover:shadow-md transition-shadow">
                    <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-2">Empresa</div>
                    <div className="text-[#212121] font-semibold text-lg">{data.companyName || data.companyId || 'N/A'}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E0E0E0] hover:shadow-md transition-shadow">
                    <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-2">Data de Criação</div>
                    <div className="text-[#212121] font-semibold text-base">
                      {(() => {
                        const date = new Date(data.createdAt);
                        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Lista de Produtos - Redesenhada */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-lg overflow-hidden">
              {/* Header da seção */}
              <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 sm:px-8 py-5 border-b border-[#E0E0E0]">
                <h2 className="text-2xl font-bold text-[#212121]">Produtos da Solicitação</h2>
                <p className="text-sm text-[#757575] mt-1">Gerencie individualmente cada item solicitado</p>
              </div>

              <div className="p-6 sm:p-8">
                {loadingItens && (
                  <div className="text-center py-16">
                    <RefreshCw className="w-8 h-8 text-[#16476A] animate-spin inline-block mb-4" />
                    <p className="text-[#757575] font-medium">Carregando produtos...</p>
                  </div>
                )}

                {!loadingItens && itens.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Archive className="w-10 h-10 text-[#757575]" />
                    </div>
                    <p className="text-[#757575] font-medium">Nenhum produto encontrado nesta solicitação</p>
                  </div>
                )}

                {!loadingItens && itens.length > 0 && (
                  <div className="space-y-5">
                    {itens.map((item, index) => (
                      <div
                        key={item.id}
                        className="group relative border border-[#E0E0E0] rounded-xl p-5 sm:p-6 hover:border-[#16476A] hover:shadow-xl transition-all duration-300 bg-white"
                      >
                        {/* Número do item */}
                        <div className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-sm font-bold">{index + 1}</span>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6">
                          {/* Imagem do Produto */}
                          <div className="flex-shrink-0">
                            {item.fotoUrl && item.fotoUrl.length > 0 ? (
                              <div className="relative group/image">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.fotoUrl[0]}
                                  alt={item.descricao}
                                  className="w-full lg:w-32 h-32 object-cover rounded-xl border-2 border-[#E0E0E0] group-hover:border-[#16476A] transition-all shadow-sm"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 rounded-xl transition-all" />
                              </div>
                            ) : (
                              <div className="w-full lg:w-32 h-32 bg-gradient-to-br from-[#F5F5F5] to-[#E0E0E0] rounded-xl flex items-center justify-center border-2 border-[#E0E0E0]">
                                <span className="text-[#757575] text-sm font-medium">Sem foto</span>
                              </div>
                            )}
                          </div>

                          {/* Informações do Produto */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[#212121] text-xl mb-4 group-hover:text-[#16476A] transition-colors">
                              {item.descricao}
                            </h3>

                            {/* Grid de informações */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E0E0E0]">
                                <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-1">Quantidade</div>
                                <div className="font-bold text-[#212121] text-lg">{item.qtd}</div>
                              </div>

                              <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E0E0E0]">
                                <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-1">Preço Unit.</div>
                                <div className="font-bold text-[#212121] text-base">
                                  {item.precoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              </div>

                              <div className="bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg p-3 border border-[#16476A]/20">
                                <div className="text-xs text-[#16476A] font-semibold uppercase tracking-wide mb-1">Total</div>
                                <div className="font-bold text-[#16476A] text-lg">
                                  {(item.qtd * item.precoAtual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              </div>

                              <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E0E0E0]">
                                <div className="text-xs text-[#757575] font-semibold uppercase tracking-wide mb-1">Validade</div>
                                <div className="font-bold text-[#212121] text-base">
                                  {new Date(item.validade).toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                            </div>

                            {/* Tags de informações adicionais */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {item.ean && (
                                <span className="inline-flex items-center px-3 py-1.5 bg-[#E0E7EF] text-[#16476A] rounded-lg text-xs font-semibold border border-[#16476A]/20">
                                  EAN: {item.ean}
                                </span>
                              )}
                              {item.sku && (
                                <span className="inline-flex items-center px-3 py-1.5 bg-[#E0E7EF] text-[#16476A] rounded-lg text-xs font-semibold border border-[#16476A]/20">
                                  SKU: {item.sku}
                                </span>
                              )}
                              {item.lote && (
                                <span className="inline-flex items-center px-3 py-1.5 bg-[#F8F9FA] text-[#757575] rounded-lg text-xs font-semibold border border-[#E0E0E0]">
                                  Lote: {item.lote}
                                </span>
                              )}
                              {item.localizacao && (
                                <span className="inline-flex items-center px-3 py-1.5 bg-[#F8F9FA] text-[#757575] rounded-lg text-xs font-semibold border border-[#E0E0E0]">
                                  Local: {item.localizacao}
                                </span>
                              )}
                            </div>

                            {/* Observação */}
                            {item.observacao && (
                              <div className="mb-4 p-4 bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] border-l-4 border-[#BF092F] rounded-lg">
                                <div className="flex gap-2">
                                  <span className="text-xl">💬</span>
                                  <div>
                                    <div className="font-semibold text-[#132440] text-sm mb-1">Observação</div>
                                    <p className="text-[#132440] text-sm">{item.observacao}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Status e ações */}
                            <div className="flex flex-wrap items-center gap-3">
                              {item.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => approveItem(item.id)}
                                    disabled={approvingItem === item.id}
                                    className="px-5 py-2.5 bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 transition-all duration-200"
                                  >
                                    {approvingItem === item.id ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Aprovando...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Aprovar Item
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(item.id)}
                                    disabled={rejectingItem === item.id}
                                    className="px-5 py-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 transition-all duration-200"
                                  >
                                    {rejectingItem === item.id ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Rejeitando...
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-4 h-4" />
                                        Rejeitar Item
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                              {item.status === 'approved' && (
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E0E7EF] to-[#E0E7EF] text-[#16476A] rounded-xl text-sm font-bold border-2 border-[#3B9797]/30">
                                  <CheckCircle2 className="w-4 h-4" />
                                  Item Aprovado
                                </span>
                              )}
                              {item.status === 'rejected' && (
                                <div className="flex flex-col gap-2">
                                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] text-[#BF092F] rounded-xl text-sm font-bold border-2 border-[#BF092F]/30">
                                    <XCircle className="w-4 h-4" />
                                    Item Rejeitado
                                  </span>
                                  {item.motivoRejeicao && (
                                    <div className="px-4 py-2 bg-[#E0E7EF] border border-[#BF092F]/20 rounded-lg">
                                      <span className="text-xs font-semibold text-[#BF092F]">Motivo: </span>
                                      <span className="text-xs text-[#757575]">{item.motivoRejeicao}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Fotos Gerais - Redesenhado */}
            {(data.photos?.length || data.photoUrl) && (
              <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] px-6 sm:px-8 py-5 border-b border-[#E0E0E0]">
                  <h2 className="text-2xl font-bold text-[#212121]">Fotos Gerais da Solicitação</h2>
                  <p className="text-sm text-[#757575] mt-1">Imagens anexadas à solicitação</p>
                </div>
                <div className="p-6 sm:p-8">
                  <Carousel urls={(data.photos && data.photos.length > 0) ? data.photos : (data.photoUrl ? [data.photoUrl] : [])} id={data.id || ''} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Rejeição - Redesenhado */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-slideUp">
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Rejeitar Item</h3>
                    <p className="text-white/80 text-sm">Informe o motivo da rejeição</p>
                  </div>
                </div>
              </div>

              {/* Conteúdo do Modal */}
              <div className="p-6">
                <label className="block mb-2 text-sm font-semibold text-[#212121]">
                  Motivo da Rejeição <span className="text-[#BF092F]">*</span>
                </label>
                <textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  className="w-full p-4 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF092F] focus:border-transparent resize-none transition-all"
                  rows={5}
                  placeholder="Ex: Produto ainda dentro da validade, sem necessidade de desconto..."
                  autoFocus
                />
                <p className="text-xs text-[#757575] mt-2">
                  {motivoRejeicao.length} / 500 caracteres
                </p>
              </div>

              {/* Footer do Modal */}
              <div className="bg-[#F8F9FA] px-6 py-4 flex gap-3">
                <button
                  onClick={closeRejectModal}
                  disabled={rejectingItem !== null}
                  className="flex-1 px-5 py-3 border-2 border-[#E0E0E0] text-[#757575] rounded-xl font-semibold hover:bg-white hover:border-[#BDBDBD] disabled:opacity-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={rejectItem}
                  disabled={rejectingItem !== null || !motivoRejeicao.trim()}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-[#BF092F] to-[#BF092F] text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2 transition-all"
                >
                  {rejectingItem ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Rejeitando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      Confirmar Rejeição
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Carousel({ urls, id }: { urls: string[]; id: string }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const count = urls.length;
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.changedTouches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    if (touchStart !== null) {
      const delta = e.changedTouches[0].clientX - touchStart;
      if (Math.abs(delta) > 50) {
        if (delta < 0) next(); else prev();
      }
    }
    setTouchStart(null);
  };
  const prev = () => setIdx((i) => (i - 1 + count) % count);
  const next = () => setIdx((i) => (i + 1) % count);
  const openLightbox = () => { setOpen(true); setZoom(1); };
  const closeLightbox = () => setOpen(false);
  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));

  if (count === 0) return null;

  return (
    <div className="w-full">
      <div className="relative w-full max-h-[520px] overflow-hidden rounded-lg border border-[#E0E0E0] bg-[#F9FAFB] flex items-center justify-center" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={urls[idx]}
          src={urls[idx]}
          alt={`Foto ${idx + 1} da solicitação ${id}`}
          className="object-contain w-full h-full cursor-zoom-in"
          loading="lazy"
          onClick={openLightbox}
        />
        {count > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-[#212121] rounded-full w-9 h-9 flex items-center justify-center shadow" aria-label="Anterior">‹</button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-[#212121] rounded-full w-9 h-9 flex items-center justify-center shadow" aria-label="Próxima">›</button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex items-center gap-3 mt-3 overflow-x-auto py-1">
          {urls.map((u, i) => (
            <button key={u + i} onClick={() => setIdx(i)} className={`border rounded-md ${i === idx ? 'border-[#16476A]' : 'border-[#E0E0E0] hover:border-[#BDBDBD]'}`} aria-label={`Ir para foto ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Thumb ${i + 1}`} className="w-16 h-16 object-cover rounded-md" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 bg-white/90 hover:bg-white text-[#212121] rounded-full w-9 h-9 flex items-center justify-center shadow" aria-label="Fechar">✕</button>
          {count > 1 && (
            <>
              <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#212121] rounded-full w-10 h-10 flex items-center justify-center shadow" aria-label="Anterior">‹</button>
              <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#212121] rounded-full w-10 h-10 flex items-center justify-center shadow" aria-label="Próxima">›</button>
            </>
          )}
          <div className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center">
            {/* Controles de zoom */}
            <div className="absolute bottom-4 right-1/2 translate-x-1/2 flex items-center gap-2">
              <button onClick={zoomOut} className="bg-white/90 hover:bg-white text-[#212121] rounded-md px-3 py-1 shadow" aria-label="Diminuir zoom">−</button>
              <span className="text-white text-sm w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} className="bg-white/90 hover:bg-white text-[#212121] rounded-md px-3 py-1 shadow" aria-label="Aumentar zoom">+</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`lb-${urls[idx]}`}
              src={urls[idx]}
              alt={`Foto ${idx + 1} da solicitação ${id}`}
              className="object-contain"
              style={{ maxWidth: '90vw', maxHeight: '85vh', transform: `scale(${zoom})` }}
            />
            {count > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg">
                {urls.map((u, i) => (
                  <button key={`lb-thumb-${u}-${i}`} onClick={() => setIdx(i)} className={`border rounded ${i === idx ? 'border-white' : 'border-transparent opacity-75'}`} aria-label={`Ir para foto ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`Thumb ${i + 1}`} className="w-12 h-12 object-cover rounded" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}






