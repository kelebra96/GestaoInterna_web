'use client';

import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download, Info } from 'lucide-react';
import { ProductSalesData } from '@/lib/types/category-planning';

interface DataUploaderProps {
  onDataImported: (data: ProductSalesData[]) => void;
  templateId?: string;
}

export default function DataUploader({ onDataImported, templateId }: DataUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let format: 'csv' | 'json' | 'xlsx' = 'csv';

      if (fileExtension === 'json') {
        format = 'json';
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        format = 'xlsx';
      } else if (fileExtension !== 'csv') {
        throw new Error('Formato de arquivo não suportado. Use CSV, JSON ou XLSX.');
      }

      // Ler arquivo
      const fileContent = await readFile(file, format);

      // Enviar para API
      const response = await fetch('/api/category-planning/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          data: fileContent,
          templateId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar dados');
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        setError(`Importado com avisos:\n${result.errors.slice(0, 3).join('\n')}`);
      } else {
        setSuccess(`${result.recordsImported} produtos importados com sucesso!`);
      }

      // Notificar componente pai
      onDataImported(result.data);
    } catch (err: any) {
      console.error('Erro no upload:', err);
      setError(err.message || 'Erro ao processar arquivo');
    } finally {
      setUploading(false);
      // Limpar input
      event.target.value = '';
    }
  };

  const readFile = (file: File, format: 'csv' | 'json' | 'xlsx'): Promise<string | any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;

          if (format === 'json') {
            const parsed = JSON.parse(content);
            resolve(parsed);
          } else if (format === 'csv') {
            resolve(content);
          } else if (format === 'xlsx') {
            // Para XLSX, precisaríamos de uma biblioteca como 'xlsx'
            // Por simplicidade, vamos esperar que o usuário converta para CSV/JSON
            reject(new Error('XLSX ainda não suportado. Use CSV ou JSON.'));
          }
        } catch (error) {
          reject(new Error('Erro ao processar conteúdo do arquivo'));
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  };

  const downloadTemplate = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csvContent = `productId,productName,ean,salesVolume,salesRevenue,profitMargin,seasonalityIndex,width,height,depth,category,subcategory,brand
PROD001,Coca-Cola 2L,7894900011517,1500,4500.00,35.5,1.2,12,30,8,Bebidas,Refrigerantes,Coca-Cola
PROD002,Guaraná 2L,7891991010344,1200,3300.00,32.0,1.0,12,30,8,Bebidas,Refrigerantes,Ambev
PROD003,Pepsi 2L,7894900530315,800,2200.00,30.0,0.9,12,30,8,Bebidas,Refrigerantes,PepsiCo`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_vendas.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else if (format === 'json') {
      const jsonContent = [
        {
          productId: 'PROD001',
          productName: 'Coca-Cola 2L',
          ean: '7894900011517',
          salesVolume: 1500,
          salesRevenue: 4500.0,
          profitMargin: 35.5,
          seasonalityIndex: 1.2,
          width: 12,
          height: 30,
          depth: 8,
          category: 'Bebidas',
          subcategory: 'Refrigerantes',
          brand: 'Coca-Cola',
        },
        {
          productId: 'PROD002',
          productName: 'Guaraná 2L',
          ean: '7891991010344',
          salesVolume: 1200,
          salesRevenue: 3300.0,
          profitMargin: 32.0,
          seasonalityIndex: 1.0,
          width: 12,
          height: 30,
          depth: 8,
          category: 'Bebidas',
          subcategory: 'Refrigerantes',
          brand: 'Ambev',
        },
      ];

      const blob = new Blob([JSON.stringify(jsonContent, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_vendas.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#212121]">Importar Dados de Vendas</h2>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-sm text-[#1F53A2] hover:text-[#153D7A] flex items-center gap-1"
        >
          <Info className="w-4 h-4" />
          {showTemplates ? 'Ocultar' : 'Ver'} Templates
        </button>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="bg-[#F5F5F5] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-[#212121] mb-3">
            Baixar Templates de Exemplo
          </h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => downloadTemplate('csv')}
              className="inline-flex items-center gap-2 bg-[#4CAF50] hover:bg-[#388E3C] text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              <Download className="w-4 h-4" />
              Template CSV
            </button>
            <button
              onClick={() => downloadTemplate('json')}
              className="inline-flex items-center gap-2 bg-[#2196F3] hover:bg-[#1976D2] text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              <Download className="w-4 h-4" />
              Template JSON
            </button>
          </div>

          <div className="bg-white rounded-lg p-3 text-sm">
            <p className="font-semibold text-[#212121] mb-2">Campos obrigatórios:</p>
            <ul className="list-disc list-inside text-[#757575] space-y-1 text-xs">
              <li>
                <strong>productId:</strong> Identificador único do produto
              </li>
              <li>
                <strong>salesVolume:</strong> Volume de vendas em unidades
              </li>
              <li>
                <strong>salesRevenue:</strong> Receita total (R$)
              </li>
              <li>
                <strong>profitMargin:</strong> Margem de lucro (% de 0 a 100)
              </li>
            </ul>

            <p className="font-semibold text-[#212121] mt-3 mb-2">Campos opcionais:</p>
            <ul className="list-disc list-inside text-[#757575] space-y-1 text-xs">
              <li>productName, ean, category, subcategory, brand</li>
              <li>
                seasonalityIndex: Índice de sazonalidade (1.0 = normal, &gt;1.0 = alta demanda)
              </li>
              <li>width, height, depth: Dimensões do produto (cm)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="border-2 border-dashed border-[#E0E0E0] rounded-lg p-8 text-center hover:border-[#1F53A2] transition-colors">
        <input
          type="file"
          accept=".csv,.json,.xlsx"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />

        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          {uploading ? (
            <>
              <Upload className="w-12 h-12 text-[#1F53A2] mb-3 animate-bounce" />
              <p className="text-[#212121] font-medium mb-1">Processando arquivo...</p>
              <p className="text-sm text-[#757575]">Aguarde enquanto importamos os dados</p>
            </>
          ) : (
            <>
              <FileText className="w-12 h-12 text-[#757575] mb-3" />
              <p className="text-[#212121] font-medium mb-1">
                Clique para selecionar um arquivo
              </p>
              <p className="text-sm text-[#757575]">CSV, JSON ou XLSX (até 10MB)</p>
            </>
          )}
        </label>
      </div>

      {/* Mensagens de Feedback */}
      {error && (
        <div className="mt-4 bg-[#FFEBEE] border border-[#E82129] rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#E82129] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-[#E82129] mb-1">Erro na importação</p>
            <p className="text-sm text-[#C62828] whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mt-4 bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[#4CAF50] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-[#4CAF50] mb-1">Importação concluída</p>
            <p className="text-sm text-[#388E3C]">{success}</p>
          </div>
        </div>
      )}
    </div>
  );
}
