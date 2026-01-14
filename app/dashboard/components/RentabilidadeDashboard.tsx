'use client';

import { useState } from 'react';
import { ExecucaoVsRentabilidadeScatter } from './ExecucaoVsRentabilidadeScatter';
import { MargemWaterfallChart } from './MargemWaterfallChart';
import { HeatmapRentabilidadeCategoriaLoja } from './HeatmapRentabilidadeCategoriaLoja';
import { useExecucaoVsRentabilidadeScatter, useMargemWaterfall, useHeatmapRentabilidadeCategoriaLoja } from '@/hooks/useAnalytics';

interface RentabilidadeDashboardProps {
    storeId: string;
}

export function RentabilidadeDashboard({ storeId }: RentabilidadeDashboardProps) {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  const { data: scatterData, loading: scatterLoading, error: scatterError } = useExecucaoVsRentabilidadeScatter(storeId, startDate, endDate);
  const { data: waterfallData, loading: waterfallLoading, error: waterfallError } = useMargemWaterfall(storeId, startDate, endDate);
  const { data: heatmapData, loading: heatmapLoading, error: heatmapError } = useHeatmapRentabilidadeCategoriaLoja(startDate, endDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
      <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Execução vs. Rentabilidade (Scatter Plot)</h2>
        {scatterLoading ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : scatterError ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-red-600">Error: {scatterError}</div>
            </div>
        ) : (
            <ExecucaoVsRentabilidadeScatter data={scatterData} />
        )}
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Cascata de Margem (Waterfall)</h2>
        {waterfallLoading ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : waterfallError ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-red-600">Error: {waterfallError}</div>
            </div>
        ) : (
            <MargemWaterfallChart data={waterfallData} />
        )}
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Heatmap de Rentabilidade</h2>
        {heatmapLoading ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-gray-600">Loading chart...</div>
            </div>
        ) : heatmapError ? (
            <div className="h-96 flex items-center justify-center">
                <div className="text-red-600">Error: {heatmapError}</div>
            </div>
        ) : (
            <HeatmapRentabilidadeCategoriaLoja data={heatmapData} />
        )}
      </div>
    </div>
  );
}
