'use client';
import React from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface SystemHealth {
  check_type: string;
  endpoint: string;
  status: string;
  response_time_ms: number;
  checked_at: string;
}

interface HealthStatusChartProps {
  systemHealth: SystemHealth[];
}

const HealthStatusChart: React.FC<HealthStatusChartProps> = ({ systemHealth }) => {
  // Group data by time and calculate status counts
  const processedData = React.useMemo(() => {
    if (!systemHealth || systemHealth.length === 0) return [];

    const grouped: Record<string, any> = {};
    systemHealth.forEach(item => {
      const timeKey = item.checked_at;
      if (!grouped[timeKey]) {
        grouped[timeKey] = {
          time: new Date(item.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          total: 0
        };
      }
      grouped[timeKey][item.status]++;
      grouped[timeKey].total++;
    });

    return Object.values(grouped).slice(-10);
  }, [systemHealth]);

  // Calculate overall stats
  const stats = React.useMemo(() => {
    const healthy = systemHealth.filter(h => h.status === 'healthy').length;
    const degraded = systemHealth.filter(h => h.status === 'degraded').length;
    const unhealthy = systemHealth.filter(h => h.status === 'unhealthy').length;
    const total = systemHealth.length;
    const uptimePercent = total > 0 ? Math.round((healthy / total) * 100) : 0;

    return { healthy, degraded, unhealthy, total, uptimePercent };
  }, [systemHealth]);

  const colors = {
    healthy: '#3B9797',
    degraded: '#F59E0B',
    unhealthy: '#BF092F'
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#E0E0E0] overflow-hidden">
      <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Health Status</h3>
              <p className="text-white/70 text-xs">Status dos serviços ao longo do tempo</p>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{stats.uptimePercent}%</p>
              <p className="text-white/60 text-xs">uptime</p>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        {/* Stats summary */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3B9797]/10 rounded-lg">
            <CheckCircle className="w-4 h-4 text-[#3B9797]" />
            <span className="text-sm font-medium text-[#3B9797]">{stats.healthy} healthy</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">{stats.degraded} degraded</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#BF092F]/10 rounded-lg">
            <XCircle className="w-4 h-4 text-[#BF092F]" />
            <span className="text-sm font-medium text-[#BF092F]">{stats.unhealthy} unhealthy</span>
          </div>
        </div>

        {processedData.length === 0 ? (
          <div className="text-sm text-[#757575] py-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum dado de health check disponível.</p>
            <p className="text-xs mt-1">Clique em "Health Check" para iniciar</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Stacked bar chart showing health status distribution */}
            <div className="w-full flex items-end gap-1 h-40">
              {processedData.map((point: any, idx: number) => {
                const total = point.total || 1;
                const healthyHeight = (point.healthy / total) * 100;
                const degradedHeight = (point.degraded / total) * 100;
                const unhealthyHeight = (point.unhealthy / total) * 100;

                return (
                  <div key={idx} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                    <div className="w-full flex flex-col rounded-t overflow-hidden" style={{ height: '100%' }}>
                      {unhealthyHeight > 0 && (
                        <div
                          className="w-full transition-all"
                          style={{ height: `${unhealthyHeight}%`, backgroundColor: colors.unhealthy }}
                          title={`Unhealthy: ${point.unhealthy}`}
                        />
                      )}
                      {degradedHeight > 0 && (
                        <div
                          className="w-full transition-all"
                          style={{ height: `${degradedHeight}%`, backgroundColor: colors.degraded }}
                          title={`Degraded: ${point.degraded}`}
                        />
                      )}
                      {healthyHeight > 0 && (
                        <div
                          className="w-full transition-all"
                          style={{ height: `${healthyHeight}%`, backgroundColor: colors.healthy }}
                          title={`Healthy: ${point.healthy}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="w-full flex gap-1 mt-2 border-t border-[#E0E0E0] pt-2">
              {processedData.map((point: any, idx: number) => (
                <div key={idx} className="flex-1 min-w-0 text-center">
                  <span className="text-[10px] text-[#757575]">{point.time}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 justify-center pt-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.healthy }} />
                <span className="text-xs text-[#424242]">Healthy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.degraded }} />
                <span className="text-xs text-[#424242]">Degraded</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.unhealthy }} />
                <span className="text-xs text-[#424242]">Unhealthy</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthStatusChart;
