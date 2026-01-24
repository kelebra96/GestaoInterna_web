'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, RefreshCw, User, Clock, MessageSquare, Paperclip, Check, CheckCheck, MoreVertical, Phone, Video, Info, Image, Smile, Circle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { supabase } from '@/lib/supabase-client';
import DOMPurify from 'dompurify';

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  createdAt: string;
  read: boolean;
  attachments?: Attachment[];
  deletedBy?: string[];
  deletedForEveryone?: boolean;
  deletedForEveryoneAt?: string | null;
}

interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage?: string;
  unreadCount: Record<string, number>;
  onlineStatus?: Record<string, boolean>;
  createdAt?: string;
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const conversationId = params?.id;

  const currentUserId = user?.uid || '';
  const currentUserName = user?.displayName || 'Usuário';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Estados para menu de contexto e exclusão
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string; createdAt: string; isSender: boolean } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  // Estados para funcionalidades do header
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // WebRTC Hook
  const otherUserId = conversation?.participants.find(p => p !== currentUserId) || '';
  const {
    callState,
    startCall,
    acceptCall,
    endCall: endWebRTCCall,
    toggleMute,
    toggleVideo,
  } = useWebRTC({
    userId: currentUserId,
    conversationId: conversationId || '',
    otherUserId,
  });

  // Effect para conectar áudio remoto (chamadas de voz)
  useEffect(() => {
    if (remoteAudioRef.current && callState.remoteStream) {
      console.log('🔊 Conectando stream de áudio remoto');
      remoteAudioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  const fetchData = async () => {
    if (!conversationId) return;
    try {
      const url = currentUserId
        ? `/api/mensagens/${conversationId}?userId=${currentUserId}`
        : `/api/mensagens/${conversationId}`;

      console.log('🔄 DEBUG: Buscando mensagens com URL:', url);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha');
      const json = await res.json();
      console.log('🔄 DEBUG: Mensagens recebidas:', json.messages?.length || 0);

      console.log('🔍 DEBUG - Conversa individual:', {
        conversationId,
        onlineStatus: json.conversation?.onlineStatus,
        participants: json.conversation?.participants,
        currentUserId
      });

      setConversation(json.conversation);
      setMessages(json.messages || []);
      try {
        const unreadCount = json?.conversation?.unreadCount?.[currentUserId] || 0;
        if (currentUserId && unreadCount > 0) {
          await fetch(`/api/mensagens/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId }),
          });
        }
      } catch (e) {
        console.error('Error auto-marking as read:', e);
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!conversationId) return;
    try {
      await fetch(`/api/mensagens/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
    } catch (e) {
      console.error('Erro ao marcar como lidas:', e);
    }
  };

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    fetchData();
    markAsRead();

    console.log('🔥 Configurando listener Supabase para conversationId:', conversationId);

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('🔥 Supabase Realtime Message:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            const formattedMsg: Message = {
              id: newMsg.id,
              conversationId: newMsg.conversation_id,
              senderId: newMsg.sender_id,
              senderName: newMsg.sender_name,
              receiverId: newMsg.receiver_id,
              text: newMsg.text,
              createdAt: newMsg.created_at,
              read: newMsg.read,
              attachments: newMsg.attachments || [],
              deletedBy: newMsg.deleted_for || [], // Mapeando deleted_for do banco para deletedBy
              deletedForEveryone: newMsg.deleted_for_all,
              deletedForEveryoneAt: newMsg.deleted_for_all_at
            };
            
            setMessages((prev) => {
              // Evitar duplicatas
              if (prev.find(m => m.id === formattedMsg.id)) return prev;
              return [...prev, formattedMsg];
            });

            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

            if (formattedMsg.receiverId === currentUserId) {
              markAsRead();
            }
          } else {
            // Para UPDATE ou DELETE, recarregar tudo é mais seguro para garantir consistência
            // (Ex: mensagem deletada para todos, editada, ou lida)
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔥 Removendo listener Supabase');
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }

      if (contextMenu && !target.closest('.context-menu-container')) {
        console.log('🖱️ Fechando menu de contexto (clique fora)');
        setContextMenu(null);
      }

      if (showMoreMenu && !target.closest('.more-menu-button') && !target.closest('.more-menu-dropdown')) {
        setShowMoreMenu(false);
      }
    };

    if (showEmojiPicker || contextMenu || showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, contextMenu, showMoreMenu]);

  const handleSend = async () => {
    if ((!messageText.trim() && !selectedFile) || !conversation) return;
    if (!currentUserId) {
      alert('Sessão inválida. Faça login novamente para enviar mensagens.');
      return;
    }

    const text = messageText.trim();
    setMessageText('');
    setSending(true);
    setUploading(!!selectedFile);

    try {
      const otherUserId = conversation.participants.find(p => p !== currentUserId);
      if (!otherUserId) throw new Error('Destinatário não encontrado');

      let attachments: Attachment[] = [];

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('conversationId', conversationId || '');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Falha ao fazer upload do arquivo');
        }

        const uploadData = await uploadRes.json();
        attachments = [uploadData.attachment];
      }

      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderName: currentUserName,
          receiverId: otherUserId,
          text: text || (selectedFile ? `Enviou um ${selectedFile.type.startsWith('image/') ? 'imagem' : 'arquivo'}` : ''),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Falha ao enviar');
      }

      clearSelectedFile();
      await fetchData();
    } catch (e) {
      console.error('Erro ao enviar:', e);
      setMessageText(text);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande! Tamanho máximo: 10MB');
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      setFilePreview(null);
      e.target.value = '';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Imagem muito grande! Tamanho máximo: 10MB');
        e.target.value = '';
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      e.target.value = '';
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleEmojiClick = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message, isMine: boolean) => {
    console.log('🖱️ Botão direito clicado', { isMine, msgId: msg.id, deletedForEveryone: msg.deletedForEveryone });

    if (!isMine) {
      console.log('🖱️ Menu bloqueado: não é mensagem própria');
      return;
    }
    if (msg.deletedForEveryone) {
      console.log('🖱️ Menu bloqueado: mensagem já deletada para todos');
      return;
    }

    e.preventDefault();
    const isSender = msg.senderId === currentUserId;
    console.log('🖱️ Abrindo menu de contexto', { isSender, messageId: msg.id });

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId: msg.id,
      createdAt: msg.createdAt,
      isSender,
    });
  };

  const isWithin30Minutes = (createdAt: string): boolean => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
    return diffMinutes <= 30;
  };

  const handleDeleteForMeClick = () => {
    console.log('📝 Clicou em "Excluir para mim"', contextMenu);
    if (contextMenu) {
      setMessageToDelete(contextMenu.messageId);
      setDeleteForEveryone(false);
      setShowDeleteModal(true);
      setContextMenu(null);
      console.log('📝 Modal de exclusão aberta (para mim)');
    }
  };

  const handleDeleteForEveryoneClick = () => {
    console.log('📝 Clicou em "Excluir para todos"', contextMenu);
    if (contextMenu) {
      setMessageToDelete(contextMenu.messageId);
      setDeleteForEveryone(true);
      setShowDeleteModal(true);
      setContextMenu(null);
      console.log('📝 Modal de exclusão aberta (para todos)');
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !currentUserId) {
      console.error('DEBUG: Faltam dados para deletar', { messageToDelete, currentUserId });
      return;
    }

    const url = deleteForEveryone
      ? `/api/mensagens/message/${messageToDelete}?forEveryone=true`
      : `/api/mensagens/message/${messageToDelete}`;

    console.log('DEBUG: Tentando deletar mensagem', {
      messageId: messageToDelete,
      userId: currentUserId,
      forEveryone: deleteForEveryone,
      url
    });

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });

      console.log('DEBUG: Resposta da API', {
        status: res.status,
        ok: res.ok
      });

      const responseData = await res.json();
      console.log('DEBUG: Dados da resposta', responseData);

      if (!res.ok) {
        throw new Error(responseData.error || 'Falha ao deletar');
      }

      setShowDeleteModal(false);
      setMessageToDelete(null);
      setDeleteForEveryone(false);
      console.log('DEBUG: Recarregando mensagens...');
      await fetchData();
      console.log('DEBUG: Mensagens recarregadas');
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      alert(`Erro ao deletar mensagem: ${error}`);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall]);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  useEffect(() => {
    if (callState.callStatus === 'ringing') {
      if (callState.callType === 'video') {
        setShowVideoCallModal(true);
      } else {
        setShowVoiceCallModal(true);
      }
    } else if (callState.callStatus === 'connected' && !isInCall) {
      setIsInCall(true);
    } else if (callState.callStatus === 'idle' && (isInCall || showVoiceCallModal || showVideoCallModal)) {
      setIsInCall(false);
      setShowVoiceCallModal(false);
      setShowVideoCallModal(false);
    }
  }, [callState.callStatus, callState.callType, isInCall, showVoiceCallModal, showVideoCallModal]);

  const handleVoiceCall = async () => {
    const success = await startCall('voice');
    if (success) {
      setShowVoiceCallModal(true);
      setIsInCall(true);
    }
  };

  const handleVideoCall = async () => {
    const success = await startCall('video');
    if (success) {
      setShowVideoCallModal(true);
      setIsInCall(true);
    }
  };

  const handleEndCall = () => {
    endWebRTCCall();
    setIsInCall(false);
    setShowVoiceCallModal(false);
    setShowVideoCallModal(false);
    setCallDuration(0);
  };

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClearConversation = async () => {
    if (!confirm('Tem certeza que deseja limpar todas as mensagens desta conversa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const deletePromises = messages.map(msg =>
        fetch(`/api/mensagens/message/${msg.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId }),
        })
      );

      await Promise.all(deletePromises);
      await fetchData();
      setShowMoreMenu(false);
      alert('Conversa limpa com sucesso!');
    } catch (error) {
      console.error('Erro ao limpar conversa:', error);
      alert('Erro ao limpar conversa');
    }
  };

  const handleMuteConversation = () => {
    alert('Conversa silenciada! (funcionalidade em desenvolvimento)');
    setShowMoreMenu(false);
  };

  const handleBlockUser = () => {
    if (!confirm(`Tem certeza que deseja bloquear ${otherUserName}?`)) {
      return;
    }
    alert('Usuário bloqueado! (funcionalidade em desenvolvimento)');
    setShowMoreMenu(false);
  };

  const emojis = ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😢', '😭', '😡', '👍', '👎', '❤️', '🎉', '🔥', '✨', '💪', '🙏', '👏', '🎊'];

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const otherUserName = !conversation
    ? 'Carregando...'
    : conversation.participantNames?.[otherUserId] || 'Usuário';

  const isOtherUserOnline = !!(otherUserId && conversation?.onlineStatus?.[otherUserId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] flex flex-col">
      {/* Header Melhorado */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] shadow-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 backdrop-blur-sm"
              title="Voltar"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>

            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg shadow-lg ring-4 ring-white/20">
                {otherUserName.substring(0, 2).toUpperCase()}
              </div>
              <div className="absolute bottom-0 right-0">
                <Circle className={`w-4 h-4 ${
                  isOtherUserOnline ? 'text-green-400 fill-green-400' : 'text-gray-400 fill-gray-400'
                } bg-[#1F53A2] rounded-full ring-2 ring-[#1F53A2]`} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white text-lg truncate">{otherUserName}</h2>
              <p className="text-sm flex items-center gap-1.5 text-white/80">
                {isOtherUserOnline ? (
                  <>
                    <Circle className="w-2.5 h-2.5 text-green-400 fill-green-400" />
                    <span className="font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{messages.length} mensagens</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleVoiceCall}
                className="p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 text-white backdrop-blur-sm"
                title="Chamada de voz"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={handleVideoCall}
                className="p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 text-white backdrop-blur-sm"
                title="Chamada de vídeo"
              >
                <Video className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowInfoModal(true)}
                className="p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 text-white backdrop-blur-sm"
                title="Informações"
              >
                <Info className="w-5 h-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="more-menu-button p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 text-white backdrop-blur-sm"
                  title="Mais opções"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMoreMenu && (
                  <div className="more-menu-dropdown absolute right-0 top-full mt-2 bg-white border border-[#E0E0E0] rounded-xl shadow-2xl py-2 z-50 min-w-[220px]">
                    <button
                      onClick={handleMuteConversation}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#212121] hover:bg-[#F5F5F5] flex items-center gap-3 transition-all font-medium"
                    >
                      <svg className="w-5 h-5 text-[#757575]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                      Silenciar conversa
                    </button>
                    <button
                      onClick={handleClearConversation}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#212121] hover:bg-[#F5F5F5] flex items-center gap-3 transition-all font-medium"
                    >
                      <svg className="w-5 h-5 text-[#757575]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Limpar conversa
                    </button>
                    <div className="border-t border-[#E0E0E0] my-1.5"></div>
                    <button
                      onClick={handleBlockUser}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#E82129] hover:bg-red-50 flex items-center gap-3 transition-all font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Bloquear usuário
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {loading && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] mb-6 animate-pulse">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
              <p className="text-xl font-bold text-[#212121]">Carregando mensagens...</p>
              <p className="text-sm text-[#757575] mt-2">Buscando histórico da conversa</p>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] mb-6">
                <MessageSquare className="w-10 h-10 text-[#757575]" />
              </div>
              <p className="text-xl font-bold text-[#212121] mb-2">Nenhuma mensagem ainda</p>
              <p className="text-sm text-[#757575] flex items-center gap-2 justify-center">
                <Smile className="w-4 h-4" />
                Envie a primeira mensagem para {otherUserName}
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;

            if (msg.deletedForEveryone) {
              return (
                <div key={msg.id} className={`flex items-end gap-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#757575] to-[#616161] flex items-center justify-center text-white text-xs font-bold shadow-md opacity-50">
                      {msg.senderName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="max-w-[70%] rounded-2xl px-4 py-3 shadow-md border-2 border-[#E0E0E0] bg-gradient-to-br from-[#F5F5F5] to-[#E9ECEF] opacity-70">
                    <p className="text-sm italic text-[#757575] flex items-center gap-2 font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Mensagem excluída
                    </p>
                    <div className="text-xs mt-2 text-[#9E9E9E] flex items-center gap-1 justify-end font-medium">
                      <Clock className="w-3 h-3" />
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                  {isMine && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] flex items-center justify-center text-white text-xs font-bold shadow-md opacity-50 ring-2 ring-[#1F53A2]/20">
                      {currentUserName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex items-end gap-3 ${isMine ? 'justify-end' : 'justify-start'} group`}>
                {!isMine && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#757575] to-[#616161] flex items-center justify-center text-white text-xs font-bold shadow-md">
                    {msg.senderName.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-lg border-2 transition-all duration-300 ${
                    isMine
                      ? 'bg-gradient-to-br from-[#E3EFFF] to-[#F0F7FF] border-[#1F53A2]/20 cursor-context-menu hover:shadow-xl'
                      : 'bg-white border-[#E0E0E0] hover:shadow-xl'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, msg, isMine)}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {msg.attachments.filter(att => att && att.type).map((attachment, idx) => (
                        <div key={idx}>
                          {attachment.type === 'image' ? (
                            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-md border border-[#E0E0E0]"
                                style={{ maxHeight: '300px' }}
                              />
                            </a>
                          ) : (
                            <a
                              href={attachment.url}
                              download={attachment.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-[#F5F5F5] rounded-xl hover:bg-[#E9ECEF] transition-colors border border-[#E0E0E0]"
                            >
                              <div className="p-2 bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] rounded-lg">
                                <Paperclip className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#212121] truncate">{attachment.name}</p>
                                <p className="text-xs text-[#757575] font-medium">{(attachment.size / 1024).toFixed(2)} KB</p>
                              </div>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.text && (
                    <div 
                      className="text-sm break-words text-[#212121] leading-relaxed [&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }}
                    />
                  )}
                  <div className="text-xs mt-2 text-[#757575] flex items-center gap-2 justify-end font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(msg.createdAt)}
                    </span>
                    {isMine && (
                      <span className="inline-flex items-center gap-1" title={msg.read ? 'Lida' : 'Enviada'}>
                        {msg.read ? (
                          <CheckCheck className="w-4 h-4 text-[#1F53A2]" />
                        ) : (
                          <Check className="w-4 h-4 text-[#757575]" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {isMine && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] flex items-center justify-center text-white text-xs font-bold shadow-md ring-4 ring-[#1F53A2]/20">
                    {currentUserName.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Área de Input Melhorada */}
      <div className="sticky bottom-0 z-10 bg-white shadow-2xl border-t-2 border-[#E0E0E0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="*/*"
          />
          <input
            ref={imageInputRef}
            type="file"
            className="hidden"
            onChange={handleImageChange}
            accept="image/*"
          />

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={handleFileClick}
              className="p-2.5 rounded-xl hover:bg-[#F5F5F5] text-[#757575] hover:text-[#1F53A2] transition-all disabled:opacity-50 border border-[#E0E0E0]"
              title="Anexar arquivo"
              disabled={sending}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleImageClick}
              className="p-2.5 rounded-xl hover:bg-[#F5F5F5] text-[#757575] hover:text-[#1F53A2] transition-all disabled:opacity-50 border border-[#E0E0E0]"
              title="Anexar imagem"
              disabled={sending}
            >
              <Image className="w-5 h-5" />
            </button>
            <div className="relative emoji-picker-container">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2.5 rounded-xl hover:bg-[#F5F5F5] text-[#757575] hover:text-[#1F53A2] transition-all disabled:opacity-50 border border-[#E0E0E0] ${showEmojiPicker ? 'bg-[#E3EFFF] text-[#1F53A2]' : ''}`}
                title="Emoji"
                disabled={sending}
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border-2 border-[#E0E0E0] rounded-2xl shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#757575] font-bold">Emojis</span>
                    <button
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-[#757575] hover:text-[#E82129] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2 w-64">
                    {emojis.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleEmojiClick(emoji)}
                        className="text-2xl p-2 hover:bg-[#E3EFFF] rounded-xl transition-all duration-300 hover:scale-125"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedFile && (
            <div className="mb-3 p-4 bg-gradient-to-br from-[#E3EFFF] to-[#F0F7FF] rounded-2xl border-2 border-[#1F53A2]/30 shadow-md">
              <div className="flex items-start gap-3">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-xl border-2 border-[#1F53A2]/20 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] rounded-xl flex items-center justify-center shadow-md">
                    <Paperclip className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#212121] truncate">{selectedFile.name}</p>
                  <p className="text-sm text-[#757575] font-medium">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  {uploading && (
                    <p className="text-xs text-[#1F53A2] mt-1 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Fazendo upload...
                    </p>
                  )}
                </div>
                <button
                  onClick={clearSelectedFile}
                  disabled={uploading || sending}
                  className="p-2 hover:bg-white/50 rounded-xl transition-all disabled:opacity-50"
                  title="Remover arquivo"
                >
                  <svg className="w-5 h-5 text-[#E82129]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite uma mensagem..."
              disabled={sending}
              className="flex-1 px-4 py-3 border-2 border-[#E0E0E0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1F53A2]/30 focus:border-[#1F53A2] text-[#212121] placeholder-[#757575] font-medium transition-all shadow-sm"
              maxLength={500}
            />
            <button
              onClick={handleSend}
              disabled={(!messageText.trim() && !selectedFile) || sending}
              className="px-6 py-3 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] hover:from-[#1A4585] hover:to-[#2558AA] text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-105 font-bold"
              title="Enviar mensagem"
            >
              {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <div className="mt-2 text-xs text-[#757575] flex items-center gap-1 font-medium">
            <Info className="w-3 h-3" />
            {messageText.length}/500 caracteres
          </div>
        </div>
      </div>

      {/* Menu de contexto */}
      {contextMenu && (
        <div
          className="context-menu-container fixed bg-white border-2 border-[#E0E0E0] rounded-xl shadow-2xl py-2 z-50 min-w-[200px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteForMeClick();
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-[#212121] hover:bg-[#F5F5F5] flex items-center gap-3 transition-all font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir para mim
          </button>

          {contextMenu.isSender && isWithin30Minutes(contextMenu.createdAt) && (
            <>
              <div className="border-t border-[#E0E0E0] my-1"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteForEveryoneClick();
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-[#E82129] hover:bg-red-50 flex items-center gap-3 transition-all font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <div className="flex-1">
                  <div>Excluir para todos</div>
                  <div className="text-xs text-[#757575]">Remove para ambos</div>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E0E0E0]">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                deleteForEveryone ? 'bg-gradient-to-br from-[#E82129] to-[#C62828]' : 'bg-gradient-to-br from-[#FF9800] to-[#F57C00]'
              } shadow-lg`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#212121]">
                  {deleteForEveryone ? 'Excluir para todos' : 'Excluir mensagem'}
                </h3>
                <p className="text-sm text-[#757575] font-medium">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className={`rounded-xl p-4 mb-6 border-2 ${
              deleteForEveryone ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
            }`}>
              <p className="text-sm text-[#212121] leading-relaxed font-medium">
                {deleteForEveryone ? (
                  <>
                    <strong className="text-[#E82129]">A mensagem será excluída para todos os participantes.</strong>
                    <br />
                    Ninguém mais poderá vê-la nesta conversa.
                  </>
                ) : (
                  'A mensagem será excluída apenas para você. O destinatário ainda poderá vê-la.'
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setMessageToDelete(null);
                  setDeleteForEveryone(false);
                }}
                className="flex-1 px-4 py-3 border-2 border-[#E0E0E0] rounded-xl text-[#212121] hover:bg-[#F5F5F5] transition-all font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteMessage}
                className={`flex-1 px-4 py-3 text-white rounded-xl transition-all font-bold shadow-lg hover:shadow-xl ${
                  deleteForEveryone
                    ? 'bg-gradient-to-r from-[#E82129] to-[#C62828] hover:from-[#D32F2F] hover:to-[#B71C1C]'
                    : 'bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100]'
                }`}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informações - versão simplificada por limite de caracteres */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#212121]">Informações do Contato</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 hover:bg-[#F5F5F5] rounded-xl transition-all"
              >
                <svg className="w-5 h-5 text-[#757575]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1F53A2] to-[#2E67C3] flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-4 ring-4 ring-[#1F53A2]/20">
                {otherUserName.substring(0, 2).toUpperCase()}
              </div>
              <h4 className="text-2xl font-bold text-[#212121] mb-2">{otherUserName}</h4>
              <div className="flex items-center gap-2">
                <Circle className={`w-3 h-3 ${isOtherUserOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'}`} />
                <span className={`text-sm font-medium ${isOtherUserOnline ? 'text-green-600' : 'text-gray-500'}`}>
                  {isOtherUserOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-[#E3EFFF] to-[#F0F7FF] rounded-xl p-4 border border-[#1F53A2]/20">
                <div className="flex items-center gap-3 mb-3">
                  <MessageSquare className="w-5 h-5 text-[#1F53A2]" />
                  <span className="font-bold text-[#212121]">Estatísticas</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#757575] font-medium">Total de mensagens:</span>
                    <span className="font-bold text-[#1F53A2]">{messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#757575] font-medium">Desde:</span>
                    <span className="font-bold text-[#212121]">
                      {conversation?.createdAt ? new Date(conversation.createdAt).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInfoModal(false);
                    handleVoiceCall();
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#1F53A2] to-[#2E67C3] hover:from-[#1A4585] hover:to-[#2558AA] text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-105"
                >
                  <Phone className="w-4 h-4" />
                  Ligar
                </button>
                <button
                  onClick={() => {
                    setShowInfoModal(false);
                    handleVideoCall();
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5C94CC] to-[#1F53A2] hover:from-[#4A7FB8] hover:to-[#1A4585] text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-105"
                >
                  <Video className="w-4 h-4" />
                  Vídeo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modais de chamada mantidos simplificados */}
      {showVoiceCallModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#1F53A2] to-[#153D7A] flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-4xl font-bold shadow-2xl mx-auto mb-6 animate-pulse ring-4 ring-white/20">
                {otherUserName.substring(0, 2).toUpperCase()}
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">{otherUserName}</h3>
              <p className="text-white/80 text-lg mb-4">
                {isInCall ? 'Chamada em andamento' : 'Chamando...'}
              </p>
              {isInCall && (
                <p className="text-white/90 text-2xl font-mono">{formatCallDuration(callDuration)}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-6">
              {callState.callStatus === 'ringing' ? (
                <>
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center"
                    title="Recusar"
                  >
                    <Phone className="w-8 h-8 rotate-[135deg]" />
                  </button>
                  <button
                    onClick={() => acceptCall()}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center animate-pulse"
                    title="Atender"
                  >
                    <Phone className="w-8 h-8" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E82129] to-[#C62828] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center"
                    title="Encerrar chamada"
                  >
                    <Phone className="w-6 h-6 rotate-[135deg]" />
                  </button>
                  <button
                    onClick={toggleMute}
                    className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all backdrop-blur-sm flex items-center justify-center"
                    title="Silenciar microfone"
                  >
                    {callState.isMuted ? (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>

            {callState.callStatus === 'connected' && (
              <div className="mt-6 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full inline-flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">Conectado</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showVideoCallModal && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="w-full h-full relative">
            {callState.remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center text-white text-5xl font-bold shadow-2xl mx-auto mb-6 animate-pulse">
                    {otherUserName.substring(0, 2).toUpperCase()}
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">{otherUserName}</h3>
                  <p className="text-gray-400 text-lg mb-4">
                    {callState.callStatus === 'calling' ? 'Chamando...' : 'Conectando...'}
                  </p>
                  {isInCall && (
                    <p className="text-white text-2xl font-mono">{formatCallDuration(callDuration)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-xl shadow-2xl border-2 border-white/20 overflow-hidden">
              {callState.localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1F53A2] to-[#153D7A] flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
                    {currentUserName.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
              {callState.callStatus === 'ringing' ? (
                <>
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center"
                    title="Recusar"
                  >
                    <Phone className="w-8 h-8 rotate-[135deg]" />
                  </button>
                  <button
                    onClick={() => acceptCall()}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center animate-pulse"
                    title="Atender"
                  >
                    <Video className="w-8 h-8" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md flex items-center justify-center"
                    title="Silenciar microfone"
                  >
                    {callState.isMuted ? (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E82129] to-[#C62828] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white transition-all shadow-2xl hover:scale-110 flex items-center justify-center"
                    title="Encerrar chamada"
                  >
                    <Phone className="w-6 h-6 rotate-[135deg]" />
                  </button>
                  <button
                    onClick={toggleVideo}
                    className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md flex items-center justify-center"
                    title="Desligar câmera"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {callState.callStatus === 'connected' && (
              <div className="absolute top-4 left-4 bg-green-600/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">{formatCallDuration(callDuration)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Elemento de áudio oculto para chamadas de voz */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
    </div>
  );
}
