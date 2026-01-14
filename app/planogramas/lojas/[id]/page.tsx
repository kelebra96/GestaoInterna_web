'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Store,
  Package,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  User as UserIcon,
} from 'lucide-react';
import { PlanogramStore, PlanogramStatus, User, Role, PlanogramSlot } from '@prisma/client';
import { useAuth } from '@/contexts/AuthContext';

const statusLabels: Record<PlanogramStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  em_revisao: 'Em Revisão',
  arquivado: 'Arquivado',
};

const statusColors: Record<PlanogramStatus, string> = {
  rascunho: 'bg-orange-500 text-white',
  publicado: 'bg-green-500 text-white',
  em_revisao: 'bg-blue-500 text-white',
  arquivado: 'bg-gray-700 text-white',
};

export default function PlanogramStoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [planogram, setPlanogram] = useState<(PlanogramStore & { slots: PlanogramSlot[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de publicação
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [createTasks, setCreateTasks] = useState(true);
  const [assignTo, setAssignTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  const fetchPlanogram = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await fetch(`/api/planograms/store/${id}`, { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao carregar planograma');
      }

      const data = await response.json();
      setPlanogram(data.planogram);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar planograma');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await fetch('/api/users', { headers });

      if (response.ok) {
        const data = await response.json();
        const filteredUsers = (data.users || []).filter((u: User) =>
          [Role.merchandiser, Role.repositor, Role.gestor_loja].includes(u.role as any)
        );
        setUsers(filteredUsers);
      } else {
        console.error('Erro ao buscar usuários');
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  useEffect(() => {
    if (id && firebaseUser) {
      fetchPlanogram();
    }
  }, [id, firebaseUser]);

  const handleOpenPublishModal = async () => {
    if (planogram?.status === PlanogramStatus.publicado) {
      alert('Este planograma já está publicado');
      return;
    }
    const nextWeek = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);
    setDueDate(nextWeek.toISOString().split('T')[0]);
    await fetchUsers();
    setShowPublishModal(true);
  };

  const handlePublish = async () => {
    if (createTasks && !assignTo) return alert('Selecione um usuário para atribuir as tarefas');
    if (createTasks && !dueDate) return alert('Informe o prazo');

    try {
      setPublishing(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/planograms/store/${id}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createComplianceTasks: createTasks,
          assignTo: createTasks ? assignTo : undefined,
          dueDate: createTasks ? dueDate : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Falha ao publicar planograma');
      }

      const result = await response.json();
      setShowPublishModal(false);
      alert(`Planograma publicado com sucesso! ${result.tasksCreated || 0} tarefa(s) criada(s).`);
      fetchPlanogram();
    } catch (error: any) {
      alert('Erro ao publicar: ' + error.message);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <RefreshCw className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-gray-500">Carregando planograma...</p>
      </div>
    );
  }

  if (error || !planogram) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] p-8">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error || 'Planograma não encontrado'}</p>
          <button onClick={() => router.push('/planogramas/lojas')} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => router.push('/planogramas/lojas')} className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{planogram.name}</h1>
            <span className={`px-3 py-1 text-sm font-semibold rounded-lg ${statusColors[planogram.status]}`}>
              {statusLabels[planogram.status]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Store className="w-4 h-4" />
            <span>{planogram.storeId}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {planogram.status === PlanogramStatus.rascunho && (
              <button onClick={handleOpenPublishModal} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-md">
                <CheckCircle className="w-4 h-4" />
                Publicar Planograma
              </button>
            )}
            <button onClick={fetchPlanogram} className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-800 hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold transition-all">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações Principais */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Detalhes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Template Base</label>
                  <p className="text-gray-800 font-medium">{planogram.basePlanogramId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Atualizado em</label>
                  <p className="text-gray-800 font-medium">{new Date(planogram.updatedAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Slots ({planogram.slots?.length || 0})
              </h2>
              {planogram.slots && planogram.slots.length > 0 ? (
                <div className="space-y-2">
                  {planogram.slots.map((slot) => (
                    <div key={slot.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <p className="font-semibold">{slot.productId}</p>
                      <p className="text-sm text-gray-600">Shelf: {slot.shelfId} | Facings: {slot.facings}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhum slot configurado</p>
              )}
            </div>
          </div>

          {/* Sidebar - Métricas */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Métricas</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">SKUs</p>
                    <p className="text-2xl font-bold text-gray-800">{planogram.slots?.length || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ajustes</p>
                    <p className="text-2xl font-bold text-gray-800">{(planogram.adjustments as any)?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Publicação */}
        {showPublishModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                <h2 className="text-xl font-bold">Publicar Planograma</h2>
                <button onClick={() => setShowPublishModal(false)} className="text-white hover:bg-white/10 p-2 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="flex items-center gap-3 mb-6 p-4 bg-green-50 border border-green-600 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={createTasks} onChange={(e) => setCreateTasks(e.target.checked)} className="w-5 h-5 text-green-600 border-green-600 rounded focus:ring-green-600" />
                  <p className="font-semibold text-gray-800">Criar Tarefa de Compliance</p>
                </label>
                {createTasks && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">Atribuir a *</label>
                      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2" required>
                        <option value="">Selecione um usuário</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">Prazo *</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2" required />
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
                <button onClick={() => setShowPublishModal(false)} disabled={publishing} className="px-4 py-2 border border-gray-200 text-gray-800 hover:bg-white rounded-lg font-medium">Cancelar</button>
                <button onClick={handlePublish} disabled={publishing} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold">
                  {publishing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Publicando...</> : <><CheckCircle className="w-4 h-4" /> Publicar</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
