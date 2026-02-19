/**
 * Hook for Supabase Realtime subscription to inventory_counts
 * Provides real-time updates when mobile registers inventory counts
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface InventoryCount {
  id: string;
  inventoryId: string;
  inventoryName?: string;
  addressCode: string;
  ean: string;
  description?: string;
  internalCode?: string;
  expectedQuantity?: number;
  countedQuantity: number;
  difference: number;
  diffType: 'ok' | 'excess' | 'shortage';
  expirationDate?: Date;
  userId: string;
  userName?: string;
  storeId: string;
  storeName?: string;
  countedAt: Date;
  createdAt: Date;
}

export interface InventorySummary {
  inventoryId: string;
  inventoryName: string;
  storeId: string;
  storeName: string;
  status: 'preparation' | 'in_progress' | 'completed' | 'cancelled';
  totalAddresses: number;
  addressesCompleted: number;
  totalItemsExpected: number;
  totalItemsCounted: number;
  totalCountOperations: number;
  accuracy: number;
  lastCountAt?: Date;
}

interface UseInventoryCountsRealtimeOptions {
  inventoryId?: string;
  storeId?: string;
  companyId?: string;
  enabled?: boolean;
}

interface UseInventoryCountsRealtimeResult {
  counts: InventoryCount[];
  summary: InventorySummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
  lastUpdate: Date | null;
  stats: {
    totalCounts: number;
    uniqueItems: number;
    uniqueAddresses: number;
    totalQuantity: number;
    excesses: number;
    shortages: number;
    accurate: number;
  };
}

// Transform database row to InventoryCount
function transformCount(row: any): InventoryCount {
  const expected = row.expected_quantity || 0;
  const counted = row.counted_quantity || row.quantity || 0;
  const diff = counted - expected;

  let diffType: 'ok' | 'excess' | 'shortage' = 'ok';
  if (diff > 0) diffType = 'excess';
  else if (diff < 0) diffType = 'shortage';

  return {
    id: row.id,
    inventoryId: row.inventory_id,
    inventoryName: row.inventory_name || row.inventories?.name,
    addressCode: row.address_code,
    ean: row.ean,
    description: row.description,
    internalCode: row.internal_code,
    expectedQuantity: expected,
    countedQuantity: counted,
    difference: diff,
    diffType,
    expirationDate: row.expiration_date ? new Date(row.expiration_date) : undefined,
    userId: row.user_id || row.counted_by,
    userName: row.user_name || row.users?.display_name,
    storeId: row.store_id,
    storeName: row.store_name || row.stores?.name,
    countedAt: new Date(row.counted_at || row.created_at),
    createdAt: new Date(row.created_at),
  };
}

export function useInventoryCountsRealtime({
  inventoryId,
  storeId,
  companyId,
  enabled = true,
}: UseInventoryCountsRealtimeOptions = {}): UseInventoryCountsRealtimeResult {
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Calculate stats
  const stats = {
    totalCounts: counts.length,
    uniqueItems: new Set(counts.map((c) => c.ean)).size,
    uniqueAddresses: new Set(counts.map((c) => c.addressCode)).size,
    totalQuantity: counts.reduce((sum, c) => sum + c.countedQuantity, 0),
    excesses: counts.filter((c) => c.diffType === 'excess').length,
    shortages: counts.filter((c) => c.diffType === 'shortage').length,
    accurate: counts.filter((c) => c.diffType === 'ok').length,
  };

  // Fetch inventory summary
  const fetchSummary = useCallback(async () => {
    if (!inventoryId) {
      setSummary(null);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('inventories')
        .select(`
          *,
          stores:store_id(name)
        `)
        .eq('id', inventoryId)
        .single();

      if (fetchError) {
        if (fetchError.code !== 'PGRST116') {
          console.error('[Inventory Realtime] Error fetching summary:', fetchError);
        }
        return;
      }

      if (data) {
        setSummary({
          inventoryId: data.id,
          inventoryName: data.name,
          storeId: data.store_id,
          storeName: data.stores?.name || '',
          status: data.status,
          totalAddresses: data.total_addresses || 0,
          addressesCompleted: data.addresses_completed || 0,
          totalItemsExpected: data.total_items_expected || 0,
          totalItemsCounted: data.total_items_counted || 0,
          totalCountOperations: counts.length,
          accuracy:
            data.total_items_expected > 0
              ? Math.round((data.total_items_counted / data.total_items_expected) * 100)
              : 0,
          lastCountAt: lastUpdate || undefined,
        });
      }
    } catch (err: any) {
      console.error('[Inventory Realtime] Error fetching summary:', err);
    }
  }, [inventoryId, counts.length, lastUpdate]);

  // Fetch counts from database
  const fetchCounts = useCallback(async () => {
    if (!enabled || !inventoryId) {
      setCounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('inventory_counts')
        .select(`
          *,
          inventories:inventory_id(name),
          stores:store_id(name),
          users:user_id(display_name)
        `)
        .eq('inventory_id', inventoryId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const transformed = (data || []).map((row: any) => ({
        ...transformCount(row),
        inventoryName: row.inventories?.name,
        storeName: row.stores?.name,
        userName: row.users?.display_name,
      }));

      setCounts(transformed);
      setLastUpdate(new Date());

      // Also fetch summary
      await fetchSummary();
    } catch (err: any) {
      console.error('[Inventory Realtime] Error fetching counts:', err);
      setError(err.message || 'Erro ao carregar contagens');
    } finally {
      setLoading(false);
    }
  }, [inventoryId, storeId, enabled, fetchSummary]);

  // Handle realtime changes
  const handleRealtimeChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('[Inventory Realtime] Event:', eventType, payload);
      setLastUpdate(new Date());

      switch (eventType) {
        case 'INSERT': {
          const newCount = transformCount(newRecord);

          // Check filters
          if (inventoryId && newRecord.inventory_id !== inventoryId) return;
          if (storeId && newRecord.store_id !== storeId) return;

          setCounts((prev) => [newCount, ...prev].slice(0, 500));

          // Update summary stats
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  totalCountOperations: prev.totalCountOperations + 1,
                  totalItemsCounted: prev.totalItemsCounted + newCount.countedQuantity,
                  lastCountAt: new Date(),
                }
              : null
          );
          break;
        }

        case 'UPDATE': {
          const updatedCount = transformCount(newRecord);

          setCounts((prev) => {
            const existingIndex = prev.findIndex((c) => c.id === updatedCount.id);

            if (existingIndex === -1) return prev;

            const newList = [...prev];
            newList[existingIndex] = updatedCount;
            return newList;
          });
          break;
        }

        case 'DELETE': {
          const deletedId = oldRecord?.id;
          if (deletedId) {
            setCounts((prev) => prev.filter((c) => c.id !== deletedId));
          }
          break;
        }
      }
    },
    [inventoryId, storeId]
  );

  // Setup realtime subscription
  useEffect(() => {
    if (!enabled || !inventoryId) return;

    // Initial fetch
    fetchCounts();

    // Create realtime channel
    const channelName = `inventory-counts-${inventoryId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_counts',
          filter: `inventory_id=eq.${inventoryId}`,
        },
        handleRealtimeChange
      )
      .subscribe((status) => {
        console.log('[Inventory Realtime] Subscription status:', status);
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
  }, [enabled, inventoryId, fetchCounts, handleRealtimeChange]);

  return {
    counts,
    summary,
    loading,
    error,
    refresh: fetchCounts,
    isConnected,
    lastUpdate,
    stats,
  };
}

/**
 * Hook for monitoring all active inventories in real-time
 */
export function useActiveInventoriesRealtime({
  companyId,
  storeId,
  enabled = true,
}: {
  companyId?: string;
  storeId?: string;
  enabled?: boolean;
} = {}): {
  inventories: InventorySummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
} {
  const [inventories, setInventories] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchInventories = useCallback(async () => {
    if (!enabled) {
      setInventories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('inventories')
        .select(`
          *,
          stores:store_id(name)
        `)
        .in('status', ['preparation', 'in_progress'])
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const transformed: InventorySummary[] = (data || []).map((row: any) => ({
        inventoryId: row.id,
        inventoryName: row.name,
        storeId: row.store_id,
        storeName: row.stores?.name || '',
        status: row.status,
        totalAddresses: row.total_addresses || 0,
        addressesCompleted: row.addresses_completed || 0,
        totalItemsExpected: row.total_items_expected || 0,
        totalItemsCounted: row.total_items_counted || 0,
        totalCountOperations: 0,
        accuracy:
          row.total_items_expected > 0
            ? Math.round((row.total_items_counted / row.total_items_expected) * 100)
            : 0,
        lastCountAt: row.updated_at ? new Date(row.updated_at) : undefined,
      }));

      setInventories(transformed);
    } catch (err: any) {
      console.error('[Active Inventories] Error fetching:', err);
      setError(err.message || 'Erro ao carregar inventários');
    } finally {
      setLoading(false);
    }
  }, [companyId, storeId, enabled]);

  const handleRealtimeChange = useCallback(() => {
    // Refetch on any change
    fetchInventories();
  }, [fetchInventories]);

  useEffect(() => {
    if (!enabled) return;

    fetchInventories();

    let filter = '';
    if (companyId) {
      filter = `company_id=eq.${companyId}`;
    } else if (storeId) {
      filter = `store_id=eq.${storeId}`;
    }

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'inventories',
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`active-inventories-${companyId || storeId || 'all'}-${Date.now()}`)
      .on('postgres_changes', channelConfig, handleRealtimeChange)
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
  }, [enabled, companyId, storeId, fetchInventories, handleRealtimeChange]);

  return {
    inventories,
    loading,
    error,
    refresh: fetchInventories,
    isConnected,
  };
}

export default useInventoryCountsRealtime;
