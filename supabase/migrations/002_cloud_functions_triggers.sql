-- ==========================================
-- Migration 002: Database Triggers (Substituindo Firebase Cloud Functions)
-- ==========================================
-- Esta migration implementa a lógica das Cloud Functions do Firebase
-- como triggers nativos do PostgreSQL

-- ==========================================
-- TRIGGER 1: Cascade Company Deactivation
-- Substitui: onCompanyUpdate Firebase Function
-- ==========================================

CREATE OR REPLACE FUNCTION cascade_company_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- Executar apenas se a company estava ativa e agora está inativa
  IF OLD.active = true AND NEW.active = false THEN

    -- Desativar todas as lojas desta empresa
    UPDATE stores
    SET active = false, updated_at = NOW()
    WHERE company_id = NEW.id AND active = true;

    -- Desativar todos os usuários desta empresa
    UPDATE users
    SET active = false, updated_at = NOW()
    WHERE company_id = NEW.id AND active = true;

    RAISE NOTICE 'Company % deactivated. Cascaded to stores and users.', NEW.id;

  -- Se a company foi reativada, reativar stores e users
  ELSIF OLD.active = false AND NEW.active = true THEN

    -- Reativar todas as lojas desta empresa
    UPDATE stores
    SET active = true, updated_at = NOW()
    WHERE company_id = NEW.id;

    -- Reativar todos os usuários desta empresa
    UPDATE users
    SET active = true, updated_at = NOW()
    WHERE company_id = NEW.id;

    RAISE NOTICE 'Company % reactivated. Cascaded to stores and users.', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para company deactivation
DROP TRIGGER IF EXISTS trigger_cascade_company_deactivation ON companies;
CREATE TRIGGER trigger_cascade_company_deactivation
  AFTER UPDATE OF active ON companies
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION cascade_company_deactivation();

COMMENT ON FUNCTION cascade_company_deactivation() IS 'Cascata de desativação/reativação de company para stores e users';

-- ==========================================
-- TRIGGER 2: Cascade Store Deactivation
-- Substitui: onStoreUpdate Firebase Function
-- ==========================================

CREATE OR REPLACE FUNCTION cascade_store_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- Executar apenas se a store estava ativa e agora está inativa
  IF OLD.active = true AND NEW.active = false THEN

    -- Desativar todos os usuários desta loja
    UPDATE users
    SET active = false, updated_at = NOW()
    WHERE store_id = NEW.id AND active = true;

    RAISE NOTICE 'Store % deactivated. Cascaded to % users.', NEW.id, (
      SELECT COUNT(*) FROM users WHERE store_id = NEW.id
    );

  -- Se a store foi reativada, reativar apenas se a company também está ativa
  ELSIF OLD.active = false AND NEW.active = true THEN

    -- Verificar se a company está ativa antes de reativar users
    IF EXISTS (SELECT 1 FROM companies WHERE id = NEW.company_id AND active = true) THEN
      UPDATE users
      SET active = true, updated_at = NOW()
      WHERE store_id = NEW.id;

      RAISE NOTICE 'Store % reactivated. Cascaded to users.', NEW.id;
    ELSE
      RAISE NOTICE 'Store % reactivated but company is inactive. Users remain inactive.', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para store deactivation
DROP TRIGGER IF EXISTS trigger_cascade_store_deactivation ON stores;
CREATE TRIGGER trigger_cascade_store_deactivation
  AFTER UPDATE OF active ON stores
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION cascade_store_deactivation();

COMMENT ON FUNCTION cascade_store_deactivation() IS 'Cascata de desativação/reativação de store para users';

-- ==========================================
-- TRIGGER 3: Notify on Solicitação Closed
-- Substitui: onSolicitacaoStatusChanged Firebase Function
-- ==========================================

CREATE OR REPLACE FUNCTION notify_solicitacao_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_user_record RECORD;
  v_store_name TEXT;
  v_approved_count INTEGER;
  v_rejected_count INTEGER;
  v_total_count INTEGER;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  -- Executar apenas quando o status muda para 'closed'
  IF OLD.status != 'closed' AND NEW.status = 'closed' THEN

    -- Buscar dados do usuário que criou a solicitação
    SELECT * INTO v_user_record
    FROM users
    WHERE id = NEW.created_by;

    IF v_user_record IS NULL THEN
      RAISE WARNING 'User % not found for solicitação %', NEW.created_by, NEW.id;
      RETURN NEW;
    END IF;

    -- Buscar nome da loja
    SELECT name INTO v_store_name
    FROM stores
    WHERE id = NEW.store_id;

    v_store_name := COALESCE(v_store_name, 'Loja');

    -- Contar itens por status
    SELECT
      COUNT(*) FILTER (WHERE status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*) AS total
    INTO v_approved_count, v_rejected_count, v_total_count
    FROM solicitacao_itens
    WHERE solicitacao_id = NEW.id;

    -- Montar mensagens de notificação
    v_notification_title := '✅ Solicitação Fechada';
    v_notification_body := format(
      'Sua solicitação da %s foi fechada. %s aprovados, %s rejeitados de %s itens.',
      v_store_name,
      v_approved_count,
      v_rejected_count,
      v_total_count
    );

    -- Inserir notificação na tabela de notificações
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      link,
      created_at
    ) VALUES (
      NEW.created_by,
      v_notification_title,
      v_notification_body,
      'success',
      '/solicitacoes/' || NEW.id::text,
      NOW()
    );

    -- Inserir na fila FCM se o usuário tem token
    IF v_user_record.fcm_token IS NOT NULL THEN
      INSERT INTO fcm_queue (
        user_id,
        fcm_token,
        notification_type,
        title,
        body,
        data,
        status,
        created_at
      ) VALUES (
        NEW.created_by,
        v_user_record.fcm_token,
        'ficha_closed',
        v_notification_title,
        v_notification_body,
        jsonb_build_object(
          'type', 'ficha_closed',
          'solicitacaoId', NEW.id::text,
          'dayKey', NEW.day_key,
          'summary', jsonb_build_object(
            'approved', v_approved_count,
            'rejected', v_rejected_count,
            'total', v_total_count
          )
        ),
        'pending',
        NOW()
      );

      RAISE NOTICE 'Notification queued for user % about solicitação %', NEW.created_by, NEW.id;
    ELSE
      RAISE NOTICE 'User % has no FCM token, skipping push notification', NEW.created_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para solicitação closed
DROP TRIGGER IF EXISTS trigger_notify_solicitacao_closed ON solicitacoes;
CREATE TRIGGER trigger_notify_solicitacao_closed
  AFTER UPDATE OF status ON solicitacoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_solicitacao_closed();

COMMENT ON FUNCTION notify_solicitacao_closed() IS 'Envia notificação quando solicitação é fechada';

-- ==========================================
-- TRIGGER 4: Notify Admins on New Solicitação
-- Substitui: onSolicitacaoCreated Firebase Function
-- ==========================================

CREATE OR REPLACE FUNCTION notify_admins_new_solicitacao()
RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
  v_creator_name TEXT;
  v_store_name TEXT;
  v_notification_count INTEGER := 0;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  -- Buscar nome do criador
  SELECT display_name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by;

  v_creator_name := COALESCE(v_creator_name, 'Usuário');

  -- Buscar nome da loja
  SELECT name INTO v_store_name
  FROM stores
  WHERE id = NEW.store_id;

  v_store_name := COALESCE(v_store_name, NEW.store_id::text);

  -- Montar mensagens
  v_notification_title := '🆕 Nova Solicitação';
  v_notification_body := format('%s criou uma nova solicitação na %s', v_creator_name, v_store_name);

  -- Notificar todos os admins ativos
  FOR v_admin IN
    SELECT id, fcm_token, display_name
    FROM users
    WHERE role IN ('admin', 'buyer') AND active = true
  LOOP

    -- Inserir notificação in-app
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      link,
      created_at
    ) VALUES (
      v_admin.id,
      v_notification_title,
      v_notification_body,
      'info',
      '/solicitacoes/' || NEW.id::text,
      NOW()
    );

    -- Se o admin tem FCM token, adicionar à fila
    IF v_admin.fcm_token IS NOT NULL THEN
      INSERT INTO fcm_queue (
        user_id,
        fcm_token,
        notification_type,
        title,
        body,
        data,
        status,
        created_at
      ) VALUES (
        v_admin.id,
        v_admin.fcm_token,
        'solicitacao_created',
        v_notification_title,
        v_notification_body,
        jsonb_build_object(
          'type', 'solicitacao_created',
          'solicitacaoId', NEW.id::text,
          'createdBy', NEW.created_by::text,
          'creatorName', v_creator_name,
          'storeId', NEW.store_id::text,
          'storeName', v_store_name,
          'dayKey', NEW.day_key
        ),
        'pending',
        NOW()
      );

      v_notification_count := v_notification_count + 1;
    END IF;
  END LOOP;

  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Queued % notifications for new solicitação %', v_notification_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para nova solicitação
DROP TRIGGER IF EXISTS trigger_notify_admins_new_solicitacao ON solicitacoes;
CREATE TRIGGER trigger_notify_admins_new_solicitacao
  AFTER INSERT ON solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_solicitacao();

COMMENT ON FUNCTION notify_admins_new_solicitacao() IS 'Notifica admins e buyers quando nova solicitação é criada';

-- ==========================================
-- TRIGGER 5: Notify on New Message
-- Substitui: onMessageCreated Firebase Function
-- ==========================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_receiver RECORD;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  -- Buscar dados do destinatário
  SELECT * INTO v_receiver
  FROM users
  WHERE id = NEW.receiver_id;

  IF v_receiver IS NULL THEN
    RAISE WARNING 'Receiver % not found for message %', NEW.receiver_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Montar mensagens
  v_notification_title := 'Mensagem nova de: ' || COALESCE(NEW.sender_name, 'Usuário');
  v_notification_body := COALESCE(LEFT(NEW.text, 100), '');

  -- Inserir notificação in-app
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    link,
    created_at
  ) VALUES (
    NEW.receiver_id,
    v_notification_title,
    v_notification_body,
    'info',
    '/messages/' || NEW.conversation_id::text,
    NOW()
  );

  -- Se o receiver tem FCM token, adicionar à fila
  IF v_receiver.fcm_token IS NOT NULL THEN
    INSERT INTO fcm_queue (
      user_id,
      fcm_token,
      notification_type,
      title,
      body,
      data,
      status,
      created_at
    ) VALUES (
      NEW.receiver_id,
      v_receiver.fcm_token,
      'new_message',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'type', 'new_message',
        'messageId', NEW.id::text,
        'conversationId', NEW.conversation_id::text,
        'senderId', NEW.sender_id::text,
        'senderName', NEW.sender_name
      ),
      'pending',
      NOW()
    );

    RAISE NOTICE 'Queued message notification for user %', NEW.receiver_id;
  ELSE
    RAISE NOTICE 'User % has no FCM token, skipping push notification', NEW.receiver_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para nova mensagem
DROP TRIGGER IF EXISTS trigger_notify_new_message ON chat_messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  WHEN (NEW.sender_id IS DISTINCT FROM NEW.receiver_id)
  EXECUTE FUNCTION notify_new_message();

COMMENT ON FUNCTION notify_new_message() IS 'Envia notificação quando nova mensagem de chat é recebida';

-- ==========================================
-- TRIGGER 6: Update Conversation on New Message
-- ==========================================

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar a conversation com a última mensagem
  UPDATE conversations
  SET
    last_message = LEFT(COALESCE(NEW.text, ''), 100),
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  -- Incrementar unread_count para o receiver
  IF NEW.receiver_id IS NOT NULL THEN
    UPDATE conversations
    SET unread_count = jsonb_set(
      COALESCE(unread_count, '{}'::jsonb),
      ARRAY[NEW.receiver_id::text],
      (COALESCE((unread_count->>NEW.receiver_id::text)::integer, 0) + 1)::text::jsonb
    )
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar conversation
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON chat_messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

COMMENT ON FUNCTION update_conversation_on_message() IS 'Atualiza conversation com última mensagem e contador de não lidas';

-- ==========================================
-- TRIGGER 7: Update Presence on User Activity
-- ==========================================

CREATE OR REPLACE FUNCTION update_presence_on_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar ou inserir registro de presença
  INSERT INTO presence (uid, online, display_name, last_seen, updated_at)
  VALUES (
    NEW.id,
    true,
    NEW.display_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (uid) DO UPDATE SET
    online = true,
    display_name = EXCLUDED.display_name,
    last_seen = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar presença ao atualizar last_seen do usuário
DROP TRIGGER IF EXISTS trigger_update_presence_on_activity ON users;
CREATE TRIGGER trigger_update_presence_on_activity
  AFTER UPDATE OF last_seen ON users
  FOR EACH ROW
  WHEN (NEW.last_seen IS DISTINCT FROM OLD.last_seen)
  EXECUTE FUNCTION update_presence_on_activity();

COMMENT ON FUNCTION update_presence_on_activity() IS 'Atualiza tabela de presença quando usuário tem atividade';

-- ==========================================
-- FUNÇÕES AUXILIARES PARA LIMPEZA
-- ==========================================

-- Função para limpar FCM queue antigo (manter apenas últimos 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_fcm_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM fcm_queue
  WHERE status IN ('sent', 'failed')
  AND created_at < NOW() - INTERVAL '30 days';

  RAISE NOTICE 'Cleaned up old FCM queue entries';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_fcm_queue() IS 'Remove entradas antigas da fila FCM (> 30 dias)';

-- Função para marcar usuários offline (último acesso > 5 minutos)
CREATE OR REPLACE FUNCTION mark_inactive_users_offline()
RETURNS void AS $$
BEGIN
  UPDATE presence
  SET online = false, updated_at = NOW()
  WHERE online = true
  AND last_seen < NOW() - INTERVAL '5 minutes';

  RAISE NOTICE 'Marked inactive users as offline';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_inactive_users_offline() IS 'Marca usuários como offline se último acesso > 5 minutos';

-- ==========================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE DOS TRIGGERS
-- ==========================================

-- Índice para acelerar busca de admins/buyers ativos
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active) WHERE role IN ('admin', 'buyer');

-- Índice para acelerar busca de FCM tokens não nulos
CREATE INDEX IF NOT EXISTS idx_users_fcm_token_not_null ON users(id) WHERE fcm_token IS NOT NULL;

-- ==========================================
-- MIGRATION COMPLETA
-- ==========================================
-- Esta migration implementa todos os triggers que substituem as Cloud Functions do Firebase
-- Próximo passo: Criar FCM Worker (workers/fcm-worker.ts)
