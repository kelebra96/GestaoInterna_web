'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { ChecklistType, Frequency, QuestionType, ChecklistQuestion } from '@/lib/types/checklist';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
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

const questionTypeLabels: Record<QuestionType, string> = {
  yes_no: 'Sim/Não',
  multiple_choice: 'Múltipla Escolha',
  numeric: 'Numérico',
  text: 'Texto Livre',
  photo: 'Foto Obrigatória',
  temperature: 'Temperatura',
  signature: 'Assinatura',
};

export default function NewChecklistTemplatePage() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Dados do template
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChecklistType>('custom');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [requiresGPS, setRequiresGPS] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [questions, setQuestions] = useState<Partial<ChecklistQuestion>[]>([
    {
      id: `q_${Date.now()}_0`,
      order: 0,
      question: '',
      type: 'yes_no',
      required: true,
    },
  ]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const response = await fetch('/api/companies', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setCompanies(data.companies || []);
        } else {
          console.error('Falha ao carregar empresas');
        }
      } catch (error) {
        console.error('Erro ao carregar empresas:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (user?.companyId) {
      setCompanyId(user.companyId);
      return;
    }

    if (!companyId && companies.length === 1) {
      setCompanyId(companies[0].id);
    }
  }, [user, companies, companyId]);

  const availableCompanies =
    user?.companyId && !companies.some((c) => c.id === user.companyId)
      ? [{ id: user.companyId, name: user.companyId }, ...companies]
      : companies;

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q_${Date.now()}_${questions.length}`,
        order: questions.length,
        question: '',
        type: 'yes_no',
        required: true,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      alert('O template deve ter pelo menos uma pergunta');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // Resetar campos específicos ao mudar o tipo
    if (field === 'type') {
      if (value === 'multiple_choice') {
        updated[index].options = ['Opção 1', 'Opção 2'];
      } else {
        delete updated[index].options;
      }

      if (value === 'temperature' || value === 'numeric') {
        updated[index].unit = value === 'temperature' ? '°C' : '';
      } else {
        delete updated[index].minValue;
        delete updated[index].maxValue;
        delete updated[index].unit;
      }
    }

    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const options = updated[questionIndex].options || [];
    updated[questionIndex].options = [...options, `Opção ${options.length + 1}`];
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const options = updated[questionIndex].options || [];
    if (options.length <= 2) {
      alert('Deve haver pelo menos 2 opções');
      return;
    }
    updated[questionIndex].options = options.filter((_, i) => i !== optionIndex);
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions];
    const options = [...(updated[questionIndex].options || [])];
    options[optionIndex] = value;
    updated[questionIndex].options = options;
    setQuestions(updated);
  };

  const handleSave = async () => {
    // Validações
    if (loadingCompanies) {
      setToast({ type: 'error', message: 'Aguarde carregar empresas antes de salvar' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!companyId) {
      setToast({ type: 'error', message: 'Selecione a empresa do template' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const createdBy = firebaseUser?.uid || user?.uid;
    if (!createdBy) {
      setToast({ type: 'error', message: 'Não foi possível identificar o usuário' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!name.trim()) {
      setToast({ type: 'error', message: 'Nome do template é obrigatório' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (questions.some((q) => !q.question?.trim())) {
      setToast({ type: 'error', message: 'Todas as perguntas devem ter texto' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const sanitize = <T extends Record<string, any>>(obj: T): T =>
      Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;

    try {
      setSaving(true);

      const sanitizedQuestions = questions.map((q, index) =>
        sanitize({
          ...q,
          order: index,
          options: q.options || [],
        })
      );

      const payload = {
        name,
        description,
        type,
        frequency,
        companyId,
        estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : 0,
        requiresGPS,
        requiresSignature,
        allowOfflineExecution: true,
        questions: sanitizedQuestions,
        createdBy,
      };

      const response = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao criar template');
      }

      setToast({ type: 'success', message: 'Template criado com sucesso!' });
      setTimeout(() => {
        router.push('/checklists/templates');
      }, 1500);
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Erro ao criar template' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toast && (
          <div
            className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-md text-white ${
              toast.type === 'success' ? 'bg-[#3B9797]' : 'bg-[#BF092F]'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-white border border-[#E0E0E0]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">Novo Template</h1>
              <p className="text-[#757575] mt-1">Crie um modelo de checklist operacional</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loadingCompanies}
            className="inline-flex items-center gap-2 bg-[#3B9797] hover:bg-[#16476A] text-white px-4 py-2 rounded-lg font-semibold shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>

        {/* Informações Básicas */}
        <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6 mb-6">
          <h2 className="text-lg font-bold text-[#212121] mb-4">Informações Básicas</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#212121] mb-1">Empresa *</label>
              {loadingCompanies ? (
                <div className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg bg-[#F5F5F5] text-[#757575]">
                  Carregando empresas...
                </div>
              ) : availableCompanies.length === 0 ? (
                <div className="w-full px-3 py-2 border border-[#BF092F] bg-[#E9ECEF] rounded-lg text-[#BF092F]">
                  Nenhuma empresa encontrada. Cadastre uma empresa antes de criar o template.
                </div>
              ) : (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                  disabled={!!user?.companyId}
                >
                  <option value="">Selecione uma empresa</option>
                  {availableCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              )}
              {user?.companyId && (
                <p className="text-xs text-[#757575] mt-1">Empresa vinculada ao seu acesso</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#212121] mb-1">
                Nome do Template *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Checklist de Abertura - Padaria"
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#212121] mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste checklist"
                rows={3}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">Tipo *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ChecklistType)}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">
                  Frequência *
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                >
                  {Object.entries(frequencyLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212121] mb-1">
                  Duração Estimada (min)
                </label>
                <input
                  type="number"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  placeholder="30"
                  min="0"
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresGPS}
                  onChange={(e) => setRequiresGPS(e.target.checked)}
                  className="w-4 h-4 text-[#16476A] rounded focus:ring-[#16476A]"
                />
                <span className="text-sm text-[#212121]">Requer GPS</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresSignature}
                  onChange={(e) => setRequiresSignature(e.target.checked)}
                  className="w-4 h-4 text-[#16476A] rounded focus:ring-[#16476A]"
                />
                <span className="text-sm text-[#212121]">Requer Assinatura</span>
              </label>
            </div>
          </div>
        </div>

        {/* Perguntas */}
        <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#212121]">Perguntas ({questions.length})</h2>
            <button
              onClick={addQuestion}
              className="inline-flex items-center gap-2 bg-[#16476A] hover:bg-[#132440] text-white px-3 py-2 rounded-lg text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Adicionar Pergunta
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="border border-[#E0E0E0] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-semibold text-[#16476A]">
                    Pergunta {index + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(index)}
                      className="text-[#BF092F] hover:bg-[#BF092F] hover:text-white p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={question.question || ''}
                      onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                      placeholder="Digite a pergunta"
                      className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={question.type || 'yes_no'}
                      onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                      className="px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16476A]/30"
                    >
                      {Object.entries(questionTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={question.required !== false}
                        onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                        className="w-4 h-4 text-[#16476A] rounded"
                      />
                      <span className="text-sm">Obrigatória</span>
                    </label>
                  </div>

                  {/* Opções para múltipla escolha */}
                  {question.type === 'multiple_choice' && (
                    <div className="bg-[#F5F5F5] p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#757575]">OPÇÕES</span>
                        <button
                          onClick={() => addOption(index)}
                          className="text-xs text-[#16476A] hover:underline"
                        >
                          + Adicionar opção
                        </button>
                      </div>
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, optIndex, e.target.value)}
                            placeholder={`Opção ${optIndex + 1}`}
                            className="flex-1 px-2 py-1 text-sm border border-[#E0E0E0] rounded"
                          />
                          {(question.options?.length || 0) > 2 && (
                            <button
                              onClick={() => removeOption(index, optIndex)}
                              className="text-[#BF092F] p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Limites para numérico/temperatura */}
                  {(question.type === 'numeric' || question.type === 'temperature') && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={question.minValue || ''}
                        onChange={(e) => updateQuestion(index, 'minValue', parseFloat(e.target.value))}
                        placeholder="Min"
                        className="px-2 py-1 text-sm border border-[#E0E0E0] rounded"
                      />
                      <input
                        type="number"
                        value={question.maxValue || ''}
                        onChange={(e) => updateQuestion(index, 'maxValue', parseFloat(e.target.value))}
                        placeholder="Max"
                        className="px-2 py-1 text-sm border border-[#E0E0E0] rounded"
                      />
                      <input
                        type="text"
                        value={question.unit || ''}
                        onChange={(e) => updateQuestion(index, 'unit', e.target.value)}
                        placeholder="Unidade"
                        className="px-2 py-1 text-sm border border-[#E0E0E0] rounded"
                      />
                    </div>
                  )}

                  {/* Configurações de Foto */}
                  <div className="bg-gradient-to-br from-[#E9ECEF] to-white border-2 border-[#BF092F]/20 rounded-lg p-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!(question.allowMultiplePhotos || question.photoRequired)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const updated = [...questions];
                            if (checked) {
                              // Habilitar fotos
                              updated[index] = {
                                ...updated[index],
                                allowMultiplePhotos: true,
                                maxPhotos: 1,
                              };
                            } else {
                              // Desabilitar fotos
                              updated[index] = {
                                ...updated[index],
                                allowMultiplePhotos: false,
                                photoRequired: false,
                                maxPhotos: undefined,
                              };
                            }
                            setQuestions(updated);
                          }}
                          className="w-4 h-4 text-[#BF092F] rounded focus:ring-[#BF092F]"
                        />
                        <span className="text-sm font-semibold text-[#212121]">📷 Permitir anexar foto</span>
                      </label>

                      {(question.allowMultiplePhotos || question.photoRequired) && (
                        <div className="ml-6 space-y-2 border-l-2 border-[#BF092F]/30 pl-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!question.photoRequired}
                              onChange={(e) => updateQuestion(index, 'photoRequired', e.target.checked)}
                              className="w-4 h-4 text-[#BF092F] rounded focus:ring-[#BF092F]"
                            />
                            <span className="text-sm text-[#212121]">Foto obrigatória</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <label className="text-sm text-[#757575] whitespace-nowrap">Máximo de fotos:</label>
                            <input
                              type="number"
                              value={question.maxPhotos || 1}
                              onChange={(e) => updateQuestion(index, 'maxPhotos', parseInt(e.target.value) || 1)}
                              min="1"
                              max="10"
                              className="w-20 px-2 py-1 text-sm border border-[#E0E0E0] rounded focus:outline-none focus:ring-2 focus:ring-[#BF092F]/30"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pontuação e Conformidade */}
                  <div className="bg-gradient-to-br from-[#E0E7EF] to-white border-2 border-[#3B9797]/20 rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-[#212121] mb-1">
                            🎯 Pontuação (opcional)
                          </label>
                          <input
                            type="number"
                            value={question.points || ''}
                            onChange={(e) => updateQuestion(index, 'points', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Ex: 10 pontos"
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 text-sm border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B9797]/30"
                          />
                          <p className="text-xs text-[#757575] mt-1">Quanto vale esta pergunta em pontos</p>
                        </div>
                      </div>

                      <div className="border-t border-[#E0E0E0] pt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!question.isConformityCheck}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateQuestion(index, 'isConformityCheck', checked);
                              if (!checked) {
                                updateQuestion(index, 'conformityExpectedAnswer', undefined);
                              }
                            }}
                            className="w-4 h-4 text-[#3B9797] rounded focus:ring-[#3B9797]"
                          />
                          <span className="text-sm font-semibold text-[#212121]">✅ Verificação de Conformidade</span>
                        </label>
                        <p className="text-xs text-[#757575] ml-6 mt-1">
                          Marque se esta pergunta avalia conformidade da loja
                        </p>

                        {question.isConformityCheck && (
                          <div className="ml-6 mt-3 p-3 bg-white border border-[#E0E0E0] rounded-lg">
                            <label className="block text-xs font-semibold text-[#757575] mb-2 uppercase">
                              Resposta esperada para CONFORMIDADE
                            </label>

                            {question.type === 'yes_no' && (
                              <select
                                value={question.conformityExpectedAnswer || 'yes'}
                                onChange={(e) => updateQuestion(index, 'conformityExpectedAnswer', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-[#E0E0E0] rounded focus:outline-none focus:ring-2 focus:ring-[#3B9797]/30"
                              >
                                <option value="yes">Sim (Conforme quando Sim)</option>
                                <option value="no">Não (Conforme quando Não)</option>
                              </select>
                            )}

                            {question.type === 'multiple_choice' && question.options && (
                              <select
                                value={question.conformityExpectedAnswer || question.options[0]}
                                onChange={(e) => updateQuestion(index, 'conformityExpectedAnswer', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-[#E0E0E0] rounded focus:outline-none focus:ring-2 focus:ring-[#3B9797]/30"
                              >
                                {question.options.map((opt, optIdx) => (
                                  <option key={optIdx} value={opt}>
                                    {opt} (Conforme quando esta opção)
                                  </option>
                                ))}
                              </select>
                            )}

                            {(question.type === 'numeric' || question.type === 'temperature') && (
                              <div className="space-y-2">
                                <p className="text-xs text-[#757575]">
                                  Conforme quando valor está dentro dos limites (min/max)
                                </p>
                                {(!question.minValue && !question.maxValue) && (
                                  <p className="text-xs text-[#BF092F]">
                                    ⚠️ Configure os limites Min/Max acima
                                  </p>
                                )}
                              </div>
                            )}

                            {(question.type === 'text' || question.type === 'photo' || question.type === 'signature') && (
                              <p className="text-xs text-[#757575]">
                                Conforme quando campo está preenchido
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-[#E0E0E0] text-[#212121] rounded-lg hover:bg-[#F5F5F5] font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingCompanies}
            className="inline-flex items-center gap-2 bg-[#3B9797] hover:bg-[#16476A] text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
