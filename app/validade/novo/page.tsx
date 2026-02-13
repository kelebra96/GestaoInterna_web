'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Barcode,
  Calendar,
  Camera,
  CheckCircle,
  Loader2,
  MapPin,
  Package,
  FileText,
  Search,
  Upload,
  X,
} from 'lucide-react';

export default function NovaValidadePage() {
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // UI state
  const [searchingProduct, setSearchingProduct] = useState(false);
  const [productFound, setProductFound] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get effective store ID from user
  const storeId = user?.storeId || (user as any)?.companyId;
  const companyId = (user as any)?.companyId || user?.storeId;

  // Build auth headers
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!firebaseUser) return {};
    const token = await firebaseUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [firebaseUser]);

  // Search product by barcode
  const searchProduct = useCallback(async (code: string) => {
    if (code.length < 8) return;

    setSearchingProduct(true);
    setProductFound(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/produtos/search?ean=${code}`, { headers });

      if (res.ok) {
        const data = await res.json();
        if (data.product?.nome || data.product?.descricao) {
          setProductName(data.product.nome || data.product.descricao);
          setProductFound(true);
        } else {
          setProductFound(false);
        }
      } else {
        setProductFound(false);
      }
    } catch (err) {
      console.error('Error searching product:', err);
      setProductFound(false);
    } finally {
      setSearchingProduct(false);
    }
  }, [getAuthHeaders]);

  // Debounced barcode search
  useEffect(() => {
    if (barcode.length >= 8) {
      const timer = setTimeout(() => {
        searchProduct(barcode);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setProductFound(null);
    }
  }, [barcode, searchProduct]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo
  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!barcode.trim()) {
      setError('Informe o código de barras');
      return false;
    }
    if (!expiryDate) {
      setError('Informe a data de validade');
      return false;
    }
    if (!photoFile) {
      setError('Tire uma foto do produto');
      return false;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Informe uma quantidade válida');
      return false;
    }
    return true;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;
    if (!user?.uid || !storeId) {
      setError('Usuário não autenticado ou sem loja atribuída');
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();

      // 1. Upload photo
      const formData = new FormData();
      formData.append('file', photoFile!);
      formData.append('storeId', storeId);

      const uploadRes = await fetch('/api/expiry/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization || '' },
        body: formData,
      });

      let photoUrl = '';
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      } else {
        // Fallback: use local preview for now
        console.warn('Photo upload failed, continuing without cloud URL');
        photoUrl = photoPreview || '';
      }

      // 2. Create report
      const res = await fetch('/api/expiry', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: barcode.trim(),
          productName: productName.trim() || undefined,
          expiryDate,
          quantity: parseInt(quantity, 10),
          photoUrl,
          storeId,
          companyId,
          createdBy: user.uid,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao criar relatório');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/validade');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar relatório');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#132440]" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-[#E0F2F2] rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-[#3B9797]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Relatório Criado!</h2>
          <p className="text-gray-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#132440] to-[#16476A] text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Nova Validade</h1>
              <p className="text-[#E0E7EF] text-sm">Cadastrar produto próximo ao vencimento</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-[#F5E6E9] border border-[#BF092F]/20 rounded-lg text-[#BF092F] flex items-start gap-2">
              <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Barcode */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Barcode className="w-4 h-4 inline mr-1" />
              Código de Barras *
            </label>
            <div className="relative">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Digite ou escaneie o código"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black"
              />
              {searchingProduct && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#132440]" />
                </div>
              )}
            </div>
          </div>

          {/* Product Name */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Nome do Produto (opcional)
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Leite Integral 1L"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black"
            />
            {searchingProduct && (
              <p className="mt-1 text-sm text-[#132440] flex items-center gap-1">
                <Search className="w-4 h-4" />
                Buscando produto...
              </p>
            )}
            {!searchingProduct && productFound === true && (
              <p className="mt-1 text-sm text-[#3B9797] flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Produto encontrado no cadastro!
              </p>
            )}
            {!searchingProduct && productFound === false && barcode.length >= 8 && (
              <p className="mt-1 text-sm text-[#BF092F] flex items-center gap-1">
                <X className="w-4 h-4" />
                Produto não encontrado. Digite o nome manualmente.
              </p>
            )}
          </div>

          {/* Quantity and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data de Validade *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black"
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Localização (opcional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Corredor 3, Prateleira B"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black"
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#132440] focus:border-transparent text-black resize-none"
            />
          </div>

          {/* Photo */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Camera className="w-4 h-4 inline mr-1" />
              Foto do Produto *
            </label>

            {photoPreview ? (
              <div className="relative">
                <Image
                  src={photoPreview}
                  alt="Preview"
                  width={400}
                  height={300}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-2 bg-[#BF092F] text-white rounded-full hover:bg-[#9A0726] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#16476A] hover:bg-[#E0E7EF] transition-colors"
              >
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">Clique para selecionar uma foto</p>
                <p className="text-sm text-gray-400 mt-1">ou arraste e solte aqui</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-[#3B9797] text-white font-medium rounded-xl hover:bg-[#2A7A7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Salvar Relatório
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
