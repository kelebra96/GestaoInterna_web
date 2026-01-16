'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ClearDBModal from '@/components/configuracoes/ClearDBModal';
import { Settings as SettingsIcon, Bell, Sun, Moon, Monitor, RefreshCw, Database, Server, Users, Shield, AlertTriangle, Save, RotateCcw, Check, X } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
type Period = 7 | 30 | 90 | 0; // 0 = Tudo

export default function ConfiguracoesPage() {
  const { user, firebaseUser } = useAuth();
  const [theme, setTheme] = useState<Theme>('system');
  const [reportsPeriod, setReportsPeriod] = useState<Period>(30);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [useFirebase, setUseFirebase] = useState<boolean>(true);
  const [allowUserRegistration, setAllowUserRegistration] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showClearDBModal, setShowClearDBModal] = useState(false);
  const [clearingDB, setClearingDB] = useState(false);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [migrationStats, setMigrationStats] = useState<{ inserted: number; updated: number; skipped: number; total: number } | null>(null);

  useEffect(() => {
    try {
      const t = (localStorage.getItem('pref.theme') as Theme) || 'system';
      const p = Number(localStorage.getItem('pref.reportsPeriod')) as Period;
      setTheme(t);
      setReportsPeriod([7, 30, 90, 0].includes(p) ? p : 30);
      setNotifEnabled(localStorage.getItem('pref.notifications') === 'on');
      // aplica tema ao carregar
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', t);
      }

      // Fetch storage config
      fetch('/api/config/storage')
        .then(res => res.json())
        .then(data => {
          if (typeof data.useFirebase === 'boolean') {
            setUseFirebase(data.useFirebase);
          }
        });

      // Fetch feature flags
      fetch('/api/features')
        .then(res => res.json())
        .then(data => {
          if (typeof data.allowUserRegistration === 'boolean') {
            setAllowUserRegistration(data.allowUserRegistration);
          }
        });

    } catch {}
  }, []);

  const applyTheme = (value: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = value;
    }
  };

  const requestNotifPermission = async () => {
    try {
      if (!('Notification' in window)) {
        setToast({ type: 'error', message: 'Navegador não suporta notificações' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotifEnabled(true);
        setToast({ type: 'success', message: 'Notificações ativadas com sucesso!' });
      } else if (perm === 'denied') {
        setNotifEnabled(false);
        setToast({ type: 'error', message: 'Permissão de notificações negada' });
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Falha ao solicitar permissão' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      // Save local preferences
      localStorage.setItem('pref.theme', theme);
      localStorage.setItem('pref.reportsPeriod', String(reportsPeriod));
      localStorage.setItem('pref.notifications', notifEnabled ? 'on' : 'off');
      applyTheme(theme);

      // Save storage config
      await fetch('/api/config/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useFirebase }),
      });

      // Save feature flags
      await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowUserRegistration }),
      });

      setToast({ type: 'success', message: 'Preferências salvas com sucesso!' });
    } catch (e) {
      setToast({ type: 'error', message: 'Falha ao salvar preferências. Tente novamente.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const resetDefaults = () => {
    setTheme('system');
    setReportsPeriod(30);
    setNotifEnabled(false);
    setUseFirebase(true);
    setAllowUserRegistration(false);
    setToast({ type: 'success', message: 'Configurações restauradas para o padrão' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleClearDatabase = async () => {
    if (!firebaseUser) {
      setToast({ type: 'error', message: 'Você precisa estar autenticado.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setClearingDB(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/database/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao limpar o banco de dados.');
      }
      setToast({ type: 'success', message: 'Banco de dados limpo com sucesso! A página será recarregada.' });
      setShowClearDBModal(false);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setClearingDB(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleMigrateProducts = async () => {
    if (!firebaseUser) {
      setToast({ type: 'error', message: 'Faça login para executar a migração.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setMigrationRunning(true);
    setMigrationMessage(null);
    setMigrationStats(null);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/migrate/produtos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao migrar produtos.');
      }

      setMigrationStats(data.stats || null);
      const successMessage = data.message || 'Migração concluída com sucesso!';
      setMigrationMessage(successMessage);
      setToast({ type: 'success', message: successMessage });
    } catch (error: any) {
      const message = error?.message || 'Falha ao migrar produtos.';
      setMigrationMessage(message);
      setToast({ type: 'error', message });
    } finally {
      setMigrationRunning(false);
      setTimeout(() => setToast(null), 3200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 border-2 animate-in slide-in-from-bottom-5 ${
          toast.type === 'success'
            ? 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] border-[#3B9797]/30'
            : 'bg-gradient-to-r from-[#BF092F] to-[#a50728] border-[#BF092F]/30'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#1F53A2] via-[#2E67C3] to-[#5C94CC] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <SettingsIcon className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Configurações
                  </h1>
                  <p className="text-[#E3EFFF] text-base font-medium mt-2">
                    Personalize o sistema de acordo com suas preferências
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={resetDefaults}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
                >
                  <RotateCcw className="w-5 h-5" />
                  Restaurar Padrões
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-white text-[#1F53A2] px-5 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 -mt-6">
        <div className="space-y-6">

          {/* Armazenamento de Dados */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Armazenamento de Dados</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-xl shadow-lg">
                    <Server className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-[#212121] font-bold text-lg">Fonte de Dados</div>
                    <div className="text-[#757575] text-sm font-medium mt-1">
                      Modo atual: <span className={`font-bold ${useFirebase ? 'text-[#3B9797]' : 'text-amber-500'}`}>
                        {useFirebase ? 'Produção (Firebase)' : 'Desenvolvimento (Local)'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setUseFirebase(v => !v)}
                  className={`relative inline-flex h-10 w-20 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 shadow-lg ${
                    useFirebase ? 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] focus:ring-[#3B9797]/30' : 'bg-gradient-to-r from-[#BFC7C9] to-[#9E9E9E] focus:ring-[#BFC7C9]/30'
                  }`}
                >
                  <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                    useFirebase ? 'translate-x-11' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="mt-4 p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                <p className="text-sm text-[#757575] leading-relaxed">
                  <strong className="text-[#16476A]">Informação:</strong> Alterne entre o banco de dados em nuvem (Firebase) e o banco de dados local (MongoDB). Esta configuração afeta onde os dados são armazenados e recuperados.
                </p>
              </div>
            </div>
          </div>

          {/* Migração Firestore ➜ Supabase */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] px-6 py-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Migração Firestore</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#757575]">
                Sincroniza a coleção <strong>produtos</strong> do Firestore com a tabela <strong>produtos</strong> do Supabase. Os campos de comprador e fornecedor são atualizados com os valores que já existem no Firestore.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={handleMigrateProducts}
                  disabled={migrationRunning}
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-2 ${
                    migrationRunning
                      ? 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] text-white opacity-80 cursor-wait'
                      : 'bg-gradient-to-r from-[#16476A] to-[#1F53A2] text-white hover:shadow-xl focus:ring-[#1F53A2]/30'
                  }`}
                >
                  <RefreshCw className={`w-5 h-5 ${migrationRunning ? 'animate-spin' : ''}`} />
                  {migrationRunning ? 'Migrando...' : 'Migrar agora'}
                </button>
                <p className="text-xs text-[#757575] max-w-md">
                  Use este botão apenas quando precisar reaplicar os dados do Firestore no Supabase (ex.: para preencher campos de comprador). A operação é idempotente e pode ser repetida quantas vezes precisar.
                </p>
              </div>
              {migrationMessage && (
                <div className="text-sm text-[#1F53A2] font-medium">
                  {migrationMessage}
                </div>
              )}
              {migrationStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#1F53A2]">
                  <div className="px-3 py-2 rounded-xl bg-[#F3FAFF] border border-[#1F53A2]/20">
                    <div className="text-[10px] uppercase tracking-wide">Total lidos</div>
                    <div className="text-base font-bold">{migrationStats.total}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[#F3FAFF] border border-[#1F53A2]/20">
                    <div className="text-[10px] uppercase tracking-wide">Inseridos</div>
                    <div className="text-base font-bold">{migrationStats.inserted}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[#F3FAFF] border border-[#1F53A2]/20">
                    <div className="text-[10px] uppercase tracking-wide">Atualizados</div>
                    <div className="text-base font-bold">{migrationStats.updated}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[#F3FAFF] border border-[#1F53A2]/20">
                    <div className="text-[10px] uppercase tracking-wide">Ignorados</div>
                    <div className="text-base font-bold">{migrationStats.skipped}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tema */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <div className="flex items-center gap-3">
                <Sun className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Aparência do Sistema</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => { setTheme('system'); applyTheme('system'); }}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                    theme === 'system'
                      ? 'border-[#16476A] bg-blue-100 shadow-lg'
                      : 'border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div className={`p-4 rounded-xl ${theme === 'system' ? 'bg-gradient-to-br from-[#16476A] to-[#132440]' : 'bg-[#F5F5F5]'}`}>
                    <Monitor className={`w-8 h-8 ${theme === 'system' ? 'text-white' : 'text-[#757575]'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${theme === 'system' ? 'text-[#16476A]' : 'text-[#212121]'}`}>Sistema</p>
                    <p className="text-xs text-[#757575] mt-1">Usar tema do sistema</p>
                  </div>
                </button>

                <button
                  onClick={() => { setTheme('light'); applyTheme('light'); }}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-100 shadow-lg'
                      : 'border-[#E0E0E0] hover:border-amber-500 hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-[#F5F5F5]'}`}>
                    <Sun className={`w-8 h-8 ${theme === 'light' ? 'text-white' : 'text-[#757575]'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${theme === 'light' ? 'text-amber-500' : 'text-[#212121]'}`}>Claro</p>
                    <p className="text-xs text-[#757575] mt-1">Tema claro</p>
                  </div>
                </button>

                <button
                  onClick={() => { setTheme('dark'); applyTheme('dark'); }}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                    theme === 'dark'
                      ? 'border-[#132440] bg-gray-200 shadow-lg'
                      : 'border-[#E0E0E0] hover:border-[#132440] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gradient-to-br from-[#132440] to-[#16476A]' : 'bg-[#F5F5F5]'}`}>
                    <Moon className={`w-8 h-8 ${theme === 'dark' ? 'text-white' : 'text-[#757575]'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${theme === 'dark' ? 'text-[#132440]' : 'text-[#212121]'}`}>Escuro</p>
                    <p className="text-xs text-[#757575] mt-1">Tema escuro</p>
                  </div>
                </button>
              </div>
              <div className="mt-4 p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                <p className="text-sm text-[#757575]">
                  <strong className="text-[#16476A]">Nota:</strong> A preferência de tema é salva localmente no seu navegador.
                </p>
              </div>
            </div>
          </div>

          {/* Relatórios */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] px-6 py-4">
              <div className="flex items-center gap-3">
                <SettingsIcon className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Configurações de Relatórios</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-[#757575] mb-3">Período Padrão dos Relatórios</label>
                <div className="inline-flex rounded-xl border-2 border-[#E0E0E0] overflow-hidden shadow-md">
                  {[7, 30, 90, 0].map((p) => (
                    <button
                      key={p}
                      onClick={() => setReportsPeriod(p as Period)}
                      className={`px-6 py-3 text-sm font-bold transition-all duration-300 ${
                        reportsPeriod === (p as Period)
                          ? 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] text-white shadow-lg'
                          : 'text-[#212121] hover:bg-[#F5F5F5]'
                      }`}
                    >
                      {p === 0 ? 'Tudo' : `${p} dias`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                <p className="text-sm text-[#757575]">
                  <strong className="text-[#3B9797]">Informação:</strong> Define o período padrão que será usado ao gerar relatórios no sistema.
                </p>
              </div>
            </div>
          </div>

          {/* Controle de Acesso ao Mobile */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Controle de Acesso (Mobile)</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-[#212121] font-bold text-lg">Permitir "Criar Nova Conta"</div>
                    <div className="text-[#757575] text-sm font-medium mt-1">
                      Status: <span className={`font-bold ${allowUserRegistration ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                        {allowUserRegistration ? 'Botão ativo no app mobile' : 'Botão desabilitado no app mobile'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAllowUserRegistration(v => !v)}
                  className={`relative inline-flex h-10 w-20 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 shadow-lg ${
                    allowUserRegistration
                      ? 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] focus:ring-[#3B9797]/30'
                      : 'bg-gradient-to-r from-[#BF092F] to-[#a50728] focus:ring-[#BF092F]/30'
                  }`}
                >
                  <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                    allowUserRegistration ? 'translate-x-11' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="mt-4 p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-2 border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#757575] leading-relaxed">
                    <strong className="text-amber-500">Atenção:</strong> Quando desabilitado, usuários do app mobile NÃO poderão criar novas contas. Apenas administradores poderão cadastrar usuários pelo painel web.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notificações */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Notificações do Navegador</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#16476A] to-[#132440] rounded-xl shadow-lg">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-[#212121] font-bold text-lg">Permitir notificações do navegador</div>
                    <div className="text-[#757575] text-sm font-medium mt-1">
                      Status: <span className={`font-bold ${notifEnabled ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                        {notifEnabled ? 'Ativadas' : 'Desativadas'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={requestNotifPermission}
                    className="px-5 py-2.5 rounded-xl border-2 border-[#16476A] text-[#16476A] bg-white hover:bg-blue-100 font-bold transition-all duration-300 hover:scale-105"
                  >
                    Solicitar Permissão
                  </button>
                  <button
                    onClick={() => setNotifEnabled(v => !v)}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-all duration-300 hover:scale-105 ${
                      notifEnabled
                        ? 'bg-gradient-to-r from-[#BF092F] to-[#a50728] text-white hover:from-[#a50728] hover:to-[#BF092F]'
                        : 'bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] text-white hover:from-[#2c7a7a] hover:to-[#3B9797]'
                    }`}
                  >
                    {notifEnabled ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Zona de Perigo */}
          {user?.role === 'developer' && (
            <div className="bg-white rounded-2xl border-4 border-[#BF092F]/50 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#BF092F] to-[#a50728] px-6 py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Zona de Perigo</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between p-6 rounded-2xl border-2 border-[#BF092F]/50 bg-gradient-to-br from-red-50 to-red-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#BF092F] to-[#a50728] rounded-xl shadow-lg">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-[#212121] font-bold text-lg">Limpar Banco de Dados</div>
                      <div className="text-[#BF092F] text-sm font-medium mt-1">
                        Esta ação é <strong>irreversível</strong> e irá apagar todos os dados permanentemente.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowClearDBModal(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#BF092F] to-[#a50728] text-white font-bold shadow-lg hover:from-[#a50728] hover:to-[#BF092F] transition-all duration-300 hover:scale-105"
                  >
                    Limpar Banco
                  </button>
                </div>
                <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 leading-relaxed font-medium">
                      <strong>AVISO CRÍTICO:</strong> Esta ação removerá permanentemente todas as solicitações, usuários, lojas, produtos e configurações do sistema. Use apenas para ambiente de desenvolvimento!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showClearDBModal && (
        <ClearDBModal
          onClose={() => setShowClearDBModal(false)}
          onConfirm={handleClearDatabase}
          loading={clearingDB}
        />
      )}
    </div>
  );
}
