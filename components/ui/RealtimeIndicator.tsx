'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface RealtimeIndicatorProps {
  isConnected: boolean;
  lastUpdate: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

export function RealtimeIndicator({
  isConnected,
  lastUpdate,
  onRefresh,
  loading = false,
  className = '',
}: RealtimeIndicatorProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Connection status */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          isConnected
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-amber-100 text-amber-700 border border-amber-200'
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Tempo real</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Last update */}
      {lastUpdate && (
        <span className="text-xs text-gray-500">
          Atualizado: {formatTime(lastUpdate)}
        </span>
      )}

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      )}
    </div>
  );
}

export default RealtimeIndicator;
