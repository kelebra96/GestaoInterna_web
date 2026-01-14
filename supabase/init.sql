-- ==========================================
-- MyInventory - Schema PostgreSQL Inicial
-- ==========================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- COMPANIES (Empresas/Redes)
-- ==========================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  cnpj VARCHAR(18) UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255);

-- Índices para companies
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);

-- ==========================================
-- STORES (Lojas)
-- ==========================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  manager_id UUID,
  agent_id UUID,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS manager_id UUID;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS agent_id UUID;

-- Índices para stores
CREATE INDEX IF NOT EXISTS idx_stores_company_id ON stores(company_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(active);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_manager_id ON stores(manager_id);
CREATE INDEX IF NOT EXISTS idx_stores_agent_id ON stores(agent_id);

-- ==========================================
-- USERS (Usuários do sistema)
-- ==========================================
-- Nota: A tabela auth.users já existe (criada pelo GoTrue)
-- Vamos criar uma tabela public.users com dados adicionais
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'agent',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  store_ids UUID[] DEFAULT ARRAY[]::UUID[],
  active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('developer', 'admin', 'manager', 'agent', 'buyer'))
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- ==========================================
-- NOTIFICATIONS (Notificações)
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  link VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_notification_type CHECK (type IN ('info', 'warning', 'error', 'success'))
);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ==========================================
-- MESSAGES (Sistema de Mensagens)
-- ==========================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ==========================================
-- ACTIVITY_LOG (Log de atividades)
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Policies para COMPANIES
-- Super admins e admins podem ver todas as empresas
CREATE POLICY "Companies are viewable by authenticated users" ON companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas super admins podem inserir/atualizar/deletar empresas
CREATE POLICY "Companies are insertable by service role" ON companies
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "Companies are updatable by service role" ON companies
  FOR UPDATE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "Companies are deletable by service role" ON companies
  FOR DELETE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- Policies para STORES
-- Usuários podem ver lojas da sua empresa
CREATE POLICY "Stores are viewable by company users" ON stores
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

-- Apenas admins podem inserir/atualizar lojas
CREATE POLICY "Stores are insertable by admins" ON stores
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "Stores are updatable by admins" ON stores
  FOR UPDATE USING (auth.jwt()->>'role' IN ('developer', 'admin'));

-- Policies para USERS
-- Usuários podem ver outros usuários da mesma empresa
CREATE POLICY "Users are viewable by same company" ON users
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.jwt()->>'role' IN ('developer', 'admin') OR
      company_id::text = auth.jwt()->>'companyId'
    )
  );

-- Apenas admins podem criar usuários
CREATE POLICY "Users are insertable by admins" ON users
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('developer', 'admin'));

-- Usuários podem atualizar seus próprios dados, admins podem atualizar todos
CREATE POLICY "Users are updatable by self or admin" ON users
  FOR UPDATE USING (
    auth.uid() = id OR
    auth.jwt()->>'role' IN ('developer', 'admin')
  );

-- Policies para NOTIFICATIONS
-- Usuários só podem ver suas próprias notificações
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Notifications are insertable by service role" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies para MESSAGES
-- Usuários podem ver mensagens que enviaram ou receberam
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

-- Policies para ACTIVITY_LOG
-- Apenas admins podem ver logs
CREATE POLICY "Activity logs viewable by admins" ON activity_log
  FOR SELECT USING (auth.jwt()->>'role' IN ('developer', 'admin'));

CREATE POLICY "Activity logs insertable by all" ON activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- FUNÇÕES ÚTEIS
-- ==========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION count_unread_notifications(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = user_uuid AND read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- DADOS INICIAIS (Opcional)
-- ==========================================

-- Inserir empresa de desenvolvimento (opcional)
INSERT INTO companies (id, name, cnpj, active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Desenvolvimento',
  '00.000.000/0001-00',
  true
) ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- COMENTÁRIOS
-- ==========================================
COMMENT ON TABLE companies IS 'Empresas/Redes cadastradas no sistema';
COMMENT ON TABLE stores IS 'Lojas vinculadas às empresas';
COMMENT ON TABLE users IS 'Usuários do sistema com dados adicionais';
COMMENT ON TABLE notifications IS 'Notificações do sistema para usuários';
COMMENT ON TABLE messages IS 'Mensagens entre usuários';
COMMENT ON TABLE activity_log IS 'Log de atividades dos usuários';
