-- ============================================
-- Criar tabela inventory_counts
-- Execute este SQL no Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.inventory_counts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    address_id UUID REFERENCES public.inventory_addresses(id) ON DELETE SET NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    company_id UUID NOT NULL,
    ean VARCHAR(20) NOT NULL,
    product_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    expiration_date DATE,
    counted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    counted_by_name VARCHAR(255),
    counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    address_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inventory_counts_inventory_id ON public.inventory_counts(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_address_code ON public.inventory_counts(address_code);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_ean ON public.inventory_counts(ean);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_counted_at ON public.inventory_counts(counted_at DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver contagens da sua empresa
CREATE POLICY "Users can view their company counts" ON public.inventory_counts
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ));

-- Policy: Usuários podem inserir contagens para sua empresa
CREATE POLICY "Users can insert counts for their company" ON public.inventory_counts
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ));

-- Grant permissions
GRANT ALL ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_inventory_counts_updated_at ON public.inventory_counts;
CREATE TRIGGER update_inventory_counts_updated_at
    BEFORE UPDATE ON public.inventory_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar se a tabela foi criada
SELECT 'Tabela inventory_counts criada com sucesso!' as status;
