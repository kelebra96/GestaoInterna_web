'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  Clock,
  Upload,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Search,
} from 'lucide-react';

interface ReviewItem {
  id: string;
  nome: string | null;
  descricao: string | null;
  ean: string | null;
  sku: string | null;
  image_status: string;
  image_source: string | null;
  image_confidence: number | null;
  image_candidate_urls: string[] | null;
  image_ai_model: string | null;
  image_ai_prompt_version: string | null;
  image_ai_reason: string | null;
  image_updated_at: string | null;
}

interface Stats {
  products: {
    byStatus: { status: string; count: number }[];
  };
  jobs: {
    byStatus: { status: string; count: number; avg_attempts: number }[];
    recent24h: { status: string; count: number }[];
    stuck: number;
  };
  today: { status: string; source: string; count: number; avg_confidence: number }[];
  cache: { total_cached: number; matches: number; avg_confidence: number };
  timestamp: string;
}

export default function ImageModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [selectedCandidateUrl, setSelectedCandidateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [showStats, setShowStats] = useState(true);
  const LIMIT = 20;

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reviewRes, statsRes] = await Promise.all([
        fetch(`/api/images/review?limit=${LIMIT}&offset=${offset}`),
        fetch('/api/images/stats'),
      ]);

      if (!reviewRes.ok) throw new Error('Erro ao buscar itens para revisão');
      if (!statsRes.ok) throw new Error('Erro ao buscar estatísticas');

      const reviewData = await reviewRes.json();
      const statsData = await statsRes.json();

      setItems(reviewData.items || []);
      setTotal(reviewData.total || 0);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Aprovar por URL
  const handleApprove = async (productId: string, imageUrl: string) => {
    setActionLoading(productId);
    try {
      const res = await fetch('/api/images/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, imageUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao aprovar');
      }

      // Remove da lista local
      setItems((prev) => prev.filter((i) => i.id !== productId));
      setTotal((prev) => prev - 1);
      setSelectedItem(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Rejeitar
  const handleReject = async (productId: string, reason?: string) => {
    setActionLoading(productId);
    try {
      const res = await fetch('/api/images/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao rejeitar');
      }

      setItems((prev) => prev.filter((i) => i.id !== productId));
      setTotal((prev) => prev - 1);
      setSelectedItem(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Upload manual
  const handleUpload = async (productId: string, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productId', productId);

      const res = await fetch('/api/images/approve-upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro no upload');
      }

      setItems((prev) => prev.filter((i) => i.id !== productId));
      setTotal((prev) => prev - 1);
      setSelectedItem(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'needs_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-blue-100 text-blue-800';
      case 'running':
      case 'fetching':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moderação de Imagens</h1>
            <p className="text-gray-600">
              {total} produtos aguardando revisão
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              <BarChart3 className="w-4 h-4" />
              {showStats ? 'Ocultar Stats' : 'Ver Stats'}
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Produtos por Status */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Produtos por Status</h3>
              <div className="space-y-1">
                {stats.products.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between text-sm">
                    <span className={`px-2 py-0.5 rounded ${getStatusColor(s.status)}`}>
                      {s.status || 'null'}
                    </span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Jobs por Status */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Jobs</h3>
              <div className="space-y-1">
                {stats.jobs.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between text-sm">
                    <span className={`px-2 py-0.5 rounded ${getStatusColor(s.status)}`}>
                      {s.status}
                    </span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
                {stats.jobs.stuck > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Travados</span>
                    <span className="font-medium">{stats.jobs.stuck}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Últimas 24h */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Últimas 24h</h3>
              <div className="space-y-1">
                {stats.today.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {s.source || 'N/A'} → {s.status}
                    </span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
                {stats.today.length === 0 && (
                  <p className="text-gray-400 text-sm">Nenhum processado</p>
                )}
              </div>
            </div>

            {/* Cache */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Cache de Validações</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total cacheado</span>
                  <span className="font-medium">{stats.cache.total_cached}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matches</span>
                  <span className="font-medium">{stats.cache.matches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confiança média</span>
                  <span className="font-medium">
                    {(Number(stats.cache.avg_confidence) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* List */}
          <div className="flex-1">
            {loading ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-gray-500">Carregando...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600">Nenhum produto aguardando revisão!</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setSelectedCandidateUrl(item.image_candidate_urls?.[0] || null);
                      }}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                        selectedItem?.id === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Thumbnail candidato */}
                        <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                          {item.image_candidate_urls?.[0] ? (
                            <img
                              src={item.image_candidate_urls[0]}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.png';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {item.nome || 'Sem nome'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            EAN: {item.ean || 'N/A'} | SKU: {item.sku || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-400 mt-1 truncate">
                            {item.image_ai_reason || 'Sem razão informada'}
                          </p>
                        </div>

                        {/* Meta */}
                        <div className="text-right text-sm">
                          <span className="text-gray-400">
                            {item.image_candidate_urls?.length || 0} candidatos
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="text-sm text-gray-500">
                    {offset + 1}-{Math.min(offset + LIMIT, total)} de {total}
                  </span>
                  <button
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={offset + LIMIT >= total}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próximo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedItem && (
            <div className="w-96 bg-white rounded-lg shadow-sm p-4 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              <h2 className="font-medium text-lg mb-4">{selectedItem.nome || 'Produto'}</h2>

              {/* Product Info */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">EAN</span>
                  <span className="font-mono">{selectedItem.ean || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU</span>
                  <span className="font-mono">{selectedItem.sku || 'N/A'}</span>
                </div>
                {selectedItem.descricao && (
                  <div>
                    <span className="text-gray-500">Descrição</span>
                    <p className="text-gray-700 mt-1">{selectedItem.descricao}</p>
                  </div>
                )}
              </div>

              {/* AI Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Análise AI</h4>
                <p className="text-sm text-gray-700">{selectedItem.image_ai_reason || 'N/A'}</p>
                <div className="flex gap-2 mt-2 text-xs text-gray-400">
                  <span>{selectedItem.image_ai_model || 'N/A'}</span>
                  <span>•</span>
                  <span>{selectedItem.image_ai_prompt_version || 'N/A'}</span>
                </div>
              </div>

              {/* Selected Candidate Preview */}
              {selectedCandidateUrl && (
                <div className="mb-4">
                  <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <img
                      src={selectedCandidateUrl}
                      alt="Candidato"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-product.png';
                      }}
                    />
                  </div>
                  <a
                    href={selectedCandidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir original
                  </a>
                </div>
              )}

              {/* Candidates Gallery */}
              {(selectedItem.image_candidate_urls?.length || 0) > 1 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Candidatos</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedItem.image_candidate_urls?.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCandidateUrl(url)}
                        className={`aspect-square rounded overflow-hidden border-2 transition ${
                          selectedCandidateUrl === url
                            ? 'border-blue-500'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Candidato ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-product.png';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {selectedCandidateUrl && (
                  <button
                    onClick={() => handleApprove(selectedItem.id, selectedCandidateUrl)}
                    disabled={actionLoading === selectedItem.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === selectedItem.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Aprovar Imagem Selecionada
                  </button>
                )}

                <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Enviando...' : 'Upload Manual'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUpload(selectedItem.id, file);
                      }
                    }}
                  />
                </label>

                <button
                  onClick={() => {
                    const reason = prompt('Motivo da rejeição (opcional):');
                    handleReject(selectedItem.id, reason || undefined);
                  }}
                  disabled={actionLoading === selectedItem.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Rejeitar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
