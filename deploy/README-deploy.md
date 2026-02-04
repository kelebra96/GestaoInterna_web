# Deploy do Image Worker na VPS Hostinger

## 1. Copiar arquivos systemd

```bash
# Na VPS como root
sudo cp deploy/image-worker.service /etc/systemd/system/
sudo cp deploy/image-worker.timer /etc/systemd/system/
sudo cp deploy/image-backfill.service /etc/systemd/system/
sudo cp deploy/image-backfill.timer /etc/systemd/system/
```

## 2. Criar arquivo .env.production

```bash
# /var/www/myinventory/.env.production
SUPABASE_URL=https://eetduqcmjucslzedsotg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENAI_API_KEY=sk-proj-...
IMAGE_CONFIDENCE_THRESHOLD=0.65
IMAGE_ACCEPT_OFF_DIRECT=false
```

## 3. Habilitar e iniciar serviços

```bash
# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar timers para iniciar no boot
sudo systemctl enable image-worker.timer
sudo systemctl enable image-backfill.timer

# Iniciar timers
sudo systemctl start image-worker.timer
sudo systemctl start image-backfill.timer

# Verificar status
sudo systemctl status image-worker.timer
sudo systemctl status image-backfill.timer
```

## 4. Comandos úteis

```bash
# Ver logs do worker
sudo journalctl -u image-worker -f

# Executar worker manualmente
sudo systemctl start image-worker.service

# Executar backfill manualmente
sudo systemctl start image-backfill.service

# Parar worker
sudo systemctl stop image-worker.service

# Reiniciar worker
sudo systemctl restart image-worker.service

# Ver próxima execução dos timers
sudo systemctl list-timers --all | grep image
```

## 5. Monitoramento

```bash
# Logs das últimas 24h
sudo journalctl -u image-worker --since "24 hours ago"

# Estatísticas de jobs
psql $DATABASE_URL -c "
SELECT
  status,
  COUNT(*) as total,
  AVG(attempts) as avg_attempts
FROM image_jobs
GROUP BY status;
"
```

## Troubleshooting

### Worker não inicia
```bash
# Verificar permissões
sudo chown -R www-data:www-data /var/www/myinventory

# Verificar se tsx está instalado
which npx tsx

# Testar manualmente
cd /var/www/myinventory
sudo -u www-data npx dotenv -e .env.production -- tsx scripts/image-worker.ts
```

### Jobs travados
```sql
-- Liberar jobs travados há mais de 30 minutos
UPDATE image_jobs
SET status = 'queued', locked_at = NULL, locked_by = NULL
WHERE status = 'running' AND locked_at < NOW() - INTERVAL '30 minutes';
```
