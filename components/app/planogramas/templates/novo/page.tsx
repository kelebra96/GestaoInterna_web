'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
}

export default function NewPlanogramTemplatePage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Dados básicos
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'normal' | 'promocional' | 'sazonal' | 'evento'>('normal');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('30');

  // Buscar empresas
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!firebaseUser) {
        return;
      }

      try {
        const token = await firebaseUser.getIdToken(true);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch('/api/empresas', { cache: 'no-store', headers });
        if (response.ok) {
          const data = await response.json();
          const companiesList = data.companies || data.empresas || [];
          setCompanies(companiesList);

          // Se houver apenas uma empresa, selecionar automaticamente
          if (companiesList.length === 1) {
            setCompanyId(companiesList[0].id);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error);
      } finally {
        setLoading(false);
      }
    };

    if (firebaseUser) {
      fetchCompanies();
    }
  }, [firebaseUser]);

  // Módulos da gôndola
  const [modules, setModules] = useState<any[]>([
    {
      id: `module_${Date.now()}`,
      name: 'Módulo 1',
      order: 1,
      width: 90,
      height: 180,
      depth: 40,
      corridor: '',
      shelves: [
        { id: `shelf_1`, level: 1, height: 30, depth: 40, width: 90, eyeLevel: false },
        { id: `shelf_2`, level: 2, height: 30, depth: 40, width: 90, eyeLevel: false },
        { id: `shelf_3`, level: 3, height: 30, depth: 40, width: 90, eyeLevel: true },
        { id: `shelf_4`, level: 4, height: 30, depth: 40, width: 90, eyeLevel: false },
      ],
    },
  ]);

  const handleAddModule = () => {
    const newModule = {
      id: `module_${Date.now()}`,
      name: `Módulo ${modules.length + 1}`,
      order: modules.length + 1,
      width: 90,
      height: 180,
      depth: 40,
      corridor: '',
      shelves: [
        { id: `shelf_${Date.now()}_1`, level: 1, height: 30, depth: 40, width: 90, eyeLevel: false },
        { id: `shelf_${Date.now()}_2`, level: 2, height: 30, depth: 40, width: 90, eyeLevel: false },
        { id: `shelf_${Date.now()}_3`, level: 3, height: 30, depth: 40, width: 90, eyeLevel: true },
        { id: `shelf_${Date.now()}_4`, level: 4, height: 30, depth: 40, width: 90, eyeLevel: false },
      ],
    };

    setModules([...modules, newModule]);
  };

  const handleRemoveModule = (moduleId: string) => {
    if (modules.length === 1) {
      alert('É necessário ter pelo menos um módulo');
      return;
    }
    setModules(modules.filter((m) => m.id !== moduleId));
  };

  const handleUpdateModule = (moduleId: string, field: string, value: any) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId) {
          return { ...m, [field]: value };
        }
        return m;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!companyId) {
      alert('Selecione uma empresa');
      return;
    }

    if (!name.trim()) {
      alert('O nome do template é obrigatório');
      return;
    }

    if (!category.trim()) {
      alert('A categoria é obrigatória');
      return;
    }

    if (modules.length === 0) {
      alert('É necessário ter pelo menos um módulo');
      return;
    }

    try {
      setSaving(true);

      // Obter token de autenticação do Firebase
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const token = await firebaseUser.getIdToken();

      // Preparar dados
      const templateData = {
        name: name.trim(),
        description: description.trim(),
        type,
        category: category.trim(),
        subcategory: subcategory.trim(),
        modules,
        slots: [], // Inicialmente vazio - produtos serão adicionados depois
        estimatedDuration: parseInt(estimatedDuration) || 30,
        requiresPhoto: true,
        requiresSignature: false,
        createdBy: firebaseUser.uid,
        createdByName: firebaseUser.displayName || firebaseUser.email || 'Administrador Web',
        orgId: companyId, // Usar orgId em vez de companyId
      };

      const response = await fetch('/api/planograms/base', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao criar template');
      }

      const data = await response.json();

      alert('Template criado com sucesso!');
      router.push(`/planogramas/templates`);
    } catch (error: any) {
      console.error('Erro ao criar template:', error);
      alert(error.message || 'Erro ao criar template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push('/planogramas/templates')}
              className="text-[#1F53A2] hover:text-[#153D7A]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">Novo Template de Planograma</h1>
          </div>
          <p className="text-[#757575] mt-1">Crie um novo modelo base de planograma</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Informações Básicas */}
          <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6 mb-6">
            <h2 className="text-lg font-bold text-[#212121] mb-4">Informações Básicas</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Empresa *
                </label>
                {loading ? (
                  <div className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg bg-[#F5F5F5] text-[#757575]">
                    Carregando empresas...
                  </div>
                ) : companies.length === 0 ? (
                  <div className="w-full px-4 py-2 border border-[#E82129] bg-[#FFEBEE] rounded-lg text-[#E82129]">
                    Nenhuma empresa encontrada. Por favor, cadastre uma empresa primeiro.
                  </div>
                ) : (
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                    required
                    disabled={companies.length === 1}
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  placeholder="Ex: Planograma Bebidas - Gôndola Central"
                  required
                  disabled={loading || companies.length === 0}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#212121] mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  rows={3}
                  placeholder="Descreva o planograma..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">Tipo *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  required
                >
                  <option value="normal">Normal</option>
                  <option value="promocional">Promocional</option>
                  <option value="sazonal">Sazonal</option>
                  <option value="evento">Evento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Duração Estimada (min)
                </label>
                <input
                  type="number"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">Categoria *</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  placeholder="Ex: Bebidas, Laticínios, Higiene..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-2">Subcategoria</label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                  placeholder="Ex: Refrigerantes, Sucos..."
                />
              </div>
            </div>
          </div>

          {/* Módulos da Gôndola */}
          <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#212121]">Módulos da Gôndola</h2>
              <button
                type="button"
                onClick={handleAddModule}
                className="inline-flex items-center gap-2 bg-[#4CAF50] hover:bg-[#388E3C] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              >
                <Plus className="w-4 h-4" />
                Adicionar Módulo
              </button>
            </div>

            <div className="space-y-4">
              {modules.map((module, index) => (
                <div
                  key={module.id}
                  className="border border-[#E0E0E0] rounded-lg p-4 bg-[#F5F5F5]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-[#212121]">Módulo {index + 1}</h3>
                    {modules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(module.id)}
                        className="text-[#E82129] hover:text-[#C62828]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Nome do Módulo
                      </label>
                      <input
                        type="text"
                        value={module.name}
                        onChange={(e) => handleUpdateModule(module.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        placeholder="Ex: Módulo Central"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Corredor/Seção
                      </label>
                      <input
                        type="text"
                        value={module.corridor}
                        onChange={(e) => handleUpdateModule(module.id, 'corridor', e.target.value)}
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        placeholder="Ex: Corredor 3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Ordem
                      </label>
                      <input
                        type="number"
                        value={module.order}
                        onChange={(e) =>
                          handleUpdateModule(module.id, 'order', parseInt(e.target.value) || 1)
                        }
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Largura (cm)
                      </label>
                      <input
                        type="number"
                        value={module.width}
                        onChange={(e) =>
                          handleUpdateModule(module.id, 'width', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Altura (cm)
                      </label>
                      <input
                        type="number"
                        value={module.height}
                        onChange={(e) =>
                          handleUpdateModule(module.id, 'height', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#212121] mb-2">
                        Profundidade (cm)
                      </label>
                      <input
                        type="number"
                        value={module.depth}
                        onChange={(e) =>
                          handleUpdateModule(module.id, 'depth', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 bg-white"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-[#757575]">
                    {module.shelves.length} prateleira(s) configurada(s)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nota informativa */}
          <div className="bg-[#E3F2FD] border-l-4 border-[#2196F3] rounded-lg p-4 mb-6">
            <p className="text-sm text-[#1976D2]">
              <strong>Nota:</strong> Após criar o template base, você poderá adicionar produtos e
              definir suas posições nas prateleiras através do editor visual de planograma.
            </p>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/planogramas/templates')}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white border-2 border-[#E0E0E0] text-[#212121] hover:bg-[#F5F5F5] px-6 py-3 rounded-lg font-semibold transition-all"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#4CAF50] hover:bg-[#388E3C] text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-50"
              disabled={saving || loading || companies.length === 0}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Criar Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
