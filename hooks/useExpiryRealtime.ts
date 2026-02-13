/**
 * Hook for Supabase Realtime subscription to expiry reports
 * Provides real-time updates for the /validade page
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ExpiryReportWithDays } from '@/lib/types/expiry';

interface UseExpiryRealtimeOptions {
  storeId: string;
  daysFilter?: number | null;
  includeResolved?: boolean;
}

interface UseExpiryRealtimeResult {
  reports: ExpiryReportWithDays[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

// Calculate days until expiry from a date string
function calculateDaysUntilExpiry(expirationDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Transform a database row (snake_case) to ExpiryReportWithDays (camelCase)
function transformReport(row: any): ExpiryReportWithDays {
  const expiryDate = row.expiry_date || row.expiration_date;
  return {
    id: row.id,
    barcode: row.barcode,
    productName: row.product_name,
    expiryDate: expiryDate,
    quantity: row.quantity,
    photoUrl: row.photo_url,
    storeId: row.store_id,
    companyId: row.company_id,
    createdBy: row.created_by,
    status: row.status,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    daysToExpire: calculateDaysUntilExpiry(expiryDate),
  };
}

export function useExpiryRealtime({
  storeId,
  daysFilter = null,
  includeResolved = false,
}: UseExpiryRealtimeOptions): UseExpiryRealtimeResult {
  const [reports, setReports] = useState<ExpiryReportWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch reports from API
  const fetchReports = useCallback(async () => {
    if (!storeId) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        storeId,
        includeResolved: String(includeResolved),
      });
      if (daysFilter !== null) {
        params.set('daysFilter', String(daysFilter));
      }

      const response = await fetch(`/api/expiry?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar relatórios');
      }

      const data = await response.json();
      // API returns { reports: [...] }
      const rawReports = data.reports || data || [];
      const transformedReports = Array.isArray(rawReports)
        ? rawReports.map(transformReport)
        : [];
      setReports(transformedReports);
    } catch (err: any) {
      console.error('Error fetching expiry reports:', err);
      setError(err.message || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, [storeId, daysFilter, includeResolved]);

  // Handle realtime changes
  const handleRealtimeChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('[Realtime] Event:', eventType, payload);

      switch (eventType) {
        case 'INSERT': {
          const newReport = transformReport(newRecord);

          // Check if it matches our filters
          const matchesDaysFilter =
            daysFilter === null || newReport.daysToExpire <= daysFilter;
          const matchesResolvedFilter =
            includeResolved || newReport.status !== 'resolved';

          if (matchesDaysFilter && matchesResolvedFilter) {
            setReports((prev) => [newReport, ...prev]);
          }
          break;
        }

        case 'UPDATE': {
          const updatedReport = transformReport(newRecord);

          // Check if it still matches our filters
          const matchesDaysFilter =
            daysFilter === null || updatedReport.daysToExpire <= daysFilter;
          const matchesResolvedFilter =
            includeResolved || updatedReport.status !== 'resolved';

          setReports((prev) => {
            const existingIndex = prev.findIndex((r) => r.id === updatedReport.id);

            if (existingIndex === -1) {
              // Was not in list, check if it should be added
              if (matchesDaysFilter && matchesResolvedFilter) {
                return [updatedReport, ...prev];
              }
              return prev;
            }

            // Was in list, check if it should be removed or updated
            if (!matchesDaysFilter || !matchesResolvedFilter) {
              return prev.filter((r) => r.id !== updatedReport.id);
            }

            // Update in place
            const newReports = [...prev];
            newReports[existingIndex] = updatedReport;
            return newReports;
          });
          break;
        }

        case 'DELETE': {
          const deletedId = oldRecord?.id;
          if (deletedId) {
            setReports((prev) => prev.filter((r) => r.id !== deletedId));
          }
          break;
        }
      }
    },
    [daysFilter, includeResolved]
  );

  // Setup realtime subscription
  useEffect(() => {
    if (!storeId) return;

    // Initial fetch
    fetchReports();

    // Create realtime channel
    const channelName = `expiry-reports-${storeId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expiry_reports',
          filter: `store_id=eq.${storeId}`,
        },
        handleRealtimeChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [storeId, fetchReports, handleRealtimeChange]);

  return {
    reports,
    loading,
    error,
    refresh: fetchReports,
    isConnected,
  };
}

/**
 * Hook for network-wide expiry feed (admin/supervisor view)
 * Shows all reports across stores in the company
 */
export function useExpiryNetworkFeed(companyId: string): UseExpiryRealtimeResult {
  const [reports, setReports] = useState<ExpiryReportWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchReports = useCallback(async () => {
    if (!companyId) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all non-resolved reports for the company
      const { data, error: fetchError } = await supabase
        .from('expiry_reports')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const transformedReports = (data || []).map(transformReport);
      setReports(transformedReports);
    } catch (err: any) {
      console.error('Error fetching network feed:', err);
      setError(err.message || 'Erro ao carregar feed da rede');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const handleRealtimeChange = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT': {
        const newReport = transformReport(newRecord);
        if (newReport.status !== 'resolved') {
          setReports((prev) => [newReport, ...prev].slice(0, 100));
        }
        break;
      }

      case 'UPDATE': {
        const updatedReport = transformReport(newRecord);
        setReports((prev) => {
          if (updatedReport.status === 'resolved') {
            return prev.filter((r) => r.id !== updatedReport.id);
          }
          const existingIndex = prev.findIndex((r) => r.id === updatedReport.id);
          if (existingIndex === -1) return prev;
          const newReports = [...prev];
          newReports[existingIndex] = updatedReport;
          return newReports;
        });
        break;
      }

      case 'DELETE': {
        const deletedId = oldRecord?.id;
        if (deletedId) {
          setReports((prev) => prev.filter((r) => r.id !== deletedId));
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!companyId) return;

    fetchReports();

    const channelName = `expiry-network-${companyId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expiry_reports',
          filter: `company_id=eq.${companyId}`,
        },
        handleRealtimeChange
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [companyId, fetchReports, handleRealtimeChange]);

  return {
    reports,
    loading,
    error,
    refresh: fetchReports,
    isConnected,
  };
}

export default useExpiryRealtime;
