-- ==========================================
-- Migration 016: Ajustar RLS da tabela stores para permitir leitura do nome
-- ==========================================
-- Problema: A RLS atual da tabela stores é muito restritiva e impede que
-- usuários vejam o nome da sua própria loja na HomeScreen do mobile.
--
-- Solução: Adicionar uma policy que permite leitura de lojas onde o usuário
-- está vinculado (via store_id ou store_ids na tabela users).
-- ==========================================

-- Remover a policy existente (se existir) para recriar
DROP POLICY IF EXISTS "Stores are viewable by company users" ON stores;
DROP POLICY IF EXISTS "Users can view their own stores" ON stores;

-- Nova policy: Usuários autenticados podem ver lojas onde estão vinculados
-- ou se forem admin/developer podem ver todas
CREATE POLICY "stores_select_policy" ON stores
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Admins e developers podem ver todas as lojas
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role IN ('developer', 'admin')
      )
      OR
      -- Usuários podem ver lojas da sua empresa
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.company_id = stores.company_id
      )
      OR
      -- Usuários podem ver sua própria loja (store_id)
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.store_id = stores.id
      )
      OR
      -- Usuários podem ver lojas do seu array store_ids
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND stores.id = ANY(u.store_ids)
      )
    )
  );

-- Manter as policies de INSERT, UPDATE, DELETE apenas para admins
-- (já devem existir, mas garantir)
DROP POLICY IF EXISTS "Stores are insertable by admins" ON stores;
DROP POLICY IF EXISTS "Stores are updatable by admins" ON stores;

CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "stores_update_policy" ON stores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "stores_delete_policy" ON stores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('developer', 'admin')
    )
  );

-- ==========================================
-- COMENTÁRIO
-- ==========================================
COMMENT ON POLICY "stores_select_policy" ON stores IS
  'Permite que usuários vejam lojas onde estão vinculados (store_id, store_ids, ou company_id)';
