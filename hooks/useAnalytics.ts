// web/hooks/useAnalytics.ts
import { useState, useEffect } from 'react';
import { RupturaTimeSeriesPoint } from '@/lib/types/analytics';

import { ReceitaTimeSeriesPoint } from '@/lib/types/analytics';

import { ParetoItem } from '@/lib/types/analytics';

import { HeatmapCell } from '@/lib/types/analytics';

import { ScatterPoint } from '@/lib/types/analytics';

import { WaterfallStep } from '@/lib/types/analytics';

function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
}

export function useRupturaTimeSeries(storeId: string, startDate: Date, endDate: Date) {
  const [data, setData] = useState<RupturaTimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return;

      try {
        setLoading(true);
        const token = getAuthToken();
        if (!token) throw new Error("Authentication token not found.");

        const headers = { 'Authorization': `Bearer ${token}` };
        const params = new URLSearchParams({
            storeId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });

        const response = await fetch(`/api/analytics/ruptura-timeseries?${params}`, { headers });

        if (!response.ok) {
          throw new Error('Failed to fetch rupture time series data');
        }

        const result = await response.json();
        setData(result.data || []);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeId, startDate, endDate]);

  return { data, loading, error };
}

export function useReceitaTimeSeries(storeId: string, startDate: Date, endDate: Date) {
    const [data, setData] = useState<ReceitaTimeSeriesPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const fetchData = async () => {
        if (!storeId) return;
  
        try {
          setLoading(true);
          const token = getAuthToken();
          if (!token) throw new Error("Authentication token not found.");
  
          const headers = { 'Authorization': `Bearer ${token}` };
          const params = new URLSearchParams({
              storeId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
          });
  
          const response = await fetch(`/api/analytics/receita-timeseries?${params}`, { headers });
  
          if (!response.ok) {
            throw new Error('Failed to fetch receita time series data');
          }
  
          const result = await response.json();
          setData(result.data || []);
          setError(null);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
    }, [storeId, startDate, endDate]);
  
    return { data, loading, error };
  }

export function useParetoReceitaPerdida(storeId: string, startDate: Date, endDate: Date) {
    const [data, setData] = useState<ParetoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const token = getAuthToken();
            if (!token) throw new Error("Authentication token not found.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({
                storeId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const response = await fetch(`/api/analytics/pareto-receita-perdida?${params}`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch pareto data');
            }

            const result = await response.json();
            setData(result.data || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
        };

        fetchData();
    }, [storeId, startDate, endDate]);

    return { data, loading, error };
}

export function useHeatmapRupturaHorario(storeId: string, startDate: Date, endDate: Date) {
    const [data, setData] = useState<HeatmapCell[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const token = getAuthToken();
            if (!token) throw new Error("Authentication token not found.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({
                storeId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const response = await fetch(`/api/analytics/heatmap-ruptura-horario?${params}`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch heatmap data');
            }

            const result = await response.json();
            setData(result.data || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
        };

        fetchData();
    }, [storeId, startDate, endDate]);

    return { data, loading, error };
}

export function useHeatmapRentabilidadeCategoriaLoja(startDate: Date, endDate: Date) {
    const [data, setData] = useState<HeatmapCell[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
        try {
            setLoading(true);
            const token = getAuthToken();
            if (!token) throw new Error("Authentication token not found.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const response = await fetch(`/api/analytics/heatmap-rentabilidade-categoria-loja?${params}`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch rentabilidade heatmap data');
            }

            const result = await response.json();
            setData(result.data || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
        };

        fetchData();
    }, [startDate, endDate]);

    return { data, loading, error };
}

export function useExecucaoVsRentabilidadeScatter(storeId: string, startDate: Date, endDate: Date) {
    const [data, setData] = useState<ScatterPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const token = getAuthToken();
            if (!token) throw new Error("Authentication token not found.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({
                storeId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const response = await fetch(`/api/analytics/execucao-vs-rentabilidade-scatter?${params}`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch scatter data');
            }

            const result = await response.json();
            setData(result.data || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
        };

        fetchData();
    }, [storeId, startDate, endDate]);

    return { data, loading, error };
}

export function useMargemWaterfall(storeId: string, startDate: Date, endDate: Date) {
    const [data, setData] = useState<WaterfallStep[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const token = getAuthToken();
            if (!token) throw new Error("Authentication token not found.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const params = new URLSearchParams({
                storeId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const response = await fetch(`/api/analytics/margem-waterfall?${params}`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch waterfall data');
            }

            const result = await response.json();
            setData(result.data || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
        };

        fetchData();
    }, [storeId, startDate, endDate]);

    return { data, loading, error };
}
