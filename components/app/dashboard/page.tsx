'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RupturaDashboard } from './components/RupturaDashboard';
import { RentabilidadeDashboard } from './components/RentabilidadeDashboard';
import { Store } from '@prisma/client';

function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
}

export default function DashboardPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const token = getAuthToken();
        if (!token) throw new Error("Authentication token not found.");
        const headers = { 'Authorization': `Bearer ${token}` };
        const response = await fetch('/api/stores', { headers });
        if (!response.ok) throw new Error('Failed to load stores');
        const data = await response.json();
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
        }
      } catch (e: any) {
        console.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-8">
      <div className="max-w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard de Análise Operacional</h1>
            <div>
                <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="p-2 border rounded-lg"
                    disabled={loading || stores.length === 0}
                >
                    <option value="">{loading ? 'Loading stores...' : 'Select a Store'}</option>
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                </select>
            </div>
        </div>
        
        <Tabs defaultValue="ruptura" className="w-full">
          <TabsList>
            <TabsTrigger value="ruptura">Análise de Ruptura</TabsTrigger>
            <TabsTrigger value="rentabilidade">Análise de Rentabilidade</TabsTrigger>
            <TabsTrigger value="ocupacao" disabled>Ocupação de Gôndola</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ruptura">
            {selectedStoreId ? <RupturaDashboard storeId={selectedStoreId} /> : <p>Please select a store.</p>}
          </TabsContent>
          <TabsContent value="rentabilidade">
            {selectedStoreId ? <RentabilidadeDashboard storeId={selectedStoreId} /> : <p>Please select a store.</p>}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}