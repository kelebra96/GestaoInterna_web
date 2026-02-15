'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Store, MapPin, CheckCircle2, XCircle, Plus, Building2 } from 'lucide-react';
import { Company, Store as StoreType, User } from '@/lib/types/business';
import { useAuth } from '@/contexts/AuthContext';

interface Loja extends StoreType {
  companyName?: string;
  managerName?: string;
}

export default function LojasPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<Loja[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newManagerId, setNewManagerId] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');

  // Filtros
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchData = async () => {
    try {
      setLoading(true);

      // Pegar token do Firebase
      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [storesRes, companiesRes, usersRes] = await Promise.all([
        fetch('/api/lojas', { cache: 'no-store', headers }),
        fetch('/api/companies', { cache: 'no-store', headers }),
        fetch('/api/usuarios', { cache: 'no-store', headers }),
      ]);

      if (!storesRes.ok) throw new Error('Falha ao carregar lojas');
      if (!companiesRes.ok) throw new Error('Falha ao carregar empresas');
      if (!usersRes.ok) throw new Error('Falha ao carregar usuários');

      const storesJson = await storesRes.json();
      const companiesJson = await companiesRes.json();
      const usersJson = await usersRes.json();

      console.log('[Lojas] Total usuários carregados:', usersJson.usuarios?.length || 0);
      console.log('[Lojas] Gerentes encontrados:', usersJson.usuarios?.filter((u: User) => u.role === 'manager').length || 0);
      console.log('[Lojas] Amostra usuários:', usersJson.usuarios?.slice(0, 3).map((u: User) => ({
        id: u.uid,
        displayName: u.displayName,
        role: u.role,
      })));

      setCompanies(companiesJson.companies || []);
      setUsers(usersJson.usuarios || []);

      const companyMap = new Map<string, Company>();
      (companiesJson.companies || []).forEach((c: Company) => {
        companyMap.set(c.id, c);
      });

      const storesWithNames: Loja[] = (storesJson.lojas || []).map((store: StoreType) => {
        const company = companyMap.get(store.companyId);
        const manager = (usersJson.usuarios || []).find((u: User) => u.uid === store.managerId);

        console.log('[Lojas Debug] Loja:', {
          storeId: store.id,
          storeCompanyId: store.companyId,
          foundCompanyName: company?.name,
          companyFound: company ? 'sim' : 'não',
        });

        return {
          ...store,
          companyName: company?.tradingName || company?.name || store.companyId || undefined,
          managerName: manager?.displayName || undefined,
        };
      });

      setData(storesWithNames);
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
      .filter((l) => (status === 'all' ? true : status === 'active' ? l.active : !l.active))
      .filter((l) => {
        if (!q) return true;
        return (
          l.name.toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (l.address || '').toLowerCase().includes(q) ||
          (l.companyName || '').toLowerCase().includes(q) ||
          (l.managerName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [query, status]);

  const patchLoja = async (id: string, payload: Partial<Loja>) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      // Pegar token do Firebase
      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/lojas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Falha ao atualizar loja');
      const json = await res.json();
      const updated = json?.loja as Loja | undefined;
      if (updated) {
        setData((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
        const msg = Object.prototype.hasOwnProperty.call(payload, 'active')
          ? (payload.active ? 'Loja ativada' : 'Loja desativada')
          : 'Loja atualizada';
        setToast({ type: 'success', message: msg });
      } else {
        await fetchData();
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar loja' });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
      setTimeout(() => setToast(null), 3000);
    }
  };

  const createLoja = async () => {
    try {
      setSaving((s) => ({ ...s, __create: true } as any));

      // Pegar token do Firebase
      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (!newCompanyId) {
        setToast({ type: 'error', message: 'Selecione a empresa da loja' });
        setSaving((s) => ({ ...s, __create: false } as any));
        setTimeout(() => setToast(null), 3000);
        return;
      }
      if (!newName.trim()) {
        setToast({ type: 'error', message: 'Informe o nome da loja' });
        setSaving((s) => ({ ...s, __create: false } as any));
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const body = {
        name: newName.trim(),
        companyId: newCompanyId,
        managerId: newManagerId || undefined,
        address: newAddress.trim() || undefined,
        city: newCity.trim() || undefined,
        state: newState.trim() || undefined,
      };
      const res = await fetch('/api/lojas', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Falha ao criar loja');
      const json = await res.json();
      const loja = json?.loja as Loja;
      if (loja) {
        // Adicionar companyName e managerName à loja criada
        const company = companies.find(c => c.id === loja.companyId);
        const manager = users.find(u => u.uid === loja.managerId);
        const lojaComNomes: Loja = {
          ...loja,
          companyName: company?.tradingName || company?.name || loja.companyId || undefined,
          managerName: manager?.displayName || undefined,
        };
        setData((prev) => [lojaComNomes, ...prev]);
        setToast({ type: 'success', message: 'Loja criada' });
        setCreating(false);
        setNewName(''); setNewCompanyId(''); setNewManagerId(''); setNewAddress(''); setNewCity(''); setNewState('');
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Erro ao criar loja' });
    } finally {
      setSaving((s) => ({ ...s, __create: false } as any));
      setTimeout(() => setToast(null), 3000);
    }
  };

  const availableManagers = useMemo(() => {
    // Mostrar apenas gerentes ativos da empresa selecionada (API tamb‚m valida)
    const managers = users.filter(u =>
      u.role === 'manager' &&
      u.active &&
      (!newCompanyId || u.companyId === newCompanyId)
    );
    console.log('[Lojas] Gerentes disponiveis para selecao:', managers.length);
    console.log('[Lojas] Gerentes:', managers.map(m => ({ id: m.uid, name: m.displayName, role: m.role, active: m.active, companyId: m.companyId })));
    return managers;
  }, [users, newCompanyId]);

  useEffect(() => {
    if (newManagerId) {
      const stillValid = availableManagers.some(m => m.uid === newManagerId);
      if (!stillValid) {
        setNewManagerId('');
      }
    }
  }, [newCompanyId, availableManagers, newManagerId]);

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
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Lojas
                  </h1>
                  <p className="text-[#E3EFFF] text-base font-medium mt-2">
                    Gerencie e acompanhe as lojas do sistema
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-2 bg-[#3B9797] hover:bg-[#2c7a7a] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Nova Loja
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
                  placeholder="Buscar por nome, cidade, endereço, empresa ou gerente..."
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
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#212121]">Carregando lojas...</p>
              <p className="text-sm text-[#757575] mt-2">Aguarde enquanto buscamos os dados</p>
            </div>
          )}

          {!loading && error && (
            <div className="px-6 py-24 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
              <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar as lojas</p>
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
              <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma loja encontrada</p>
              <p className="text-sm text-[#757575]">
                {filtered.length === 0 && data.length > 0
                  ? 'Tente ajustar os filtros para ver mais resultados'
                  : 'Comece adicionando uma nova loja ao sistema'}
              </p>
            </div>
          )}

          {!loading && !error && current.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E0E0E0]">
                  <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Loja</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Empresa</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Gerente</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Endereço</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Ações</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Criado em</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E0E0E0]">
                    {current.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => router.push(`/lojas/${encodeURIComponent(l.id)}`)}
                        className="hover:bg-gray-100 transition-all duration-300 cursor-pointer group hover:shadow-md"
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-xl shadow-lg">
                              <Store className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-bold text-[#212121] group-hover:text-[#16476A] transition-colors">
                              {l.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-medium text-[#212121] bg-[#F8F9FA] px-3 py-1.5 rounded-lg border border-[#E0E0E0]">
                            {l.companyName || l.companyId || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] flex items-center justify-center text-white font-bold text-xs shadow-md">
                              {(l.managerName || 'G').substring(0, 1).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-[#212121]">
                              {l.managerName || (l.managerId ? `Gerente ID: ${l.managerId}` : '-')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-[#757575]">
                            <MapPin className="w-4 h-4 text-[#3B9797]" />
                            <span className="font-medium">{l.address || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {l.active ? (
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
                            onClick={(e) => { e.stopPropagation(); patchLoja(l.id, { active: !l.active }); }}
                            disabled={!!saving[l.id]}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                              l.active
                                ? 'bg-[#BF092F]/10 border-[#BF092F]/30 text-[#BF092F] hover:bg-[#BF092F]/20'
                                : 'bg-[#3B9797]/10 border-[#3B9797]/30 text-[#3B9797] hover:bg-[#3B9797]/20'
                            }`}
                            title={l.active ? 'Desativar' : 'Ativar'}
                          >
                            {l.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="text-sm font-medium text-[#212121]">
                            {(() => {
                              const date = l.createdAt instanceof Date ? l.createdAt : new Date(l.createdAt);
                              return date.toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric'
                              });
                            })()}
                          </div>
                          <div className="text-xs text-[#757575] mt-1">
                            {(() => {
                              const date = l.createdAt instanceof Date ? l.createdAt : new Date(l.createdAt);
                              return date.toLocaleTimeString('pt-BR', {
                                hour: '2-digit', minute: '2-digit'
                              });
                            })()}
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
        <div className="bg-white rounded-2xl shadow-2xl border border-[#E0E0E0] w-full max-w-2xl overflow-hidden animate-slideUp">
          {/* Header do Modal */}
          <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Nova Loja</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#757575] mb-2">
                  Nome da Loja <span className="text-[#BF092F]">*</span>
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                  placeholder="Ex.: Loja Centro"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">
                    Empresa <span className="text-[#BF092F]">*</span>
                  </label>
                  <select
                    value={newCompanyId}
                    onChange={(e) => setNewCompanyId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white transition-all"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">
                    Gerente <span className="font-normal text-[#757575]">(Opcional)</span>
                  </label>
                  <select
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white transition-all"
                  >
                    <option value="">Selecione um gerente</option>
                    {availableManagers.length === 0 && (
                      <option value="" disabled>Nenhum gerente disponível</option>
                    )}
                    {availableManagers.map((u, idx) => (
                      <option key={u.uid || `${u.displayName}-${idx}`} value={u.uid}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>
                  {availableManagers.length === 0 && (
                    <p className="text-xs text-[#BF092F] mt-1 font-medium">
                      ⚠ Não há gerentes disponíveis. Cadastre novos gerentes ou libere gerentes já vinculados.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t-2 border-[#E0E0E0] pt-4 mt-4">
                <h3 className="text-sm font-bold text-[#757575] mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Localização (Opcional)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">Endereço</label>
                    <input
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                      placeholder="Ex.: Av. Paulista, 1000"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#757575] mb-2">Cidade</label>
                      <input
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                        placeholder="Ex.: São Paulo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#757575] mb-2">Estado</label>
                      <input
                        value={newState}
                        onChange={(e) => setNewState(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                        placeholder="Ex.: SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
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
                onClick={createLoja}
                disabled={saving.__create || newName.trim().length === 0 || !newCompanyId}
                className="px-5 py-3 rounded-xl bg-[#3B9797] hover:bg-[#2c7a7a] text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
              >
                {saving.__create ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Criando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Criar Loja
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
