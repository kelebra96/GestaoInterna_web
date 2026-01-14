# 🐳 MyInventory - Docker Deploy Guide

Deploy da aplicação MyInventory usando Docker + Supabase

---

## 🎯 Stack

- **Frontend/Backend:** Next.js 16 (App Router)
- **Database:** Supabase PostgreSQL (único banco!)
- **Auth:** Firebase Authentication
- **Cache:** Redis
- **Proxy:** Nginx
- **Container:** Docker + Docker Compose

---

## ⚡ Quick Start (3 comandos)

```bash
# 1. Copiar variáveis de ambiente
cp .env.production .env

# 2. Build e start
docker compose -f docker-compose.supabase.yml up -d

# 3. Acessar
# http://localhost
```

---

## 📦 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Build da imagem Next.js |
| `docker-compose.supabase.yml` | Orquestração (app + nginx + redis) |
| `nginx.conf` | Configuração do proxy reverso |
| `.dockerignore` | Arquivos ignorados no build |
| `.env.production` | Variáveis de ambiente |
| `DOCKER_DEPLOY.md` | Guia completo de deploy |

---

## 🏗️ Arquitetura

```
Internet
   │
   ▼
┌──────────────┐
│    Nginx     │  ← Porta 80/443 (SSL)
│  (proxy)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│  Next.js App │◄────►│    Redis     │
│ (porta 3000) │      │   (cache)    │
└──────┬───────┘      └──────────────┘
       │
       ├──► Supabase (PostgreSQL)
       │    https://eetduqcmjucslzedsotg.supabase.co
       │
       └──► Firebase (Auth)
            https://myinventoy.firebaseapp.com
```

---

## 💰 Custos (1.000 usuários)

| Serviço | Custo/Mês |
|---------|-----------|
| VPS (Hetzner CPX31) | €11.90 (~R$70) |
| Supabase Pro | $25 (~R$125) |
| Firebase (Auth) | $0-10 (~R$0-50) |
| **TOTAL** | **~R$195-245/mês** |

**vs Firebase Full:** R$500-1.500/mês
**Economia:** R$255-1.255/mês 🎉

---

## 🚀 Deploy em VPS

### 1. Preparar VPS

```bash
# SSH na VPS
ssh root@SEU_IP

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
apt-get install docker-compose-plugin -y
```

### 2. Clonar Projeto

```bash
git clone https://github.com/seu-usuario/myinventory.git
cd myinventory/WEB
```

### 3. Configurar .env

```bash
cp .env.production .env
nano .env
```

**Configure:**
- ✅ `DATABASE_URL` - Supabase connection string
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Do dashboard Supabase
- ✅ `FIREBASE_PRIVATE_KEY` - Do service account
- ✅ `JWT_SECRET` - Gere um secret forte

### 4. Deploy

```bash
# Build
docker compose -f docker-compose.supabase.yml build

# Start
docker compose -f docker-compose.supabase.yml up -d

# Verificar
docker compose ps
docker compose logs -f app
```

### 5. SSL (Certbot)

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Obter certificado
certbot --nginx -d seudominio.com

# Auto-renovação
echo "0 3 * * * certbot renew --quiet" | crontab -
```

---

## 📊 Comandos Úteis

```bash
# Ver logs
docker compose logs -f

# Restart app
docker compose restart app

# Ver uso de recursos
docker stats

# Entrar no container
docker exec -it myinventory-app sh

# Rebuild após mudanças
docker compose build app
docker compose up -d app

# Parar tudo
docker compose down

# Limpar tudo (CUIDADO!)
docker compose down -v
```

---

## ✅ Checklist de Deploy

### Antes do Deploy
- [ ] `.env` configurado com credenciais corretas
- [ ] Senha do Supabase correta e encodada
- [ ] Firebase service account key disponível
- [ ] DNS apontando para VPS
- [ ] Portas 80 e 443 abertas

### Após Deploy
- [ ] App acessível via domínio
- [ ] Health check respondendo (`/health`)
- [ ] SSL funcionando (HTTPS)
- [ ] Logs sem erros
- [ ] Banco conectando (Supabase)
- [ ] Auth funcionando (Firebase)

---

## 🔧 Troubleshooting

### App não inicia

```bash
# Ver erros
docker compose logs app

# Verificar env vars
docker exec -it myinventory-app env | grep DATABASE_URL
```

### Erro de conexão Supabase

**Problema:** `Can't reach database server`

**Solução:**
1. Verificar se IP da VPS está na whitelist do Supabase
2. Usar connection pooler URL:
   ```
   postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
   ```

### App lento

```bash
# Escalar horizontalmente
docker compose up -d --scale app=3

# Adicionar mais recursos na VPS
# Hetzner: Upgrade para CPX41 (8 vCPU, 16GB RAM)
```

---

## 🎓 Recursos

- **Docker Docs:** https://docs.docker.com
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docker:** https://nextjs.org/docs/deployment#docker-image
- **DOCKER_DEPLOY.md:** Guia completo de deploy

---

**Está tudo pronto para deploy!** 🚀

Qualquer dúvida, consulte [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md)
