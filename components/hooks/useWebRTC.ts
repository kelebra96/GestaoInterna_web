import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface UseWebRTCProps {
  userId: string;
  conversationId: string;
  otherUserId: string;
}

interface CallState {
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
  callType: 'voice' | 'video' | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ userId, conversationId, otherUserId }: UseWebRTCProps) => {
  const [callState, setCallState] = useState<CallState>({
    remoteStream: null,
    localStream: null,
    callStatus: 'idle',
    callType: null,
    isMuted: false,
    isVideoEnabled: true,
  });

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const incomingOfferRef = useRef<SimplePeer.SignalData | null>(null);

  const endCallCleanup = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setCallState({
      remoteStream: null,
      localStream: null,
      callStatus: 'idle',
      callType: null,
      isMuted: false,
      isVideoEnabled: true,
    });
    remoteSocketIdRef.current = null;
    incomingOfferRef.current = null;
  }, []);

  useEffect(() => {
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3002';
    const signalingPath = process.env.NEXT_PUBLIC_SIGNALING_SOCKET_PATH || '/socket.io';
    const socket = io(signalingUrl, {
      path: signalingPath,
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor de sinalização com ID:', socket.id);
      socket.emit('register', { userId, conversationId });
    });

    // Servidor confirma que a chamada foi iniciada e envia o socketId do destinatário
    socket.on('call-initiated', ({ toSocketId }) => {
      console.log('📞 Chamada iniciada. Destinatário socket ID:', toSocketId);
      remoteSocketIdRef.current = toSocketId;
    });

    // Recebendo uma chamada
    socket.on('incoming-call', ({ from, offer, callType }) => {
      console.log('Incoming call from', from);
      remoteSocketIdRef.current = from;
      incomingOfferRef.current = offer;
      setCallState(prev => ({ ...prev, callStatus: 'ringing', callType }));
    });

    // A outra parte atendeu
    socket.on('call-answered', ({ from, answer }) => {
      console.log('Call answered by', from);
      remoteSocketIdRef.current = from;
      peerRef.current?.signal(answer);
    });

    // A outra parte enviou um sinal (ICE candidate)
    socket.on('ice-candidate', ({ candidate }) => {
      peerRef.current?.signal(candidate);
    });

    // A outra parte desligou
    socket.on('call-ended', () => {
      console.log('Chamada encerrada pela outra parte.');
      endCallCleanup();
    });
    
    // O usuário chamado não está disponível
    socket.on('user-unavailable', () => {
      console.log('Usuário chamado não está disponível.');
      endCallCleanup();
    });

    return () => {
      socket.disconnect();
      endCallCleanup();
    };
  }, [userId, conversationId, endCallCleanup]);

  const createPeer = (stream: MediaStream, initiator: boolean) => {
    const peer = new SimplePeer({
      initiator,
      stream,
      config: ICE_SERVERS,
      trickle: true,
    });

    peer.on('signal', (signal) => {
      if (initiator && signal.type === 'offer') {
        console.log('Enviando oferta...');
        socketRef.current?.emit('call-user', { to: otherUserId, offer: signal, callType: callState.callType });
      } else if (!initiator && signal.type === 'answer') {
        console.log('Enviando resposta...');
        socketRef.current?.emit('answer-call', { to: remoteSocketIdRef.current, answer: signal });
      } else {
        // Enviar ICE candidates
        socketRef.current?.emit('ice-candidate', { to: remoteSocketIdRef.current, candidate: signal });
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('🎥 Stream remoto recebido');
      setCallState(prev => ({ ...prev, remoteStream, callStatus: 'connected' }));
    });

    peer.on('error', (err) => console.error('❌ Erro no peer:', err));
    peer.on('close', () => endCallCleanup());

    peerRef.current = peer;
    return peer;
  };

  const startCall = useCallback(async (type: 'voice' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      localStreamRef.current = stream;
      setCallState(prev => ({ ...prev, localStream: stream, callStatus: 'calling', callType: type }));
      createPeer(stream, true);
      return true;
    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      return false;
    }
  }, [otherUserId]);

  const acceptCall = useCallback(async (type?: 'voice' | 'video', offer?: SimplePeer.SignalData) => {
    const callTypeToUse = type || callState.callType || 'voice';
    const offerToUse = offer || incomingOfferRef.current;

    if (!offerToUse) {
      console.error('Nenhuma oferta para aceitar');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callTypeToUse === 'video',
        audio: true,
      });
      localStreamRef.current = stream;
      setCallState(prev => ({ ...prev, localStream: stream, callStatus: 'connected', callType: callTypeToUse }));
      const peer = createPeer(stream, false);
      peer.signal(offerToUse);
      return true;
    } catch (error) {
      console.error('Erro ao aceitar chamada:', error);
      return false;
    }
  }, [callState.callType]);

  const endCall = useCallback(() => {
    socketRef.current?.emit('end-call', { to: remoteSocketIdRef.current });
    endCallCleanup();
  }, [endCallCleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCallState(prev => ({ ...prev, isVideoEnabled: videoTrack.enabled }));
      }
    }
  }, []);

  return { callState, startCall, acceptCall, endCall, toggleMute, toggleVideo };
};
