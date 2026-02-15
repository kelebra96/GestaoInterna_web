'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ArrowLeft, Save, Store, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function NovoInventarioPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState('');

  const fetchStores = async () => {
    try {
      setLoadingStores(true);

      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/lojas', { cache: 'no-store', headers });
      if (!res.ok) throw new Error('Falha ao carregar lojas');

      const json = await res.json();
      setStores(json.lojas || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar lojas');
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchStores();
    }
  }, [firebaseUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !storeId) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await firebaseUser?.getIdToken(true);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          storeId,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Falha ao criar inventário');
      }

      const json = await res.json();
      const inventario = json.inventario;

      // Redirecionar para a página do inventário criado
      router.push(`/inventario/${inventario.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao criar inventário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
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
                <Package className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Novo Inventário
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Crie um novo inventário para uma loja
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              Informações do Inventário
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-gradient-to-r from-[#BF092F]/10 to-[#BF092F]/10 border-2 border-[#BF092F]/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0" />
                  <p className="text-sm font-bold text-[#BF092F]">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#757575] mb-2">
                  Nome do Inventário <span className="text-[#BF092F]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Inventário Janeiro 2025"
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium transition-all"
                  required
                />
                <p className="text-xs text-[#757575] mt-2">
                  Escolha um nome descritivo para identificar este inventário
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#757575] mb-2 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Loja <span className="text-[#BF092F]">*</span>
                </label>
                {loadingStores ? (
                  <div className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl bg-[#F8F9FA] text-[#757575] font-medium">
                    Carregando lojas...
                  </div>
                ) : (
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white transition-all"
                    required
                  >
                    <option value="">Selecione uma loja</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-[#757575] mt-2">
                  Selecione a loja onde será realizado o inventário
                </p>
              </div>

              <div className="bg-gradient-to-r from-[#3B9797]/10 to-[#16476A]/10 border-2 border-[#3B9797]/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#16476A] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[#16476A]">
                    <p className="font-bold mb-1">Importante:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Apenas um inventário pode estar em andamento por loja</li>
                      <li>Após criar, você poderá importar o arquivo TXT com os produtos</li>
                      <li>O inventário começa no status "Preparação"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t-2 border-[#E0E0E0]">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-xl border-2 border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#212121] font-bold transition-all duration-300 hover:scale-105 shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !storeId}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#388E3C] hover:to-[#1B5E20] text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Criar Inventário
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
