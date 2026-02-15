-- ==========================================
-- Migration 017: Adicionar estruturas para notificações FCM
-- ==========================================
-- Esta migration adiciona:
-- 1. Coluna fcm_token na tabela users
-- 2. Tabela fcm_queue para fila de notificações
-- ==========================================

-- ==========================================
-- 1. USERS: Adicionar coluna FCM Token
-- ==========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users(fcm_token) WHERE fcm_token IS NOT NULL;

COMMENT ON COLUMN users.fcm_token IS 'Token Firebase Cloud Messaging para notificações push';
COMMENT ON COLUMN users.fcm_token_updated_at IS 'Data da última atualização do token FCM';

-- ==========================================
-- 2. FCM_QUEUE: Fila de Notificações Push
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
CREATE INDEX IF NOT EXISTS idx_fcm_queue_status_attempts ON fcm_queue(status, attempts);

COMMENT ON TABLE fcm_queue IS 'Fila de notificações push para processamento pelo worker FCM';
COMMENT ON COLUMN fcm_queue.attempts IS 'Número de tentativas de envio (máximo 10)';
COMMENT ON COLUMN fcm_queue.status IS 'pending: aguardando envio, sent: enviada, failed: falhou após retentativas';

-- ==========================================
-- 3. RLS POLICIES: FCM_QUEUE
-- ==========================================
ALTER TABLE fcm_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode acessar a fila (worker FCM usa service role key)
DROP POLICY IF EXISTS "fcm_queue_service_only" ON fcm_queue;
CREATE POLICY "fcm_queue_service_only" ON fcm_queue
  FOR ALL USING (true);

-- ==========================================
-- 4. NOTIFICATIONS: Tabela de notificações persistidas (opcional)
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}'::JSONB,
  link VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_notification_type CHECK (type IN ('info', 'warning', 'error', 'success', 'item_approved', 'item_rejected', 'solicitacao_created', 'solicitacao_closed'))
);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- RLS para notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE notifications IS 'Notificações persistidas para exibição na tela de notificações do app';

-- ==========================================
-- MIGRATION COMPLETA
-- ==========================================
