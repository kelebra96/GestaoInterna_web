/**
 * Servidor de Sinalização WebRTC
 * Usa Socket.IO para coordenar conexões P2P entre clientes
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Armazena informações sobre usuários conectados
const users = new Map(); // socketId -> { userId, conversationId }
const userIdToSocketId = new Map(); // userId -> socketId
const conversations = new Map(); // conversationId -> Set<socketId>

// Healthcheck
app.get('/health', (_req, res) => {
  const usersOnline = userIdToSocketId.size;
  const usersOnlineList = Array.from(userIdToSocketId.keys());
  res.json({
    status: 'ok',
    usersOnline,
    users: usersOnlineList,
  });
});

io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Registrar usuário
  socket.on('register', (payload) => {
    let userId = null;
    let conversationId = 'global';

    if (typeof payload === 'string') {
      userId = payload;
    } else {
      userId = payload?.userId;
      conversationId = payload?.conversationId || 'global';
    }

    if (!userId) {
      console.log('⚠️ Registro inválido: userId ausente');
      return;
    }

    console.log(`👤 Usuário registrado: ${userId} na conversa ${conversationId}`);

    users.set(socket.id, { userId, conversationId });
    userIdToSocketId.set(userId, socket.id); // Mapear userId para socketId

    // Adicionar ao grupo da conversa
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, new Set());
    }
    conversations.get(conversationId).add(socket.id);

    socket.join(conversationId);

    // Notificar outros usuários na conversa
    socket.to(conversationId).emit('user-connected', { userId });
  });

  // Iniciar chamada
  socket.on('call-user', ({ to, offer, callType }) => {
    const toSocketId = userIdToSocketId.get(to); // Encontrar socketId a partir do userId
    const callerData = users.get(socket.id);

    if (toSocketId) {
      console.log(`📞 Chamada iniciada de ${callerData?.userId || socket.id} para ${to} (socket: ${toSocketId}), tipo: ${callType}`);

      // Notificar o chamador com o socketId do destinatário
      socket.emit('call-initiated', { toSocketId });

      // Enviar a oferta para o destinatário
      // IMPORTANTE: Inclui fromSocketId explicitamente para que o destinatário saiba para onde enviar a resposta
      socket.to(toSocketId).emit('incoming-call', {
        from: callerData?.userId || socket.id,  // userId do chamador (para exibição)
        fromSocketId: socket.id,                 // socketId do chamador (para roteamento da resposta)
        offer,
        callType,
        caller: callerData
      });
    } else {
      console.log(`⚠️ Usuário ${to} não encontrado para chamada.`);
      console.log(`📋 Usuários online: ${Array.from(userIdToSocketId.keys()).join(', ')}`);
      socket.emit('user-unavailable'); // Notificar o chamador
    }
  });

  // Responder chamada
  socket.on('answer-call', ({ to, answer }) => {
    console.log(`✅ Chamada respondida por ${socket.id} para ${to}`);
    socket.to(to).emit('call-answered', {
      from: socket.id,
      answer
    });
  });

  // Rejeitar chamada
  socket.on('reject-call', ({ to }) => {
    console.log(`❌ Chamada rejeitada por ${socket.id} para ${to}`);
    socket.to(to).emit('call-rejected', {
      from: socket.id
    });
  });

  // Encerrar chamada
  socket.on('end-call', ({ to }) => {
    console.log(`📴 Chamada encerrada por ${socket.id} para ${to}`);
    socket.to(to).emit('call-ended', {
      from: socket.id
    });
  });

  // ICE candidates (para NAT traversal)
  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);

    const userData = users.get(socket.id);
    if (userData) {
      const { userId, conversationId } = userData;

      // Remover do mapeamento
      userIdToSocketId.delete(userId);
      users.delete(socket.id);

      // Remover do grupo da conversa
      if (conversations.has(conversationId)) {
        conversations.get(conversationId).delete(socket.id);
        if (conversations.get(conversationId).size === 0) {
          conversations.delete(conversationId);
        }
      }

      // Notificar outros usuários
      socket.to(conversationId).emit('user-disconnected', { userId });
    }
  });
});

const PORT = process.env.SOCKET_PORT || 3002;
const HOST = process.env.SOCKET_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor de sinalização WebRTC rodando na porta ${PORT}`);
  console.log(`📡 Listening on ${HOST}:${PORT}`);
  console.log(`🌐 Produção: https://myinventory.com.br ou http://76.13.163.7:${PORT}`);
  console.log(`🏠 Desenvolvimento: http://192.168.1.179:${PORT}`);
});
