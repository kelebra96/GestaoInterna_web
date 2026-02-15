-- ==========================================
-- Migration 001: Tabelas Faltantes para Migração Firebase → Supabase
-- ==========================================

-- ==========================================
-- USERS: Adicionar coluna FCM Token
-- ==========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users(fcm_token) WHERE fcm_token IS NOT NULL;

-- ==========================================
-- SOLICITACOES (Pedidos/Fichas)
-- ==========================================
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  day_key VARCHAR(10) NOT NULL,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_solicitacao_status CHECK (status IN ('pending', 'batched', 'closed'))
);

-- Índices para solicitacoes
CREATE INDEX IF NOT EXISTS idx_solicitacoes_store_id ON solicitacoes(store_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_company_id ON solicitacoes(company_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_by ON solicitacoes(created_by);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_buyer_id ON solicitacoes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_day_key ON solicitacoes(day_key);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_store_status ON solicitacoes(store_id, status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_by_day ON solicitacoes(created_by, day_key);

COMMENT ON TABLE solicitacoes IS 'Solicitações/Fichas de produtos criadas pelos usuários';
COMMENT ON COLUMN solicitacoes.day_key IS 'Chave do dia no formato YYYY-MM-DD para agrupamento';
COMMENT ON COLUMN solicitacoes.status IS 'pending: aguardando, batched: agrupada, closed: fechada/processada';

-- ==========================================
-- SOLICITACAO_ITENS (Itens das Solicitações)
-- ==========================================
CREATE TABLE IF NOT EXISTS solicitacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id) ON DELETE CASCADE NOT NULL,
  ean VARCHAR(50) NOT NULL,
  sku VARCHAR(50),
  descricao TEXT NOT NULL,
  preco_atual DECIMAL(10, 2) NOT NULL,
  qtd INTEGER NOT NULL CHECK (qtd > 0),
  validade TIMESTAMP WITH TIME ZONE,
  foto_url TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  sugestao_desconto_percent DECIMAL(5, 2),
  motivo_rejeicao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_item_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_discount CHECK (sugestao_desconto_percent IS NULL OR (sugestao_desconto_percent >= 0 AND sugestao_desconto_percent <= 100))
);

-- Índices para solicitacao_itens
CREATE INDEX IF NOT EXISTS idx_solicitacao_itens_solicitacao_id ON solicitacao_itens(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_itens_ean ON solicitacao_itens(ean);
CREATE INDEX IF NOT EXISTS idx_solicitacao_itens_sku ON solicitacao_itens(sku);
CREATE INDEX IF NOT EXISTS idx_solicitacao_itens_status ON solicitacao_itens(status);

COMMENT ON TABLE solicitacao_itens IS 'Itens individuais de cada solicitação';
COMMENT ON COLUMN solicitacao_itens.foto_url IS 'Array de URLs das fotos do produto';
COMMENT ON COLUMN solicitacao_itens.status IS 'pending: aguardando análise, approved: aprovado, rejected: rejeitado';

-- ==========================================
-- CONVERSATIONS (Conversas de Chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  participant_names JSONB DEFAULT '{}'::JSONB,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT at_least_two_participants CHECK (array_length(participants, 1) >= 2)
);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);

COMMENT ON TABLE conversations IS 'Conversas de chat entre usuários';
COMMENT ON COLUMN conversations.participants IS 'Array de UUIDs dos participantes da conversa';
COMMENT ON COLUMN conversations.participant_names IS 'JSONB com mapeamento user_id => display_name';
COMMENT ON COLUMN conversations.unread_count IS 'JSONB com contagem de não lidas por usuário';

-- ==========================================
-- CHAT_MESSAGES (Mensagens de Chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(255),
  text TEXT,
  attachments JSONB DEFAULT '[]'::JSONB,
  image_url TEXT,
  file_url TEXT,
  deleted_for UUID[] DEFAULT ARRAY[]::UUID[],
  deleted_for_all BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC);

COMMENT ON TABLE chat_messages IS 'Mensagens de chat entre usuários (substituindo Firebase Firestore messages)';
COMMENT ON COLUMN chat_messages.deleted_for IS 'Array de user IDs que deletaram a mensagem (soft delete)';
COMMENT ON COLUMN chat_messages.deleted_for_all IS 'True se a mensagem foi deletada para todos';

-- ==========================================
-- PRESENCE (Status Online dos Usuários)
-- ==========================================
CREATE TABLE IF NOT EXISTS presence (
  uid UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  online BOOLEAN DEFAULT false,
  display_name VARCHAR(255),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para presence
CREATE INDEX IF NOT EXISTS idx_presence_online ON presence(online);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_presence_online_users ON presence(uid) WHERE online = true;

COMMENT ON TABLE presence IS 'Status de presença online dos usuários em tempo real';
COMMENT ON COLUMN presence.last_seen IS 'Última vez que o usuário foi visto online';

-- ==========================================
-- PRODUCTS (Produtos do Catálogo)
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ean VARCHAR(50) UNIQUE NOT NULL,
  sku VARCHAR(50),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  category VARCHAR(100),
  brand VARCHAR(100),
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('portuguese', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

COMMENT ON TABLE products IS 'Catálogo de produtos para uso em planogramas e validações';

-- ==========================================
-- FCM_QUEUE (Fila de Notificações Push)
-- ==========================================
CREATE TABLE IF NOT EXISTS fcm_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_fcm_status CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= 10)
);

-- Índices para fcm_queue
CREATE INDEX IF NOT EXISTS idx_fcm_queue_status ON fcm_queue(status);
CREATE INDEX IF NOT EXISTS idx_fcm_queue_created_at ON fcm_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_fcm_queue_user_id ON fcm_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_queue_pending ON fcm_queue(id, created_at) WHERE status = 'pending';

COMMENT ON TABLE fcm_queue IS 'Fila de notificações push para processamento pelo worker FCM';
COMMENT ON COLUMN fcm_queue.attempts IS 'Número de tentativas de envio (máximo 10)';
COMMENT ON COLUMN fcm_queue.status IS 'pending: aguardando envio, sent: enviada, failed: falhou após retentativas';

-- ==========================================
-- TRIGGERS: Auto-update updated_at
-- ==========================================

-- Trigger para solicitacoes
CREATE TRIGGER update_solicitacoes_updated_at
  BEFORE UPDATE ON solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para solicitacao_itens
CREATE TRIGGER update_solicitacao_itens_updated_at
  BEFORE UPDATE ON solicitacao_itens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para chat_messages
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para presence
CREATE TRIGGER update_presence_updated_at
  BEFORE UPDATE ON presence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_queue ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES: SOLICITACOES
-- ==========================================

-- Usuários podem ver solicitações da sua loja/empresa
CREATE POLICY "solicitacoes_select_policy" ON solicitacoes
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      store_id::text IN (SELECT unnest(string_to_array(auth.jwt()->>'storeIds', ',')::text[])) OR
      created_by = auth.uid()
    )
  );

-- Usuários podem criar solicitações
CREATE POLICY "solicitacoes_insert_policy" ON solicitacoes
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND created_by = auth.uid()
  );

-- Usuários podem atualizar suas próprias solicitações, admins podem atualizar todas
CREATE POLICY "solicitacoes_update_policy" ON solicitacoes
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin', 'buyer') OR
      created_by = auth.uid()
    )
  );

-- Apenas admins podem deletar solicitações
CREATE POLICY "solicitacoes_delete_policy" ON solicitacoes
  FOR DELETE USING (
    auth.jwt()->>'role' IN ('developer', 'admin')
  );

-- ==========================================
-- RLS POLICIES: SOLICITACAO_ITENS
-- ==========================================

-- Usuários podem ver itens das solicitações que podem acessar
CREATE POLICY "solicitacao_itens_select_policy" ON solicitacao_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM solicitacoes s
      WHERE s.id = solicitacao_id
      AND (
        s.created_by = auth.uid() OR
        auth.jwt()->>'role' IN ('developer', 'admin', 'buyer')
      )
    )
  );

-- Usuários podem inserir itens nas suas solicitações
CREATE POLICY "solicitacao_itens_insert_policy" ON solicitacao_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM solicitacoes s
      WHERE s.id = solicitacao_id AND s.created_by = auth.uid()
    )
  );

-- Usuários podem atualizar itens das suas solicitações, admins/buyers podem atualizar todos
CREATE POLICY "solicitacao_itens_update_policy" ON solicitacao_itens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM solicitacoes s
      WHERE s.id = solicitacao_id
      AND (
        s.created_by = auth.uid() OR
        auth.jwt()->>'role' IN ('developer', 'admin', 'buyer')
      )
    )
  );

-- Usuários podem deletar itens das suas solicitações
CREATE POLICY "solicitacao_itens_delete_policy" ON solicitacao_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM solicitacoes s
      WHERE s.id = solicitacao_id AND s.created_by = auth.uid()
    )
  );

-- ==========================================
-- RLS POLICIES: CONVERSATIONS
-- ==========================================

-- Usuários podem ver conversas onde são participantes
CREATE POLICY "conversations_select_policy" ON conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
  );

-- Usuários podem criar conversas onde são participantes
CREATE POLICY "conversations_insert_policy" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = ANY(participants)
  );

-- Usuários podem atualizar conversas onde são participantes
CREATE POLICY "conversations_update_policy" ON conversations
  FOR UPDATE USING (
    auth.uid() = ANY(participants)
  );

-- ==========================================
-- RLS POLICIES: CHAT_MESSAGES
-- ==========================================

-- Usuários podem ver mensagens de conversas onde são participantes
CREATE POLICY "chat_messages_select_policy" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
    AND NOT (auth.uid() = ANY(deleted_for))
    AND NOT deleted_for_all
  );

-- Usuários podem enviar mensagens em conversas onde são participantes
CREATE POLICY "chat_messages_insert_policy" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
  );

-- Usuários podem atualizar mensagens que enviaram
CREATE POLICY "chat_messages_update_policy" ON chat_messages
  FOR UPDATE USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

-- Usuários podem deletar mensagens que enviaram
CREATE POLICY "chat_messages_delete_policy" ON chat_messages
  FOR DELETE USING (
    sender_id = auth.uid()
  );

-- ==========================================
-- RLS POLICIES: PRESENCE
-- ==========================================

-- Todos usuários autenticados podem ver presença de outros
CREATE POLICY "presence_select_policy" ON presence
  FOR SELECT USING (auth.role() = 'authenticated');

-- Usuários podem inserir/atualizar apenas sua própria presença
CREATE POLICY "presence_upsert_policy" ON presence
  FOR INSERT WITH CHECK (uid = auth.uid());

CREATE POLICY "presence_update_policy" ON presence
  FOR UPDATE USING (uid = auth.uid());

-- ==========================================
-- RLS POLICIES: PRODUCTS
-- ==========================================

-- Todos usuários autenticados podem ver produtos ativos
CREATE POLICY "products_select_policy" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (active = true OR auth.jwt()->>'role' IN ('developer', 'admin'))
  );

-- Apenas admins podem inserir/atualizar/deletar produtos
CREATE POLICY "products_insert_policy" ON products
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "products_update_policy" ON products
  FOR UPDATE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "products_delete_policy" ON products
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- ==========================================
-- RLS POLICIES: FCM_QUEUE
-- ==========================================

-- Apenas service role pode acessar a fila (worker FCM)
CREATE POLICY "fcm_queue_service_only" ON fcm_queue
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- FUNÇÕES ÚTEIS
-- ==========================================

-- Função para incrementar item_count automaticamente
CREATE OR REPLACE FUNCTION increment_solicitacao_item_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacoes
  SET item_count = item_count + 1
  WHERE id = NEW.solicitacao_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para decrementar item_count automaticamente
CREATE OR REPLACE FUNCTION decrement_solicitacao_item_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacoes
  SET item_count = GREATEST(0, item_count - 1)
  WHERE id = OLD.solicitacao_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers para manter item_count atualizado
CREATE TRIGGER increment_item_count_on_insert
  AFTER INSERT ON solicitacao_itens
  FOR EACH ROW
  EXECUTE FUNCTION increment_solicitacao_item_count();

CREATE TRIGGER decrement_item_count_on_delete
  AFTER DELETE ON solicitacao_itens
  FOR EACH ROW
  EXECUTE FUNCTION decrement_solicitacao_item_count();

-- ==========================================
-- MIGRATION COMPLETA
-- ==========================================
-- Esta migration adiciona todas as tabelas necessárias para a migração do Firebase
-- Próxima migration: 002_cloud_functions_triggers.sql
