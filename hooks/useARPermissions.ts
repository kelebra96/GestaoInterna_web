import { useState, useEffect } from 'react';

export interface ARPermissionsState {
  camera: PermissionState | 'unknown';
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
}

type PermissionState = 'granted' | 'denied' | 'prompt';

export function useARPermissions() {
  const [state, setState] = useState<ARPermissionsState>({
    camera: 'unknown',
    isLoading: true,
    error: null,
    isSupported: false,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Verifica se o navegador suporta WebXR
      if (!('xr' in navigator)) {
        setState({
          camera: 'unknown',
          isLoading: false,
          error: 'WebXR não é suportado neste navegador. Use Safari no iOS 15+ ou Chrome/Edge no Android.',
          isSupported: false,
        });
        return;
      }

      // @ts-ignore
      const supported = await navigator.xr?.isSessionSupported('immersive-ar');

      if (!supported) {
        setState({
          camera: 'unknown',
          isLoading: false,
          error: 'Realidade Aumentada não é suportada neste dispositivo.',
          isSupported: false,
        });
        return;
      }

      // Verifica permissão de câmera
      if ('permissions' in navigator) {
        try {
          const cameraPermission = await navigator.permissions.query({
            // @ts-ignore - camera não está nos tipos oficiais ainda
            name: 'camera',
          });

          setState({
            camera: cameraPermission.state as PermissionState,
            isLoading: false,
            error: null,
            isSupported: true,
          });

          // Observa mudanças na permissão
          cameraPermission.onchange = () => {
            setState((prev) => ({
              ...prev,
              camera: cameraPermission.state as PermissionState,
            }));
          };
        } catch (error) {
          // Fallback: assume que a permissão será solicitada quando iniciar AR
          setState({
            camera: 'prompt',
            isLoading: false,
            error: null,
            isSupported: true,
          });
        }
      } else {
        // Navegador não suporta Permissions API - assume prompt
        setState({
          camera: 'prompt',
          isLoading: false,
          error: null,
          isSupported: true,
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar permissões:', error);
      setState({
        camera: 'unknown',
        isLoading: false,
        error: error.message || 'Erro ao verificar permissões',
        isSupported: false,
      });
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Solicita acesso à câmera via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // Para o stream imediatamente (só queríamos a permissão)
      stream.getTracks().forEach((track) => track.stop());

      setState((prev) => ({
        ...prev,
        camera: 'granted',
        error: null,
      }));

      return true;
    } catch (error: any) {
      console.error('Erro ao solicitar permissões:', error);

      const errorMessage =
        error.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Por favor, habilite nas configurações do navegador.'
          : error.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : 'Erro ao solicitar permissão de câmera.';

      setState((prev) => ({
        ...prev,
        camera: 'denied',
        error: errorMessage,
      }));

      return false;
    }
  };

  return {
    ...state,
    requestPermissions,
    recheckPermissions: checkPermissions,
  };
}
