'use client';

import { useEffect, useState, ReactElement } from 'react';
import { CheckCircle, AlertCircle, Wrench, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type FeatureStatus = 'ready' | 'beta' | 'planned';

interface Feature {
  id: string;
  title: string;
  status: FeatureStatus;
  impact: 'alto' | 'medio';
  effort: 'baixo' | 'medio';
  description: string;
  available: boolean;
  metrics?: Record<string, number | string | boolean>;
}

const statusConfig: Record<FeatureStatus, { label: string; color: string; icon: ReactElement }> = {
  ready: { label: 'Disponível', color: 'bg-green-100 text-green-800 border-green-300', icon: <CheckCircle className="w-4 h-4" /> },
  beta: { label: 'Beta', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <Wrench className="w-4 h-4" /> },
  planned: { label: 'Planejado', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: <AlertCircle className="w-4 h-4" /> },
};

export default function PlanogramFeaturesPage() {
  const { firebaseUser, user } = useAuth();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRoleToBackend = (role?: string) => {
    switch ((role || '').toLowerCase()) {
      case 'developer':
      case 'admin':
        return 'super_admin';
      case 'manager':
        return 'gestor_loja';
      case 'agent':
        return 'repositor';
      case 'buyer':
        return 'merchandiser';
      default:
        return 'super_admin';
    }
  };

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken(true);
      const payload = {
        userId: firebaseUser.uid,
        orgId: (user as any)?.orgId || user?.companyId || 'default-org',
        role: mapRoleToBackend(user?.role),
        storeIds: Array.isArray((user as any)?.storeIds)
          ? (user as any).storeIds
          : user?.storeId
            ? [user.storeId]
            : [],
      };

      const response = await fetch('/api/planograms/features', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-payload': JSON.stringify(payload),
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Não foi possível carregar o status das funcionalidades');
      }
      const data = await response.json();
      setFeatures(data.features || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar funcionalidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchFeatures();
    }
  }, [firebaseUser]);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">Planogramas · Funcionalidades</p>
            <h1 className="text-3xl font-bold text-gray-900">Status das Capacidades</h1>
            <p className="text-gray-600 mt-1">Visão rápida do que está disponível, em beta ou planejado.</p>
          </div>
          <button
            onClick={fetchFeatures}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-[#1F53A2] hover:bg-[#153D7A] text-white px-4 py-2 rounded-lg font-semibold shadow-md disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            Carregando funcionalidades...
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {features.map((feature) => {
              const status = statusConfig[feature.status];
              return (
                <div key={feature.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Impacto {feature.impact.toUpperCase()} · Esforço {feature.effort.toUpperCase()}
                      </p>
                      <h2 className="text-lg font-semibold text-gray-900">{feature.title}</h2>
                      <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                      {status.icon}
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-700">
                    <span className={`px-2 py-1 rounded ${feature.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                      {feature.available ? 'Ativo' : 'Em preparação'}
                    </span>
                    {feature.metrics && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(feature.metrics).map(([key, value]) => (
                          <span key={key} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-200">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
