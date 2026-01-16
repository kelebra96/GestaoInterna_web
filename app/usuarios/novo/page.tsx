'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types/business';
import {
  UserPlus,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Shield,
  Building2,
  Store as StoreIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
  companyId?: string;
}

const roleLabels: Record<UserRole, string> = {
  developer: 'Desenvolvedor',
  admin: 'Administrador',
  buyer: 'Comprador',
  agent: 'Agente',
  manager: 'Gerente',
};

const roleDescriptions: Record<UserRole, string> = {
  developer: 'Acesso completo ao sistema, incluindo configurações técnicas',
  admin: 'Gerenciamento de usuários, empresas e configurações',
  manager: 'Gerenciamento de lojas e operações',
  agent: 'Execução de tarefas operacionais',
  buyer: 'Gestão de compras e fornecedores',
};

export default function NovoUsuarioPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'buyer' as UserRole,
    companyId: '',
    storeId: '',
  });
  const [allStores, setAllStores] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    displayName: false,
    email: false,
    password: false,
  });

  useEffect(() => {
    const fetchCompaniesAndStores = async () => {
      try {
        setLoadingData(true);
        const token = await firebaseUser?.getIdToken(true);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const [companiesRes, storesRes] = await Promise.all([
          fetch('/api/empresas', { headers }),
          fetch('/api/lojas', { headers }),
        ]);
        const [companiesData, storesData] = await Promise.all([
          companiesRes.json(),
          storesRes.json(),
        ]);
        setCompanies(companiesData.empresas || []);
        setStores(storesData.lojas || []);
      } catch (e) {
        console.error('Falha ao carregar dados:', e);
        setError('Não foi possível carregar as empresas e lojas.');
      } finally {
        setLoadingData(false);
      }
    };
    fetchCompaniesAndStores();
  }, []);

  // Filtrar lojas pela empresa selecionada
  const filteredStores = useMemo(() => {
    if (!formData.companyId) return stores;
    return stores.filter(s => s.companyId === formData.companyId);
  }, [stores, formData.companyId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Se mudar a empresa, resetar a loja selecionada
    if (name === 'companyId') {
      setFormData({ ...formData, companyId: value, storeId: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched({ ...touched, [field]: true });
  };

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: '', color: '' };
    if (password.length < 6) return { strength: 1, label: 'Muito fraca', color: 'text-[#BF092F]' };
    if (password.length < 8) return { strength: 2, label: 'Fraca', color: 'text-orange-500' };
    if (password.length < 12) return { strength: 3, label: 'Média', color: 'text-yellow-500' };
    return { strength: 4, label: 'Forte', color: 'text-[#4CAF50]' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const isFormValid = () => {
    const baseValid =
      formData.displayName.trim().length > 0 &&
      validateEmail(formData.email) &&
      formData.password.length >= 6;

    if (formData.role === 'developer' || formData.role === 'admin') {
      return baseValid;
    }

    // Para manager/agent, precisa de empresa e (loja específica OU todas as lojas)
    if (formData.role === 'manager' || formData.role === 'agent') {
      const hasStore = allStores || formData.storeId !== '';
      return baseValid && formData.companyId !== '' && hasStore;
    }

    return baseValid && formData.companyId !== '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = { ...formData };
      if (formData.role === 'developer' || formData.role === 'admin') {
        delete payload.companyId;
        delete payload.storeId;
      } else if (allStores && filteredStores.length > 0) {
        // Enviar todas as lojas da empresa selecionada
        payload.storeIds = filteredStores.map(s => s.id);
        delete payload.storeId;
      }
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao criar usuário');
      }

      setSuccess('Usuário criado com sucesso! Redirecionando...');
      setTimeout(() => {
        router.push('/usuarios');
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Success Toast */}
      {success && (
        <div className="fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] text-white font-bold animate-slideDown">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.back()}
              className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg hover:bg-white/20 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <UserPlus className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Novo Usuário
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Crie uma nova conta de usuário no sistema
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Informações do Usuário
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-gradient-to-r from-[#BF092F]/10 to-[#BF092F]/10 border-2 border-[#BF092F]/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0" />
                  <p className="text-sm font-bold text-[#BF092F]">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Personal Information Section */}
              <div>
                <h3 className="text-lg font-bold text-[#212121] mb-4 pb-2 border-b-2 border-[#E0E0E0]">
                  Dados Pessoais
                </h3>
                <div className="space-y-5">
                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      Nome Completo <span className="text-[#BF092F]">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                      <input
                        name="displayName"
                        type="text"
                        value={formData.displayName}
                        onChange={handleChange}
                        onBlur={() => handleBlur('displayName')}
                        placeholder="Ex: João da Silva"
                        className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 font-medium transition-all ${
                          touched.displayName && formData.displayName.trim().length === 0
                            ? 'border-[#BF092F] focus:ring-[#BF092F]/20'
                            : 'border-[#E0E0E0] focus:ring-[#16476A]/30 focus:border-[#16476A]'
                        }`}
                        required
                      />
                    </div>
                    {touched.displayName && formData.displayName.trim().length === 0 && (
                      <p className="mt-1 text-sm text-[#BF092F]">Nome é obrigatório</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      E-mail <span className="text-[#BF092F]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={() => handleBlur('email')}
                        placeholder="usuario@empresa.com"
                        className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 font-medium transition-all ${
                          touched.email && !validateEmail(formData.email)
                            ? 'border-[#BF092F] focus:ring-[#BF092F]/20'
                            : 'border-[#E0E0E0] focus:ring-[#16476A]/30 focus:border-[#16476A]'
                        }`}
                        required
                      />
                    </div>
                    {touched.email && formData.email && !validateEmail(formData.email) && (
                      <p className="mt-1 text-sm text-[#BF092F]">E-mail inválido</p>
                    )}
                    <p className="mt-2 text-xs text-[#757575]">
                      Este e-mail será usado para login no sistema
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      Senha <span className="text-[#BF092F]">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={() => handleBlur('password')}
                        placeholder="Mínimo 6 caracteres"
                        className={`w-full pl-11 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 font-medium transition-all ${
                          touched.password && formData.password.length < 6
                            ? 'border-[#BF092F] focus:ring-[#BF092F]/20'
                            : 'border-[#E0E0E0] focus:ring-[#16476A]/30 focus:border-[#16476A]'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#212121] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formData.password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                passwordStrength.strength === 1 ? 'bg-[#BF092F] w-1/4' :
                                passwordStrength.strength === 2 ? 'bg-orange-500 w-1/2' :
                                passwordStrength.strength === 3 ? 'bg-yellow-500 w-3/4' :
                                'bg-[#4CAF50] w-full'
                              }`}
                            ></div>
                          </div>
                          <span className={`text-xs font-bold ${passwordStrength.color}`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                      </div>
                    )}
                    {touched.password && formData.password.length < 6 && formData.password.length > 0 && (
                      <p className="mt-1 text-sm text-[#BF092F]">A senha deve ter pelo menos 6 caracteres</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Role & Permissions Section */}
              <div>
                <h3 className="text-lg font-bold text-[#212121] mb-4 pb-2 border-b-2 border-[#E0E0E0]">
                  Função e Permissões
                </h3>
                <div className="space-y-5">
                  {/* Role */}
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      Função <span className="text-[#BF092F]">*</span>
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575] pointer-events-none" />
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] font-medium bg-white text-[#212121] transition-all appearance-none cursor-pointer"
                      >
                        <option value="developer">🔧 {roleLabels.developer}</option>
                        <option value="admin">👑 {roleLabels.admin}</option>
                        <option value="manager">📊 {roleLabels.manager}</option>
                        <option value="agent">⚡ {roleLabels.agent}</option>
                        <option value="buyer">🛒 {roleLabels.buyer}</option>
                      </select>
                    </div>
                    <div className="mt-2 p-3 bg-gradient-to-r from-[#3B9797]/10 to-[#16476A]/10 border border-[#3B9797]/30 rounded-lg">
                      <p className="text-xs text-[#16476A] flex items-start gap-2">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{roleDescriptions[formData.role]}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Organization Section */}
              {(formData.role === 'manager' || formData.role === 'agent' || formData.role === 'buyer') && (
              <div>
                <h3 className="text-lg font-bold text-[#212121] mb-4 pb-2 border-b-2 border-[#E0E0E0]">
                  Organização
                </h3>
                <div className="space-y-5">
                  {/* Company */}
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      Empresa <span className="text-[#BF092F]">*</span>
                    </label>
                    {loadingData ? (
                      <div className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-[#F8F9FA] text-[#757575] font-medium">
                        Carregando empresas...
                      </div>
                    ) : (
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575] pointer-events-none" />
                        <select
                          name="companyId"
                          value={formData.companyId}
                          onChange={handleChange}
                          className="w-full pl-11 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] font-medium bg-white text-[#212121] transition-all appearance-none cursor-pointer"
                          required
                        >
                          <option value="">Selecione uma empresa</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#757575]">
                      A empresa à qual este usuário pertence
                    </p>
                  </div>

                  {/* Store */}
                  {(formData.role === 'manager' || formData.role === 'agent') && (
                  <div>
                    <label className="block text-sm font-bold text-[#757575] mb-2">
                      Loja
                    </label>

                    {/* Checkbox Todas as Lojas */}
                    <div className="mb-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={allStores}
                            onChange={(e) => {
                              setAllStores(e.target.checked);
                              if (e.target.checked) {
                                setFormData({ ...formData, storeId: '' });
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 border-2 border-[#E0E0E0] rounded-md bg-white peer-checked:bg-[#3B9797] peer-checked:border-[#3B9797] transition-all duration-200 group-hover:border-[#3B9797]">
                            <svg className="w-full h-full text-white opacity-0 peer-checked:opacity-100 p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="absolute inset-0 w-5 h-5 peer-checked:block hidden">
                            <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-[#212121] group-hover:text-[#3B9797] transition-colors">
                          Habilitar acesso a todas as lojas
                        </span>
                      </label>
                    </div>

                    {!allStores && (
                      <>
                        {loadingData ? (
                          <div className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-[#F8F9FA] text-[#757575] font-medium">
                            Carregando lojas...
                          </div>
                        ) : (
                          <div className="relative">
                            <StoreIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575] pointer-events-none" />
                            <select
                              name="storeId"
                              value={formData.storeId}
                              onChange={handleChange}
                              className="w-full pl-11 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] font-medium bg-white text-[#212121] transition-all appearance-none cursor-pointer"
                            >
                              <option value="">Selecione uma loja</option>
                              {filteredStores.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-[#757575]">
                          Vincule o usuário a uma loja específica
                        </p>
                      </>
                    )}

                    {allStores && (
                      <div className="p-3 bg-gradient-to-r from-[#3B9797]/10 to-[#16476A]/10 border border-[#3B9797]/30 rounded-lg">
                        <p className="text-xs text-[#16476A] flex items-start gap-2">
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>O usuário terá acesso a todas as lojas da empresa ({filteredStores.length} {filteredStores.length === 1 ? 'loja' : 'lojas'})</span>
                        </p>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t-2 border-[#E0E0E0]">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#212121] font-bold transition-all duration-300 hover:scale-105 shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !isFormValid() || loadingData}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando usuário...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Criar Usuário
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
