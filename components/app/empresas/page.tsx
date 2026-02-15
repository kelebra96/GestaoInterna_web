'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Building, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Empresa {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
}

export default function EmpresasPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);

  // Filtros
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      const token = await firebaseUser.getIdToken(true);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch('/api/empresas', { cache: 'no-store', headers });
      if (!res.ok) throw new Error('Falha ao carregar empresas');
      const data = await res.json();
      setEmpresas(data.empresas || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchData();
    }
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return empresas
      .filter((e) => (status === 'all' ? true : status === 'active' ? e.active : !e.active))
      .filter((e) => {
        if (!q) return true;
        return e.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [empresas, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  const createEmpresa = async () => {
    setIsCreating(true);
    try {
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Falha ao criar empresa');
      const json = await res.json();
      const empresa = json?.empresa as Empresa;
      if (empresa) {
        setEmpresas((prev) => [empresa, ...prev]);
        setToast({ type: 'success', message: 'Empresa criada com sucesso' });
        setCreating(false);
        setNewName('');
      }
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao criar empresa' });
    } finally {
      setIsCreating(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const patchEmpresa = async (id: string, payload: Partial<Empresa>) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/empresas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Falha ao atualizar empresa');
      const json = await res.json();
      const updated = json?.empresa as Empresa | undefined;
      if (updated) {
        setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
        const msg = Object.prototype.hasOwnProperty.call(payload, 'active')
          ? (payload.active ? 'Empresa ativada' : 'Empresa desativada')
          : 'Empresa atualizada';
        setToast({ type: 'success', message: msg });
      } else {
        await fetchData();
      }
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar empresa' });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#F8F9FA]">
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-[#3B9797]' : 'bg-[#BF092F]'}`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {toast.message}
            </div>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                    <Building className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                      Empresas
                    </h1>
                    <p className="text-[#E3EFFF] text-base font-medium mt-2">
                      Gerencie e acompanhe as empresas do sistema
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-2 bg-[#3B9797] hover:bg-[#2c7a7a] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
                  >
                    <Plus className="w-5 h-5" />
                    Nova Empresa
                  </button>
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
          {/* Filtros */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros e Busca
              </h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-4">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome da empresa..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Status</label>
                  <div className="flex gap-3">
                    {(['all', 'active', 'inactive'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                          (status === s)
                            ? 'bg-gradient-to-r from-[#16476A] to-[#132440] text-white border-[#16476A] shadow-lg scale-105'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA] hover:scale-105'
                        }`}
                      >
                        {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Inativas'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            {/* Estados de Loading/Error/Empty */}
            {loading && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#132440] mb-6 animate-pulse">
                  <Building className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#212121]">Carregando empresas...</p>
                <p className="text-sm text-[#757575] mt-2">Aguarde enquanto buscamos os dados</p>
              </div>
            )}

            {!loading && error && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
                <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar as empresas</p>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#16476A] hover:to-[#132440] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className="w-5 h-5" />
                  Tentar Novamente
                </button>
              </div>
            )}

            {!loading && !error && current.length === 0 && (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#3B9797] to-[#2c7a7a] mb-6">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma empresa encontrada</p>
                <p className="text-sm text-[#757575]">
                  {filtered.length === 0 && empresas.length > 0
                    ? 'Tente ajustar os filtros para ver mais resultados'
                    : 'Comece adicionando uma nova empresa ao sistema'}
                </p>
              </div>
            )}

            {!loading && !error && current.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E0E0E0]">
                    <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Empresa</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Ações</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E0E0E0]">
                      {current.map((empresa) => (
                        <tr
                          key={empresa.id}
                          onClick={() => router.push(`/empresas/${encodeURIComponent(empresa.id)}`)}
                          className="hover:bg-gray-100 transition-all duration-300 cursor-pointer group hover:shadow-md"
                        >
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-xl shadow-lg">
                                <Building className="w-5 h-5 text-white" />
                              </div>
                              <span className="text-sm font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                                {empresa.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            {empresa.active ? (
                              <span className="px-3 py-2 inline-flex items-center gap-2 text-xs font-bold rounded-xl border bg-[#3B9797]/10 text-[#3B9797] border-[#3B9797]/30 shadow-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                Ativa
                              </span>
                            ) : (
                              <span className="px-3 py-2 inline-flex items-center gap-2 text-xs font-bold rounded-xl border bg-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30 shadow-sm">
                                <XCircle className="w-4 h-4" />
                                Inativa
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); patchEmpresa(empresa.id, { active: !empresa.active }); }}
                              disabled={!!saving[empresa.id]}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                                empresa.active
                                  ? 'bg-[#BF092F]/10 border-[#BF092F]/30 text-[#BF092F] hover:bg-[#BF092F]/20'
                                  : 'bg-[#3B9797]/10 border-[#3B9797]/30 text-[#3B9797] hover:bg-[#3B9797]/20'
                              }`}
                              title={empresa.active ? 'Desativar' : 'Ativar'}
                            >
                              {empresa.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            {empresa.createdAt ? (
                              <>
                                <div className="text-sm font-medium text-[#212121]">
                                  {new Date(empresa.createdAt).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                  })}
                                </div>
                                <div className="text-xs text-[#757575] mt-1">
                                  {new Date(empresa.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </div>
                              </>
                            ) : (
                              <span className="text-sm text-[#757575]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF] border-t-2 border-[#E0E0E0] px-6 py-5">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                        <span className="text-sm font-bold text-[#16476A]">{filtered.length}</span>
                        <span className="text-sm text-[#757575] ml-1">
                          {filtered.length === 1 ? 'resultado' : 'resultados'}
                        </span>
                      </div>
                      <div className="px-4 py-2 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                        <span className="text-sm text-[#757575]">Página </span>
                        <span className="text-sm font-bold text-[#16476A]">{page}</span>
                        <span className="text-sm text-[#757575]"> de </span>
                        <span className="text-sm font-bold text-[#16476A]">{totalPages}</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#132440] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
                      >
                        « Anterior
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#132440] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
                      >
                        Próxima »
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E0E0E0] w-full max-w-lg overflow-hidden animate-slideUp">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Nova Empresa</h2>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">
                    Nome da Empresa <span className="text-[#BF092F]">*</span>
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                    placeholder="Ex.: Empresa XYZ"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t-2 border-[#E0E0E0]">
                <button
                  onClick={() => setCreating(false)}
                  className="px-5 py-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#212121] font-bold transition-all duration-300 hover:scale-105 shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={createEmpresa}
                  disabled={isCreating || newName.trim().length === 0}
                  className="px-5 py-3 rounded-xl bg-[#3B9797] hover:bg-[#2c7a7a] text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Criando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Criar Empresa
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
