-- ============================================
-- Adicionar coluna expiration_dates em inventory_items
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Adicionar coluna expiration_dates (array JSON para armazenar múltiplas datas com quantidades)
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS expiration_dates JSONB DEFAULT '[]'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.inventory_items.expiration_dates IS 'Array de objetos {date: string, quantity: number} para rastrear validades';

-- Verificar
SELECT 'Coluna expiration_dates adicionada com sucesso!' as status;
