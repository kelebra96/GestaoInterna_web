/**
 * Hook para sincronização automática de contagens offline
 */

import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { inventoryCacheService } from '@/lib/services/inventory-cache.service';
import { useAuth } from '@/contexts/AuthContext';

interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

export function useInventorySync(inventoryId: string) {
  const isOnline = useOnlineStatus();
  const { firebaseUser } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });

  /**
   * Sincroniza contagens pendentes
   */
  const syncPendingCounts = useCallback(async () => {
    if (!isOnline || !firebaseUser) {
      console.log('[Sync] Ignorando sincronização (offline ou sem autenticação)');
      return;
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

      const unsyncedCounts = await inventoryCacheService.getUnsyncedCounts();
      const countsForThisInventory = unsyncedCounts.filter(
        (c) => c.inventoryId === inventoryId
      );

      if (countsForThisInventory.length === 0) {
        console.log('[Sync] Nenhuma contagem pendente');
        setSyncStatus({
          isSyncing: false,
          pendingCount: 0,
          lastSyncAt: new Date(),
          error: null,
        });
        return;
      }

      console.log(`[Sync] Sincronizando ${countsForThisInventory.length} contagens...`);

      const token = await firebaseUser.getIdToken();
      let syncedCount = 0;
      let failedCount = 0;

      for (const count of countsForThisInventory) {
        try {
          const response = await fetch(`/api/inventario/${inventoryId}/count`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ean: count.ean,
              quantity: count.quantity,
              expirationDate: count.expirationDate,
              addressCode: count.addressCode,
            }),
          });

          if (response.ok) {
            await inventoryCacheService.markCountAsSynced(count.id!);
            syncedCount++;
            console.log(`[Sync] Contagem ${count.id} sincronizada`);
          } else {
            failedCount++;
            console.error(`[Sync] Falha ao sincronizar contagem ${count.id}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`[Sync] Erro ao sincronizar contagem ${count.id}:`, error);
        }
      }

      console.log(`[Sync] Finalizado: ${syncedCount} sincronizadas, ${failedCount} falharam`);

      setSyncStatus({
        isSyncing: false,
        pendingCount: failedCount,
        lastSyncAt: new Date(),
        error: failedCount > 0 ? `${failedCount} contagens não sincronizadas` : null,
      });
    } catch (error: any) {
      console.error('[Sync] Erro ao sincronizar:', error);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: error.message,
      }));
    }
  }, [isOnline, firebaseUser, inventoryId]);

  /**
   * Atualiza contador de pendências
   */
  const updatePendingCount = useCallback(async () => {
    try {
      const unsyncedCounts = await inventoryCacheService.getUnsyncedCounts();
      const count = unsyncedCounts.filter((c) => c.inventoryId === inventoryId).length;

      setSyncStatus((prev) => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('[Sync] Erro ao atualizar contador de pendências:', error);
    }
  }, [inventoryId]);

  // Sincronizar quando voltar online
  useEffect(() => {
    if (isOnline && firebaseUser) {
      console.log('[Sync] Conexão online detectada, iniciando sincronização...');
      syncPendingCounts();
    }
  }, [isOnline, firebaseUser, syncPendingCounts]);

  // Atualizar contador de pendências periodicamente
  useEffect(() => {
    updatePendingCount();

    const interval = setInterval(() => {
      updatePendingCount();
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, [updatePendingCount]);

  return {
    ...syncStatus,
    isOnline,
    syncNow: syncPendingCounts,
    updatePendingCount,
  };
}
