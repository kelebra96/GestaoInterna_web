-- Verificar se o endereço existe em QUALQUER inventário
SELECT 
  ia.id, 
  ia.address_code, 
  ia.status, 
  ia.inventory_id, 
  i.name as inventory_name,
  i.status as inventory_status
FROM inventory_addresses ia
JOIN inventories i ON i.id = ia.inventory_id
WHERE ia.address_code ILIKE '%LOJA06062026007%';

-- Listar endereços parecidos para ver se há erro de digitação
SELECT address_code 
FROM inventory_addresses 
WHERE address_code LIKE '%06062026%'
LIMIT 10;
