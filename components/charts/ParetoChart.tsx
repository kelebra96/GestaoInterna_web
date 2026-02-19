'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

interface DataPoint {
  productName: string;
  ean?: string;
  valor: number;
  count: number;
  percentualAcumulado: number;
}

interface ParetoChartProps {
  data: DataPoint[];
  primaryColor?: string;
  successColor?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isAbove80 = data.percentualAcumulado > 80;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-white/20 ring-1 ring-black/5 min-w-[200px]">
        <h4 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2 leading-tight">
          {label}
        </h4>
        {data.ean && (
          <p className="text-[10px] text-slate-400 font-mono mb-2">EAN: {data.ean}</p>
        )}
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Valor Total</span>
            <span className="text-sm font-bold text-slate-700">
              R$ {data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Acumulado</span>
            <span className={`text-sm font-bold ${isAbove80 ? 'text-amber-500' : 'text-teal-600'}`}>
              {data.percentualAcumulado.toFixed(1)}%
            </span>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full rounded-full ${isAbove80 ? 'bg-amber-400' : 'bg-teal-500'}`} 
              style={{ width: `${Math.min(data.percentualAcumulado, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const ParetoChart: React.FC<ParetoChartProps> = ({
  data,
  primaryColor = '#16476A',
  successColor = '#3B9797'
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[260px] bg-slate-50/50 rounded-xl border-dashed border-2 border-slate-200">
        <p className="text-slate-400 font-medium">Sem dados para análise de Pareto</p>
      </div>
    );
  }

  // Limitar a top 15 para não poluir o gráfico
  const chartData = data.slice(0, 15).map(d => ({
    ...d,
    // Truncar nome longo para o eixo X
    shortName: d.productName.length > 12 ? d.productName.substring(0, 12) + '...' : d.productName
  }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          
          <XAxis 
            dataKey="shortName" 
            angle={-45} 
            textAnchor="end"
            height={60}
            tick={{ fill: '#64748b', fontSize: 10 }}
            interval={0}
          />
          
          {/* Eixo Y da Esquerda: Valor Monetário */}
          <YAxis 
            yAxisId="left"
            orientation="left"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          
          {/* Eixo Y da Direita: Porcentagem */}
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fill: successColor, fontSize: 10, fontWeight: 600 }}
            tickFormatter={(value) => `${value}%`}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            width={35}
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
          
          <ReferenceLine 
            y={80} 
            yAxisId="right" 
            stroke="#f59e0b" 
            strokeDasharray="4 4" 
            label={{ position: 'right', value: '80%', fill: '#f59e0b', fontSize: 10 }}
          />

          <Bar 
            yAxisId="left" 
            dataKey="valor" 
            barSize={24}
            radius={[4, 4, 0, 0]}
            animationDuration={1500}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={primaryColor} 
                fillOpacity={entry.percentualAcumulado <= 80 ? 1 : 0.6} // Destaque visual para os top 80%
              />
            ))}
          </Bar>
          
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="percentualAcumulado"
            stroke={successColor}
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: successColor, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0, fill: successColor }}
            animationDuration={1500}
            animationBegin={200}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ParetoChart;
