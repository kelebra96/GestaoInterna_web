'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  ArrowLeft,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Filter,
  Search,
  FileText,
  Calendar,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductAnalytics {
  ean: string;
  productName: string;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  storeId: string | null;
  storeName: string | null;
  totalQuantity: number;
  totalCost: number;
  totalSaleValue: number;
  marginLost: number;
  recordCount: number;
  avgQuantityPerOccurrence: number;
  lastOccurrence: Date | null;
  lossTypes: Record<string, number>;
  trend: 'up' | 'down' | 'stable';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

interface StoreOption {
  id: string;
  name: string;
}

interface SummaryStats {
  totalProducts: number;
  totalLossValue: number;
  totalQuantityLost: number;
  totalMarginLost: number;
  criticalProducts: number;
  highRiskProducts: number;
  topCategory: string;
  topSupplier: string;
}

export default function ProdutosAnalyticsPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [products, setProducts] = useState<ProductAnalytics[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'totalCost' | 'totalQuantity' | 'recordCount'>('totalCost');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfStore, setPdfStore] = useState<string>('all');
  const [pdfDateRange, setPdfDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const fetchProductAnalytics = useCallback(async () => {
    if (!firebaseUser) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Buscar lojas disponíveis
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');

      let storesList: StoreOption[] = [];
      if (storesData && storesData.length > 0 && !storesError) {
        storesList = storesData.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
      }

      // Se não encontrou lojas na tabela stores, extrair dos loss_records
      if (storesList.length === 0) {
        const { data: lossStores } = await supabase
          .from('loss_records')
          .select('store_id')
          .not('store_id', 'is', null);

        if (lossStores) {
          const uniqueStoreIds = [...new Set(lossStores.map((r: { store_id: string }) => r.store_id))];
          storesList = uniqueStoreIds.map(id => ({
            id: id as string,
            name: `Loja ${(id as string).substring(0, 8)}...`
          }));
        }
      }

      setStores(storesList);

      // Calcular data inicial baseado no filtro
      let startDate: string | null = null;
      const now = new Date();
      if (dateRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Buscar dados de loss_records
      let query = supabase
        .from('loss_records')
        .select('*');

      if (startDate) {
        query = query.gte('occurrence_date', startDate);
      }

      if (filterStore !== 'all') {
        query = query.eq('store_id', filterStore);
      }

      const { data: lossData, error: lossError } = await query;

      if (lossError) throw lossError;

      // Criar mapa de lojas para lookup
      const storeMap = new Map<string, string>();
      (storesData || []).forEach((s: { id: string; name: string }) => {
        storeMap.set(s.id, s.name);
      });

      // Agregar dados por produto + loja (chave composta)
      const productMap = new Map<string, ProductAnalytics>();

      (lossData || []).forEach((record: Record<string, unknown>) => {
        const ean = (record.ean as string) || 'SEM_EAN';
        const storeId = (record.store_id as string) || null;
        // Se filtro de loja específica, usar chave simples; senão, agrupar por produto
        const key = filterStore !== 'all' ? ean : `${ean}`;
        const existing = productMap.get(key);

        const quantity = (record.quantity as number) || 0;
        const totalCost = (record.total_cost as number) || 0;
        const saleValue = (record.total_sale_value as number) || 0;
        const marginLost = (record.margin_lost as number) || 0;
        const lossType = (record.loss_type as string) || 'outros';

        if (existing) {
          existing.totalQuantity += quantity;
          existing.totalCost += totalCost;
          existing.totalSaleValue += saleValue;
          existing.marginLost += marginLost;
          existing.recordCount += 1;
          existing.lossTypes[lossType] = (existing.lossTypes[lossType] || 0) + 1;
          if (record.occurrence_date && (!existing.lastOccurrence || new Date(record.occurrence_date as string) > existing.lastOccurrence)) {
            existing.lastOccurrence = new Date(record.occurrence_date as string);
          }
        } else {
          productMap.set(key, {
            ean,
            productName: (record.product_name as string) || ean,
            category: record.category as string | null,
            brand: record.brand as string | null,
            supplier: record.supplier as string | null,
            storeId: storeId,
            storeName: storeId ? (storeMap.get(storeId) || `Loja ${storeId.substring(0, 8)}`) : null,
            totalQuantity: quantity,
            totalCost: totalCost,
            totalSaleValue: saleValue,
            marginLost: marginLost,
            recordCount: 1,
            avgQuantityPerOccurrence: quantity,
            lastOccurrence: record.occurrence_date ? new Date(record.occurrence_date as string) : null,
            lossTypes: { [lossType]: 1 },
            trend: 'stable',
            riskLevel: 'low',
          });
        }
      });

      // Calcular métricas derivadas
      const productsArray = Array.from(productMap.values());
      const maxCost = Math.max(...productsArray.map(p => p.totalCost), 1);

      productsArray.forEach(product => {
        product.avgQuantityPerOccurrence = product.totalQuantity / product.recordCount;

        // Calcular nível de risco baseado no custo relativo e frequência
        const costRatio = product.totalCost / maxCost;
        const frequencyRatio = product.recordCount / Math.max(...productsArray.map(p => p.recordCount), 1);
        const riskScore = (costRatio * 0.6) + (frequencyRatio * 0.4);

        if (riskScore > 0.75) {
          product.riskLevel = 'critical';
        } else if (riskScore > 0.5) {
          product.riskLevel = 'high';
        } else if (riskScore > 0.25) {
          product.riskLevel = 'medium';
        } else {
          product.riskLevel = 'low';
        }

        // Trend simples baseado na última ocorrência
        if (product.lastOccurrence) {
          const daysSinceLastOccurrence = (Date.now() - product.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastOccurrence < 7) {
            product.trend = 'up';
          } else if (daysSinceLastOccurrence > 30) {
            product.trend = 'down';
          }
        }
      });

      // Ordenar
      productsArray.sort((a, b) => b[sortBy] - a[sortBy]);

      // Calcular sumário
      const categoryCount: Record<string, number> = {};
      const supplierCount: Record<string, number> = {};

      productsArray.forEach(p => {
        if (p.category) categoryCount[p.category] = (categoryCount[p.category] || 0) + p.totalCost;
        if (p.supplier) supplierCount[p.supplier] = (supplierCount[p.supplier] || 0) + p.totalCost;
      });

      const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const topSupplier = Object.entries(supplierCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      setSummary({
        totalProducts: productsArray.length,
        totalLossValue: productsArray.reduce((sum, p) => sum + p.totalCost, 0),
        totalQuantityLost: productsArray.reduce((sum, p) => sum + p.totalQuantity, 0),
        totalMarginLost: productsArray.reduce((sum, p) => sum + p.marginLost, 0),
        criticalProducts: productsArray.filter(p => p.riskLevel === 'critical').length,
        highRiskProducts: productsArray.filter(p => p.riskLevel === 'high').length,
        topCategory,
        topSupplier,
      });

      setProducts(productsArray);
    } catch (err) {
      console.error('Error fetching product analytics:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, router, dateRange, sortBy, filterStore]);

  useEffect(() => {
    fetchProductAnalytics();
  }, [fetchProductAnalytics]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' ||
      product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.ean.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.supplier?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRisk = filterRisk === 'all' || product.riskLevel === filterRisk;

    return matchesSearch && matchesRisk;
  });

  const generatePDF = async (reportStore: string, reportDateRange: string) => {
    setGeneratingPdf(true);

    try {
      // Buscar dados específicos para o relatório
      let startDate: string | null = null;
      const now = new Date();
      if (reportDateRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (reportDateRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (reportDateRange === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      let query = supabase.from('loss_records').select('*');
      if (startDate) {
        query = query.gte('occurrence_date', startDate);
      }
      if (reportStore !== 'all') {
        query = query.eq('store_id', reportStore);
      }

      const { data: reportData, error: reportError } = await query;
      if (reportError) throw reportError;

      // Agregar dados para o relatório
      const reportProductMap = new Map<string, ProductAnalytics>();
      const storeMap = new Map<string, string>();
      stores.forEach(s => storeMap.set(s.id, s.name));

      (reportData || []).forEach((record: Record<string, unknown>) => {
        const ean = (record.ean as string) || 'SEM_EAN';
        const storeId = (record.store_id as string) || null;
        const key = ean;
        const existing = reportProductMap.get(key);

        const quantity = (record.quantity as number) || 0;
        const totalCost = (record.total_cost as number) || 0;
        const saleValue = (record.total_sale_value as number) || 0;
        const marginLost = (record.margin_lost as number) || 0;
        const lossType = (record.loss_type as string) || 'outros';

        if (existing) {
          existing.totalQuantity += quantity;
          existing.totalCost += totalCost;
          existing.totalSaleValue += saleValue;
          existing.marginLost += marginLost;
          existing.recordCount += 1;
          existing.lossTypes[lossType] = (existing.lossTypes[lossType] || 0) + 1;
        } else {
          reportProductMap.set(key, {
            ean,
            productName: (record.product_name as string) || ean,
            category: record.category as string | null,
            brand: record.brand as string | null,
            supplier: record.supplier as string | null,
            storeId: storeId,
            storeName: storeId ? (storeMap.get(storeId) || `Loja ${storeId.substring(0, 8)}`) : null,
            totalQuantity: quantity,
            totalCost: totalCost,
            totalSaleValue: saleValue,
            marginLost: marginLost,
            recordCount: 1,
            avgQuantityPerOccurrence: quantity,
            lastOccurrence: record.occurrence_date ? new Date(record.occurrence_date as string) : null,
            lossTypes: { [lossType]: 1 },
            trend: 'stable',
            riskLevel: 'low',
          });
        }
      });

      const reportProducts = Array.from(reportProductMap.values());
      const maxCost = Math.max(...reportProducts.map(p => p.totalCost), 1);

      reportProducts.forEach(product => {
        const costRatio = product.totalCost / maxCost;
        const frequencyRatio = product.recordCount / Math.max(...reportProducts.map(p => p.recordCount), 1);
        const riskScore = (costRatio * 0.6) + (frequencyRatio * 0.4);

        if (riskScore > 0.75) product.riskLevel = 'critical';
        else if (riskScore > 0.5) product.riskLevel = 'high';
        else if (riskScore > 0.25) product.riskLevel = 'medium';
        else product.riskLevel = 'low';
      });

      reportProducts.sort((a, b) => b.totalCost - a.totalCost);

      // Calcular sumário do relatório
      const reportSummary = {
        totalProducts: reportProducts.length,
        totalLossValue: reportProducts.reduce((sum, p) => sum + p.totalCost, 0),
        totalQuantityLost: reportProducts.reduce((sum, p) => sum + p.totalQuantity, 0),
        totalMarginLost: reportProducts.reduce((sum, p) => sum + p.marginLost, 0),
        criticalProducts: reportProducts.filter(p => p.riskLevel === 'critical').length,
        highRiskProducts: reportProducts.filter(p => p.riskLevel === 'high').length,
      };

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Identificar loja selecionada
      const selectedStore = reportStore === 'all'
        ? 'Todas as Lojas (Rede)'
        : stores.find(s => s.id === reportStore)?.name || reportStore;

    // Título
    doc.setFontSize(20);
    doc.setTextColor(22, 71, 106); // #16476A
    doc.text('Relatorio de Analise de Produtos', pageWidth / 2, 20, { align: 'center' });

    // Loja
    doc.setFontSize(14);
    doc.setTextColor(59, 151, 151); // #3B9797
    doc.text(`Loja: ${selectedStore}`, pageWidth / 2, 28, { align: 'center' });

    // Data do relatório
    doc.setFontSize(10);
    doc.setTextColor(117, 117, 117);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 36, { align: 'center' });
    doc.text(`Período: ${reportDateRange === '7d' ? 'Últimos 7 dias' : reportDateRange === '30d' ? 'Últimos 30 dias' : reportDateRange === '90d' ? 'Últimos 90 dias' : 'Todo período'}`, pageWidth / 2, 42, { align: 'center' });

    // Sumário
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.text('Resumo Executivo', 14, 54);

    doc.setFontSize(10);
    doc.setTextColor(66, 66, 66);
    const summaryY = 62;
    doc.text(`Total de Produtos com Perdas: ${reportSummary.totalProducts}`, 14, summaryY);
    doc.text(`Valor Total de Perdas: ${formatCurrency(reportSummary.totalLossValue)}`, 14, summaryY + 6);
    doc.text(`Quantidade Total Perdida: ${formatNumber(reportSummary.totalQuantityLost)} unidades`, 14, summaryY + 12);
    doc.text(`Margem Perdida: ${formatCurrency(reportSummary.totalMarginLost)}`, 14, summaryY + 18);
    doc.text(`Produtos Críticos: ${reportSummary.criticalProducts}`, 120, summaryY);
    doc.text(`Produtos Alto Risco: ${reportSummary.highRiskProducts}`, 120, summaryY + 6);
    doc.text(`Total de Registros: ${reportProducts.reduce((sum, p) => sum + p.recordCount, 0)}`, 120, summaryY + 12);
    doc.text(`Lojas: ${reportStore === 'all' ? 'Toda a Rede' : '1 Loja'}`, 120, summaryY + 18);

    // Tabela de produtos
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.text('Top Produtos com Maiores Perdas', 14, 94);

    // Tabela de produtos
    const tableHeaders = ['#', 'Produto', 'EAN', 'Categoria', 'Qtd', 'Custo Total', 'Ocorr.', 'Risco'];

    const tableDataWithStore = reportProducts.slice(0, 50).map((product, index) => [
      (index + 1).toString(),
      product.productName.substring(0, 35) + (product.productName.length > 35 ? '...' : ''),
      product.ean,
      (product.category || 'N/A').substring(0, 15),
      formatNumber(product.totalQuantity),
      formatCurrency(product.totalCost),
      product.recordCount.toString(),
      getRiskLabel(product.riskLevel),
    ]);

    autoTable(doc, {
      startY: 100,
      head: [tableHeaders],
      body: tableDataWithStore,
      theme: 'striped',
      headStyles: {
        fillColor: [22, 71, 106],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 18, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
    });

    // Recomendações
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    if (finalY < 250) {
      doc.setFontSize(14);
      doc.setTextColor(33, 33, 33);
      doc.text('Recomendacoes', 14, finalY);

      doc.setFontSize(9);
      doc.setTextColor(66, 66, 66);
      const recommendations = [
        '• Priorizar ações nos produtos de risco CRÍTICO e ALTO',
        '• Revisar processos de armazenamento dos produtos mais afetados',
        '• Avaliar fornecedores com maiores índices de perdas',
        '• Implementar controles de validade para produtos perecíveis',
        '• Considerar ajuste de pedidos para produtos com perdas recorrentes',
      ];

      recommendations.forEach((rec, idx) => {
        doc.text(rec, 14, finalY + 8 + (idx * 6));
      });
    }

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount} - MyInventory - Inteligência de Perdas`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Salvar com nome incluindo loja
    const storeSlug = reportStore === 'all'
      ? 'rede-completa'
      : (stores.find(s => s.id === reportStore)?.name || 'loja').toLowerCase().replace(/\s+/g, '-').substring(0, 20);
    doc.save(`relatorio-produtos-${storeSlug}-${new Date().toISOString().split('T')[0]}.pdf`);

    setShowPdfModal(false);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o relatório PDF. Tente novamente.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const getRiskLabel = (risk: string) => {
    const labels: Record<string, string> = {
      critical: 'CRÍTICO',
      high: 'ALTO',
      medium: 'MÉDIO',
      low: 'BAIXO',
    };
    return labels[risk] || risk;
  };

  const riskColors: Record<string, string> = {
    critical: 'bg-[#BF092F] text-white',
    high: 'bg-[#FF9800] text-white',
    medium: 'bg-[#F57C00] text-white',
    low: 'bg-[#4CAF50] text-white',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Modal de Geração de PDF */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Gerar Relatorio PDF
              </h3>
              <p className="text-white/70 text-sm mt-1">Configure os filtros do relatorio</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Seleção de Loja */}
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#3B9797]" />
                  Loja
                </label>
                <select
                  value={pdfStore}
                  onChange={(e) => setPdfStore(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white"
                >
                  <option value="all">Toda a Rede (Todas as Lojas)</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                <p className="text-xs text-[#757575] mt-1">
                  {pdfStore === 'all'
                    ? 'O relatório incluirá dados de todas as lojas da rede'
                    : 'O relatório será filtrado apenas para esta loja'}
                </p>
              </div>

              {/* Seleção de Período */}
              <div>
                <label className="block text-sm font-bold text-[#212121] mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3B9797]" />
                  Periodo
                </label>
                <select
                  value={pdfDateRange}
                  onChange={(e) => setPdfDateRange(e.target.value as typeof pdfDateRange)}
                  className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A] font-medium bg-white"
                >
                  <option value="7d">Ultimos 7 dias</option>
                  <option value="30d">Ultimos 30 dias</option>
                  <option value="90d">Ultimos 90 dias</option>
                  <option value="all">Todo o periodo</option>
                </select>
              </div>

              {/* Preview */}
              <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E0E0E0]">
                <p className="text-sm font-bold text-[#212121] mb-2">Resumo do Relatorio:</p>
                <div className="space-y-1 text-sm text-[#757575]">
                  <p><span className="font-medium">Loja:</span> {pdfStore === 'all' ? 'Toda a Rede' : stores.find(s => s.id === pdfStore)?.name}</p>
                  <p><span className="font-medium">Periodo:</span> {pdfDateRange === '7d' ? 'Últimos 7 dias' : pdfDateRange === '30d' ? 'Últimos 30 dias' : pdfDateRange === '90d' ? 'Últimos 90 dias' : 'Todo período'}</p>
                  <p><span className="font-medium">Formato:</span> PDF com tabela de produtos</p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="px-6 py-4 bg-[#F8F9FA] border-t border-[#E0E0E0] flex gap-3">
              <button
                onClick={() => setShowPdfModal(false)}
                disabled={generatingPdf}
                className="flex-1 px-4 py-3 border-2 border-[#E0E0E0] text-[#757575] rounded-xl font-bold hover:bg-white transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => generatePDF(pdfStore, pdfDateRange)}
                disabled={generatingPdf}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white rounded-xl font-bold hover:from-[#132440] hover:to-[#16476A] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingPdf ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Gerar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/inteligencia')}
                className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 transition-all"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <Package className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Analise de Produtos
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  {filterStore !== 'all' ? (
                    <span className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      {stores.find(s => s.id === filterStore)?.name || 'Loja Selecionada'}
                    </span>
                  ) : (
                    'Dados analiticos para tomada de decisao - Todas as Lojas'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPdfStore(filterStore);
                  setPdfDateRange(dateRange);
                  setShowPdfModal(true);
                }}
                disabled={loading || products.length === 0}
                className="inline-flex items-center gap-2 bg-white text-[#16476A] px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <Download className="w-5 h-5" />
                Gerar Relatorio PDF
              </button>
              <button
                onClick={fetchProductAnalytics}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#16476A]/10 rounded-xl">
                  <Package className="w-5 h-5 text-[#16476A]" />
                </div>
              </div>
              <p className="text-sm text-[#757575]">Produtos Afetados</p>
              <p className="text-2xl font-bold text-[#212121]">{summary.totalProducts}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#BF092F]/10 rounded-xl">
                  <DollarSign className="w-5 h-5 text-[#BF092F]" />
                </div>
              </div>
              <p className="text-sm text-[#757575]">Perda Total</p>
              <p className="text-2xl font-bold text-[#BF092F]">{formatCurrency(summary.totalLossValue)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#FF9800]/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-[#FF9800]" />
                </div>
              </div>
              <p className="text-sm text-[#757575]">Produtos Criticos</p>
              <p className="text-2xl font-bold text-[#FF9800]">{summary.criticalProducts + summary.highRiskProducts}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#4CAF50]/10 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-[#4CAF50]" />
                </div>
              </div>
              <p className="text-sm text-[#757575]">Quantidade Perdida</p>
              <p className="text-2xl font-bold text-[#212121]">{formatNumber(summary.totalQuantityLost)}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
                <input
                  type="text"
                  placeholder="Buscar produto, EAN, categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] focus:border-[#16476A]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#757575]" />
              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className="px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] font-medium min-w-[180px]"
              >
                <option value="all">Todas as Lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#757575]" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] font-medium"
              >
                <option value="7d">Ultimos 7 dias</option>
                <option value="30d">Ultimos 30 dias</option>
                <option value="90d">Ultimos 90 dias</option>
                <option value="all">Todo periodo</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#757575]" />
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] font-medium"
              >
                <option value="all">Todos os riscos</option>
                <option value="critical">Critico</option>
                <option value="high">Alto</option>
                <option value="medium">Medio</option>
                <option value="low">Baixo</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#757575]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A] font-medium"
              >
                <option value="totalCost">Maior Custo</option>
                <option value="totalQuantity">Maior Quantidade</option>
                <option value="recordCount">Mais Ocorrencias</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#3B9797] mb-6 animate-pulse">
              <Package className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold text-[#212121]">Analisando produtos...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
            <button
              onClick={fetchProductAnalytics}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white px-6 py-3 rounded-xl font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F8F9FA] text-[#757575] mb-6">
              <Package className="w-8 h-8" />
            </div>
            <p className="text-xl font-bold text-[#212121] mb-2">Nenhum produto encontrado</p>
            <p className="text-[#757575]">Importe dados de perdas para visualizar a analise</p>
          </div>
        )}

        {/* Products Table */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#212121] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#16476A]" />
                Produtos ({filteredProducts.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#757575] uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#757575] uppercase">EAN</th>
                    {filterStore === 'all' && (
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#757575] uppercase">Loja</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#757575] uppercase">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#757575] uppercase">Quantidade</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#757575] uppercase">Custo Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-[#757575] uppercase">Ocorr.</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-[#757575] uppercase">Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {filteredProducts.slice(0, 50).map((product) => (
                    <tr key={product.ean} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#212121]">{product.productName}</p>
                        {product.supplier && (
                          <p className="text-xs text-[#757575]">{product.supplier}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#757575] font-mono">{product.ean}</td>
                      {filterStore === 'all' && (
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 bg-[#3B9797]/10 text-[#3B9797] text-xs rounded-lg font-medium">
                            {product.storeName || 'Várias'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-[#16476A]/10 text-[#16476A] text-xs rounded-lg font-medium">
                          {product.category || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-[#212121]">
                        {formatNumber(product.totalQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-[#BF092F]">
                        {formatCurrency(product.totalCost)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-[#F8F9FA] rounded-full font-bold text-[#212121]">
                          {product.recordCount}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-lg ${riskColors[product.riskLevel]}`}>
                          {getRiskLabel(product.riskLevel)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredProducts.length > 50 && (
              <div className="px-6 py-4 border-t border-[#E0E0E0] text-center text-sm text-[#757575]">
                Mostrando 50 de {filteredProducts.length} produtos. Exporte o PDF para ver todos.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
