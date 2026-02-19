'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, UserCheck, UserX, Mail, IdCard, Building, Store as StoreIcon } from 'lucide-react';
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

interface Activity {
  id: string;
  type: 'info' | 'warning' | 'error' | string;
  message: string;
  createdAt: string;
}

const roleLabels: Record<UserRole, string> = {
  developer: 'Desenvolvedor',
  admin: 'Admin',
  buyer: 'Comprador',
  agent: 'Agente',
  manager: 'Gerente',
};

export default function UsuarioDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { firebaseUser, user: currentUser } = useAuth();

  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [storesList, setStoresList] = useState<{ id: string; name: string }[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const fetchUser = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    try {
      setLoading(true);
      // Force token refresh to get updated custom claims
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // Carregar usuario e lojas em paralelo para validar IDs
      const [userRes, lojasRes] = await Promise.all([
        fetch(`/api/usuarios/${encodeURIComponent(id)}`, { cache: 'no-store', headers, signal }),
        fetch('/api/lojas', { cache: 'no-store', headers, signal }),
      ]);

      if (signal?.aborted) return;

      if (!userRes.ok) throw new Error('Falha ao carregar usuario');
      const userJson = await userRes.json();
      setUser(userJson.usuario as Usuario);

      // Carregar lista de lojas validas
      let validStoreIds = new Set<string>();
      if (lojasRes.ok) {
        const lojasJson = await lojasRes.json();
        const list: { id: string; name: string }[] = [];
        (lojasJson.lojas || []).forEach((loja: any) => {
          validStoreIds.add(loja.id);
          list.push({ id: loja.id, name: loja.name || loja.id });
        });
        setStoresList(list);
      }

      // Filtrar apenas IDs de lojas que realmente existem
      const storesFromUser = (userJson.usuario?.storeIds as string[] | undefined) || (userJson.usuario?.storeId ? [userJson.usuario.storeId] : []);
      const validatedStores = storesFromUser.filter(id => validStoreIds.has(id));
      setSelectedStoreIds(validatedStores);

      setError(null);
    } catch (e: any) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [id, firebaseUser]);

  useEffect(() => {
    if (!id) return;

    const abortController = new AbortController();
    const { signal } = abortController;

    fetchUser(signal);

    // fetch activities (best-effort)
    (async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}/activities`, { cache: 'no-store', headers, signal });
        if (signal.aborted || !res.ok) return;
        const json = await res.json();
        setActivities(json.activities || []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    })();

    // fetch empresas para mapear nomes
    (async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const empresasRes = await fetch('/api/empresas', { cache: 'no-store', headers, signal });
        if (signal.aborted) return;

        if (empresasRes.ok) {
          const empresasJson = await empresasRes.json();
          const map: Record<string, string> = {};
          (empresasJson.empresas || []).forEach((empresa: any) => {
            map[empresa.id] = empresa.tradingName || empresa.name || empresa.id;
          });
          setCompanyMap(map);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('Falha ao mapear empresas para nomes:', err);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [id, fetchUser]);

  const patchUser = async (payload: Partial<Pick<Usuario, 'active' | 'role' | 'storeId' | 'storeIds' | 'companyId'>>) => {
    if (!id) return;
    try {
      setSaving(true);
      const token = await firebaseUser?.getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Falha ao atualizar usuário');
      }
      const updated = json?.usuario as Usuario | undefined;
      if (updated) {
        setUser(updated);
        const storesFromUpdated = (updated.storeIds as string[] | undefined) || (updated.storeId ? [updated.storeId] : []);
        setSelectedStoreIds(storesFromUpdated);
        let msg = 'Usuário atualizado';
        if (Object.prototype.hasOwnProperty.call(payload, 'active')) {
          msg = payload.active ? 'Usuário ativado' : 'Usuário desativado';
        } else if (Object.prototype.hasOwnProperty.call(payload, 'role') && payload.role) {
          const labels = roleLabels as Record<string, string>;
          msg = `Função alterada para ${labels[(payload.role as keyof typeof labels)] ?? payload.role}`;
        }
        setToast({ type: 'success', message: msg });
      }
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: (e as any)?.message || 'Erro ao atualizar usuário' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-md text-white ${toast.type === 'success' ? 'bg-[#4CAF50]' : 'bg-[#E82129]'}`}>
            {toast.message}
          </div>
        )}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/usuarios')}
              className="text-[#1F53A2] hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">Detalhes do Usuário</h1>
              <p className="text-sm text-[#757575]">Informações completas e ações rápidas</p>
            </div>
          </div>
          <Link href="/usuarios" className="hidden md:inline text-[#1F53A2] hover:underline">Ver lista</Link>
        </div>

        {loading && (
          <div className="bg-white p-6 rounded-xl border border-[#E0E0E0]">Carregando usuário...</div>
        )}
        {!loading && error && (
          <div className="bg-white p-6 rounded-xl border border-[#E0E0E0] text-[#E82129] font-semibold">{error}</div>
        )}
        {!loading && !error && user && (
          <div className="space-y-6">
            {/* Header card */}
            <div className="bg-gradient-to-r from-[#16476A] via-[#3B9797] to-[#4daaa6] p-6 rounded-2xl shadow-lg border border-[#16476A]/20 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-xl">
                    {user.displayName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{user.displayName}</div>
                    <div className="mt-1 text-white/80 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {user.email || '-'}
                    </div>
                    <div className="mt-1 text-white/80 flex items-center gap-2">
                      <IdCard className="w-4 h-4" /> ID: <span className="font-mono">{user.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <span className={`px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border ${
                    user.active
                      ? 'bg-white/15 text-white border-white/30'
                      : 'bg-white/10 text-white border-white/20'
                  }`}>
                    {user.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border border-white/30 bg-white/10 text-white">
                    <Shield className="w-4 h-4" /> {roleLabels[user.role]}
                  </span>
                  <div className="text-right text-sm text-white/80">
                    <div>Criado em</div>
                    <div className="font-semibold">
                      {new Date(user.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm">
                <div className="text-xs font-bold text-[#757575] flex items-center gap-2 uppercase tracking-wide">
                  <Building className="w-4 h-4 text-[#16476A]" /> Empresa
                </div>
                <div className="mt-2 text-sm font-semibold text-[#212121]">
                  {user.companyId ? (companyMap[user.companyId] || user.companyId) : 'N/A'}
                </div>
              </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm">
              <div className="text-xs font-bold text-[#757575] flex items-center gap-2 uppercase tracking-wide mb-2">
                <StoreIcon className="w-4 h-4 text-[#16476A]" /> Loja
              </div>
              <div className="space-y-2">
                <div className="text-xs text-[#757575]">Selecione uma ou mais lojas deste usuário</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {storesList.map((store) => {
                    const checked = selectedStoreIds.includes(store.id);
                    return (
                      <label
                        key={store.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition ${
                          checked
                            ? 'border-[#16476A] bg-[#16476A]/10 text-[#16476A]'
                            : 'border-[#E0E0E0] bg-white text-[#212121] hover:border-[#16476A]'
                        }`}>
                        <input
                          type="checkbox"
                          className="accent-[#16476A]"
                          checked={checked}
                          disabled={saving}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedStoreIds, store.id]
                              : selectedStoreIds.filter((s) => s !== store.id);
                            setSelectedStoreIds(next);
                            patchUser({ storeIds: next, storeId: next[0] ?? null });
                          }}
                        />
                        <span>{store.name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedStoreIds.length === 0 && (
                  <div className="text-xs text-[#BF092F]">Nenhuma loja selecionada</div>
                )}
              </div>
            </div>
            </div>

            {/* Ações rápidas */}
            <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm">
              <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-sm font-semibold text-[#757575]">Status</span>
                  <button
                    onClick={() => patchUser({ active: !user.active })}
                    disabled={saving}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 shadow-sm ${
                      user.active
                        ? 'border-[#E82129]/30 text-[#E82129] bg-[#E82129]/10 hover:bg-[#E82129]/20'
                        : 'border-[#4CAF50]/30 text-[#4CAF50] bg-[#4CAF50]/10 hover:bg-[#4CAF50]/20'
                    }`}>
                    {user.active ? 'Desativar usuário' : 'Ativar usuário'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    // Botao 'Dev' so aparece para usuarios com role 'developer'
                    ...(currentUser?.role === 'developer' ? [
                      { key: 'developer', label: 'Dev', className: 'border-purple-500/30 text-purple-500 hover:bg-purple-500/10' }
                    ] : []),
                    { key: 'admin', label: 'Admin', className: 'border-[#1F53A2]/30 text-[#1F53A2] hover:bg-[#1F53A2]/10' },
                    { key: 'manager', label: 'Gerente', className: 'border-[#5C94CC]/30 text-[#5C94CC] hover:bg-[#5C94CC]/10' },
                    { key: 'agent', label: 'Agente', className: 'border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/10' },
                    { key: 'buyer', label: 'Comprador', className: 'border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10' },
                  ].map((role) => {
                    const isActiveRole = user.role === role.key;
                    return (
                      <button
                        key={role.key}
                        onClick={() => patchUser({ role: role.key as UserRole })}
                        disabled={saving || isActiveRole}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 shadow-sm ${
                          isActiveRole
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500 border-gray-200'
                            : role.className
                        }`}>
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Permissões por função */}
            <div className="bg-white p-6 rounded-xl border border-[#E0E0E0]">
              <h2 className="text-lg font-bold text-[#212121] mb-3">Permissões</h2>
              <ul className="list-disc pl-5 text-[#757575] text-sm">
                {(user.role === 'developer' ? [
                  'Acesso total ao sistema (desenvolvedor)',
                  'Gerenciar usuários, lojas e empresas',
                  'Visualizar e editar todas as solicitações',
                ] : user.role === 'admin' ? [
                  'Acesso total ao sistema (administrador)',
                  'Gerenciar usuários, lojas e empresas',
                  'Visualizar e editar todas as solicitações',
                ] : user.role === 'manager' ? [
                  'Gerenciar solicitações da sua loja',
                  'Visualizar dashboard da sua loja',
                ] : user.role === 'agent' ? [
                  'Criar e operar solicitações da sua loja',
                  'Visualizar dashboard da sua loja',
                ] : user.role === 'buyer' ? [
                  'Visualizar solicitações de todas as lojas',
                  'Acompanhar e negociar itens existentes',
                  'Visualizar dashboard global',
                ] : [
                  'Permissões padrão',
                ]).map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Atividades recentes */}
            <div className="bg-white p-6 rounded-xl border border-[#E0E0E0]">
              <h2 className="text-lg font-bold text-[#212121] mb-3">Atividades Recentes</h2>
              {activities.length === 0 ? (
                <p className="text-[#757575]">Sem atividades recentes</p>
              ) : (
                <ul className="space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#212121]">{a.message}</span>
                      <span className="text-[#757575]">
                        {new Date(a.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
