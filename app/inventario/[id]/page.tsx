'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  MapPin,
  Scan,
  RefreshCw,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Lock,
  Trash2,
  Download,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Inventory {
  id: string;
  name: string;
  storeId: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  totalAddresses?: number;
  addressesCompleted?: number;
  totalItemsExpected?: number;
  totalItemsCounted?: number;
  importedFileName?: string;
  importedAt?: any;
}

const statusLabels: Record<string, string> = {
  preparation: 'Preparação',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  preparation: 'bg-[#E0E7EF] text-[#16476A] border border-[#3B9797]/30',
  in_progress: 'bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white shadow-md border border-[#16476A]/40',
  completed: 'bg-[#16476A] text-white border border-[#3B9797]/40',
  cancelled: 'bg-[#E0E0E0] text-[#757575] border border-[#E0E0E0]',
};

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (value: any, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return '--';
    const dateValue = value?.toDate ? value.toDate() : new Date(value);
    return dateValue.toLocaleString('pt-BR', options);
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao carregar inventário');
      }

      const data = await response.json();
      setInventory(data.inventory);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && firebaseUser) {
      fetchInventory();
    }
  }, [id, firebaseUser]);

  const handleFinalize = async () => {
    if (!firebaseUser) {
      alert('Você precisa estar autenticado');
      return;
    }

    const confirmFinalize = window.confirm(
      'Finalizar este inventário?\n\n' +
      '- Após finalizar não será possível registrar novas coletas\n' +
      '- O arquivo output.txt será gerado automaticamente\n' +
      '- Esta ação não pode ser desfeita'
    );

    if (!confirmFinalize) return;

    try {
      setFinalizing(true);

      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/inventario/${id}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao finalizar inventário');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `output_${id}_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Inventário finalizado com sucesso! O arquivo output.txt foi baixado.');
      fetchInventory();
    } catch (error: any) {
      alert('Erro ao finalizar inventário: ' + error.message);
    } finally {
      setFinalizing(false);
    }
  };

  const handleDelete = async () => {
    if (!firebaseUser) {
      alert('Você precisa estar autenticado');
      return;
    }

    const confirmDelete = window.confirm(
      'Excluir este inventário?\n\n' +
      'ATENÇÃO:\n' +
      '- Todos os dados serão permanentemente deletados\n' +
      '- Itens, endereços e contagens serão removidos\n' +
      '- Esta ação não pode ser desfeita\n\n' +
      'Digite "EXCLUIR" para confirmar'
    );

    if (!confirmDelete) return;

    const confirmText = window.prompt('Digite "EXCLUIR" para confirmar:');
    if (confirmText !== 'EXCLUIR') {
      alert('Exclusão cancelada');
      return;
    }

    try {
      setDeleting(true);

      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/inventario/${id}/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao excluir inventário');
      }

      alert('Inventário excluído com sucesso!');
      router.push('/inventario');
    } catch (error: any) {
      alert('Erro ao excluir inventário: ' + error.message);
      setDeleting(false);
    }
  };

  if (loading && !inventory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-white/10 border border-white/30 animate-pulse" />
            <RefreshCw className="w-10 h-10 text-white absolute inset-0 m-auto animate-spin" />
          </div>
          <p className="text-xl font-semibold">Carregando inventário</p>
          <p className="text-sm text-[#E0E7EF]">Sincronizando informações em tempo real</p>
        </div>
      </div>
    );
  }

  if (error || !inventory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#BF092F]/10 border border-[#BF092F]/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[#BF092F]" />
          </div>
          <p className="text-lg font-semibold text-[#BF092F] mb-2">{error || 'Inventário não encontrado'}</p>
          <p className="text-sm text-[#757575] mb-6">Cheque sua conexão ou tente novamente.</p>
          <button
            onClick={() => router.push('/inventario')}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#3B9797] hover:to-[#16476A] text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const rawProgress = inventory.totalAddresses && inventory.totalAddresses > 0
    ? ((inventory.addressesCompleted || 0) / inventory.totalAddresses) * 100
    : 0;
  const progress = Math.min(100, Math.max(0, rawProgress));
  const displayProgress =
    inventory.totalAddresses && (inventory.addressesCompleted || 0) > 0
      ? Math.min(100, Math.max(1, rawProgress))
      : progress;
  const addressesLabel = `${inventory.addressesCompleted || 0} de ${inventory.totalAddresses || 0} endereços`;
  const derivedStatus =
    inventory.status === 'preparation' &&
    ((inventory.addressesCompleted || 0) > 0 || (inventory.totalItemsCounted || 0) > 0)
      ? 'in_progress'
      : inventory.status;
  const pendingAddresses = Math.max(0, (inventory.totalAddresses || 0) - (inventory.addressesCompleted || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] text-[#212121]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-[#3B9797]/25 bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] text-white shadow-2xl">
          <div
            className="absolute inset-0 opacity-25 animate-[pulse_10s_ease-in-out_infinite]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, #FFFFFF22, transparent 35%), radial-gradient(circle at 80% 0%, #FFFFFF11, transparent 30%)',
            }}
          />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/15 blur-3xl rounded-full animate-[pulse_6s_ease-in-out_infinite]" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#BF092F]/10 blur-3xl rounded-full animate-[pulse_7s_ease-in-out_infinite]" />
          </div>
          <div className="relative p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => router.push('/inventario')}
                  className="p-2 rounded-2xl bg-white/10 border border-white/25 hover:bg-white/15 transition transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <ArrowLeft className="w-5 h-5 animate-[pulse_2s_ease-in-out_infinite]" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-[#E0E7EF] font-semibold">Inventário</p>
                  <h1 className="text-3xl md:text-4xl font-bold leading-tight">{inventory.name}</h1>
                  <p className="text-sm text-[#E0E7EF] mt-1">ID {id}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold ${statusColors[derivedStatus] || 'bg-[#E0E0E0] text-[#212121]'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-current opacity-80" />
                    {statusLabels[derivedStatus] || derivedStatus}
                  </span>
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold">
                  <BarChart3 className="w-4 h-4" />
                  <span>{progress.toFixed(0)}% concluído</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-[#E0E7EF]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Criado em {formatDate(inventory.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>Atualizado em {formatDate(inventory.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{inventory.totalItemsCounted || 0} / {inventory.totalItemsExpected || 0} itens</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => router.push(`/inventario/${id}/importar`)}
            disabled={inventory.status === 'completed'}
            className="group relative overflow-hidden rounded-2xl border border-[#3B9797]/30 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition" style={{ backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.18), transparent)' }} />
            <div className="relative flex items-center justify-between p-4">
              <div className="text-left">
                <p className="text-sm font-semibold">Importar arquivo</p>
                <p className="text-xs text-white/80">CSV/TXT com itens</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/25">
                <Upload className="w-5 h-5" />
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push(`/inventario/${id}/enderecos`)}
            className="group rounded-2xl border border-[#3B9797]/25 bg-gradient-to-r from-[#E0E7EF] to-[#F8F9FA] text-[#16476A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between p-4">
              <div className="text-left">
                <p className="text-sm font-semibold">Endereços</p>
                <p className="text-xs text-[#3B9797]">{addressesLabel}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#E0E0E0]">
                <MapPin className="w-5 h-5 text-[#16476A]" />
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push(`/inventario/${id}/coleta`)}
            disabled={inventory.status === 'completed'}
            className="group rounded-2xl border border-[#16476A]/30 bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between p-4">
              <div className="text-left">
                <p className="text-sm font-semibold">Iniciar coleta</p>
                <p className="text-xs text-white/80">Escaneamento seguro</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/25">
                <Scan className="w-5 h-5" />
              </div>
            </div>
          </button>

          <button
            onClick={fetchInventory}
            className="group rounded-2xl border border-[#E0E0E0] bg-white text-[#16476A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between p-4">
              <div className="text-left">
                <p className="text-sm font-semibold">Atualizar</p>
                <p className="text-xs text-[#757575]">Recarregar dados</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#E0E7EF] flex items-center justify-center border border-[#E0E0E0]">
                <RefreshCw className={`w-5 h-5 text-[#16476A] ${loading ? 'animate-spin' : ''}`} />
              </div>
            </div>
          </button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#16476A] to-[#3B9797] flex items-center justify-center text-white">
                <Package className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Itens esperados</span>
            </div>
            <p className="text-3xl font-bold text-[#16476A]">{inventory.totalItemsExpected || 0}</p>
            <p className="text-sm text-[#757575]">Meta projetada</p>
          </div>

          <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B9797] to-[#16476A] flex items-center justify-center text-white">
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Itens contados</span>
            </div>
            <p className="text-3xl font-bold text-[#16476A]">{inventory.totalItemsCounted || 0}</p>
            <p className="text-sm text-[#757575]">Volume já conferido</p>
          </div>

          <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#E0E7EF] flex items-center justify-center text-[#16476A] border border-[#3B9797]/20">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Endereços</span>
            </div>
            <p className="text-3xl font-bold text-[#16476A]">{inventory.totalAddresses || 0}</p>
            <p className="text-sm text-[#757575]">Pendentes: {pendingAddresses}</p>
          </div>

          <div className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B9797] to-[#16476A] flex items-center justify-center text-white">
                <BarChart3 className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Progresso</span>
            </div>
            <div className="w-full bg-[#E0E0E0] rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#3B9797] to-[#16476A]"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-[#16476A] font-semibold">
              <span>{displayProgress.toFixed(0)}%</span>
              <span>{inventory.addressesCompleted || 0} finalizados / {pendingAddresses} pendentes</span>
            </div>
          </div>
        </section>

        {inventory.totalAddresses && inventory.totalAddresses > 0 && (
          <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold text-[#16476A]">Linha do tempo da coleta</h2>
                <p className="text-sm text-[#757575]">Acompanhe o ritmo de endereços concluídos</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#E0E7EF] text-[#16476A] font-semibold text-sm">
                {addressesLabel}
              </div>
            </div>
            <div className="w-full bg-[#E0E0E0] rounded-full h-4 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#16476A] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#3B9797]/25 bg-gradient-to-br from-[#E0E7EF] to-[#F8F9FA] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-[#3B9797] uppercase tracking-wide">Fluxo de operações</p>
                <h3 className="text-lg font-bold text-[#16476A]">Ações rápidas</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#E0E0E0]">
                <RefreshCw className="w-5 h-5 text-[#16476A]" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleFinalize}
                disabled={inventory.status === 'completed' || finalizing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-4 py-3 font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {finalizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    {inventory.status === 'completed' ? 'Inventário finalizado' : 'Finalizar inventário'}
                  </>
                )}
              </button>

              <button
                onClick={fetchInventory}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#16476A] border border-[#3B9797]/30 px-4 py-3 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar status
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#BF092F]/25 bg-gradient-to-br from-[#BF092F]/10 via-[#F8F9FA] to-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-[#BF092F] uppercase tracking-wide">Zona crítica</p>
                <h3 className="text-lg font-bold text-[#BF092F]">Segurança de dados</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#BF092F]/15 flex items-center justify-center border border-[#BF092F]/30">
                <Trash2 className="w-5 h-5 text-[#BF092F]" />
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#BF092F] text-white px-4 py-3 font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Excluir inventário
                </>
              )}
            </button>

            {inventory.status === 'completed' && (
              <div className="mt-3 p-3 rounded-xl border border-[#3B9797]/25 bg-[#E0E7EF] text-[#16476A] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Inventário finalizado. Baixe o arquivo output.txt
                </div>
                <button
                  onClick={async () => {
                    try {
                      const token = await firebaseUser?.getIdToken();
                      const response = await fetch(`/api/inventario/${id}/download-output`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });

                      if (!response.ok) throw new Error('Falha ao baixar arquivo');

                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `output_${id}_${Date.now()}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (downloadError: any) {
                      alert('Erro ao baixar arquivo: ' + downloadError.message);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-white text-[#16476A] border border-[#3B9797]/30 px-3 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  Baixar output.txt
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#16476A] mb-4">Informações</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Loja</p>
              <p className="text-base font-semibold text-[#212121]">{inventory.storeId}</p>
            </div>
            {inventory.importedFileName && (
              <div>
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Arquivo importado</p>
                <p className="text-base font-semibold text-[#212121]">{inventory.importedFileName}</p>
              </div>
            )}
            {inventory.importedAt && (
              <div>
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Importado em</p>
                <p className="text-base font-semibold text-[#212121]">
                  {formatDate(inventory.importedAt)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Última atualização</p>
              <p className="text-base font-semibold text-[#212121]">
                {formatDate(inventory.updatedAt)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
