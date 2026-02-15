#!/bin/bash

# Backup automático do PostgreSQL
# Mantém backups dos últimos 7 dias

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="myinventory_backup_$DATE.sql.gz"

echo "[$(date)] Iniciando backup do PostgreSQL..."

# Criar backup comprimido
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -h $POSTGRES_HOST \
  -U $POSTGRES_USER \
  -d $POSTGRES_DB \
  | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup criado com sucesso: $FILENAME"

  # Remover backups antigos (manter últimos 7 dias)
  find $BACKUP_DIR -name "myinventory_backup_*.sql.gz" -mtime +7 -delete
  echo "[$(date)] Backups antigos removidos (>7 dias)"
else
  echo "[$(date)] ERRO ao criar backup!"
  exit 1
fi

# Listar backups existentes
echo "[$(date)] Backups disponíveis:"
ls -lh $BACKUP_DIR/myinventory_backup_*.sql.gz
