'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, RefreshCw, Edit, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  type?: string;
  active: boolean;
  createdAt: string;
  questions: Question[];
}

interface Question {
  id: string;
  question: string;
  type: string;
  order: number;
  required?: boolean;
  options?: string[];
  photoRequired?: boolean;
  allowMultiplePhotos?: boolean;
  maxPhotos?: number;
}

export default function TemplateDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const id = params?.id as string;

  const [data, setData] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
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

      const res = await fetch(`/api/checklist-templates/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Template não encontrado');
        }
        throw new Error('Falha ao carregar template');
      }

      const json = await res.json();
      setData(json.template || json);
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
  }, [id, firebaseUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/checklists/templates')}
              className="p-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white hover:border-[#16476A] transition-all duration-300 hover:scale-105 shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-[#212121]">Detalhes do Template</h1>
          </div>
          <Link
            href="/checklists/templates"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F8F9FA] border-2 border-[#E0E0E0] rounded-xl font-bold text-[#16476A] transition-all duration-300 hover:scale-105 shadow-md"
          >
            Ver todos os templates
          </Link>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border-2 border-[#E0E0E0] p-12 text-center shadow-xl">
            <RefreshCw className="w-8 h-8 text-[#16476A] animate-spin inline-block mb-4" />
            <p className="text-lg font-bold text-[#757575]">Carregando template...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border-2 border-[#BF092F] p-8 text-center shadow-xl">
            <AlertCircle className="w-12 h-12 text-[#BF092F] mx-auto mb-4" />
            <p className="text-xl font-bold text-[#BF092F] mb-2">{error}</p>
            <p className="text-sm text-[#757575] mb-6">Ocorreu um erro ao carregar o template</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#132440] hover:to-[#3B9797] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Card Principal */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                      <CheckSquare className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{data.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/checklists/templates/editar/${id}`)}
                      className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 space-y-4">
                {data.description && (
                  <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                    <p className="text-xs font-bold text-[#757575] uppercase mb-1">Descrição</p>
                    <p className="text-base text-[#212121]">{data.description}</p>
                  </div>
                )}

                <div className="p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0]">
                  <p className="text-xs font-bold text-[#757575] uppercase mb-1">Status</p>
                  {data.active ? (
                    <span className="px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border-2 bg-gradient-to-r from-[#3B9797]/10 to-[#16476A]/10 text-[#16476A] border-[#3B9797]/30">
                      ✓ Ativo
                    </span>
                  ) : (
                    <span className="px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border-2 bg-gradient-to-r from-[#BF092F]/10 to-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30">
                      ✕ Inativo
                    </span>
                  )}
                </div>

                <div className="border-t-2 border-[#E0E0E0] pt-4">
                  <div className="text-xs text-[#757575]">
                    <span className="font-bold">Criado em:</span>{' '}
                    {new Date(data.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Perguntas do Checklist */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#3B9797] to-[#16476A] px-6 py-4">
                <h3 className="text-xl font-bold text-white">
                  Perguntas do Checklist ({data.questions?.length || 0})
                </h3>
              </div>

              <div className="p-6">
                {!data.questions || data.questions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="w-12 h-12 text-[#757575] mx-auto mb-4 opacity-50" />
                    <p className="text-[#757575] font-medium">Nenhuma pergunta cadastrada neste template</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.questions
                      .sort((a, b) => a.order - b.order)
                      .map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border border-[#E0E0E0] hover:shadow-md transition-shadow"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-[#212121] mb-1">{question.question}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="px-2 py-0.5 bg-[#16476A]/10 text-[#16476A] text-xs font-bold rounded-full">
                                {question.type === 'yes_no' && 'Sim/Não'}
                                {question.type === 'text' && 'Texto'}
                                {question.type === 'numeric' && 'Número'}
                                {question.type === 'multiple_choice' && 'Múltipla Escolha'}
                                {question.type === 'temperature' && 'Temperatura'}
                                {question.type === 'photo' && 'Foto'}
                                {question.type === 'signature' && 'Assinatura'}
                              </span>
                              {question.required && (
                                <span className="px-2 py-0.5 bg-[#BF092F]/10 text-[#BF092F] text-xs font-bold rounded-full">
                                  * Obrigatório
                                </span>
                              )}
                              {question.photoRequired && (
                                <span className="px-2 py-0.5 bg-[#BF092F]/10 text-[#BF092F] text-xs font-bold rounded-full">
                                  📷 Foto Obrigatória
                                </span>
                              )}
                              {(question.allowMultiplePhotos || question.photoRequired) && !question.photoRequired && (
                                <span className="px-2 py-0.5 bg-[#3B9797]/10 text-[#3B9797] text-xs font-bold rounded-full">
                                  📷 Foto Opcional
                                </span>
                              )}
                              {question.maxPhotos && question.maxPhotos > 1 && (
                                <span className="px-2 py-0.5 bg-[#132440]/10 text-[#132440] text-xs font-bold rounded-full">
                                  Máx: {question.maxPhotos} fotos
                                </span>
                              )}
                            </div>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-2 text-xs text-[#757575]">
                                <strong>Opções:</strong> {question.options.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
