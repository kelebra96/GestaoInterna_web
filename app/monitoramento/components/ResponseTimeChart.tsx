'use client';
import React from 'react';
import { Gauge } from 'lucide-react';

interface SystemHealth {
  check_type: string;
  endpoint: string;
  status: string;
  response_time_ms: number;
  checked_at: string;
}

interface ResponseTimeChartProps {
  systemHealth: SystemHealth[];
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ systemHealth }) => {
  // Process data
  const processedData = React.useMemo(() => {
    if (!systemHealth || systemHealth.length === 0) return [];

    const grouped: Record<string, any> = {};
    systemHealth.forEach(item => {
      const timeKey = item.checked_at;
      if (!grouped[timeKey]) {
        grouped[timeKey] = {
          time: new Date(item.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
      }
      grouped[timeKey][item.check_type] = item.response_time_ms;
    });

    return Object.values(grouped).slice(-10);
  }, [systemHealth]);

  const services = React.useMemo(() => {
    return Array.from(new Set(systemHealth.map(h => h.check_type)));
  }, [systemHealth]);

  const avgResponseTime = React.useMemo(() => {
    if (!systemHealth || systemHealth.length === 0) return 0;
    return Math.round(
      systemHealth.reduce((sum, h) => sum + h.response_time_ms, 0) / systemHealth.length
    );
  }, [systemHealth]);

  const colors: Record<string, string> = {
    database: '#16476A',
    auth: '#3B9797',
    api: '#BF092F'
  };

  // Get max value for scaling
  const maxValue = React.useMemo(() => {
    let max = 100;
    processedData.forEach((point: any) => {
      services.forEach(svc => {
        if (point[svc] && point[svc] > max) max = point[svc];
      });
    });
    return max * 1.1; // Add 10% padding
  }, [processedData, services]);

  return (
    <div className="bg-white rounded-2xl border-2 border-[#E0E0E0] overflow-hidden">
      <div className="bg-gradient-to-r from-[#132440] to-[#16476A] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Response Time</h3>
              <p className="text-white/70 text-xs">Latência das APIs em tempo real</p>
            </div>
          </div>
          {avgResponseTime > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{avgResponseTime}ms</p>
              <p className="text-white/60 text-xs">média</p>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="text-xs text-[#757575] mb-3">
          Pontos: {processedData.length} | Serviços: {services.join(', ') || 'nenhum'}
        </div>

        {processedData.length === 0 ? (
          <div className="text-sm text-[#757575] py-12 text-center">
            <Gauge className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum dado de resposta disponível.</p>
            <p className="text-xs mt-1">Execute um Health Check para começar</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Area chart simulation using SVG */}
            <svg viewBox="0 0 400 200" className="w-full h-52" preserveAspectRatio="none">
              {/* Grid lines */}
              <g stroke="#E0E0E0" strokeWidth="1">
                <line x1="40" y1="20" x2="40" y2="180" />
                <line x1="40" y1="180" x2="390" y2="180" />
                {[0, 1, 2, 3, 4].map(i => (
                  <line key={i} x1="40" y1={20 + i * 40} x2="390" y2={20 + i * 40} strokeDasharray="4 4" />
                ))}
              </g>

              {/* Y-axis labels */}
              <g fill="#757575" fontSize="10">
                {[0, 1, 2, 3, 4].map(i => (
                  <text key={i} x="35" y={24 + i * 40} textAnchor="end">
                    {Math.round(maxValue - (i * maxValue / 4))}ms
                  </text>
                ))}
              </g>

              {/* Lines for each service */}
              {services.map((svc) => {
                // Calculate points
                const pointsData = processedData.map((point: any, idx: number) => {
                  const x = 50 + (idx * (340 / Math.max(processedData.length - 1, 1)));
                  const value = point[svc] || 0;
                  const y = 180 - ((value / maxValue) * 160);
                  return { x, y };
                });

                // Create smooth curve using cubic bezier
                const createSmoothPath = (pts: {x: number, y: number}[]) => {
                  if (pts.length < 2) return '';

                  let path = `M ${pts[0].x},${pts[0].y}`;

                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[Math.max(0, i - 1)];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[Math.min(pts.length - 1, i + 2)];

                    // Calculate control points for smooth curve
                    const tension = 0.3;
                    const cp1x = p1.x + (p2.x - p0.x) * tension;
                    const cp1y = p1.y + (p2.y - p0.y) * tension;
                    const cp2x = p2.x - (p3.x - p1.x) * tension;
                    const cp2y = p2.y - (p3.y - p1.y) * tension;

                    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                  }

                  return path;
                };

                const smoothLinePath = createSmoothPath(pointsData);

                // Create smooth area path
                const firstX = pointsData[0]?.x || 50;
                const lastX = pointsData[pointsData.length - 1]?.x || 390;
                const smoothAreaPath = `M ${firstX},180 L ${firstX},${pointsData[0]?.y || 180} ${smoothLinePath.slice(smoothLinePath.indexOf('C'))} L ${lastX},180 Z`;

                return (
                  <g key={svc}>
                    {/* Area fill with gradient */}
                    <defs>
                      <linearGradient id={`gradient-${svc}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={colors[svc] || '#999'} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={colors[svc] || '#999'} stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path
                      d={smoothAreaPath}
                      fill={`url(#gradient-${svc})`}
                    />
                    {/* Smooth Line */}
                    <path
                      d={smoothLinePath}
                      fill="none"
                      stroke={colors[svc] || '#999'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Dots */}
                    {pointsData.map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r="3"
                        fill="white"
                        stroke={colors[svc] || '#999'}
                        strokeWidth="1.5"
                      />
                    ))}
                  </g>
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="w-full flex justify-between mt-2 px-6">
              {processedData.map((point: any, idx: number) => (
                <span key={idx} className="text-[10px] text-[#757575]">{point.time}</span>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 justify-center pt-4">
              {services.map(svc => (
                <div key={svc} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: colors[svc] || '#999' }}
                  />
                  <span className="text-xs text-[#424242]">{svc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseTimeChart;
