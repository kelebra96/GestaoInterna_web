'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function NovaEmpresaPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!firebaseUser) {
        throw new Error('Usu rio nÆo autenticado. Fa‡a login novamente.');
      }

      const token = await firebaseUser.getIdToken(true);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao criar empresa');
      }

      const data = await res.json();
      setSuccess(`Empresa "${data.empresa.name}" criada com sucesso!`);
      setName('');
      // Redirecionar para a página de empresas após um tempo
      setTimeout(() => {
        router.push('/empresas');
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white p-8 rounded-xl shadow-md border border-[#E0E0E0]">
          <h1 className="text-2xl md:text-3xl font-bold text-[#212121] mb-6">
            Criar Nova Empresa
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Erro:</strong>
              <span className="block sm:inline"> {error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Sucesso:</strong>
              <span className="block sm:inline"> {success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-[#757575] mb-2">
                Nome da Empresa
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30"
                placeholder="Digite o nome da empresa"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-[#1F53A2] hover:bg-[#153D7A] text-white px-6 py-2 rounded-lg font-semibold shadow-md disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Empresa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
