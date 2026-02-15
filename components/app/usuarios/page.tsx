'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Shield, UserCheck, UserX, Plus } from 'lucide-react';
import { UserRole } from '@/lib/types/business';
import { useAuth } from '@/contexts/AuthContext';

interface Usuario {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  storeId?: string;
  storeIds?: string[];
  companyId?: string;
  active: boolean;
  createdAt: string;
}

const roleLabels: Record<UserRole, string> = {
  developer: 'Desenvolvedor',
  admin: 'Admin',
  buyer: 'Comprador',
  agent: 'Agente',
  manager: 'Gerente',
};

const roleStyles: Record<UserRole, string> = {
  developer: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  admin: 'bg-[#16476A]/10 text-[#16476A] border-[#16476A]/30',
  buyer: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  agent: 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30',
  manager: 'bg-[#3B9797]/10 text-[#3B9797] border-[#3B9797]/30',
};

export default function UsuariosPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mapeamento de IDs para nomes
  const [stores, setStores] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Record<string, string>>({});

  // Filtros
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchData = async () => {
    try {
      setLoading(true);

      // Force token refresh to get updated custom claims
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // Buscar usuários, lojas e empresas em paralelo
      const [usuariosRes, lojasRes, empresasRes] = await Promise.all([
        fetch('/api/usuarios', { cache: 'no-store', headers }),
        fetch('/api/lojas', { cache: 'no-store', headers }),
        fetch('/api/empresas', { cache: 'no-store', headers }),
      ]);

      if (!usuariosRes.ok) {
        throw new Error(`Falha ao carregar usuários: ${usuariosRes.status}`);
      }

      const usuariosJson = await usuariosRes.json();
      setData(usuariosJson.usuarios || []);

      // Criar mapeamento de lojas (ID -> Nome)
      if (lojasRes.ok) {
        const lojasJson = await lojasRes.json();
        const storesMap: Record<string, string> = {};
        (lojasJson.lojas || []).forEach((loja: any) => {
          storesMap[loja.id] = loja.name;
        });
        console.log('Lojas mapeadas:', storesMap);
        setStores(storesMap);
      }

      // Criar mapeamento de empresas (ID -> Nome)
      if (empresasRes.ok) {
        const empresasJson = await empresasRes.json();
        const companiesMap: Record<string, string> = {};
        (empresasJson.empresas || []).forEach((empresa: any) => {
          companiesMap[empresa.id] = empresa.tradingName || empresa.name || empresa.id;
        });
        console.log('Empresas mapeadas:', companiesMap);
        setCompanies(companiesMap);
      }

      console.log('Usuários carregados:', usuariosJson.usuarios);

      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
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
    return data
      .filter((u) => (role === 'all' ? true : u.role === role))
      .filter((u) => (status === 'all' ? true : status === 'active' ? u.active : !u.active))
      .filter((u) => {
        if (!q) return true;
        return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.storeId && u.storeId.toLowerCase().includes(q)) || (u.companyId && u.companyId.toLowerCase().includes(q));
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [data, query, role, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [query, role, status]);

  const patchUser = async (id: string, payload: Partial<Pick<Usuario, 'active' | 'role' | 'storeId' | 'companyId'>>) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Falha ao atualizar usuário');
      const json = await res.json();
      const updated = json?.usuario as Usuario | undefined;
      if (updated) {
        setData((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
        let msg = 'Usuário atualizado';
        if (Object.prototype.hasOwnProperty.call(payload, 'active')) {
          msg = payload.active ? 'Usuário ativado' : 'Usuário desativado';
        } else if (Object.prototype.hasOwnProperty.call(payload, 'role') && payload.role) {
          const labels = roleLabels as Record<string, string>;
          msg = `Função alterada para ${labels[(payload.role as keyof typeof labels)] ?? payload.role}`;
        }
        setToast({ type: 'success', message: msg });
      } else {
        await fetchData();
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar usuário' });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32]' : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F]'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <UserCheck className="w-5 h-5" />
            ) : (
              <UserX className="w-5 h-5" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
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
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Usuários
                  </h1>
                  <p className="text-[#E0E7EF] text-base font-medium mt-2">
                    Gerencie e acompanhe os usuários do sistema
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/usuarios/novo')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Novo Usuário
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
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
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
                  placeholder="Buscar por nome, e-mail, loja ou empresa..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Função</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole | 'all')}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[#E0E0E0] text-sm font-bold bg-white text-[#212121] hover:border-[#16476A] focus:border-[#16476A] focus:outline-none focus:ring-2 focus:ring-[#16476A] transition-all"
                  >
                    <option value="all">Todas as funções</option>
                    <option value="developer">Desenvolvedor</option>
                    <option value="admin">Admin</option>
                    <option value="buyer">Comprador</option>
                    <option value="agent">Agente</option>
                    <option value="manager">Gerente</option>
                  </select>
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
                            ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white border-[#16476A] shadow-lg scale-105'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA] hover:scale-105'
                        }`}
                      >
                        {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
                      </button>
                    ))}
                  </div>
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#212121]">Carregando usuários...</p>
              <p className="text-sm text-[#757575] mt-2">Aguarde enquanto buscamos os dados</p>
            </div>
          )}

          {!loading && error && (
            <div className="px-6 py-24 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#BF092F] mb-6">
                <UserX className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
              <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar os usuários</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          )}

          {!loading && !error && current.length === 0 && (
            <div className="px-6 py-24 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#FF9800] to-[#F57C00] mb-6">
                <Search className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#212121] mb-2">Nenhum usuário encontrado</p>
              <p className="text-sm text-[#757575]">
                {filtered.length === 0 && data.length > 0
                  ? 'Tente ajustar os filtros para ver mais resultados'
                  : 'Comece adicionando um novo usuário ao sistema'}
              </p>
            </div>
          )}

          {!loading && !error && current.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E0E0E0]">
                  <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                    <tr>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Nome</th>
                      <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">E-mail</th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Função</th>
                      <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Loja</th>
                      <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Empresa</th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Ações</th>
                      <th className="hidden xl:table-cell px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Criado em</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E0E0E0]">
                    {current.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => router.push(`/usuarios/${encodeURIComponent(u.id)}`)}
                        className="hover:bg-gradient-to-r hover:from-[#E0E7EF] hover:to-white transition-all duration-300 cursor-pointer group hover:shadow-md"
                      >
                        <td className="px-3 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] flex items-center justify-center text-white font-bold text-sm shadow-lg">
                              {u.displayName.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                              {u.displayName}
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-5 whitespace-nowrap text-sm text-[#757575] font-medium">{u.email}</td>
                        <td className="px-3 sm:px-6 py-5 whitespace-nowrap">
                          <span className={`px-3 py-2 inline-flex text-xs leading-5 font-bold rounded-xl border shadow-sm ${roleStyles[u.role]}`}>
                            {roleLabels[u.role]}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-5">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              // Para dev/admin, loja não é obrigatória
                              if (u.role === 'developer' || u.role === 'admin') {
                                return <span className="text-sm font-medium text-[#757575] bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E0E0E0]">N/A</span>;
                              }

                              // Get all stores for this user
                              const userStores = u.storeIds && u.storeIds.length > 0
                                ? u.storeIds
                                : (u.storeId ? [u.storeId] : []);

                              if (userStores.length === 0) {
                                return <span className="text-sm font-medium text-[#757575] bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E0E0E0]">N/A</span>;
                              }

                              // Show all stores as badges
                              return userStores.map((storeId, idx) => {
                                const storeName = stores[storeId] || storeId;
                                return (
                                  <span
                                    key={storeId}
                                    className="text-xs font-semibold text-[#16476A] bg-[#16476A]/10 px-2 py-1 rounded-md border border-[#16476A]/20"
                                    title={storeName}
                                  >
                                    {storeName}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-medium text-[#212121] bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E0E0E0]">
                            {(() => {
                              if (!u.companyId) return 'N/A';
                              const companyName = companies[u.companyId];
                              console.log(`Usuario ${u.displayName} - CompanyId: ${u.companyId}, CompanyName: ${companyName}`);
                              return companyName || u.companyId;
                            })()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-5 whitespace-nowrap">
                          {u.active ? (
                            <span className="px-3 py-2 inline-flex items-center gap-2 text-xs font-bold rounded-xl border bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 text-[#2E7D32] border-[#4CAF50]/30 shadow-sm">
                              <UserCheck className="w-4 h-4" />
                              <span className="hidden sm:inline">Ativo</span>
                            </span>
                          ) : (
                            <span className="px-3 py-2 inline-flex items-center gap-2 text-xs font-bold rounded-xl border bg-gradient-to-r from-[#BF092F]/10 to-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30 shadow-sm">
                              <UserX className="w-4 h-4" />
                              <span className="hidden sm:inline">Inativo</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); patchUser(u.id, { active: !u.active }); }}
                              disabled={!!saving[u.id]}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                                u.active
                                  ? 'bg-gradient-to-r from-[#BF092F]/10 to-[#BF092F]/10 border-[#BF092F]/30 text-[#BF092F] hover:from-[#BF092F]/20 hover:to-[#BF092F]/20'
                                  : 'bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 border-[#4CAF50]/30 text-[#4CAF50] hover:from-[#4CAF50]/20 hover:to-[#2E7D32]/20'
                              }`}
                              title={u.active ? 'Desativar' : 'Ativar'}
                            >
                              {u.active ? (
                                <>
                                  <span className="hidden sm:inline">Desativar</span>
                                  <span className="sm:hidden">✕</span>
                                </>
                              ) : (
                                <>
                                  <span className="hidden sm:inline">Ativar</span>
                                  <span className="sm:hidden">✓</span>
                                </>
                              )}
                            </button>
                            <select
                              value={u.role}
                              onChange={(e) => { e.stopPropagation(); patchUser(u.id, { role: e.target.value as UserRole }); }}
                              disabled={!!saving[u.id]}
                              className="hidden sm:block px-3 py-2 rounded-xl text-xs font-bold border border-[#E0E0E0] shadow-sm transition-all duration-300 bg-white text-[#212121] hover:border-[#16476A] hover:bg-[#F8F9FA] focus:outline-none focus:ring-2 focus:ring-[#16476A] disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="developer">Desenvolvedor</option>
                              <option value="admin">Admin</option>
                              <option value="buyer">Comprador</option>
                              <option value="agent">Agente</option>
                              <option value="manager">Gerente</option>
                            </select>
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-6 py-5 whitespace-nowrap">
                          <div className="text-sm font-medium text-[#212121]">
                            {new Date(u.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-[#757575] mt-1">
                            {new Date(u.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
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
                      className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
                    >
                      « Anterior
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2.5 rounded-xl border-2 border-[#E0E0E0] bg-white text-sm font-bold text-[#212121] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-sm"
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
  );
}
