-- ==========================================
-- Migration 021: RLS Completo - Isolamento por Organização
-- Created: 2026-02-11
-- Description: Políticas RLS para isolamento total de dados por org_id
-- CRÍTICO: Sem isso, dados de uma rede podem vazar para outra!
-- ==========================================

-- ==========================================
-- FUNÇÃO HELPER: Obter org_id do usuário atual
-- ==========================================

-- Função para extrair org_id do JWT de forma segura
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt()->>'orgId')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função para extrair store_ids do JWT
CREATE OR REPLACE FUNCTION get_current_store_ids()
RETURNS UUID[] AS $$
DECLARE
  v_store_ids TEXT;
BEGIN
  v_store_ids := auth.jwt()->>'storeIds';
  IF v_store_ids IS NULL OR v_store_ids = '' THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  -- Converter string JSON array para array PostgreSQL
  RETURN ARRAY(SELECT jsonb_array_elements_text(v_store_ids::JSONB)::UUID);
EXCEPTION
  WHEN OTHERS THEN
    RETURN ARRAY[]::UUID[];
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função para verificar se usuário é super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt()->>'role' IN ('super_admin', 'developer');
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para verificar se usuário é admin da rede
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt()->>'role' IN ('super_admin', 'developer', 'admin_rede');
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- ORGANIZATIONS
-- ==========================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop políticas existentes
DROP POLICY IF EXISTS "org_select_own" ON organizations;
DROP POLICY IF EXISTS "org_update_own" ON organizations;
DROP POLICY IF EXISTS "org_admin_all" ON organizations;

-- Usuários podem ver apenas sua organização
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (
    id = get_current_org_id()
    OR is_super_admin()
  );

-- Apenas admin da rede pode atualizar
CREATE POLICY "org_update_own" ON organizations
  FOR UPDATE USING (
    id = get_current_org_id()
    AND is_org_admin()
  );

-- Super admin pode tudo
CREATE POLICY "org_admin_all" ON organizations
  FOR ALL USING (is_super_admin());

-- ==========================================
-- STORES (Lojas)
-- ==========================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_select_org" ON stores;
DROP POLICY IF EXISTS "stores_insert_org" ON stores;
DROP POLICY IF EXISTS "stores_update_org" ON stores;
DROP POLICY IF EXISTS "stores_delete_org" ON stores;

-- Usuários veem lojas da sua organização
CREATE POLICY "stores_select_org" ON stores
  FOR SELECT USING (
    company_id = get_current_org_id()
    OR is_super_admin()
  );

-- Admin pode criar lojas na organização
CREATE POLICY "stores_insert_org" ON stores
  FOR INSERT WITH CHECK (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- Admin pode atualizar lojas da organização
CREATE POLICY "stores_update_org" ON stores
  FOR UPDATE USING (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- Admin pode deletar lojas da organização
CREATE POLICY "stores_delete_org" ON stores
  FOR DELETE USING (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- ==========================================
-- USERS (Usuários)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_org" ON users;
DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_insert_org" ON users;
DROP POLICY IF EXISTS "users_update_org" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;

-- Usuários veem outros usuários da mesma organização
CREATE POLICY "users_select_org" ON users
  FOR SELECT USING (
    company_id = get_current_org_id()
    OR id = auth.uid()
    OR is_super_admin()
  );

-- Admin pode criar usuários na organização
CREATE POLICY "users_insert_org" ON users
  FOR INSERT WITH CHECK (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- Admin pode atualizar usuários da organização
CREATE POLICY "users_update_org" ON users
  FOR UPDATE USING (
    (company_id = get_current_org_id() AND is_org_admin())
    OR id = auth.uid() -- Usuário pode atualizar próprio perfil
    OR is_super_admin()
  );

-- ==========================================
-- PRODUCTS (Produtos)
-- ==========================================
-- Nota: Produtos podem ser compartilhados (catálogo global) ou por org
-- Ajustar conforme necessidade de negócio

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON products;
DROP POLICY IF EXISTS "products_manage_admin" ON products;

-- Todos autenticados podem ver produtos ativos
-- (produtos são catálogo compartilhado por padrão)
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (active = true OR is_org_admin())
  );

-- Admins podem gerenciar produtos
CREATE POLICY "products_manage_admin" ON products
  FOR ALL USING (is_org_admin());

-- ==========================================
-- INVENTORIES (Inventários)
-- ==========================================
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventories_select_org" ON inventories;
DROP POLICY IF EXISTS "inventories_insert_org" ON inventories;
DROP POLICY IF EXISTS "inventories_update_org" ON inventories;
DROP POLICY IF EXISTS "inventories_delete_org" ON inventories;

-- Usuários veem inventários da sua organização/lojas
CREATE POLICY "inventories_select_org" ON inventories
  FOR SELECT USING (
    company_id = get_current_org_id()
    OR is_super_admin()
  );

-- Usuários podem criar inventários na organização
CREATE POLICY "inventories_insert_org" ON inventories
  FOR INSERT WITH CHECK (
    company_id = get_current_org_id()
  );

-- Usuários podem atualizar inventários da organização
CREATE POLICY "inventories_update_org" ON inventories
  FOR UPDATE USING (
    company_id = get_current_org_id()
  );

-- Admin pode deletar inventários
CREATE POLICY "inventories_delete_org" ON inventories
  FOR DELETE USING (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- ==========================================
-- INVENTORY_ITEMS (Itens de Inventário)
-- ==========================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;

-- Acesso via inventário pai (já tem RLS)
CREATE POLICY "inventory_items_select" ON inventory_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inventories i
      WHERE i.id = inventory_id
      AND (i.company_id = get_current_org_id() OR is_super_admin())
    )
  );

CREATE POLICY "inventory_items_insert" ON inventory_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventories i
      WHERE i.id = inventory_id
      AND i.company_id = get_current_org_id()
    )
  );

CREATE POLICY "inventory_items_update" ON inventory_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM inventories i
      WHERE i.id = inventory_id
      AND i.company_id = get_current_org_id()
    )
  );

CREATE POLICY "inventory_items_delete" ON inventory_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM inventories i
      WHERE i.id = inventory_id
      AND i.company_id = get_current_org_id()
    )
  );

-- ==========================================
-- EXPIRY_REPORTS (Relatórios de Validade)
-- ==========================================
ALTER TABLE expiry_reports ENABLE ROW LEVEL SECURITY;

-- Remover políticas permissivas anteriores
DROP POLICY IF EXISTS "Allow all inserts on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all selects on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all updates on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all deletes on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "expiry_reports_select_org" ON expiry_reports;
DROP POLICY IF EXISTS "expiry_reports_insert_org" ON expiry_reports;
DROP POLICY IF EXISTS "expiry_reports_update_org" ON expiry_reports;

-- Acesso por organização via store
CREATE POLICY "expiry_reports_select_org" ON expiry_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = store_id
      AND (s.company_id = get_current_org_id() OR is_super_admin())
    )
  );

CREATE POLICY "expiry_reports_insert_org" ON expiry_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = store_id
      AND s.company_id = get_current_org_id()
    )
  );

CREATE POLICY "expiry_reports_update_org" ON expiry_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = store_id
      AND s.company_id = get_current_org_id()
    )
  );

-- ==========================================
-- PLANOGRAM_BASES (Planogramas Base)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'planogram_bases') THEN
    ALTER TABLE planogram_bases ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planogram_bases_select_org" ON planogram_bases;
    DROP POLICY IF EXISTS "planogram_bases_manage_org" ON planogram_bases;

    CREATE POLICY "planogram_bases_select_org" ON planogram_bases
      FOR SELECT USING (
        org_id = get_current_org_id()::TEXT
        OR is_super_admin()
      );

    CREATE POLICY "planogram_bases_manage_org" ON planogram_bases
      FOR ALL USING (
        org_id = get_current_org_id()::TEXT
        AND is_org_admin()
      );
  END IF;
END $$;

-- ==========================================
-- PLANOGRAM_STORES (Planogramas por Loja)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'planogram_stores') THEN
    ALTER TABLE planogram_stores ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planogram_stores_select_org" ON planogram_stores;
    DROP POLICY IF EXISTS "planogram_stores_manage_org" ON planogram_stores;

    CREATE POLICY "planogram_stores_select_org" ON planogram_stores
      FOR SELECT USING (
        org_id = get_current_org_id()::TEXT
        OR is_super_admin()
      );

    CREATE POLICY "planogram_stores_manage_org" ON planogram_stores
      FOR ALL USING (
        org_id = get_current_org_id()::TEXT
      );
  END IF;
END $$;

-- ==========================================
-- COMPLIANCE_TASKS
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'compliance_tasks') THEN
    ALTER TABLE compliance_tasks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "compliance_tasks_select_org" ON compliance_tasks;
    DROP POLICY IF EXISTS "compliance_tasks_manage_org" ON compliance_tasks;

    CREATE POLICY "compliance_tasks_select_org" ON compliance_tasks
      FOR SELECT USING (
        org_id = get_current_org_id()::TEXT
        OR is_super_admin()
      );

    CREATE POLICY "compliance_tasks_manage_org" ON compliance_tasks
      FOR ALL USING (
        org_id = get_current_org_id()::TEXT
      );
  END IF;
END $$;

-- ==========================================
-- COMPLIANCE_EXECUTIONS
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'compliance_executions') THEN
    ALTER TABLE compliance_executions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "compliance_executions_select_org" ON compliance_executions;
    DROP POLICY IF EXISTS "compliance_executions_manage_org" ON compliance_executions;

    CREATE POLICY "compliance_executions_select_org" ON compliance_executions
      FOR SELECT USING (
        org_id = get_current_org_id()::TEXT
        OR is_super_admin()
      );

    CREATE POLICY "compliance_executions_manage_org" ON compliance_executions
      FOR ALL USING (
        org_id = get_current_org_id()::TEXT
      );
  END IF;
END $$;

-- ==========================================
-- CHECKLIST_TEMPLATES
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklist_templates') THEN
    ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "checklist_templates_select_org" ON checklist_templates;
    DROP POLICY IF EXISTS "checklist_templates_manage_org" ON checklist_templates;

    CREATE POLICY "checklist_templates_select_org" ON checklist_templates
      FOR SELECT USING (
        company_id = get_current_org_id()
        OR is_super_admin()
      );

    CREATE POLICY "checklist_templates_manage_org" ON checklist_templates
      FOR ALL USING (
        company_id = get_current_org_id()
        AND is_org_admin()
      );
  END IF;
END $$;

-- ==========================================
-- CHECKLIST_EXECUTIONS
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklist_executions') THEN
    ALTER TABLE checklist_executions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "checklist_executions_select_org" ON checklist_executions;
    DROP POLICY IF EXISTS "checklist_executions_manage_org" ON checklist_executions;

    CREATE POLICY "checklist_executions_select_org" ON checklist_executions
      FOR SELECT USING (
        company_id = get_current_org_id()
        OR is_super_admin()
      );

    CREATE POLICY "checklist_executions_manage_org" ON checklist_executions
      FOR ALL USING (
        company_id = get_current_org_id()
      );
  END IF;
END $$;

-- ==========================================
-- SOLICITACOES (Já tem RLS, reforçar org)
-- ==========================================
DROP POLICY IF EXISTS "solicitacoes_select_policy" ON solicitacoes;
DROP POLICY IF EXISTS "solicitacoes_insert_policy" ON solicitacoes;
DROP POLICY IF EXISTS "solicitacoes_update_policy" ON solicitacoes;
DROP POLICY IF EXISTS "solicitacoes_delete_policy" ON solicitacoes;

CREATE POLICY "solicitacoes_select_org" ON solicitacoes
  FOR SELECT USING (
    company_id = get_current_org_id()
    OR is_super_admin()
  );

CREATE POLICY "solicitacoes_insert_org" ON solicitacoes
  FOR INSERT WITH CHECK (
    company_id = get_current_org_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "solicitacoes_update_org" ON solicitacoes
  FOR UPDATE USING (
    company_id = get_current_org_id()
    AND (created_by = auth.uid() OR is_org_admin())
  );

CREATE POLICY "solicitacoes_delete_org" ON solicitacoes
  FOR DELETE USING (
    company_id = get_current_org_id()
    AND is_org_admin()
  );

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
    DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

    -- Usuários veem apenas suas notificações
    CREATE POLICY "notifications_select_own" ON notifications
      FOR SELECT USING (
        user_id = auth.uid()
        OR is_super_admin()
      );

    CREATE POLICY "notifications_update_own" ON notifications
      FOR UPDATE USING (
        user_id = auth.uid()
      );
  END IF;
END $$;

-- ==========================================
-- CONVERSATIONS & CHAT_MESSAGES (Já tem RLS)
-- Apenas garantir que está habilitado
-- ==========================================
-- Já configurado em 001_add_missing_tables.sql

-- ==========================================
-- PROMOTIONS
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'promotions') THEN
    ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "promotions_select_org" ON promotions;
    DROP POLICY IF EXISTS "promotions_manage_org" ON promotions;

    CREATE POLICY "promotions_select_org" ON promotions
      FOR SELECT USING (
        org_id = get_current_org_id()::TEXT
        OR is_super_admin()
      );

    CREATE POLICY "promotions_manage_org" ON promotions
      FOR ALL USING (
        org_id = get_current_org_id()::TEXT
        AND is_org_admin()
      );
  END IF;
END $$;

-- ==========================================
-- MATERIALIZED VIEW: expiry_analytics_mv
-- (Se existir, precisa de grant específico)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'expiry_analytics_mv') THEN
    -- Materialized views não suportam RLS diretamente
    -- Garantir que a view filtra por org_id
    GRANT SELECT ON expiry_analytics_mv TO authenticated;
  END IF;
END $$;

-- ==========================================
-- FUNÇÃO: Verificar acesso antes de operações críticas
-- ==========================================

-- Função para validar se operação é permitida
CREATE OR REPLACE FUNCTION validate_org_access(
  p_table_name VARCHAR,
  p_org_id UUID,
  p_action VARCHAR DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_org UUID;
BEGIN
  v_current_org := get_current_org_id();

  -- Super admin tem acesso total
  IF is_super_admin() THEN
    RETURN true;
  END IF;

  -- Verificar se pertence à mesma organização
  IF p_org_id = v_current_org THEN
    RETURN true;
  END IF;

  -- Log tentativa de acesso negado
  INSERT INTO audit_log (org_id, user_id, action, resource_type, metadata)
  VALUES (
    v_current_org,
    auth.uid(),
    'access_denied',
    p_table_name,
    jsonb_build_object(
      'target_org_id', p_org_id,
      'action_attempted', p_action
    )
  );

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- TRIGGER: Log de acesso a dados sensíveis
-- ==========================================

-- Função para logar acessos a dados sensíveis
CREATE OR REPLACE FUNCTION log_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Só logar operações de UPDATE e DELETE
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    INSERT INTO audit_log (
      org_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values
    ) VALUES (
      get_current_org_id(),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger em tabelas sensíveis (opcional, pode impactar performance)
-- Descomentar conforme necessidade de auditoria

-- CREATE TRIGGER audit_subscriptions
--   AFTER UPDATE OR DELETE ON subscriptions
--   FOR EACH ROW EXECUTE FUNCTION log_sensitive_access();

-- CREATE TRIGGER audit_users
--   AFTER UPDATE OR DELETE ON users
--   FOR EACH ROW EXECUTE FUNCTION log_sensitive_access();

-- ==========================================
-- GRANTS FINAIS
-- ==========================================

-- Funções helper
GRANT EXECUTE ON FUNCTION get_current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_store_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION has_feature(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION check_usage_limit(UUID, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_org_access(VARCHAR, UUID, VARCHAR) TO authenticated;

-- ==========================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ==========================================

COMMENT ON FUNCTION get_current_org_id() IS 'Extrai org_id do JWT do usuário autenticado';
COMMENT ON FUNCTION get_current_store_ids() IS 'Extrai array de store_ids do JWT do usuário';
COMMENT ON FUNCTION is_super_admin() IS 'Verifica se usuário é super_admin ou developer';
COMMENT ON FUNCTION is_org_admin() IS 'Verifica se usuário é admin da organização';
COMMENT ON FUNCTION validate_org_access(VARCHAR, UUID, VARCHAR) IS 'Valida e loga tentativas de acesso cross-org';

-- ==========================================
-- MIGRATION COMPLETA
-- ==========================================
-- RLS ativado em todas as tabelas de negócio
-- Dados isolados por organização
-- Funções helper para verificações
-- Audit log para compliance
