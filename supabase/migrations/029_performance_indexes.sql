-- =============================================
-- Performance Indexes - Sprint 5 Otimização
-- =============================================
-- Índices otimizados para queries frequentes.
-- Usar CONCURRENTLY para não bloquear tabelas em produção.
-- =============================================

-- ==========================================
-- SOLICITAÇÕES
-- ==========================================

-- Índice para dashboard: busca por status excluindo draft
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacoes_status_created
  ON solicitacoes(status, created_at DESC)
  WHERE status != 'draft';

-- Índice para busca por loja
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacoes_store_id
  ON solicitacoes(store_id, created_at DESC)
  WHERE status != 'draft';

-- Índice para busca por criador
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacoes_created_by
  ON solicitacoes(created_by, created_at DESC);

-- Índice para período (relatórios)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacoes_created_at
  ON solicitacoes(created_at DESC);

-- ==========================================
-- SOLICITAÇÃO ITENS
-- ==========================================

-- Índice para JOIN com solicitação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacao_itens_solicitacao_id
  ON solicitacao_itens(solicitacao_id);

-- Índice para busca por status do item
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacao_itens_status
  ON solicitacao_itens(status);

-- Índice para busca por EAN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacao_itens_ean
  ON solicitacao_itens(ean)
  WHERE ean IS NOT NULL;

-- Índice para busca por comprador
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solicitacao_itens_comprador
  ON solicitacao_itens(comprador)
  WHERE comprador IS NOT NULL;

-- ==========================================
-- PRODUTOS
-- ==========================================

-- Índice para busca por EAN (lookup frequente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_ean
  ON products(ean)
  WHERE ean IS NOT NULL;

-- Índice para busca por nome (texto parcial)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_nome_trgm
  ON products USING gin(nome gin_trgm_ops);

-- Habilitar extensão pg_trgm se não existir
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice para busca por organização
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_org_id
  ON products(org_id)
  WHERE org_id IS NOT NULL;

-- Índice para produtos ativos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active
  ON products(id)
  WHERE active = true OR active IS NULL;

-- ==========================================
-- USERS
-- ==========================================

-- Índice para usuários ativos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active
  ON users(id)
  WHERE active = true OR active IS NULL;

-- Índice para busca por loja
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_store_id
  ON users(store_id)
  WHERE store_id IS NOT NULL;

-- Índice para busca por role
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role
  ON users(role);

-- Índice para busca por email
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users(email);

-- ==========================================
-- STORES
-- ==========================================

-- Índice para busca por organização
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_org_id
  ON stores(org_id)
  WHERE org_id IS NOT NULL;

-- Índice para busca por nome
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_name
  ON stores(name);

-- ==========================================
-- INVENTORIES
-- ==========================================

-- Índice para busca por loja e data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventories_store_date
  ON inventories(store_id, created_at DESC);

-- Índice para busca por status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventories_status
  ON inventories(status, created_at DESC);

-- ==========================================
-- INVENTORY COUNTS
-- ==========================================

-- Índice para busca por inventário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_counts_inventory_id
  ON inventory_counts(inventory_id);

-- Índice para busca por EAN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_counts_ean
  ON inventory_counts(ean);

-- ==========================================
-- COMPLIANCE TASKS
-- ==========================================

-- Índice para busca por loja e status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_tasks_store_status
  ON compliance_tasks(store_id, status, created_at DESC);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================

-- Índice para busca por usuário (não lidas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read = false;

-- ==========================================
-- FCM QUEUE
-- ==========================================

-- Índice para busca de pendentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fcm_queue_pending
  ON fcm_queue(status, created_at ASC)
  WHERE status = 'pending';

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON INDEX idx_solicitacoes_status_created IS 'Otimiza dashboard: busca solicitações por status';
COMMENT ON INDEX idx_solicitacao_itens_solicitacao_id IS 'Otimiza JOIN entre solicitações e itens';
COMMENT ON INDEX idx_products_ean IS 'Otimiza lookup de produtos por código de barras';
COMMENT ON INDEX idx_users_active IS 'Otimiza listagem de usuários ativos';

-- ==========================================
-- ANALYZE para atualizar estatísticas
-- ==========================================

ANALYZE solicitacoes;
ANALYZE solicitacao_itens;
ANALYZE products;
ANALYZE users;
ANALYZE stores;
ANALYZE inventories;
