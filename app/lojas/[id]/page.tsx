'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Store, MapPin, CheckCircle2, XCircle, RefreshCw, Edit, Save, X } from 'lucide-react';
import { Store as StoreType, Company, User } from '@/lib/types/business';
import { useAuth } from '@/contexts/AuthContext';

interface Loja extends StoreType {
  companyName?: string;
  managerName?: string;
}

export default function LojaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const id = params?.id as string;

  const [data, setData] = useState<Loja | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados para edição
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
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

      const [storeRes, companiesRes, usersRes] = await Promise.all([
        fetch(`/api/lojas/${encodeURIComponent(id)}`, { cache: 'no-store', headers }),
        fetch('/api/companies', { cache: 'no-store', headers }),
        fetch('/api/usuarios', { cache: 'no-store', headers }),
      ]);

      if (!storeRes.ok) throw new Error('Falha ao carregar loja');
      if (!companiesRes.ok) throw new Error('Falha ao carregar empresas');
      if (!usersRes.ok) throw new Error('Falha ao carregar usuários');

      const storeJson = await storeRes.json();
      const companiesJson = await companiesRes.json();
      const usersJson = await usersRes.json();

      console.log('[Loja Detalhe] Total usuários carregados:', usersJson.usuarios?.length || 0);
      console.log('[Loja Detalhe] Gerentes encontrados:', usersJson.usuarios?.filter((u: User) => u.role === 'manager').length || 0);

      setCompanies(companiesJson.companies || []);
      setUsers(usersJson.usuarios || []);

      const storeData: StoreType = storeJson.loja;
      const company = (companiesJson.companies || []).find((c: Company) => c.id === storeData.companyId);
      const manager = (usersJson.usuarios || []).find((u: User) => u.uid === storeData.managerId);

      const lojaData = {
        ...storeData,
        companyName: company?.name,
        managerName: manager?.displayName,
      };

      setData(lojaData);

      // Inicializar campos de edição com dados atuais
      setEditName(storeData.name || '');
      setEditCompanyId(storeData.companyId || '');
      setEditManagerId(storeData.managerId || '');
      setEditAddress(storeData.address || '');
      setEditCity(storeData.city || '');
      setEditState(storeData.state || '');

      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (firebaseUser) {
      fetchData();
    }
  }, [id, firebaseUser, fetchData]);

  const patchLoja = async (payload: Partial<Loja>) => {
    if (!id) return;
    try {
      setSaving(true);

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
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao atualizar loja');
      }
      const json = await res.json();
      const updated = json?.loja as Loja | undefined;
      if (updated) {
        await fetchData(); // Recarregar dados completos
        const msg = Object.prototype.hasOwnProperty.call(payload, 'active')
          ? (payload.active ? 'Loja ativada' : 'Loja desativada')
          : 'Loja atualizada com sucesso';
        setToast({ type: 'success', message: msg });
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar loja' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEdit = () => {
    if (!data) return;
    setEditName(data.name || '');
    setEditCompanyId(data.companyId || '');
    setEditManagerId(data.managerId || '');
    setEditAddress(data.address || '');
    setEditCity(data.city || '');
    setEditState(data.state || '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editCompanyId || !editManagerId) {
      setToast({ type: 'error', message: 'Nome, Empresa e Gerente são obrigatórios' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    await patchLoja({
      name: editName.trim(),
      companyId: editCompanyId,
      managerId: editManagerId,
      address: editAddress.trim() || undefined,
      city: editCity.trim() || undefined,
      state: editState.trim() || undefined,
    });

    setEditing(false);
  };

  // Gerentes disponíveis (todos os gerentes ativos)
  const availableManagers = useMemo(() => {
    const managers = users.filter(u => u.role === 'manager' && u.active);
    console.log('[Loja Detalhe] Total usuários:', users.length);
    console.log('[Loja Detalhe] Gerentes disponíveis:', managers.length);
    console.log('[Loja Detalhe] Gerentes:', managers.map(m => ({ id: m.uid, name: m.displayName, role: m.role, active: m.active })));
    return managers;
  }, [users]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp ${toast.type === 'success' ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32]' : 'bg-gradient-to-r from-[#E82129] to-[#C62828]'}`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {toast.message}
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/lojas')}
              className="p-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-gradient-to-r hover:from-[#1F53A2] hover:to-[#2E67C3] hover:text-white hover:border-[#1F53A2] transition-all duration-300 hover:scale-105 shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-[#212121]">Detalhes da Loja</h1>
          </div>
          <Link
            href="/lojas"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F8F9FA] border-2 border-[#E0E0E0] rounded-xl font-bold text-[#1F53A2] transition-all duration-300 hover:scale-105 shadow-md"
          >
            Ver todas as lojas
          </Link>
        </div>

        {loading && (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center shadow-md">
            <RefreshCw className="w-6 h-6 text-[#1F53A2] animate-spin inline-block" />
            <p className="mt-2 text-[#757575]">Carregando...</p>
          </div>
        )}
        {!loading && error && (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center shadow-md text-[#E82129] font-semibold">{error}</div>
        )}
        {!loading && !error && data && !editing && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] overflow-hidden">
              {/* Header Card */}
              <div className="bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{data.name}</h2>
                  </div>
                  <button
                    onClick={handleEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                    <p className="text-xs font-bold text-[#757575] uppercase mb-1">Empresa</p>
                    <p className="text-base font-bold text-[#212121]">{data.companyName || data.companyId || '-'}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                    <p className="text-xs font-bold text-[#757575] uppercase mb-1">Gerente</p>
                    <p className="text-base font-bold text-[#212121]">{data.managerName || data.managerId || '-'}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                    <p className="text-xs font-bold text-[#757575] uppercase mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Endereço
                    </p>
                    <p className="text-base font-bold text-[#212121]">{data.address || '-'}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                    <p className="text-xs font-bold text-[#757575] uppercase mb-1">Cidade / Estado</p>
                    <p className="text-base font-bold text-[#212121]">
                      {data.city && data.state ? `${data.city} / ${data.state}` : data.city || data.state || '-'}
                    </p>
                  </div>
                </div>

                <div className="border-t-2 border-[#E0E0E0] pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[#757575]">
                      <span className="font-bold">ID:</span> <span className="font-mono">{data.id}</span>
                    </div>
                    <div className="text-xs text-[#757575]">
                      <span className="font-bold">Criado em:</span>{' '}
                      {(() => {
                        const date = data.createdAt instanceof Date ? data.createdAt : (data.createdAt as any).toDate?.() || new Date(0);
                        return date.toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Status e Ações */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] p-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-[#757575]">Status da Loja:</p>
                  {data.active ? (
                    <span className="px-4 py-2 inline-flex items-center gap-2 text-sm font-bold rounded-xl border-2 bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 text-[#2E7D32] border-[#4CAF50]/30 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" /> Ativa
                    </span>
                  ) : (
                    <span className="px-4 py-2 inline-flex items-center gap-2 text-sm font-bold rounded-xl border-2 bg-gradient-to-r from-[#E82129]/10 to-[#C62828]/10 text-[#C62828] border-[#E82129]/30 shadow-sm">
                      <XCircle className="w-5 h-5" /> Inativa
                    </span>
                  )}
                </div>
                <button
                  onClick={() => patchLoja({ active: !data.active })}
                  disabled={saving}
                  className={`px-5 py-3 rounded-xl text-sm font-bold border-2 shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
                    data.active
                      ? 'border-[#E82129]/30 text-[#E82129] hover:bg-[#E82129]/10 bg-gradient-to-r from-[#E82129]/5 to-[#C62828]/5'
                      : 'border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/10 bg-gradient-to-r from-[#4CAF50]/5 to-[#2E7D32]/5'
                  }`}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processando...
                    </span>
                  ) : (
                    <span>{data.active ? 'Desativar Loja' : 'Ativar Loja'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modo de Edição */}
        {!loading && !error && data && editing && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Editar Loja</h2>
              </div>
            </div>

            {/* Formulário */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#757575] mb-2">
                  Nome da Loja <span className="text-[#E82129]">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium transition-all"
                  placeholder="Ex.: Loja Centro"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">
                    Empresa <span className="text-[#E82129]">*</span>
                  </label>
                  <select
                    value={editCompanyId}
                    onChange={(e) => setEditCompanyId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium bg-white transition-all"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#757575] mb-2">
                    Gerente <span className="text-[#E82129]">*</span>
                  </label>
                  <select
                    value={editManagerId}
                    onChange={(e) => setEditManagerId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium bg-white transition-all"
                  >
                    <option value="">Selecione um gerente</option>
                    {availableManagers.length === 0 && (
                      <option value="" disabled>Nenhum gerente disponível</option>
                    )}
                    {availableManagers.map((u, index) => (
                      <option key={u.uid ?? `manager-${index}`} value={u.uid ?? ''}>
                        {u.displayName || u.email || 'Gerente sem nome'}
                      </option>
                    ))}
                  </select>
                  {availableManagers.length === 0 && (
                    <p className="text-xs text-[#E82129] mt-1 font-medium">
                      ⚠ Não há gerentes disponíveis. Cadastre novos gerentes primeiro.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t-2 border-[#E0E0E0] pt-4">
                <h3 className="text-sm font-bold text-[#757575] mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Localização (Opcional)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">Endereço</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium transition-all"
                      placeholder="Ex.: Av. Paulista, 1000"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#757575] mb-2">Cidade</label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium transition-all"
                        placeholder="Ex.: São Paulo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#757575] mb-2">Estado</label>
                      <input
                        type="text"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2] focus:border-[#1F53A2] font-medium transition-all"
                        placeholder="Ex.: SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-[#E0E0E0]">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#212121] font-bold transition-all duration-300 hover:scale-105 shadow-sm disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    Cancelar
                  </span>
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim() || !editCompanyId || !editManagerId}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </span>
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
