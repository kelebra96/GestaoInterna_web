'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  User,
  RefreshCw,
  Clock,
  Search,
  ChevronRight,
  Plus,
  Mail,
  MailOpen,
  UserPlus,
  Filter,
  X,
  Circle,
  Send,
  Users,
  Inbox,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-client';

interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  unreadCount: Record<string, number>;
  createdAt: string;
  onlineStatus?: Record<string, boolean>;
}

export default function MensagensPage() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [data, setData] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Nova conversa - estado
  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; displayName: string; email: string; active: boolean; isOnline?: boolean; lastSeen?: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const currentUserId = user?.uid || '';
  const currentUserName = user?.displayName || 'Usuário';

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = currentUserId
        ? `/api/mensagens?userId=${encodeURIComponent(currentUserId)}`
        : '/api/mensagens';
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) throw new Error('Falha ao carregar conversas');
      const json = await res.json();

      // Debug: Verificar onlineStatus
      console.log('🔍 DEBUG - Conversas recebidas:', json.conversations);
      json.conversations?.forEach((conv: any) => {
        console.log(`📋 Conversa ${conv.id}:`, {
          participants: conv.participants,
          onlineStatus: conv.onlineStatus,
          currentUserId: currentUserId
        });
      });

      setData(json.conversations || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !currentUserId) return;

    // Carregar dados iniciais
    fetchData();

    // Configurar listener em tempo real para conversas (Supabase)
    console.log('🔥 Configurando listener Supabase para conversas do userId:', currentUserId);

    const channel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        {
          event: '*', // Escutar INSERT e UPDATE
          schema: 'public',
          table: 'conversations',
          filter: `participants=cs.{${currentUserId}}`, // cs = contains (array contains)
        },
        (payload) => {
          console.log('🔥 Supabase Realtime: Conversa atualizada!', payload);
          fetchData(); // Recarrega a lista completa para garantir consistência
        }
      )
      .subscribe();

    // Polling de segurança a cada 30s
    const pollingInterval = setInterval(fetchData, 30000);

    return () => {
      console.log('🔥 Removendo listener Supabase');
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [user?.uid, currentUserId]);

  // Abrir modal e carregar usuários
  const openNew = async () => {
    setNewOpen(true);
    setSelectedUserId('');
    setFirstMessage('');
    setUsersLoading(true);
    try {
      // Obter token de autenticação
      const token = firebaseUser?.getIdToken ? await firebaseUser.getIdToken() : null;

      // Usar endpoint específico para mensagens (não requer admin)
      const res = await fetch('/api/mensagens/users', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      const list = (json.users || []) as Array<{ id: string; displayName: string; email: string; active: boolean; isOnline?: boolean; lastSeen?: string }>;
      setUsers(list);
    } catch (e) {
      console.error('Erro ao listar usuários:', e);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const closeNew = () => setNewOpen(false);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let filtered = users;
    if (q) {
      filtered = users.filter(u => (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    }
    // Ordenar: online primeiro, depois por nome
    return filtered.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [users, userSearch]);

  const createConversation = async () => {
    if (!selectedUserId || !firstMessage.trim() || !currentUserId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderName: currentUserName,
          receiverId: selectedUserId,
          text: firstMessage.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Falha ao criar conversa');
      const conversationId = json?.conversationId as string | undefined;
      setNewOpen(false);
      if (conversationId) {
        router.push(`/mensagens/${conversationId}`);
      } else {
        fetchData();
      }
    } catch (e) {
      console.error('Erro ao criar conversa:', e);
      alert('Não foi possível criar a conversa');
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((conv) => {
      if (!q) return true;
      const otherUserId = conv.participants.find(p => p !== currentUserId);
      const otherUserName = otherUserId ? conv.participantNames[otherUserId] : '';
      const lastMsg = (conv.lastMessage || '').toLowerCase();
      return otherUserName.toLowerCase().includes(q) || lastMsg.includes(q);
    });
  }, [data, query, currentUserId]);

  const stats = useMemo(() => {
    const total = data.length;
    const unreadTotal = data.reduce((sum, conv) => sum + (conv.unreadCount[currentUserId] || 0), 0);
    const unreadConversations = data.filter(conv => (conv.unreadCount[currentUserId] || 0) > 0).length;

    // Debug: verificar status online de cada conversa
    console.log('📊 Calculando stats - Início');
    console.log('📊 Total conversas:', total);
    console.log('📊 Current User ID:', currentUserId);
    console.log('📊 Todas as conversas:', data);

    const onlineUsers = data.filter(conv => {
      const otherUserId = conv.participants.find(p => p !== currentUserId);
      const hasStatus = !!conv.onlineStatus;
      const statusValue = otherUserId ? conv.onlineStatus?.[otherUserId] : undefined;
      const isOnline = !!(otherUserId && conv.onlineStatus && conv.onlineStatus[otherUserId]);

      console.log(`🔍 Conversa ${conv.id}:`, {
        participants: conv.participants,
        currentUserId,
        otherUserId,
        hasOnlineStatus: hasStatus,
        allOnlineStatuses: conv.onlineStatus,
        onlineStatusForOtherUser: statusValue,
        isOnline,
        result: isOnline ? '✅ ONLINE' : '❌ OFFLINE'
      });

      return isOnline;
    }).length;

    console.log('📊 Stats finais:', {
      total,
      unreadTotal,
      unreadConversations,
      onlineUsers,
      percentOnline: total > 0 ? `${Math.round((onlineUsers/total)*100)}%` : '0%'
    });

    return { total, unreadTotal, unreadConversations, onlineUsers };
  }, [data, currentUserId]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl relative">
                  <MessageSquare className="w-10 h-10 text-white" />
                  {stats.unreadTotal > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#BF092F] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{stats.unreadTotal > 9 ? '9+' : stats.unreadTotal}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Central de Mensagens
                  </h1>
                  <p className="text-gray-200 text-base font-medium mt-2">
                    Converse em tempo real com sua equipe
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={openNew}
                  disabled={!currentUserId}
                  className="inline-flex items-center gap-2 bg-white text-[#16476A] px-5 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
                >
                  <UserPlus className="w-5 h-5" />
                  Nova Conversa
                </button>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8 -mt-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                  <MessageCircle className="w-6 h-6 text-[#16476A]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Conversas</p>
                  <p className="text-3xl font-bold text-[#16476A]">{stats.total}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#16476A] to-[#132440]" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-[#757575] mt-2">Total de conversas</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-red-100 to-red-50 rounded-xl">
                  <Mail className="w-6 h-6 text-[#BF092F]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Não Lidas</p>
                  <p className="text-3xl font-bold text-[#BF092F]">{stats.unreadTotal}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#BF092F] to-[#a50728]"
                  style={{ width: stats.total > 0 ? `${(stats.unreadConversations / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-[#757575] mt-2">
                {stats.unreadConversations} {stats.unreadConversations === 1 ? 'conversa' : 'conversas'} pendentes
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                  <MailOpen className="w-6 h-6 text-[#3B9797]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Lidas</p>
                  <p className="text-3xl font-bold text-[#3B9797]">{stats.total - stats.unreadConversations}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3B9797] to-[#2c7a7a]"
                  style={{ width: stats.total > 0 ? `${((stats.total - stats.unreadConversations) / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-[#757575] mt-2">
                {stats.total > 0 ? `${Math.round(((stats.total - stats.unreadConversations) / stats.total) * 100)}%` : '0%'} visualizadas
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                  <Users className="w-6 h-6 text-[#3B9797]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#757575] uppercase">Online</p>
                  <p className="text-3xl font-bold text-[#3B9797]">{stats.onlineUsers}</p>
                </div>
              </div>
              <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3B9797] to-[#2c7a7a]"
                  style={{ width: stats.total > 0 ? `${(stats.onlineUsers / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-[#757575] mt-2">Usuários ativos agora</p>
            </div>
          </div>
        </div>

        {/* Modal Nova Conversa */}
        {newOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#E0E0E0]">
              <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Nova Conversa</h3>
                    {!usersLoading && users.length > 0 && (
                      <p className="text-sm text-white/70">
                        {users.filter(u => u.isOnline).length} online de {users.length} usuários
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeNew}
                  className="p-2 rounded-lg hover:bg-white/20 transition-all text-white"
                  aria-label="Fechar"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-5">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Buscar usuário</label>
                  <div className="relative">
                    <Search className="w-5 h-5 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Nome ou e-mail..."
                      className="w-full pl-11 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border-2 border-[#E0E0E0] rounded-xl mb-5 divide-y divide-[#E0E0E0]">
                  {usersLoading ? (
                    <div className="p-8 text-center text-[#757575]">
                      <RefreshCw className="w-6 h-6 animate-spin inline mb-2 text-[#16476A]" />
                      <p className="font-medium">Carregando usuários...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-[#757575]">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Nenhum usuário encontrado</p>
                    </div>
                  ) : (
                    filteredUsers.map(u => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 p-4 cursor-pointer transition-all duration-300 ${
                          selectedUserId === u.id
                            ? 'bg-blue-100 border-l-4 border-l-[#16476A]'
                            : 'hover:bg-[#F8F9FA]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="receiver"
                          value={u.id}
                          checked={selectedUserId === u.id}
                          onChange={() => setSelectedUserId(u.id)}
                          className="w-5 h-5 text-[#16476A] focus:ring-[#16476A]"
                        />
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                            u.isOnline
                              ? 'bg-gradient-to-br from-[#3B9797] to-[#2c7a7a]'
                              : 'bg-gradient-to-br from-[#16476A] to-[#132440]'
                          }`}>
                            {u.displayName.substring(0, 2).toUpperCase()}
                          </div>
                          <Circle className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${
                            u.isOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'
                          } bg-white rounded-full ring-2 ring-white`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#212121]">{u.displayName}</span>
                            {u.isOnline && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                Online
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#757575]">{u.email}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Primeira mensagem</label>
                  <textarea
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    placeholder="Digite uma mensagem de introdução..."
                    className="w-full px-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] transition-all font-medium resize-none"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="text-xs text-[#757575] mt-1 text-right">
                    {firstMessage.length}/500
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeNew}
                    disabled={creating}
                    className="flex-1 px-4 py-3 border-2 border-[#E0E0E0] text-[#757575] rounded-xl font-bold hover:bg-[#F5F5F5] disabled:opacity-50 transition-all duration-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createConversation}
                    disabled={!selectedUserId || !firstMessage.trim() || creating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#16476A] to-[#132440] text-white rounded-xl font-bold hover:from-[#132440] hover:to-[#16476A] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-lg transition-all duration-300 hover:scale-105"
                  >
                    {creating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {creating ? 'Criando...' : 'Iniciar Conversa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Busca e Legenda */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="p-6">
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-[#757575] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar conversas ou mensagens..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16476A]/30 focus:border-[#16476A] transition-all font-medium"
                  />
                </div>
              </div>

              {query && (
                <div className="mb-4 p-3 bg-gradient-to-r from-blue-100 to-blue-50 rounded-xl border border-[#16476A]/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#16476A]">
                    <Search className="w-4 h-4" />
                    Mostrando {filtered.length} de {data.length} conversas
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                  <span className="text-[#757575] font-medium">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className="w-3 h-3 text-gray-400 fill-gray-400" />
                  <span className="text-[#757575] font-medium">Offline</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#BF092F]" />
                  <span className="text-[#757575] font-medium">Não lida</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-xl">
          {loading && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#132440] mb-6 animate-pulse">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
              <p className="text-xl font-bold text-[#212121]">Carregando conversas...</p>
              <p className="text-sm text-[#757575] mt-2">Buscando mensagens em tempo real</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
              <p className="text-sm text-[#757575] mb-6">Não foi possível carregar as conversas</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] mb-6">
                <MessageSquare className="w-10 h-10 text-[#757575]" />
              </div>
              <p className="text-xl font-bold text-[#212121] mb-2">
                {query ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa'}
              </p>
              <p className="text-sm text-[#757575] mb-6">
                {query ? 'Tente ajustar os filtros de busca' : 'Clique em "Nova Conversa" para começar a conversar'}
              </p>
              {!query && (
                <button
                  onClick={openNew}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#132440] hover:to-[#16476A] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Nova Conversa
                </button>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="divide-y divide-[#E0E0E0]">
              {filtered.map((conv) => {
                const otherUserId = conv.participants.find(p => p !== currentUserId);
                const otherUserName = otherUserId ? conv.participantNames[otherUserId] : 'Usuário';
                const unreadCount = conv.unreadCount[currentUserId] || 0;
                const hasUnread = unreadCount > 0;
                const isMyLastMessage = conv.lastMessageBy === currentUserId;
                const isOnline = otherUserId && conv.onlineStatus && conv.onlineStatus[otherUserId];

                return (
                  <Link
                    key={conv.id}
                    href={`/mensagens/${conv.id}`}
                    className={`block p-5 hover:bg-gradient-to-r transition-all duration-300 group relative ${
                      hasUnread
                        ? 'hover:from-[#E3EFFF] hover:to-[#F0F7FF] bg-gradient-to-r from-[#F8FAFF] to-white'
                        : 'hover:from-[#F8F9FA] hover:to-[#F5F5F5]'
                    }`}
                  >
                    {hasUnread && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#16476A] to-[#132440]"></div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                          hasUnread
                            ? 'bg-gradient-to-br from-[#16476A] to-[#132440] ring-4 ring-[#16476A]/20'
                            : 'bg-gradient-to-br from-[#757575] to-[#616161]'
                        }`}>
                          {otherUserName.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Indicador online */}
                        <div className="absolute bottom-0 right-0 flex items-center justify-center">
                          <Circle className={`w-4 h-4 ${
                            isOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'
                          } bg-white rounded-full ring-2 ring-white`} />
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <h3 className={`font-bold text-base ${
                            hasUnread ? 'text-[#16476A]' : 'text-[#212121]'
                          } group-hover:text-[#16476A] transition-colors`}>
                            {otherUserName}
                          </h3>
                          {conv.lastMessageAt && (
                            <span className="text-xs text-[#757575] flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTime(conv.lastMessageAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm truncate ${
                            hasUnread ? 'font-semibold text-[#212121]' : 'text-[#757575]'
                          }`}>
                            {isMyLastMessage && <span className="text-[#16476A]">Você: </span>}
                            {conv.lastMessage || 'Sem mensagens ainda'}
                          </p>
                          {hasUnread && unreadCount > 0 && (
                            <span className="flex-shrink-0 bg-gradient-to-r from-[#BF092F] to-[#a50728] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-[#757575] flex-shrink-0 self-center group-hover:text-[#16476A] group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
