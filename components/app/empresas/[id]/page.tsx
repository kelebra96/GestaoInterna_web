'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Building, ArrowLeft, CheckCircle2, XCircle, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Empresa {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
}

export default function EmpresaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { firebaseUser } = useAuth();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const token = await firebaseUser?.getIdToken(true);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/empresas/${id}`, { headers, cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 404) {
            setError('Empresa não encontrada.');
          } else {
            throw new Error('Falha ao carregar dados da empresa');
          }
          return;
        }
        const data = await res.json();
        setEmpresa(data.empresa);
        setName(data.empresa.name);
        setIsActive(data.empresa.active);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    if (firebaseUser) {
      fetchEmpresa();
    }
  }, [id, firebaseUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await firebaseUser?.getIdToken(true);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/empresas/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name, active: isActive }),
      });
      if (!res.ok) throw new Error('Falha ao salvar alterações');
      const data = await res.json();
      setEmpresa(data.empresa);
      // Maybe show a toast notification here
    } catch (e) {
      // Handle error, maybe show a toast
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F8F9FA]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#16476A]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#F8F9FA]">
        <XCircle className="w-12 h-12 text-[#BF092F] mb-4" />
        <p className="text-xl text-[#BF092F]">{error}</p>
        <button
          onClick={() => router.push('/empresas')}
          className="mt-4 px-4 py-2 bg-[#16476A] text-white rounded-lg hover:bg-[#132440]"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  if (!empresa) {
    return null; 
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[#757575] hover:text-[#212121] mb-6">
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-8">
          <div className="flex items-center gap-4 mb-6">
            <Building className="w-10 h-10 text-[#16476A]" />
            <h1 className="text-3xl font-bold text-[#212121]">{empresa.name}</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#16476A] focus:border-[#16476A]"
              />
            </div>
            <div className="flex items-center">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-[#16476A] focus:ring-[#16476A] border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                Ativa
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#16476A] to-[#132440] text-white rounded-lg hover:from-[#132440] hover:to-[#16476A] disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
