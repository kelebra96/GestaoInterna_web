/**
 * Hook for Supabase Realtime subscription to checklist_executions
 * Provides real-time updates when mobile executes checklists
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ChecklistExecution {
  id: string;
  templateId: string;
  templateName: string;
  templateType: string;
  companyId: string;
  storeId: string;
  storeName: string;
  sector?: string;
  userId: string;
  userName: string;
  scheduledDate: Date;
  estimatedDuration?: number;
  startedAt?: Date;
  status: ExecutionStatus;
  progress: number;
  answersCount: number;
  score?: number;
  conformity?: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

interface UseChecklistRealtimeOptions {
  companyId?: string;
  storeId?: string;
  userId?: string;
  status?: ExecutionStatus | 'all';
  enabled?: boolean;
}

interface UseChecklistRealtimeResult {
  executions: ChecklistExecution[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
  lastUpdate: Date | null;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    avgProgress: number;
  };
}

// Transform database row to ChecklistExecution
function transformExecution(row: any): ChecklistExecution {
  const answers = Array.isArray(row.answers) ? row.answers : [];

  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name || 'Sem nome',
    templateType: row.template_type || 'custom',
    companyId: row.company_id,
    storeId: row.store_id,
    storeName: row.store_name || row.stores?.name || '',
    sector: row.sector,
    userId: row.user_id,
    userName: row.user_name || row.users?.display_name || '',
    scheduledDate: new Date(row.scheduled_date),
    estimatedDuration: row.estimated_duration,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    status: row.status || 'pending',
    progress: row.progress || 0,
    answersCount: answers.length,
    score: row.score,
    conformity: row.conformity,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

export function useChecklistRealtime({
  companyId,
  storeId,
  userId,
  status,
  enabled = true,
}: UseChecklistRealtimeOptions = {}): UseChecklistRealtimeResult {
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Calculate stats
  const stats = {
    total: executions.length,
    pending: executions.filter((e) => e.status === 'pending').length,
    inProgress: executions.filter((e) => e.status === 'in_progress').length,
    completed: executions.filter((e) => e.status === 'completed').length,
    avgProgress:
      executions.length > 0
        ? Math.round(executions.reduce((sum, e) => sum + e.progress, 0) / executions.length)
        : 0,
  };

  // Fetch executions from database
  const fetchExecutions = useCallback(async () => {
    if (!enabled) {
      setExecutions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('checklist_executions')
        .select(`
          *,
          stores:store_id(name),
          users:user_id(display_name)
        `)
        .order('scheduled_date', { ascending: false })
        .limit(100);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const transformed = (data || []).map((row: any) => ({
        ...transformExecution(row),
        storeName: row.stores?.name || row.store_name,
        userName: row.users?.display_name || row.user_name,
      }));

      setExecutions(transformed);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('[Checklist Realtime] Error fetching:', err);
      setError(err.message || 'Erro ao carregar execuções');
    } finally {
      setLoading(false);
    }
  }, [companyId, storeId, userId, status, enabled]);

  // Handle realtime changes
  const handleRealtimeChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('[Checklist Realtime] Event:', eventType, payload);
      setLastUpdate(new Date());

      switch (eventType) {
        case 'INSERT': {
          const newExecution = transformExecution(newRecord);

          // Check filters
          if (companyId && newRecord.company_id !== companyId) return;
          if (storeId && newRecord.store_id !== storeId) return;
          if (userId && newRecord.user_id !== userId) return;
          if (status && status !== 'all' && newRecord.status !== status) return;

          setExecutions((prev) => [newExecution, ...prev].slice(0, 100));
          break;
        }

        case 'UPDATE': {
          const updatedExecution = transformExecution(newRecord);

          setExecutions((prev) => {
            const existingIndex = prev.findIndex((e) => e.id === updatedExecution.id);

            // Check if it still matches filters
            const matchesCompany = !companyId || newRecord.company_id === companyId;
            const matchesStore = !storeId || newRecord.store_id === storeId;
            const matchesUser = !userId || newRecord.user_id === userId;
            const matchesStatus = !status || status === 'all' || newRecord.status === status;

            if (!matchesCompany || !matchesStore || !matchesUser || !matchesStatus) {
              if (existingIndex !== -1) {
                return prev.filter((e) => e.id !== updatedExecution.id);
              }
              return prev;
            }

            if (existingIndex === -1) {
              return [updatedExecution, ...prev].slice(0, 100);
            }

            const newList = [...prev];
            newList[existingIndex] = updatedExecution;
            return newList;
          });
          break;
        }

        case 'DELETE': {
          const deletedId = oldRecord?.id;
          if (deletedId) {
            setExecutions((prev) => prev.filter((e) => e.id !== deletedId));
          }
          break;
        }
      }
    },
    [companyId, storeId, userId, status]
  );

  // Setup realtime subscription
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchExecutions();

    // Build filter for subscription
    let filter = '';
    if (companyId) {
      filter = `company_id=eq.${companyId}`;
    } else if (storeId) {
      filter = `store_id=eq.${storeId}`;
    } else if (userId) {
      filter = `user_id=eq.${userId}`;
    }

    // Create realtime channel
    const channelName = `checklist-executions-${companyId || storeId || userId || 'all'}-${Date.now()}`;

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'checklist_executions',
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handleRealtimeChange)
      .subscribe((status) => {
        console.log('[Checklist Realtime] Subscription status:', status);
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
  }, [enabled, companyId, storeId, userId, fetchExecutions, handleRealtimeChange]);

  return {
    executions,
    loading,
    error,
    refresh: fetchExecutions,
    isConnected,
    lastUpdate,
    stats,
  };
}

export default useChecklistRealtime;
