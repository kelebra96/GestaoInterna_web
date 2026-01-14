'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface Produto {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  ean?: string;
  buyer?: string;
  supplier?: string;
  description?: string;
  price?: number;
  sku?: string;
  unit?: string;
}

export default function ProdutoDetalhePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; ean?: string; buyer?: string; supplier?: string; description?: string; price?: string; sku?: string; unit?: string; active?: boolean }>({ name: '' });

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/produtos/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar produto');
      const json = await res.json();
      const p: Produto = json.produto;
      setData(p);
      setForm({
        name: p.name || '',
        ean: p.ean,
        buyer: p.buyer,
        supplier: p.supplier,
        description: p.description,
        price: p.price != null ? String(p.price) : '',
        sku: p.sku,
        unit: p.unit,
        active: p.active,
      });
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);
  useEffect(() => { if (search?.get('edit') === '1') setEditing(true); }, [search]);

  const patchProduto = async (payload: Partial<Pick<Produto, 'active' | 'name' | 'ean' | 'buyer' | 'supplier' | 'description' | 'price' | 'sku' | 'unit'>>) => {
    if (!id) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/produtos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Falha ao atualizar produto');
      const json = await res.json();
      const updated = json?.produto as Produto | undefined;
      if (updated) {
        setData(updated);
        const msg = Object.prototype.hasOwnProperty.call(payload, 'active')
          ? (payload.active ? 'Produto ativado' : 'Produto desativado')
          : 'Produto atualizado';
        setToast({ type: 'success', message: msg });
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Erro ao atualizar produto' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-md text-white ${toast.type === 'success' ? 'bg-[#4CAF50]' : 'bg-[#E82129]'}`}>
            {toast.message}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/produtos')} className="p-2 rounded-lg border border-[#E0E0E0] bg-white hover:bg-[#F5F5F5]">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">Detalhes do Produto</h1>
          </div>
          <Link href="/produtos" className="text-[#1F53A2] hover:underline">Ver lista</Link>
        </div>

        {loading && (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center shadow-md">
            <RefreshCw className="w-6 h-6 text-[#1F53A2] animate-spin inline-block" />
            <p className="mt-2 text-[#757575]">Carregando...</p>
          </div>
        )}
        {!loading && error && (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center shadow-md text-[#E82129] font-semibold">{error}</div>
        )}
        {!loading && !error && data && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-[#E0E0E0]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-[#212121] flex items-center gap-2"><Package className="w-5 h-5 text-[#1F53A2]" /> {data.name}</div>
                  <div className="mt-1 text-[#757575]">EAN: <span className="text-[#212121] font-medium">{data.ean || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">Comprador: <span className="text-[#212121] font-medium">{data.buyer || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">Fornecedor: <span className="text-[#212121] font-medium">{data.supplier || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">SKU: <span className="text-[#212121] font-medium">{data.sku || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">Unidade: <span className="text-[#212121] font-medium">{data.unit || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">Preço: <span className="text-[#212121] font-medium">{data.price != null ? data.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</span></div>
                  <div className="mt-1 text-[#757575]">Descrição: <span className="text-[#212121] font-medium">{data.description || '-'}</span></div>
                  <div className="mt-1 text-[#757575]">ID: <span className="font-mono">{data.id}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#757575]">Criado em</div>
                  <div className="text-[#212121] font-medium">{new Date(data.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-[#E0E0E0]">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-center gap-3">
                  {data.active ? (
                    <span className="px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30"><CheckCircle2 className="w-4 h-4" /> Ativo</span>
                  ) : (
                    <span className="px-3 py-1 inline-flex items-center gap-1 text-xs font-bold rounded-full border bg-[#E82129]/10 text-[#E82129] border-[#E82129]/30"><XCircle className="w-4 h-4" /> Inativo</span>
                  )}
                </div>
                <div className="inline-flex gap-2">
                  <button onClick={() => patchProduto({ active: !data.active })} disabled={saving} className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${data.active ? 'border-[#E82129]/30 text-[#E82129] hover:bg-[#E82129]/10' : 'border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/10'}`}>{data.active ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => setEditing(true)} className="px-3 py-2 rounded-lg text-sm font-semibold border border-[#1F53A2]/30 text-[#1F53A2] hover:bg-[#E3EFFF]/50">Editar</button>
                </div>
              </div>
            </div>

            {/* Modal Editar */}
            {editing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-lg border border-[#E0E0E0] w-full max-w-xl p-6">
                  <h2 className="text-lg font-bold text-[#212121] mb-4">Editar Produto</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-[#757575]">Nome</label>
                      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">EAN</label>
                      <input value={form.ean || ''} onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">Comprador</label>
                      <input value={form.buyer || ''} onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">Fornecedor</label>
                      <input value={form.supplier || ''} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">SKU</label>
                      <input value={form.sku || ''} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">Unidade</label>
                      <input value={form.unit || ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div>
                      <label className="text-sm text-[#757575]">Preço</label>
                      <input value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" placeholder="Ex.: 149,90" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm text-[#757575]">Descrição</label>
                      <input value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30" />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 mt-2">
                      <input id="ed-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                      <label htmlFor="ed-active" className="text-sm text-[#212121]">Ativo</label>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-5">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg border border-[#E0E0E0] bg-white hover:bg-[#F5F5F5]">Cancelar</button>
                    <button onClick={async () => {
                      const payload: any = {
                        name: form.name,
                        ean: form.ean,
                        buyer: form.buyer,
                        supplier: form.supplier,
                        description: form.description,
                        sku: form.sku,
                        unit: form.unit,
                        active: form.active,
                      };
                      if (form.price && form.price.trim()) {
                        const n = Number(form.price.replace(',', '.'));
                        if (Number.isFinite(n)) payload.price = n;
                      }
                      await patchProduto(payload);
                      setEditing(false);
                      fetchData();
                    }} className="px-4 py-2 rounded-lg bg-[#1F53A2] text-white font-semibold">Salvar</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

