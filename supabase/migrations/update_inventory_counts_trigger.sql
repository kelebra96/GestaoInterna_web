-- Função para atualizar contagens de endereços no inventário
CREATE OR REPLACE FUNCTION update_inventory_address_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o inventário correspondente
  UPDATE inventories
  SET 
    total_addresses = (
      SELECT COUNT(*)
      FROM inventory_addresses
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
    ),
    addresses_completed = (
      SELECT COUNT(*)
      FROM inventory_addresses
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND status = 'completed'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contagens quando endereços são inseridos, atualizados ou excluídos
DROP TRIGGER IF EXISTS trg_update_inventory_address_counts ON inventory_addresses;

CREATE TRIGGER trg_update_inventory_address_counts
AFTER INSERT OR UPDATE OF status OR DELETE ON inventory_addresses
FOR EACH ROW
EXECUTE FUNCTION update_inventory_address_counts();

-- Correção de dados existentes (One-time fix)
UPDATE inventories i
SET 
  total_addresses = (
    SELECT COUNT(*)
    FROM inventory_addresses ia
    WHERE ia.inventory_id = i.id
  ),
  addresses_completed = (
    SELECT COUNT(*)
    FROM inventory_addresses ia
    WHERE ia.inventory_id = i.id
    AND ia.status = 'completed'
  );
