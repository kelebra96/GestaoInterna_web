/**
 * Hook for Supabase Realtime subscription to solicitacoes
 * Provides real-time updates when mobile creates/updates solicitacoes
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SolicitacaoRealtime {
  id: string;
  storeId: string;
  storeName?: string;
  companyId?: string;
  companyName?: string;
  createdBy: string;
  userName?: string;
  buyerId?: string;
  status: 'draft' | 'pending' | 'batched' | 'closed';
  dayKey: string;
  itemCount: number;
  totalValue?: number;
  createdAt: Date;
  updatedAt?: Date;
}

interface UseSolicitacoesRealtimeOptions {
  companyId?: string;
  storeId?: string;
  status?: string;
  enabled?: boolean;
}

interface UseSolicitacoesRealtimeResult {
  solicitacoes: SolicitacaoRealtime[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
  lastUpdate: Date | null;
}

// Transform database row to SolicitacaoRealtime
function transformSolicitacao(row: any): SolicitacaoRealtime {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name || row.stores?.name,
    companyId: row.company_id,
    companyName: row.company_name || row.companies?.name,
    createdBy: row.created_by,
    userName: row.user_name || row.users?.display_name,
    buyerId: row.buyer_id,
    status: row.status || 'pending',
    dayKey: row.day_key,
    itemCount: row.item_count || 0,
    totalValue: row.total_value,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

export function useSolicitacoesRealtime({
  companyId,
  storeId,
  status,
  enabled = true,
}: UseSolicitacoesRealtimeOptions = {}): UseSolicitacoesRealtimeResult {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRealtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch solicitacoes from database
  const fetchSolicitacoes = useCallback(async () => {
    if (!enabled) {
      setSolicitacoes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('solicitacoes')
        .select(`
          *,
          stores:store_id(name),
          companies:company_id(name),
          users:created_by(display_name)
        `)
        .neq('status', 'draft') // Exclude drafts
        .order('created_at', { ascending: false })
        .limit(100);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const transformed = (data || []).map((row: any) => ({
        ...transformSolicitacao(row),
        storeName: row.stores?.name,
        companyName: row.companies?.name,
        userName: row.users?.display_name,
      }));

      setSolicitacoes(transformed);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('[Solicitacoes Realtime] Error fetching:', err);
      setError(err.message || 'Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, [companyId, storeId, status, enabled]);

  // Handle realtime changes
  const handleRealtimeChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('[Solicitacoes Realtime] Event:', eventType, payload);
      setLastUpdate(new Date());

      switch (eventType) {
        case 'INSERT': {
          // Skip drafts
          if (newRecord.status === 'draft') return;

          const newSolicitacao = transformSolicitacao(newRecord);

          // Check filters
          if (companyId && newRecord.company_id !== companyId) return;
          if (storeId && newRecord.store_id !== storeId) return;
          if (status && status !== 'all' && newRecord.status !== status) return;

          setSolicitacoes((prev) => [newSolicitacao, ...prev].slice(0, 100));
          break;
        }

        case 'UPDATE': {
          const updatedSolicitacao = transformSolicitacao(newRecord);

          setSolicitacoes((prev) => {
            const existingIndex = prev.findIndex((s) => s.id === updatedSolicitacao.id);

            // Check if it still matches filters
            const matchesCompany = !companyId || newRecord.company_id === companyId;
            const matchesStore = !storeId || newRecord.store_id === storeId;
            const matchesStatus = !status || status === 'all' || newRecord.status === status;
            const isNotDraft = newRecord.status !== 'draft';

            if (!matchesCompany || !matchesStore || !matchesStatus || !isNotDraft) {
              // Remove if no longer matches
              if (existingIndex !== -1) {
                return prev.filter((s) => s.id !== updatedSolicitacao.id);
              }
              return prev;
            }

            if (existingIndex === -1) {
              // Add if now matches
              return [updatedSolicitacao, ...prev].slice(0, 100);
            }

            // Update in place
            const newList = [...prev];
            newList[existingIndex] = updatedSolicitacao;
            return newList;
          });
          break;
        }

        case 'DELETE': {
          const deletedId = oldRecord?.id;
          if (deletedId) {
            setSolicitacoes((prev) => prev.filter((s) => s.id !== deletedId));
          }
          break;
        }
      }
    },
    [companyId, storeId, status]
  );

  // Setup realtime subscription
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchSolicitacoes();

    // Build filter for subscription
    let filter = '';
    if (companyId) {
      filter = `company_id=eq.${companyId}`;
    } else if (storeId) {
      filter = `store_id=eq.${storeId}`;
    }

    // Create realtime channel
    const channelName = `solicitacoes-${companyId || storeId || 'all'}-${Date.now()}`;

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'solicitacoes',
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handleRealtimeChange)
      .subscribe((status) => {
        console.log('[Solicitacoes Realtime] Subscription status:', status);
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
  }, [enabled, companyId, storeId, fetchSolicitacoes, handleRealtimeChange]);

  return {
    solicitacoes,
    loading,
    error,
    refresh: fetchSolicitacoes,
    isConnected,
    lastUpdate,
  };
}

export default useSolicitacoesRealtime;
