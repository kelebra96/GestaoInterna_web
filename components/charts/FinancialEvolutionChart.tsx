'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface DataPoint {
  date: string;
  valor: number;
  projetado: boolean;
}

interface FinancialEvolutionChartProps {
  data: DataPoint[];
  mediaValorDiario?: number;
  primaryColor?: string;
  successColor?: string;
}

/** Formata "2026-02-15" ou ISO completo para "15/02" */
function fmtDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** Formata "2026-02-15" para "Sáb, 15 de fev" */
function fmtDateLong(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  } catch {
    return raw;
  }
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const isProjected = data.projetado;
  const value = data.valor || 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(8px)',
      padding: '12px 16px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      border: '1px solid rgba(0,0,0,0.06)',
      minWidth: 140
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
        {fmtDateLong(data.date)}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isProjected ? '#3B9797' : '#16476A'
        }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
      {isProjected && (
        <span style={{
          display: 'inline-block', marginTop: 6,
          fontSize: 9, fontWeight: 700, color: '#0d9488',
          background: '#f0fdfa', padding: '2px 6px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          Projeção
        </span>
      )}
    </div>
  );
};

const FinancialEvolutionChart: React.FC<FinancialEvolutionChartProps> = ({
  data,
  mediaValorDiario = 0,
  primaryColor = '#16476A',
  successColor = '#3B9797'
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    const lastRealItem = [...data].filter(d => !d.projetado).pop();

    return data.map(d => ({
      ...d,
      dateFormatted: fmtDate(d.date),
      valorReal: !d.projetado ? d.valor : null,
      valorProjetado: d.projetado ? d.valor : (d === lastRealItem ? d.valor : null),
    }));
  }, [data]);

  if (!mounted) {
    return <div style={{ width: '100%', height: 320, background: '#f8fafc', borderRadius: 12 }} />;
  }

  if (!processedData || processedData.length === 0) {
    return (
      <div style={{ width: '100%', height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
        <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>Sem dados financeiros para o período</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="areaProj" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={successColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={successColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="dateFormatted"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickMargin={10}
            minTickGap={30}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            width={35}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          {mediaValorDiario > 0 && (
            <ReferenceLine
              y={mediaValorDiario}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ position: 'insideTopRight', value: 'Média', fill: '#94a3b8', fontSize: 10 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="valorReal"
            stroke={primaryColor}
            strokeWidth={2}
            fill="url(#areaReal)"
            activeDot={{ r: 4, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
            connectNulls={false}
            animationDuration={1000}
          />

          <Area
            type="monotone"
            dataKey="valorProjetado"
            stroke={successColor}
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="url(#areaProj)"
            activeDot={{ r: 4, fill: successColor, stroke: '#fff', strokeWidth: 2 }}
            connectNulls={true}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FinancialEvolutionChart;
