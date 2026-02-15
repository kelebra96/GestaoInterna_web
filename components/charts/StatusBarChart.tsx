'use client';

import React, { useEffect, useState } from 'react';

interface DataPoint {
  name: string;
  value: number;
  color: string;
}

interface StatusBarChartProps {
  data: DataPoint[];
}

const StatusBarChart: React.FC<StatusBarChartProps> = ({ data }) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const maxValue = Math.max(...data.map(d => d.value), 1); // Evitar divisão por zero

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <span className="text-sm font-medium">Nenhum dado disponível</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Total amount header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Geral</span>
        <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
          R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Main Bars */}
      <div className="space-y-5">
        {data.map((item, idx) => {
          const percentage = (item.value / total) * 100;
          // Width calculation with delay based on index
          const barWidth = mounted ? (item.value / maxValue) * 100 : 0;
          
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-white"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-bold text-slate-700">{item.name}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md min-w-[3.5rem] text-center shadow-sm border border-slate-100/50"
                    style={{
                      backgroundColor: `${item.color}10`, // 10% opacity
                      color: item.color,
                      borderColor: `${item.color}20`
                    }}
                  >
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Bar track */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200/50">
                {/* Visual Bar */}
                <div
                  className="h-full rounded-full relative overflow-hidden transition-all ease-out"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: item.color,
                    transitionDuration: '1000ms',
                    transitionDelay: `${idx * 150}ms`
                  }}
                >
                  {/* Shimmer overlay animation */}
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composition footer (visualização compacta) */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição</span>
        </div>
        
        {/* Stacked bar */}
        <div className="flex h-2 w-full rounded-full overflow-hidden ring-1 ring-slate-200 shadow-sm">
          {data.map((item, idx) => {
            const width = mounted ? (item.value / total) * 100 : 0;
            return (
              <div
                key={idx}
                className="h-full transition-all duration-1000 ease-in-out hover:opacity-80"
                style={{
                  width: `${width}%`,
                  backgroundColor: item.color,
                  transitionDelay: '500ms'
                }}
                title={`${item.name}: ${(item.value / total * 100).toFixed(1)}%`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatusBarChart;
