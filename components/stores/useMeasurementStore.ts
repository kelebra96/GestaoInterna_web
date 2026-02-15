import { create } from 'zustand';
import * as THREE from 'three';

export interface MeasurementPoint {
  id: string;
  position: THREE.Vector3;
  timestamp: number;
}

export interface Measurement {
  length: number; // cm
  width: number; // cm
  height: number; // cm
  volume: number; // cm³
  volumeM3: number; // m³
}

interface MeasurementState {
  // Pontos marcados pelo usuário
  points: MeasurementPoint[];

  // Medidas calculadas
  measurement: Measurement | null;

  // Estado da sessão AR
  isARSupported: boolean;
  isARActive: boolean;

  // Ações
  addPoint: (position: THREE.Vector3) => void;
  removeLastPoint: () => void;
  reset: () => void;
  calculateMeasurement: () => void;
  setARSupported: (supported: boolean) => void;
  setARActive: (active: boolean) => void;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  points: [],
  measurement: null,
  isARSupported: false,
  isARActive: false,

  addPoint: (position: THREE.Vector3) => {
    const newPoint: MeasurementPoint = {
      id: `point-${Date.now()}`,
      position: position.clone(),
      timestamp: Date.now(),
    };

    set((state) => ({
      points: [...state.points, newPoint],
    }));

    // Calcula automaticamente quando tiver 4 pontos (para formar um bounding box)
    const { points } = get();
    if (points.length === 4) {
      get().calculateMeasurement();
    }
  },

  removeLastPoint: () => {
    set((state) => ({
      points: state.points.slice(0, -1),
      measurement: null,
    }));
  },

  reset: () => {
    set({
      points: [],
      measurement: null,
    });
  },

  calculateMeasurement: () => {
    const { points } = get();

    if (points.length < 2) {
      console.warn('Precisa de pelo menos 2 pontos para calcular');
      return;
    }

    if (points.length === 4) {
      // Calcula bounding box a partir dos 4 pontos
      const positions = points.map((p) => p.position);

      // Encontra min/max para criar bounding box
      const min = new THREE.Vector3(
        Math.min(...positions.map(p => p.x)),
        Math.min(...positions.map(p => p.y)),
        Math.min(...positions.map(p => p.z))
      );

      const max = new THREE.Vector3(
        Math.max(...positions.map(p => p.x)),
        Math.max(...positions.map(p => p.y)),
        Math.max(...positions.map(p => p.z))
      );

      // Calcula dimensões em metros
      const lengthM = Math.abs(max.x - min.x);
      const widthM = Math.abs(max.z - min.z);
      const heightM = Math.abs(max.y - min.y);

      // Converte para centímetros
      const length = lengthM * 100;
      const width = widthM * 100;
      const height = heightM * 100;

      // Calcula volume
      const volumeCm3 = length * width * height;
      const volumeM3 = volumeCm3 / 1000000;

      set({
        measurement: {
          length: parseFloat(length.toFixed(2)),
          width: parseFloat(width.toFixed(2)),
          height: parseFloat(height.toFixed(2)),
          volume: parseFloat(volumeCm3.toFixed(2)),
          volumeM3: parseFloat(volumeM3.toFixed(6)),
        },
      });
    } else if (points.length === 2) {
      // Calcula apenas distância entre 2 pontos
      const distance = points[0].position.distanceTo(points[1].position);
      const distanceCm = distance * 100;

      set({
        measurement: {
          length: parseFloat(distanceCm.toFixed(2)),
          width: 0,
          height: 0,
          volume: 0,
          volumeM3: 0,
        },
      });
    }
  },

  setARSupported: (supported: boolean) => {
    set({ isARSupported: supported });
  },

  setARActive: (active: boolean) => {
    set({ isARActive: active });
  },
}));
