// web/lib/types/analytics.ts

export type TimeSeriesPoint = {
  date: string; // ISO date string
  value: number;
};

export type RupturaTimeSeriesPoint = {
  date: string;
  rupturaPercent: number;
};

export type ReceitaTimeSeriesPoint = {
  date: string;
  receitaReal: number;
  receitaPotencial: number;
};

export type OcupacaoTimeSeriesPoint = {
  date: string;
  ocupacaoMedia: number;
  categoria?: string;
  loja?: string;
};

export type ParetoItem = {
  label: string;
  valor: number;
  percentualAcumulado: number;
};

export type HeatmapCell = {
  eixoX: string;
  eixoY: string;
  valor: number;
};

export type ScatterPoint = {
  x: number;
  y: number;
  label?: string;
  size?: number;
  colorKey?: string;
};

export type WaterfallStep = {
  label: string;
  value: number;
  type: "base" | "delta";
};
