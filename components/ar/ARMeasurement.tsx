'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useMeasurementStore } from '@/stores/useMeasurementStore';
import { useARPermissions } from '@/hooks/useARPermissions';
import { ARScene } from './ARScene';
import { MeasurementOverlay } from './MeasurementOverlay';
import { Camera, AlertCircle } from 'lucide-react';

export function ARMeasurement() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { isARSupported, setARSupported, setARActive } = useMeasurementStore();
  const {
    camera: cameraPermission,
    isLoading: permissionsLoading,
    error: permissionsError,
    isSupported: arSupported,
    requestPermissions,
  } = useARPermissions();

  useEffect(() => {
    // Verifica suporte a WebXR
    const checkARSupport = async () => {
      if ('xr' in navigator) {
        try {
          // @ts-ignore - WebXR types ainda não são totalmente suportados
          const supported = await navigator.xr?.isSessionSupported('immersive-ar');
          setARSupported(supported);

          if (!supported) {
            setError('Seu dispositivo não suporta WebXR AR. Use um dispositivo compatível (iPhone com iOS 15+).');
          }
        } catch (err) {
          console.error('Erro ao verificar suporte AR:', err);
          setError('Não foi possível verificar o suporte a AR. Certifique-se de estar usando HTTPS.');
          setARSupported(false);
        }
      } else {
        setError('WebXR não está disponível neste navegador. Use o Safari no iOS 15+ ou Chrome/Edge no Android.');
        setARSupported(false);
      }
    };

    checkARSupport();
  }, [setARSupported]);

  const startARSession = async () => {
    try {
      if (!('xr' in navigator)) {
        throw new Error('WebXR não disponível');
      }

      // Verifica e solicita permissão de câmera se necessário
      if (cameraPermission === 'prompt' || cameraPermission === 'unknown') {
        const granted = await requestPermissions();
        if (!granted) {
          setError('Permissão de câmera necessária para usar AR');
          return;
        }
      }

      if (cameraPermission === 'denied') {
        setError('Permissão de câmera negada. Por favor, habilite nas configurações do navegador.');
        return;
      }

      setARActive(true);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao iniciar sessão AR:', err);
      setError(err.message || 'Falha ao iniciar AR');
      setARActive(false);
    }
  };

  // Tela de erro para AR não suportado
  if (error && !arSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#132440] to-[#16476A] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121] text-center mb-3">
            AR Não Suportado
          </h1>
          <p className="text-[#757575] text-center mb-6">{error || permissionsError}</p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-bold text-[#16476A] mb-2">Requisitos:</h3>
            <ul className="text-sm text-[#757575] space-y-1">
              <li>• iPhone com iOS 15 ou superior</li>
              <li>• Safari como navegador</li>
              <li>• Conexão HTTPS ativa</li>
              <li>• Permissão de câmera concedida</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Tela de solicitação de permissão
  if (arSupported && cameraPermission === 'prompt') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#132440] to-[#16476A] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-[#16476A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121] text-center mb-3">
            Permissão de Câmera
          </h1>
          <p className="text-[#757575] text-center mb-6">
            Para usar a funcionalidade de medição AR, precisamos acessar sua câmera.
          </p>

          <button
            type="button"
            onClick={requestPermissions}
            className="w-full bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white py-4 rounded-2xl font-bold hover:from-[#132440] hover:to-[#16476A] transition-all shadow-lg mb-3"
          >
            Permitir Acesso à Câmera
          </button>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs text-yellow-800">
              <span className="font-bold">💡 Dica:</span> Esta permissão é necessária apenas para a
              funcionalidade de Realidade Aumentada. Você pode revogá-la a qualquer momento nas
              configurações do navegador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de permissão negada
  if (arSupported && cameraPermission === 'denied') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#132440] to-[#16476A] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121] text-center mb-3">
            Permissão Negada
          </h1>
          <p className="text-[#757575] text-center mb-6">
            A permissão de câmera foi negada. Para usar AR, você precisa habilitar a permissão nas
            configurações do navegador.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="font-bold text-[#16476A] mb-2">Como habilitar no Safari (iOS):</h3>
            <ol className="text-sm text-[#757575] space-y-1 list-decimal list-inside">
              <li>Abra as Configurações do iPhone</li>
              <li>Role até encontrar "Safari"</li>
              <li>Toque em "Câmera"</li>
              <li>Selecione "Permitir"</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white py-4 rounded-2xl font-bold hover:from-[#132440] hover:to-[#16476A] transition-all shadow-lg"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Canvas Three.js com WebXR */}
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 1.6, 0], fov: 75 }}
        gl={{
          xr: {
            enabled: true,
          },
        }}
        className="w-full h-full"
      >
        <ARScene onSessionStart={() => setARActive(true)} />
      </Canvas>

      {/* UI Overlay */}
      <MeasurementOverlay onStartAR={startARSession} />

      {/* Loading indicator */}
      {!isARSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center shadow-2xl">
            <div className="w-12 h-12 border-4 border-[#16476A] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[#212121] font-medium">Verificando suporte AR...</p>
          </div>
        </div>
      )}
    </div>
  );
}
