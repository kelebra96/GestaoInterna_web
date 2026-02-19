/**
 * Central export for all custom hooks
 */

// Realtime hooks
export { useSolicitacoesRealtime } from './useSolicitacoesRealtime';
export type { SolicitacaoRealtime } from './useSolicitacoesRealtime';

export { useChecklistRealtime } from './useChecklistRealtime';
export type { ChecklistExecution, ExecutionStatus } from './useChecklistRealtime';

export {
  useInventoryCountsRealtime,
  useActiveInventoriesRealtime,
} from './useInventoryCountsRealtime';
export type { InventoryCount, InventorySummary } from './useInventoryCountsRealtime';

export { useExpiryRealtime, useExpiryNetworkFeed } from './useExpiryRealtime';

// Other hooks
export { useOnlineStatus } from './useOnlineStatus';
export { useInventorySync } from './useInventorySync';
export { useSubscription } from './useSubscription';

// Analytics hooks
export {
  useRupturaTimeSeries,
  useReceitaTimeSeries,
  useParetoReceitaPerdida,
  useHeatmapRupturaHorario,
  useHeatmapRentabilidadeCategoriaLoja,
  useExecucaoVsRentabilidadeScatter,
  useMargemWaterfall,
} from './useAnalytics';
