'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle, Loader2, Database, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { parseTxtFile } from '@/lib/utils/txtParser';
import { TxtLineData, TxtParseError } from '@/lib/types/inventory';
import { inventoryCacheService } from '@/lib/services/inventory-cache.service';

export default function ImportarInventarioPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { firebaseUser } = useAuth();

  const [textContent, setTextContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<TxtLineData[]>([]);
  const [errors, setErrors] = useState<TxtParseError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [cachingData, setCachingData] = useState(false);
  const [progress, setProgress] = useState(0);
  const [serverProgress, setServerProgress] = useState<{ progress: number; processed: number; total: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTxt =
    '7891234567890 123456789 DESCRICAO PRODUTO TESTE                         000010,99 00000012\n' +
    '7899876543210 987654321 ARROZ TIPO 1 5KG                                000025,90 00000005\n';

  const handleDownloadModel = () => {
    const blob = new Blob([sampleTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_inventario.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTextContent(content);
      parseContent(content);
    };
    reader.readAsText(file);
  };

  const handleClearImport = () => {
    setTextContent('');
    setFileName('');
    setPreview([]);
    setErrors([]);
    setImportResult(null);
    setProgress(0);
    setServerProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    stopStatusPolling();
  };

  const startProgress = () => {
    setProgress(8);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((prev) => {
        // acelera no início, desacelera após 90 e trava em 99 até finalizar
        if (prev >= 99) return prev;
        const delta =
          prev < 70 ? Math.random() * 8 + 6 : prev < 90 ? Math.random() * 5 + 3 : Math.random() * 2 + 0.5;
        return Math.min(99, prev + delta);
      });
    }, 350);
  };

  const stopProgress = (finalValue = 100) => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(finalValue);
    if (finalValue === 100) {
      setTimeout(() => setProgress(0), 800);
    }
  };

  const fetchServerProgress = async () => {
    try {
      const res = await fetch(`/api/inventario/${id}/import/status`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setServerProgress({
        progress: data.progress ?? 0,
        processed: data.processed ?? 0,
        total: data.total ?? 0,
        status: data.status ?? 'idle',
      });
      if (data.status === 'completed' || data.status === 'failed') {
        stopStatusPolling();
        stopProgress(100);
      }
    } catch {
      // ignora erros de polling
    }
  };

  const startStatusPolling = () => {
    fetchServerProgress();
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(fetchServerProgress, 2000);
  };

  const stopStatusPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setTextContent(content);
    setFileName('');
    if (content.trim()) {
      parseContent(content);
    } else {
      setPreview([]);
      setErrors([]);
    }
  };

  const parseContent = (content: string) => {
    const result = parseTxtFile(content);

    if (result.success) {
      setPreview(result.lines.slice(0, 20));
      setErrors([]);
    } else {
      setPreview([]);
      setErrors(result.errors || []);
    }
  };

  const handleImport = async () => {
    if (!textContent.trim()) {
      alert('Por favor, forneça o conteúdo do arquivo');
      return;
    }

    if (errors.length > 0) {
      alert('Corrija os erros antes de importar');
      return;
    }

    let success = false;
    try {
      setImporting(true);
      startProgress();
      startStatusPolling();

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/inventario/${id}/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textContent,
          fileName: fileName || 'arquivo.txt',
        }),
      });

      const responseText = await response.text();
      let parsed: any = null;
      if (responseText) {
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = null;
        }
      }

      if (!response.ok) {
        const message =
          parsed?.error ||
          `HTTP ${response.status}: ${response.statusText || 'Erro'}${
            responseText ? ` — ${responseText.slice(0, 200)}` : ''
          }`;
        throw new Error(message);
      }

      const result = parsed ?? {};
      setImportResult(result);
      success = true;

      try {
        setCachingData(true);
        const parseResult = parseTxtFile(textContent);
        if (parseResult.success && parseResult.lines.length > 0) {
          const items = parseResult.lines.map((line) => ({
            ean: line.ean,
            description: line.description,
            internalCode: line.internalCode,
            expectedQuantity: line.expectedQuantity,
            price: line.price,
          }));

          await inventoryCacheService.init();
          await inventoryCacheService.cacheInventoryItems(id, items);
        }
      } catch (cacheError) {
        console.error('[Import] Erro ao salvar cache (não crítico):', cacheError);
      } finally {
        setCachingData(false);
      }
    } catch (error: any) {
      alert('Erro ao importar: ' + error.message);
      stopProgress(0);
    } finally {
      setImporting(false);
      stopProgress(success ? 100 : 0);
      stopStatusPolling();
    }
  };

  if (importResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] text-[#212121]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <header className="flex items-center gap-3 text-[#16476A]">
            <button
              onClick={() => router.push(`/inventario/${id}`)}
              className="p-2 rounded-2xl border border-[#3B9797]/30 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3B9797]">Importação</p>
              <h1 className="text-2xl font-bold">Arquivo processado com sucesso</h1>
            </div>
          </header>

          <section className="rounded-3xl overflow-hidden border border-[#3B9797]/25 bg-white shadow-xl">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/15 border border-white/30">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-[#E0E7EF]">Importação concluída</p>
                  <h2 className="text-xl font-bold">Itens prontos para coleta</h2>
                </div>
              </div>
              <span className="px-3 py-2 rounded-xl bg-white/15 border border-white/30 text-sm font-semibold">
                ID {id}
              </span>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-sm text-[#757575]">{importResult.message}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#E0E0E0] bg-gradient-to-br from-[#E0E7EF] to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Total de linhas</p>
                  <p className="text-3xl font-bold text-[#16476A]">{importResult.stats?.totalLines || 0}</p>
                </div>
                <div className="rounded-2xl border border-[#E0E0E0] bg-gradient-to-br from-[#E0E7EF] to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Itens processados</p>
                  <p className="text-3xl font-bold text-[#16476A]">{importResult.stats?.processedItems || 0}</p>
                </div>
                <div className="rounded-2xl border border-[#E0E0E0] bg-gradient-to-br from-[#E0E7EF] to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-1">Produtos criados</p>
                  <p className="text-3xl font-bold text-[#16476A]">{importResult.stats?.productsCreated || 0}</p>
                </div>
              </div>

              {cachingData && (
                <div className="rounded-2xl border border-[#3B9797]/25 bg-[#E0E7EF] p-4 flex items-start gap-3">
                  <Database className="w-5 h-5 text-[#16476A] animate-pulse mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#16476A]">Salvando dados localmente...</p>
                    <p className="text-xs text-[#757575]">Preparando dados para uso offline</p>
                  </div>
                </div>
              )}

              {!cachingData && (
                <div className="rounded-2xl border border-[#3B9797]/25 bg-gradient-to-r from-[#3B9797]/10 to-[#16476A]/10 p-4 flex items-start gap-3">
                  <Database className="w-5 h-5 text-[#16476A] mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#16476A]">Dados salvos localmente</p>
                    <p className="text-xs text-[#757575]">Você pode coletar mesmo sem conexão</p>
                  </div>
                </div>
              )}

              {importResult.stats?.errors && importResult.stats.errors.length > 0 && (
                <div className="rounded-2xl border border-[#BF092F]/30 bg-[#BF092F]/10 p-4">
                  <p className="text-sm font-semibold text-[#BF092F] mb-2">
                    Erros ({importResult.stats.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-[#BF092F]">
                    {importResult.stats.errors.map((err: any, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <span className="font-semibold">Linha {err.line}:</span>
                        <span>{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                <button
                  onClick={() => router.push(`/inventario/${id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-5 py-3 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition"
                >
                  Ver inventário
                </button>
                <button
                  onClick={() => setImportResult(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#16476A] border border-[#E0E0E0] px-5 py-3 font-semibold shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
                >
                  Importar novamente
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const effectiveProgress =
    serverProgress && serverProgress.total > 0
      ? serverProgress.progress || 0
      : progress;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#E9ECEF] to-[#F8F9FA] text-[#212121]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-[#3B9797]/25 bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#16476A] text-white shadow-2xl">
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
                <p className="text-xs uppercase tracking-[0.08em] text-[#E0E7EF] font-semibold">Importação</p>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">Importar arquivo TXT</h1>
                <p className="text-sm text-[#E0E7EF] mt-1">
                  Faça upload do arquivo posicional ou cole o conteúdo para validar antes da coleta
                </p>
              </div>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20 text-sm font-semibold">
              Inventário ID {id}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#16476A]" />
                  <h2 className="text-lg font-bold text-[#16476A]">Upload de arquivo</h2>
                </div>
                <div className="flex items-center gap-2">
                  {fileName && (
                    <span className="text-xs font-semibold text-[#3B9797] bg-[#E0E7EF] px-3 py-1 rounded-full border border-[#3B9797]/20">
                      {fileName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClearImport}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#BF092F] px-3 py-1 rounded-full border border-[#BF092F]/30 bg-[#BF092F]/10 hover:bg-[#BF092F]/15 transition disabled:opacity-50"
                    disabled={!fileName && !textContent}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                </div>
              </div>
              <label className="block w-full rounded-2xl border-2 border-dashed border-[#3B9797]/30 bg-[#E0E7EF]/40 p-4 text-center cursor-pointer hover:border-[#16476A] hover:bg-[#E0E7EF] transition">
                <p className="text-sm font-semibold text-[#16476A]">Clique para enviar ou arraste o arquivo TXT</p>
                <p className="text-xs text-[#757575]">Tamanho máximo recomendado: 5MB</p>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
              </label>
            </section>

            <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#16476A]" />
                <h2 className="text-lg font-bold text-[#16476A]">Modelo do arquivo</h2>
              </div>
              <p className="text-sm text-[#757575]">
                Arquivo TXT posicional (91-92 caracteres por linha). Layout:
              </p>
              <div className="text-xs text-[#212121] bg-[#F8F9FA] border border-[#E0E0E0] rounded-xl p-3 font-mono">
                1-13 EAN | 15-23 CÓDIGO | 25-74 DESCRIÇÃO | 76-84 PREÇO | 85-92 QTD
              </div>
              <div className="text-xs text-[#212121] bg-[#F8F9FA] border border-[#E0E0E0] rounded-xl p-3 font-mono whitespace-pre">
                {sampleTxt}
              </div>
              <button
                type="button"
                onClick={handleDownloadModel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#16476A]/30 text-[#16476A] font-semibold hover:bg-[#E0E7EF] transition"
              >
                <FileText className="w-4 h-4" />
                Baixar modelo TXT
              </button>
            </section>

            <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#16476A]" />
                <h2 className="text-lg font-bold text-[#16476A]">Ou cole o conteúdo</h2>
              </div>
              <textarea
                value={textContent}
                onChange={handleTextChange}
                placeholder="Cole o conteúdo do arquivo TXT aqui..."
                className="w-full h-64 p-3 rounded-xl border border-[#E0E0E0] bg-[#F8F9FA] font-mono text-sm text-[#212121] resize-none focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
              />
            </section>

            <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-6">
              <button
                onClick={handleImport}
                disabled={importing || !textContent.trim() || errors.length > 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-3 font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Importar arquivo
                  </>
                )}
              </button>
              {(importing || progress > 0 || (serverProgress && serverProgress.progress > 0)) && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#16476A] mb-1">
                    <span>
                      {importing && effectiveProgress >= 99
                        ? 'Validando no servidor...'
                        : 'Carregando'}
                    </span>
                    <span>{Math.min(100, Math.round(effectiveProgress))}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E0E0E0] overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-[#3B9797] via-[#16476A] to-[#3B9797] transition-all duration-300 ${importing && effectiveProgress >= 99 ? 'animate-pulse' : ''}`}
                      style={{ width: `${Math.min(100, effectiveProgress)}%` }}
                    />
                  </div>
                  {serverProgress && serverProgress.total > 0 && (
                    <div className="mt-1 text-[11px] text-[#757575] font-semibold text-right">
                      {serverProgress.processed}/{serverProgress.total} itens gravados
                    </div>
                  )}
                </div>
              )}
              {errors.length > 0 && (
                <p className="mt-3 text-xs font-semibold text-[#BF092F]">
                  Corrija os erros destacados no preview antes de continuar.
                </p>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-[#E0E0E0] bg-white shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#16476A]">Preview (primeiras 20 linhas)</h2>
              {preview.length > 0 && (
                <span className="text-xs font-semibold text-[#3B9797] bg-[#E0E7EF] px-3 py-1 rounded-full border border-[#3B9797]/20">
                  {preview.length} linhas
                </span>
              )}
            </div>

            {errors.length > 0 && (
              <div className="rounded-2xl border border-[#BF092F]/30 bg-[#BF092F]/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-[#BF092F] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#BF092F] mb-2">Erros encontrados</p>
                    <ul className="text-xs text-[#BF092F] space-y-1 max-h-32 overflow-y-auto">
                      {errors.map((err, idx) => (
                        <li key={idx}>Linha {err.lineNumber}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {preview.length > 0 && (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {preview.map((line, idx) => (
                  <div key={idx} className="border border-[#E0E0E0] rounded-xl p-3 bg-[#F8F9FA] text-sm shadow-inner">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#212121]">{line.description}</span>
                      <span className="text-xs font-semibold text-[#16476A] bg-[#E0E7EF] px-2 py-1 rounded border border-[#3B9797]/20">
                        Qtd: {line.expectedQuantity}
                      </span>
                    </div>
                    <div className="text-xs text-[#757575] space-y-0.5">
                      <p>EAN: {line.ean}</p>
                      <p>Código: {line.internalCode}</p>
                      <p>Preço: R$ {(line.price / 100).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!textContent.trim() && (
              <div className="text-center py-12 text-[#BFC7C9]">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-60" />
                <p className="text-sm">Aguardando conteúdo do arquivo...</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
