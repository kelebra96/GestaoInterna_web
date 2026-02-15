'use client';

import { useState } from 'react';
import { RupturaTimeSeriesChart } from './RupturaTimeSeriesChart';
import { ReceitaTimeSeriesChart } from './ReceitaTimeSeriesChart';
import { ParetoReceitaPerdidaChart } from './ParetoReceitaPerdidaChart';
import { HeatmapRupturaHorario } from './HeatmapRupturaHorario';
import { useRupturaTimeSeries, useReceitaTimeSeries, useParetoReceitaPerdida, useHeatmapRupturaHorario } from '@/hooks/useAnalytics';

interface RupturaDashboardProps {
    storeId: string;
}

export function RupturaDashboard({ storeId }: RupturaDashboardProps) {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  const { data: rupturaData, loading: rupturaLoading, error: rupturaError } = useRupturaTimeSeries(storeId, startDate, endDate);
  const { data: receitaData, loading: receitaLoading, error: receitaError } = useReceitaTimeSeries(storeId, startDate, endDate);
  const { data: paretoData, loading: paretoLoading, error: paretoError } = useParetoReceitaPerdida(storeId, startDate, endDate);
  const { data: heatmapData, loading: heatmapLoading, error: heatmapError } = useHeatmapRupturaHorario(storeId, startDate, endDate);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
      <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Evolução da Ruptura</h2>
        {rupturaLoading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : rupturaError ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-red-600">Error: {rupturaError}</div>
            </div>
        ) : (
            <RupturaTimeSeriesChart data={rupturaData} />
        )}
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Receita Real vs. Potencial</h2>
        {receitaLoading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : receitaError ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-red-600">Error: {receitaError}</div>
            </div>
        ) : (
            <ReceitaTimeSeriesChart data={receitaData} />
        )}
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Pareto de Perda de Receita</h2>
        {paretoLoading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : paretoError ? (
            <div className="h-64 flex items-center justify-center">
                <div className="text-red-600">Error: {paretoError}</div>
            </div>
        ) : (
            <ParetoReceitaPerdidaChart data={paretoData} />
        )}
      </div>
      <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Heatmap de Ruptura por Horário</h2>
        {heatmapLoading ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : heatmapError ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-red-600">Error: {heatmapError}</div>
            </div>
        ) : (
            <HeatmapRupturaHorario data={heatmapData} />
        )}
      </div>
    </div>
  );
}