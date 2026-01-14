'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  User,
  Upload,
  FileText,
  X,
  Trophy,
  Medal,
  Award,
  Printer,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Address {
  id: string;
  addressCode: string;
  status: string;
  assignedUserName?: string;
  itemsCounted: number;
  createdAt: any;
}

interface TopUser {
  userId: string;
  userName: string;
  addressesCompleted: number;
  totalItemsCounted: number;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  assigned: 'Atribuído',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

const statusColors: Record<string, string> = {
  pending: 'bg-[#BF092F]/10 text-[#BF092F] border-[#BF092F]/30',
  assigned: 'bg-[#E0E7EF] text-[#16476A] border-[#3B9797]/30',
  in_progress: 'bg-[#E0E7EF] text-[#3B9797] border-[#3B9797]/40',
  completed: 'bg-[#16476A] text-white border-[#3B9797]/50',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  assigned: User,
  in_progress: AlertCircle,
  completed: CheckCircle,
};

export default function EnderecosPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [newAddressCode, setNewAddressCode] = useState('');
  const [creating, setCreating] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangePrefix, setRangePrefix] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeGenerating, setRangeGenerating] = useState(false);
  const [rangeResult, setRangeResult] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [labelMode, setLabelMode] = useState<'loja' | 'cd'>('loja');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Campos para geração automática
  const [rua, setRua] = useState('');
  const [predioInicio, setPredioInicio] = useState('');
  const [predioFim, setPredioFim] = useState('');
  const [andarInicio, setAndarInicio] = useState('');
  const [andarFim, setAndarFim] = useState('');
  const [apartamentoInicio, setApartamentoInicio] = useState('');
  const [apartamentoFim, setApartamentoFim] = useState('');

  const fetchAddresses = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}/addresses`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao carregar endereços');
      }

      const data = await response.json();
      setAddresses(data.addresses || []);
      setTopUsers(data.topUsers || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar endereços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && firebaseUser) {
      fetchAddresses();
    }
  }, [id, firebaseUser]);

  const handleCreateAddress = async () => {
    if (!newAddressCode.trim()) {
      alert('Informe o código do endereço');
      return;
    }

    try {
      setCreating(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}/addresses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressCode: newAddressCode.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao criar endereço');
      }

      setNewAddressCode('');
      setShowModal(false);
      fetchAddresses();
    } catch (error: any) {
      alert('Erro ao criar endereço: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    // Validações
    if (!rua.trim()) {
      alert('Informe o código da Rua');
      return;
    }

    const predioIni = parseInt(predioInicio);
    const predioFi = parseInt(predioFim);
    const andarIni = parseInt(andarInicio);
    const andarFi = parseInt(andarFim);
    const apartIni = parseInt(apartamentoInicio);
    const apartFi = parseInt(apartamentoFim);

    if (isNaN(predioIni) || isNaN(predioFi) || predioIni > predioFi) {
      alert('Intervalo de Prédio inválido');
      return;
    }

    if (isNaN(andarIni) || isNaN(andarFi) || andarIni > andarFi) {
      alert('Intervalo de Andar inválido');
      return;
    }

    if (isNaN(apartIni) || isNaN(apartFi) || apartIni > apartFi) {
      alert('Intervalo de Apartamento inválido');
      return;
    }

    // Calcular total de endereços
    const totalPredios = predioFi - predioIni + 1;
    const totalAndares = andarFi - andarIni + 1;
    const totalApartamentos = apartFi - apartIni + 1;
    const totalEnderecos = totalPredios * totalAndares * totalApartamentos;

    if (totalEnderecos > 10000) {
      alert(`Isso geraria ${totalEnderecos} endereços, o limite é 10.000. Reduza os intervalos.`);
      return;
    }

    const confirm = window.confirm(
      `Isso irá gerar ${totalEnderecos} endereços. Deseja continuar?`
    );

    if (!confirm) return;

    try {
      setGenerating(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}/addresses/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rua: rua.trim().toUpperCase(),
          predioInicio: predioIni,
          predioFim: predioFi,
          andarInicio: andarIni,
          andarFim: andarFi,
          apartamentoInicio: apartIni,
          apartamentoFim: apartFi,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar endereços');
      }

      const result = await response.json();
      setGenerateResult(result);

      // Limpar campos
      setRua('');
      setPredioInicio('');
      setPredioFim('');
      setAndarInicio('');
      setAndarFim('');
      setApartamentoInicio('');
      setApartamentoFim('');

      fetchAddresses();
    } catch (error: any) {
      alert('Erro ao gerar endereços: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRange = async () => {
    const startNum = parseInt(rangeStart, 10);
    const endNum = parseInt(rangeEnd, 10);

    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
      alert('Informe números válidos para início e fim');
      return;
    }

    if (startNum > endNum) {
      alert('O número inicial deve ser menor ou igual ao final');
      return;
    }

    const total = endNum - startNum + 1;
    if (total > 10000) {
      alert(`Isso geraria ${total} endereços. Limite: 10.000`);
      return;
    }

    const confirm = window.confirm(`Isso irá gerar ${total} endereços. Deseja continuar?`);
    if (!confirm) return;

    try {
      setRangeGenerating(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/inventario/${id}/addresses/generate-range`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: rangePrefix.trim(),
          startNumber: rangeStart.trim(),
          endNumber: rangeEnd.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar endereços');
      }

      const result = await response.json();
      setRangeResult(result);
      setRangePrefix('');
      setRangeStart('');
      setRangeEnd('');
      fetchAddresses();
    } catch (error: any) {
      alert('Erro ao gerar endereços: ' + error.message);
    } finally {
      setRangeGenerating(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const confirm = window.confirm('Excluir este endereço? Esta ação não pode ser desfeita.');
    if (!confirm) return;

    try {
      setDeletingId(addressId);
      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/inventario/${id}/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao excluir endereço');
      }
      fetchAddresses();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir endereço');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportPdf = async () => {
    if (!addresses.length) {
      alert('Não há endereços para exportar.');
      return;
    }

    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      const loadLogo = async () => {
        try {
          const res = await fetch('/icon.png');
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };
      const logoData = await loadLogo();
      const logoSize = 10; // mm

      const encodeCode39 = (text: string) => {
        const map: Record<string, string> = {
          '0': 'nnnwwnwnn',
          '1': 'wnnwnnnnw',
          '2': 'nnwwnnnnw',
          '3': 'wnwwnnnnn',
          '4': 'nnnwwnnnw',
          '5': 'wnnwwnnnn',
          '6': 'nnwwwnnnn',
          '7': 'nnnwnnwnw',
          '8': 'wnnwnnwnn',
          '9': 'nnwwnnwnn',
          A: 'wnnnnwnnw',
          B: 'nnwnnwnnw',
          C: 'wnwnnwnnn',
          D: 'nnnnwwnnw',
          E: 'wnnnwwnnn',
          F: 'nnwnwwnnn',
          G: 'nnnnnwwnw',
          H: 'wnnnnwwnn',
          I: 'nnwnnwwnn',
          J: 'nnnnwwwnn',
          K: 'wnnnnnnww',
          L: 'nnwnnnnww',
          M: 'wnwnnnnwn',
          N: 'nnnnwnnww',
          O: 'wnnnwnnwn',
          P: 'nnwnwnnwn',
          Q: 'nnnnnnwww',
          R: 'wnnnnnwwn',
          S: 'nnwnnnwwn',
          T: 'nnnnwnwwn',
          U: 'wwnnnnnnw',
          V: 'nwwnnnnnw',
          W: 'wwwnnnnnn',
          X: 'nwnnwnnnw',
          Y: 'wwnnwnnnn',
          Z: 'nwwnwnnnn',
          '-': 'nwnnnnwnw',
          '.': 'wwnnnnwnn',
          ' ': 'nwwnnnwnn',
          '$': 'nwnwnwnnn',
          '/': 'nwnwnnnwn',
          '+': 'nwnnnwnwn',
          '%': 'nnnwnwnwn',
          '*': 'nwnnwnwnn',
        };
        const sanitized = text.toUpperCase().replace(/[^0-9A-Z .\-$/+%]/g, '');
        const full = `*${sanitized}*`;
        const sequence: Array<{ isBar: boolean; width: number }> = [];
        const narrow = 0.4;
        const wide = narrow * 3;

        for (let idx = 0; idx < full.length; idx++) {
          const pattern = map[full[idx]] || map[' '];
          for (let i = 0; i < pattern.length; i++) {
            const isBar = i % 2 === 0;
            const width = pattern[i] === 'w' ? wide : narrow;
            sequence.push({ isBar, width });
          }
          // inter-character narrow space
          sequence.push({ isBar: false, width: narrow });
        }
        return sequence;
      };

      const drawCode39 = (x: number, y: number, height: number, maxWidth: number, value: string) => {
        doc.setFillColor(20, 20, 20);
        doc.setDrawColor(20, 20, 20);
        const seq = encodeCode39(value);
        const totalWidth = seq.reduce((acc, s) => acc + s.width, 0);
        const scale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
        let cursor = x + (maxWidth - totalWidth * scale) / 2;
        seq.forEach((s) => {
          const w = s.width * scale;
          if (s.isBar) {
            doc.rect(cursor, y, w, height, 'F');
          }
          cursor += w;
        });
      };

      const labelWidth = 80; // mm
      const labelHeight = labelMode === 'cd' ? 92 : 88;
      const marginX = 15;
      const marginY = 12;
      const gapY = 4;
      const columns = 2;
      const rows = 3; // 6 etiquetas por página

      doc.setFont('helvetica', 'normal');

      for (let idx = 0; idx < addresses.length; idx++) {
        const address = addresses[idx];
        const pageIndex = Math.floor(idx / (columns * rows));
        if (idx > 0 && idx % (columns * rows) === 0) {
          doc.addPage();
        }

        const positionInPage = idx % (columns * rows);
        const col = positionInPage % columns;
        const row = Math.floor(positionInPage / columns);

        const x = marginX + col * (labelWidth + 10);
        const y = marginY + row * (labelHeight + gapY);

        // Moldura
        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, labelWidth, labelHeight, 2, 2);

        // Título + logo
        doc.setTextColor(22, 71, 106);
        doc.setFontSize(11);
        const title = labelMode === 'cd' ? 'Endereço CD' : 'Número do endereço';
        if (logoData) {
          doc.addImage(logoData, 'PNG', x + 4, y + 4, logoSize, logoSize);
          doc.text(title, x + labelWidth / 2 + 4, y + 11, { align: 'center' });
        } else {
          doc.text(title, x + labelWidth / 2, y + 11, { align: 'center' });
        }

        // Código em texto
        doc.setTextColor(33, 33, 33);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(address.addressCode, x + labelWidth / 2, y + 18, { align: 'center' });

        let rua = '';
        let predio = '';
        let andar = '';
        let apto = '';
        if (labelMode === 'cd') {
          const parts = address.addressCode.split('.');
          rua = parts[0] || '';
          predio = parts[1] || '';
          andar = parts[2] || '';
          apto = parts[3] || '';
        }

        // Área do código de barras
        const barcodeY = y + 22;
        const barcodeH = 22;
        const barcodeAreaW = labelWidth - 16;
        doc.setFillColor(240, 242, 245);
        doc.rect(x + 8, barcodeY, barcodeAreaW, barcodeH, 'F');
        drawCode39(x + 10, barcodeY + 3, barcodeH - 6, barcodeAreaW - 4, address.addressCode);

        let cursorY = barcodeY + barcodeH + 10;

        if (labelMode === 'cd') {
          doc.setFontSize(10);
          doc.setTextColor(33, 33, 33);
          const rowH = 8;
          doc.text(`Rua: ${rua}`, x + 8, cursorY);
          doc.text(`Prédio: ${predio}`, x + labelWidth / 2, cursorY);
          cursorY += rowH;
          doc.text(`Andar: ${andar}`, x + 8, cursorY);
          doc.text(`Apto: ${apto}`, x + labelWidth / 2, cursorY);
          cursorY += rowH + 4;
        }

        // Campo Coletado
        doc.setDrawColor(181, 193, 201);
        doc.setLineWidth(0.3);
        doc.rect(x + 8, cursorY, 12, 12);
        doc.setFontSize(11);
        doc.setTextColor(33, 33, 33);
        doc.text('Coletado', x + 24, cursorY + 9);
      }

      doc.save(`etiquetas_enderecos_${id}.pdf`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF', error);
      alert('Falha ao gerar PDF de endereços: ' + error.message);
    } finally {
      setExportingPdf(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status] || Clock;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] text-[#212121]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-[#3B9797]/25 bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] text-white shadow-2xl">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, #FFFFFF22, transparent 30%), radial-gradient(circle at 80% 0%, #FFFFFF11, transparent 30%)',
            }}
          />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.push(`/inventario/${id}`)}
                className="p-2 rounded-2xl bg-white/10 border border-white/25 hover:bg-white/15 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[#E0E7EF] font-semibold">
                  Endereços
                </p>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">Gerenciar endereços</h1>
                <p className="text-sm text-[#E0E7EF] mt-1">
                  Crie endereços em massa para CD ou por intervalo para lojas
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-2 py-1">
                <span className="text-xs uppercase tracking-wide text-[#E0E7EF]">Formato</span>
                <div className="flex rounded-lg overflow-hidden border border-white/30">
                  <button
                    type="button"
                    onClick={() => setLabelMode('loja')}
                    className={`px-3 py-1 text-xs font-semibold ${labelMode === 'loja' ? 'bg-white text-[#16476A]' : 'text-white/80'}`}
                  >
                    Loja
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelMode('cd')}
                    className={`px-3 py-1 text-xs font-semibold ${labelMode === 'cd' ? 'bg-white text-[#16476A]' : 'text-white/80'}`}
                  >
                    CD
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/30 text-white px-4 py-2 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition"
              >
                <Upload className="w-4 h-4" />
                Gerar em massa (CD)
              </button>
              <button
                onClick={() => setShowRangeModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-[#16476A] px-4 py-2 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition border border-[#3B9797]/30"
              >
                <Upload className="w-4 h-4" />
                Gerar por intervalo (Loja)
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!addresses.length || exportingPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-[#16476A] hover:bg-[#3B9797] text-white px-4 py-2 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                {exportingPdf ? 'Gerando etiquetas...' : `Imprimir etiquetas (${labelMode === 'cd' ? 'CD' : 'Loja'})`}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#BF092F] hover:bg-[#a30829] text-white px-4 py-2 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition"
              >
                <Plus className="w-4 h-4" />
                Novo endereço
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B9797]" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Ranking de Produtividade */}
        {!loading && !error && topUsers.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-800">Ranking de Produtividade</h2>
            </div>

            {/* Top 3 - Pódio */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {topUsers.slice(0, 3).map((user, index) => {
                const medals = [
                  { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                  { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
                  { icon: Award, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                ];
                const medal = medals[index];
                const Icon = medal.icon;

                return (
                  <div
                    key={user.userId}
                    className={`bg-white border-2 ${medal.border} rounded-xl p-6 shadow-md hover:shadow-lg transition-all`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`${medal.bg} p-3 rounded-full`}>
                        <Icon className={`w-8 h-8 ${medal.color}`} />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-800">#{index + 1}</div>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 mb-3 truncate" title={user.userName}>
                      {user.userName}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Endereços finalizados</span>
                        <span className="font-bold text-blue-600">{user.addressesCompleted}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Itens coletados</span>
                        <span className="font-bold text-green-600">{user.totalItemsCounted}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Demais posições */}
            {topUsers.length > 3 && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Posição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Endereços Finalizados
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Itens Coletados
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {topUsers.slice(3).map((user, index) => (
                      <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-700">#{index + 4}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-800">{user.userName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            {user.addressesCompleted}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                            {user.totalItemsCounted}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Addresses Grid */}
        {!loading && !error && (
          <>
            {addresses.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Todos os Endereços</h2>
                <span className="text-sm text-gray-500 ml-auto">
                  {addresses.length} {addresses.length === 1 ? 'endereço' : 'endereços'}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {addresses.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Nenhum endereço cadastrado</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Endereço
                </button>
              </div>
            ) : (
              addresses.map((address) => (
                <div
                  key={address.id}
                  className="bg-white border border-[#E0E0E0] rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#16476A]" />
                      <h3 className="text-lg font-bold text-[#212121]">{address.addressCode}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                          statusColors[address.status] || 'bg-[#E0E7EF] text-[#212121] border-[#E0E0E0]'
                        }`}
                      >
                        {getStatusIcon(address.status)}
                        {statusLabels[address.status] || address.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(address.id)}
                        disabled={deletingId === address.id}
                        className="p-2 rounded-lg border border-[#BF092F]/30 text-[#BF092F] hover:bg-[#BF092F]/10 transition disabled:opacity-50"
                        title="Excluir endereço"
                      >
                        {deletingId === address.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-[#757575]">
                    {address.assignedUserName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#3B9797]" />
                        <span className="text-[#212121] font-semibold">{address.assignedUserName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#3B9797]" />
                      <span className="text-[#212121] font-semibold">{address.itemsCounted || 0}</span>
                      <span className="text-[#757575]">itens contados</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          </>
        )}

        {/* Modal Novo Endereço */}
        {showModal && (
          <div className="fixed inset-0 bg-[#16476A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-[#E0E0E0] overflow-hidden">
              <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Novo endereço</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white/15 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-[#212121] mb-2">
                  Código do endereço
                </label>
                <input
                  type="text"
                  value={newAddressCode}
                  onChange={(e) => setNewAddressCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateAddress();
                    }
                  }}
                  placeholder="Ex: 002.22.10.1"
                  className="w-full border border-[#E0E0E0] rounded-lg px-4 py-3 text-lg font-mono bg-[#F8F9FA] focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-[#757575] mt-2">Formato: RUA.PRÉDIO.ANDAR.SALA (Ex: 002.22.10.1)</p>
              </div>
              <div className="bg-[#F8F9FA] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="px-4 py-2 border border-[#E0E0E0] text-[#212121] hover:bg-white rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateAddress}
                  disabled={creating || !newAddressCode.trim()}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] hover:from-[#3B9797] hover:to-[#16476A] text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Geração em Massa */}
        {showBulkModal && !generateResult && (
          <div className="fixed inset-0 bg-[#16476A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E0E0E0]">
              <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-4 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <Upload className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Gerar endereços automaticamente</h2>
                </div>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="text-white hover:bg-white/15 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Instruções */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">🏢 Como funciona:</p>
                  <p className="text-sm text-blue-800">
                    Defina os intervalos e o sistema gerará automaticamente todos os endereços.
                    Formato: <strong>RUA.PRÉDIO.ANDAR.APARTAMENTO</strong>
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    Exemplo: Rua 002, Prédio 22-25, Andar 10-15, Apto 1-4 gerará 96 endereços
                  </p>
                </div>

                {/* Rua */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Código da Rua <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rua}
                    onChange={(e) => setRua(e.target.value)}
                    placeholder="Ex: 002"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Prédio */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Prédio - Início <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={predioInicio}
                      onChange={(e) => setPredioInicio(e.target.value)}
                      placeholder="Ex: 22"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Prédio - Fim <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={predioFim}
                      onChange={(e) => setPredioFim(e.target.value)}
                      placeholder="Ex: 25"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Andar */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Andar - Início <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={andarInicio}
                      onChange={(e) => setAndarInicio(e.target.value)}
                      placeholder="Ex: 10"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Andar - Fim <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={andarFim}
                      onChange={(e) => setAndarFim(e.target.value)}
                      placeholder="Ex: 15"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Apartamento */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Apartamento - Início <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={apartamentoInicio}
                      onChange={(e) => setApartamentoInicio(e.target.value)}
                      placeholder="Ex: 1"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Apartamento - Fim <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={apartamentoFim}
                      onChange={(e) => setApartamentoFim(e.target.value)}
                      placeholder="Ex: 4"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Preview de Quantidade */}
                {rua && predioInicio && predioFim && andarInicio && andarFim && apartamentoInicio && apartamentoFim && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900">
                      ✓ Serão gerados{' '}
                      <span className="text-lg">
                        {(parseInt(predioFim) - parseInt(predioInicio) + 1) *
                          (parseInt(andarFim) - parseInt(andarInicio) + 1) *
                          (parseInt(apartamentoFim) - parseInt(apartamentoInicio) + 1)}
                      </span>{' '}
                      endereços
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Exemplo: {rua}.{predioInicio}.{andarInicio}.{apartamentoInicio}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={generating}
                  className="px-4 py-2 border border-gray-200 text-gray-800 hover:bg-white rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={
                    generating ||
                    !rua.trim() ||
                    !predioInicio ||
                    !predioFim ||
                    !andarInicio ||
                    !andarFim ||
                    !apartamentoInicio ||
                    !apartamentoFim
                  }
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Gerar Endereços
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Resultado da Geração */}
        {generateResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Geração Concluída!</h2>
                </div>
                <button
                  onClick={() => {
                    setGenerateResult(null);
                    setShowBulkModal(false);
                  }}
                  className="text-white hover:bg-white/10 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Total Processados</p>
                    <p className="text-3xl font-bold text-blue-700">{generateResult.stats?.total || 0}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-semibold mb-1">Criados</p>
                    <p className="text-3xl font-bold text-green-700">{generateResult.stats?.created || 0}</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-600 font-semibold mb-1">Duplicados</p>
                    <p className="text-3xl font-bold text-yellow-700">{generateResult.stats?.duplicates || 0}</p>
                  </div>
                </div>

                {generateResult.stats?.duplicates > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">
                      ⚠️ {generateResult.stats.duplicates} endereços já existiam e foram ignorados
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-center rounded-b-xl">
                <button
                  type="button"
                  onClick={() => {
                    setGenerateResult(null);
                    setShowBulkModal(false);
                  }}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  <CheckCircle className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Geração por Intervalo (Loja) */}
        {showRangeModal && !rangeResult && (
          <div className="fixed inset-0 bg-[#16476A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#E0E0E0]">
              <div className="bg-gradient-to-r from-[#3B9797] to-[#16476A] text-white px-6 py-4 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <Upload className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Gerar endereços por intervalo</h2>
                </div>
                <button
                  onClick={() => setShowRangeModal(false)}
                  className="text-white hover:bg-white/15 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-700">
                  Use esta opção para lojas: informe o número inicial e final e (opcionalmente) um prefixo.
                  Os códigos serão gerados preservando zeros à esquerda com base no maior tamanho informado.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Prefixo (opcional)
                  </label>
                  <input
                    type="text"
                    value={rangePrefix}
                    onChange={(e) => setRangePrefix(e.target.value.toUpperCase())}
                    placeholder="Ex: LOJA-"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Será adicionado antes do número (ex: LOJA-001).</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Endereço inicial <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      placeholder="Ex: 001"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Endereço final <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      placeholder="Ex: 050"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {rangeStart && rangeEnd && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-teal-900">
                      Serão gerados {Math.max(0, (parseInt(rangeEnd || '0', 10) || 0) - (parseInt(rangeStart || '0', 10) || 0) + 1)} endereços
                    </p>
                    <p className="text-xs text-teal-700 mt-1">
                      Exemplo: {`${rangePrefix}${rangeStart || '001'}`} ... {`${rangePrefix}${rangeEnd || '050'}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  disabled={rangeGenerating}
                  className="px-4 py-2 border border-gray-200 text-gray-800 hover:bg-white rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateRange}
                  disabled={rangeGenerating || !rangeStart || !rangeEnd}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rangeGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Gerar Endereços
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Resultado Intervalo */}
        {rangeResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Geração Concluída</h2>
                </div>
                <button
                  onClick={() => {
                    setRangeResult(null);
                    setShowRangeModal(false);
                  }}
                  className="text-white hover:bg-white/10 p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Total Processados</p>
                    <p className="text-3xl font-bold text-blue-700">{rangeResult.stats?.total || 0}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-semibold mb-1">Criados</p>
                    <p className="text-3xl font-bold text-green-700">{rangeResult.stats?.created || 0}</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-600 font-semibold mb-1">Duplicados</p>
                    <p className="text-3xl font-bold text-yellow-700">{rangeResult.stats?.duplicates || 0}</p>
                  </div>
                </div>

                {rangeResult.stats?.duplicates > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">
                      {rangeResult.stats.duplicates} endereços já existiam e foram ignorados
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-center rounded-b-xl">
                <button
                  type="button"
                  onClick={() => {
                    setRangeResult(null);
                    setShowRangeModal(false);
                  }}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  <CheckCircle className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
