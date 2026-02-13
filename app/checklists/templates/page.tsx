'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Plus, Edit, Trash2, Copy, Calendar, CheckSquare, Users, X } from 'lucide-react';
import { ChecklistTemplate, ChecklistType, Frequency } from '@/lib/types/checklist';
import { useAuth } from '@/contexts/AuthContext';

interface Usuario {
  id: string;
  displayName: string;
  email: string;
  role: string;
  active: boolean;
}

const typeLabels: Record<ChecklistType, string> = {
  opening: 'Abertura',
  closing: 'Fechamento',
  haccp: 'HACCP',
  cleaning: 'Limpeza',
  merchandising: 'Merchandising',
  maintenance: 'Manutenção',
  audit: 'Auditoria',
  custom: 'Personalizado',
};

const frequencyLabels: Record<Frequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  per_shift: 'Por Turno',
  on_demand: 'Sob Demanda',
};

export default function ChecklistTemplatesPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChecklistType | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados para gerenciar acesso de usuários
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (activeFilter !== 'all') {
        params.append('active', activeFilter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/checklist-templates?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Falha ao carregar templates');

      const data = await response.json();
      setTemplates(data.templates || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      console.log('[Templates] Buscando usuários...');

      // Pegar token do Firebase
      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/usuarios', {
        cache: 'no-store',
        headers
      });

      if (!response.ok) {
        console.error('[Templates] Erro na resposta:', response.status, response.statusText);
        throw new Error('Falha ao carregar usuários');
      }

      const data = await response.json();
      console.log('[Templates] Usuários carregados:', data.usuarios?.length || 0);
      console.log('[Templates] Usuários ativos:', data.usuarios?.filter((u: Usuario) => u.active).length || 0);
      console.log('[Templates] Sample:', data.usuarios?.slice(0, 3));

      setUsuarios(data.usuarios || []);
    } catch (e: any) {
      console.error('[Templates] Erro ao carregar usuários:', e);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchTemplates();
      fetchUsuarios();
    }
  }, [activeFilter, firebaseUser]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente desativar o template "${name}"?`)) return;

    try {
      const response = await fetch(`/api/checklist-templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Falha ao desativar template');

      setToast({ type: 'success', message: 'Template desativado com sucesso' });
      fetchTemplates();
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao desativar template' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleToggleActive = async (template: ChecklistTemplate) => {
    try {
      const response = await fetch(`/api/checklist-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !template.active }),
      });

      if (!response.ok) throw new Error('Falha ao atualizar template');

      setToast({
        type: 'success',
        message: template.active ? 'Template desativado' : 'Template ativado',
      });
      fetchTemplates();
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar template' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleOpenAccessModal = (template: ChecklistTemplate) => {
    console.log('[Templates] Abrindo modal de acesso');
    console.log('[Templates] Template:', template.name);
    console.log('[Templates] Total de usuários:', usuarios.length);
    console.log('[Templates] Usuários ativos:', usuarios.filter(u => u.active).length);
    console.log('[Templates] allowedUserIds atual:', template.allowedUserIds);

    setSelectedTemplate(template);
    setSelectedUserIds(template.allowedUserIds || []);
    setShowAccessModal(true);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSaveAccess = async () => {
    if (!selectedTemplate) return;

    try {
      setSavingAccess(true);

      const response = await fetch(`/api/checklist-templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedUserIds: selectedUserIds }),
      });

      if (!response.ok) throw new Error('Falha ao atualizar acesso');

      setToast({ type: 'success', message: 'Acesso atualizado com sucesso' });
      setShowAccessModal(false);
      fetchTemplates();
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar acesso' });
    } finally {
      setSavingAccess(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || template.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Toast de Notificação - Redesenhado */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div
            className={`px-6 py-4 rounded-xl shadow-2xl text-white border-2 ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A] border-[#3B9797]'
                : 'bg-gradient-to-r from-[#BF092F] to-[#BF092F] border-[#BF092F]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                {toast.type === 'success' ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <span className="font-semibold">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header com gradiente e padrão */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <CheckSquare className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Templates de Checklist
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Gerencie modelos de checklist operacional personalizados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/checklists/templates/novo')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/20 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Novo Template
              </button>
              <button
                onClick={fetchTemplates}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Filtros - Redesenhados */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                <Search className="w-5 h-5 text-[#16476A]" />
              </div>
              <h2 className="text-lg font-bold text-[#212121]">Filtros e Busca</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <label className="block text-sm font-bold text-[#212121] mb-2">Buscar Templates</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nome ou descrição..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Tipo de Checklist</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] transition-all hover:border-[#3B9797] font-semibold"
                >
                  <option value="all">Todos os tipos</option>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2">Status</label>
                <div className="flex gap-2">
                  {(['all', 'active', 'inactive'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 ${
                        activeFilter === filter
                          ? 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white border-[#16476A] shadow-lg scale-105'
                          : 'bg-white text-[#212121] border-[#E0E0E0] hover:bg-[#E0E7EF] hover:border-[#3B9797]/30'
                      }`}
                    >
                      {filter === 'all' ? 'Todos' : filter === 'active' ? 'Ativos' : 'Inativos'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Templates - Estados Redesenhados */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-full mb-6">
              <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando Templates</h3>
            <p className="text-[#757575]">Aguarde enquanto buscamos os dados...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#BF092F]">
            <div className="bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] px-6 py-5 border-b border-[#BF092F]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#BF092F] rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#BF092F]">Erro ao Carregar</h3>
                  <p className="text-[#BF092F]/80 text-sm">Não foi possível buscar os templates</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#757575] mb-4">{error}</p>
              <button
                onClick={fetchTemplates}
                className="px-5 py-2.5 bg-[#BF092F] text-white rounded-xl font-semibold hover:bg-[#BF092F] transition-all inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="w-24 h-24 bg-gradient-to-br from-[#F5F5F5] to-[#E0E0E0] rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckSquare className="w-12 h-12 text-[#757575]" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">
              {searchQuery || typeFilter !== 'all' ? 'Nenhum Template Encontrado' : 'Nenhum Template Cadastrado'}
            </h3>
            <p className="text-[#757575] mb-6">
              {searchQuery || typeFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando seu primeiro template de checklist'}
            </p>
            {(searchQuery || typeFilter !== 'all') ? (
              <button
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
                className="px-5 py-2.5 bg-[#16476A] text-white rounded-xl font-semibold hover:bg-[#132440] transition-all inline-flex items-center gap-2"
              >
                Limpar Filtros
              </button>
            ) : (
              <button
                onClick={() => router.push('/checklists/templates/novo')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3B9797] to-[#16476A] hover:from-[#16476A] hover:to-[#132440] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`group bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-[#E0E0E0] overflow-hidden transition-all duration-300 hover:-translate-y-2 ${
                  !template.active ? 'opacity-60 hover:opacity-80' : ''
                }`}
              >
                {/* Header do Card com Badge de Status */}
                <div className={`relative h-2 ${template.active ? 'bg-gradient-to-r from-[#3B9797] to-[#16476A]' : 'bg-[#757575]'}`}></div>

                <div className="p-6">
                  {/* Título e Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-2">
                      <h3 className="text-xl font-bold text-[#212121] mb-2 group-hover:text-[#16476A] transition-colors line-clamp-2">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-[#757575] line-clamp-2 leading-relaxed">{template.description}</p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                        template.active
                          ? 'bg-gradient-to-r from-[#E0E7EF] to-[#E0E7EF] text-[#16476A] border border-[#3B9797]/20'
                          : 'bg-gradient-to-r from-[#F5F5F5] to-[#E0E0E0] text-[#757575] border border-[#757575]/20'
                      }`}
                    >
                      {template.active ? '✓ Ativo' : '✗ Inativo'}
                    </span>
                  </div>

                  {/* Informações do Template */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                      <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                        <CheckSquare className="w-4 h-4 text-[#16476A]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#757575] font-semibold uppercase tracking-wide">Tipo</p>
                        <p className="text-sm font-bold text-[#212121]">{typeLabels[template.type]}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                      <div className="p-2 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-lg">
                        <Calendar className="w-4 h-4 text-[#BF092F]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#757575] font-semibold uppercase tracking-wide">Frequência</p>
                        <p className="text-sm font-bold text-[#212121]">{frequencyLabels[template.frequency]}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl border border-[#3B9797]/20">
                        <p className="text-xs text-[#3B9797] font-semibold uppercase tracking-wide mb-1">Perguntas</p>
                        <p className="text-2xl font-bold text-[#3B9797]">{template.questions.length}</p>
                      </div>

                      {template.estimatedDuration && template.estimatedDuration > 0 && (
                        <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl border border-[#BF092F]/20">
                          <p className="text-xs text-[#BF092F] font-semibold uppercase tracking-wide mb-1">Duração</p>
                          <p className="text-xl font-bold text-[#BF092F]">~{template.estimatedDuration}min</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/checklists/templates/${template.id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#16476A] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleOpenAccessModal(template)}
                      className="px-3 py-3 border-2 border-[#BF092F] text-[#BF092F] rounded-xl hover:bg-[#BF092F] hover:text-white text-sm font-bold transition-all duration-300"
                      title="Gerenciar Acesso"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`px-3 py-3 rounded-xl text-sm font-bold border-2 transition-all duration-300 ${
                        template.active
                          ? 'border-[#BF092F] text-[#BF092F] hover:bg-[#BF092F] hover:text-white'
                          : 'border-[#3B9797] text-[#3B9797] hover:bg-[#3B9797] hover:text-white'
                      }`}
                      title={template.active ? 'Desativar' : 'Ativar'}
                    >
                      {template.active ? '⏸' : '▶'}
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      className="px-3 py-3 border-2 border-[#BF092F] text-[#BF092F] rounded-xl hover:bg-[#BF092F] hover:text-white text-sm font-bold transition-all duration-300"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Gerenciar Acesso */}
      {showAccessModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border-2 border-[#E0E0E0]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#BF092F] to-[#BF092F] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Gerenciar Acesso</h2>
                  <p className="text-sm text-white/90 mt-1">{selectedTemplate.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccessModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Descrição */}
            <div className="px-6 py-4 bg-gradient-to-br from-[#E9ECEF] to-white border-b border-[#E0E0E0]">
              <p className="text-sm text-[#757575]">
                {selectedUserIds.length === 0 ? (
                  <span className="font-bold text-[#3B9797]">✓ Todos os usuários têm acesso a este template</span>
                ) : (
                  <span>
                    <span className="font-bold text-[#BF092F]">{selectedUserIds.length}</span> {selectedUserIds.length === 1 ? 'usuário selecionado' : 'usuários selecionados'}
                  </span>
                )}
              </p>
            </div>

            {/* Lista de Usuários */}
            <div className="overflow-y-auto max-h-[50vh] p-6">
              {usuarios.filter(u => u.active).length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-[#757575] mx-auto mb-4 opacity-50" />
                  <p className="text-[#757575]">Nenhum usuário ativo encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {usuarios
                    .filter(u => u.active)
                    .map((usuario) => (
                      <label
                        key={usuario.id}
                        className="flex items-center gap-4 p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border-2 border-[#E0E0E0] hover:border-[#BF092F] cursor-pointer transition-all hover:shadow-md"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(usuario.id)}
                          onChange={() => handleToggleUser(usuario.id)}
                          className="w-5 h-5 text-[#BF092F] border-2 border-[#E0E0E0] rounded focus:ring-2 focus:ring-[#BF092F] cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-[#212121]">{usuario.displayName}</p>
                          <p className="text-sm text-[#757575]">{usuario.email}</p>
                        </div>
                        <span className="px-3 py-1 bg-gradient-to-r from-[#E0E7EF] to-[#E0E7EF] text-[#16476A] text-xs font-bold rounded-full">
                          {usuario.role === 'admin' && 'Admin'}
                          {usuario.role === 'manager' && 'Gerente'}
                          {usuario.role === 'agent' && 'Agente'}
                          {usuario.role === 'buyer' && 'Comprador'}
                          {usuario.role === 'developer' && 'Developer'}
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </div>

            {/* Footer com Botões */}
            <div className="px-6 py-4 bg-gradient-to-br from-[#F8F9FA] to-white border-t-2 border-[#E0E0E0] flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedUserIds([])}
                className="px-4 py-2.5 text-[#757575] hover:text-[#212121] font-semibold transition-all"
              >
                Limpar Seleção
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAccessModal(false)}
                  className="px-5 py-2.5 border-2 border-[#E0E0E0] text-[#757575] rounded-xl font-bold hover:bg-[#F8F9FA] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAccess}
                  disabled={savingAccess}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#BF092F] to-[#BF092F] hover:from-[#BF092F] hover:to-[#BF092F] text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAccess ? 'Salvando...' : 'Salvar Acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
