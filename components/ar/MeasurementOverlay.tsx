'use client';

import { useMeasurementStore } from '@/stores/useMeasurementStore';
import { useState } from 'react';
import { Ruler, RotateCcw, Save, Box, Maximize } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saveMeasurement } from '@/lib/ar/measurementService';
import toast from 'react-hot-toast';

interface MeasurementOverlayProps {
  onStartAR: () => void;
}

export function MeasurementOverlay({ onStartAR }: MeasurementOverlayProps) {
  const { points, measurement, reset, removeLastPoint, isARActive } = useMeasurementStore();
  const { user } = useAuth();
  const [savedMeasurements, setSavedMeasurements] = useState<any[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!measurement || !user) {
      toast.error('Erro: usuário não autenticado');
      return;
    }

    setIsSaving(true);

    try {
      // Salva no Firebase
      const measurementId = await saveMeasurement(measurement, user.uid, {
        pointsCount: points.length,
      });

      const newMeasurement = {
        id: measurementId,
        ...measurement,
        timestamp: new Date().toISOString(),
        pointsCount: points.length,
      };

      setSavedMeasurements((prev) => [...prev, newMeasurement]);

      // Backup no localStorage
      const saved = JSON.parse(localStorage.getItem('ar-measurements') || '[]');
      saved.push(newMeasurement);
      localStorage.setItem('ar-measurements', JSON.stringify(saved));

      toast.success('Medição salva com sucesso!');

      // Reset após salvar
      setTimeout(() => {
        reset();
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao salvar medição:', error);
      toast.error(error.message || 'Erro ao salvar medição');
    } finally {
      setIsSaving(false);
    }
  };

  const getInstructions = () => {
    if (!isARActive) {
      return 'Toque em "Iniciar AR" para começar';
    }

    if (points.length === 0) {
      return 'Aponte a câmera para uma superfície plana e toque para marcar o primeiro ponto';
    }

    if (points.length === 1) {
      return 'Marque o segundo ponto para medir distância';
    }

    if (points.length === 2) {
      return 'Continue marcando pontos (4 total) para criar um volume';
    }

    if (points.length === 3) {
      return 'Marque o último ponto para completar o volume';
    }

    return 'Volume calculado! Salve ou reset para nova medição';
  };

  return (
    <>
      {/* Header com instruções */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-sm mb-1">Medição Volumétrica AR</h2>
              <p className="text-white/80 text-xs leading-relaxed">{getInstructions()}</p>
            </div>
          </div>

          {/* Contador de pontos */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < points.length ? 'bg-green-400 scale-125' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <span className="text-white/60 text-xs font-medium">
              {points.length}/4 pontos marcados
            </span>
          </div>
        </div>
      </div>

      {/* Painel de resultados */}
      {measurement && (
        <div className="absolute top-24 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] p-4">
            <div className="flex items-center gap-2 text-white">
              <Box className="w-5 h-5" />
              <h3 className="font-bold">Resultado da Medição</h3>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Dimensões */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-600 mb-1 font-medium">Comprimento</div>
                <div className="text-lg font-bold text-[#16476A]">{measurement.length}</div>
                <div className="text-xs text-gray-500">cm</div>
              </div>

              <div className="bg-green-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-600 mb-1 font-medium">Largura</div>
                <div className="text-lg font-bold text-[#3B9797]">{measurement.width}</div>
                <div className="text-xs text-gray-500">cm</div>
              </div>

              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-600 mb-1 font-medium">Altura</div>
                <div className="text-lg font-bold text-purple-600">{measurement.height}</div>
                <div className="text-xs text-gray-500">cm</div>
              </div>
            </div>

            {/* Volume */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Maximize className="w-4 h-4" />
                  Volume Total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-[#BF092F]">{measurement.volume}</div>
                  <div className="text-xs text-gray-500">centímetros cúbicos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#BF092F]">{measurement.volumeM3}</div>
                  <div className="text-xs text-gray-500">metros cúbicos</div>
                </div>
              </div>
            </div>

            {/* Nota de precisão */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-800">
                <span className="font-bold">⚠️ Nota:</span> As medições são aproximadas e dependem da
                precisão do sensor do dispositivo. Para medições profissionais, use equipamento
                especializado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          {/* Botão Resetar */}
          <button
            type="button"
            onClick={reset}
            disabled={points.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md text-white py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-all border border-white/30 shadow-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>

          {/* Botão Desfazer */}
          {points.length > 0 && (
            <button
              type="button"
              onClick={removeLastPoint}
              className="flex items-center justify-center gap-2 bg-yellow-500/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl font-bold hover:bg-yellow-600 transition-all shadow-lg"
            >
              ← Desfazer
            </button>
          )}

          {/* Botão Salvar */}
          {measurement && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-2xl font-bold hover:from-green-600 hover:to-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar
                </>
              )}
            </button>
          )}

          {/* Botão Iniciar AR */}
          {!isARActive && (
            <button
              type="button"
              onClick={onStartAR}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white py-4 rounded-2xl font-bold hover:from-[#132440] hover:to-[#16476A] transition-all shadow-lg"
            >
              <Box className="w-5 h-5" />
              Iniciar AR
            </button>
          )}
        </div>

        {/* Botão Ver Salvos */}
        {savedMeasurements.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSaved(!showSaved)}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md text-white py-3 rounded-xl text-sm font-medium hover:bg-white/20 transition-all border border-white/20"
          >
            📊 {savedMeasurements.length} Medições Salvas
          </button>
        )}
      </div>

      {/* Modal de medições salvas */}
      {showSaved && savedMeasurements.length > 0 && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-[#16476A] to-[#3B9797] p-6">
              <div className="flex items-center justify-between text-white">
                <h3 className="text-xl font-bold">Medições Salvas</h3>
                <button
                  type="button"
                  onClick={() => setShowSaved(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {savedMeasurements.map((saved, index) => (
                <div key={saved.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-700">
                      Medição #{savedMeasurements.length - index}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(saved.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                    <div>
                      <div className="text-gray-600">Comp.</div>
                      <div className="font-bold text-[#16476A]">{saved.length} cm</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Larg.</div>
                      <div className="font-bold text-[#3B9797]">{saved.width} cm</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Alt.</div>
                      <div className="font-bold text-purple-600">{saved.height} cm</div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-600">Volume</div>
                    <div className="font-bold text-[#BF092F]">{saved.volumeM3} m³</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
