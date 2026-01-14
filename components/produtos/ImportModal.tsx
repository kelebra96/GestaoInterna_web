'use client';

import { useState } from 'react';
import { Upload, FileText, FileJson, FileSpreadsheet, Link } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ImportModalProps {
  onClose: () => void;
  onImport: (data: any[], type: 'csv' | 'json' | 'xlsx' | 'api') => Promise<void>;
  loading: boolean;
}

export default function ImportModal({ onClose, onImport, loading }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'json' | 'xlsx' | 'api'>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files ? e.target.files[0] : null);
    setError(null);
  };

  const handleImport = async () => {
    setError(null);
    try {
      if (activeTab === 'api') {
        if (!apiUrl) {
          setError('Por favor, insira a URL da API.');
          return;
        }
        const res = await fetch(apiUrl);
        if (!res.ok) {
          throw new Error(`Falha ao buscar dados da API: ${res.statusText}`);
        }
        const data = await res.json();
        await onImport(data, 'api');
      } else {
        if (!file) {
          setError('Por favor, selecione um arquivo.');
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const content = e.target?.result;
            if (!content) {
              throw new Error('Não foi possível ler o arquivo.');
            }
            let data: any[] = [];
            if (activeTab === 'csv') {
              const result = Papa.parse(content.toString(), { header: true });
              if (result.errors.length > 0) {
                throw new Error(`Erro ao analisar o CSV: ${result.errors[0].message}`);
              }
              data = result.data;
            } else if (activeTab === 'json') {
              data = JSON.parse(content.toString());
            } else if (activeTab === 'xlsx') {
              const workbook = XLSX.read(content, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              data = XLSX.utils.sheet_to_json(worksheet);
            }
            await onImport(data, activeTab);
          } catch (err: any) {
            setError(err.message || 'Erro ao processar o arquivo.');
          }
        };
        reader.onerror = () => {
          setError('Erro ao ler o arquivo.');
        };
        if (activeTab === 'xlsx') {
          reader.readAsBinaryString(file);
        } else {
          reader.readAsText(file);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'csv':
      case 'json':
      case 'xlsx':
        return (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <label htmlFor="file-upload" className="mt-4 block text-sm font-medium text-gray-700 cursor-pointer">
              <span>Selecione o arquivo</span>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept={`.${activeTab}`} />
            </label>
            <p className="mt-1 text-xs text-gray-500">
              {file ? file.name : `.${activeTab.toUpperCase()} arquivo até 10MB`}
            </p>
          </div>
        );
      case 'api':
        return (
          <div>
            <label htmlFor="api-url" className="block text-sm font-medium text-gray-700">URL da API</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Link className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="api-url"
                id="api-url"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="https://example.com/api/products"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg border border-[#E0E0E0] w-full max-w-2xl">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-[#212121]">Importar Produtos</h2>
          <p className="text-sm text-gray-500 mt-1">Importe produtos de um arquivo ou API.</p>
        </div>
        <div className="p-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
              <button onClick={() => setActiveTab('csv')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'csv' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <FileText className="inline-block w-5 h-5 mr-2" /> CSV
              </button>
              <button onClick={() => setActiveTab('json')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'json' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <FileJson className="inline-block w-5 h-5 mr-2" /> JSON
              </button>
              <button onClick={() => setActiveTab('xlsx')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'xlsx' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <FileSpreadsheet className="inline-block w-5 h-5 mr-2" /> XLSX
              </button>
              <button onClick={() => setActiveTab('api')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'api' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <Link className="inline-block w-5 h-5 mr-2" /> API
              </button>
            </nav>
          </div>
          <div className="mt-6">
            {renderTabContent()}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-xl">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            onClick={handleImport}
            disabled={loading}
          >
            {loading ? 'Importando...' : 'Importar'}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
