# 🐳 Deploy com Docker + Supabase

Guia completo para fazer deploy da aplicação usando Docker com Supabase como banco único.

---

## 📋 Arquitetura

```
┌─────────────────────────────────────────┐
│         Docker Containers               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  Next.js App │    │    Redis     │  │
│  │ (porta 3000) │    │  (cache)     │  │
│  └──────┬───────┘    └──────────────┘  │
│         │                               │
│  ┌──────▼───────┐                       │
│  │    Nginx     │                       │
│  │  (porta 80)  │                       │
│  └──────────────┘                       │
│                                         │
└────────┬────────────────────────────────┘
         │
         ├──► Supabase Cloud (PostgreSQL)
         │    - Todos os dados
         │    - Storage de arquivos
         │
         └──► Firebase (apenas Auth)
              - Autenticação de usuários
```

**IMPORTANTE:**
- ✅ **Supabase** = Banco de dados único (PostgreSQL)
- ✅ **Firebase** = Apenas autenticação
- ❌ **NÃO usa** Firestore
- ❌ **NÃO usa** MongoDB

---

## ⚡ Quick Start (Local)

### 1. Preparar Ambiente

```bash
# Copiar env de produção
cp .env.production .env

# Editar se necessário
notepad .env
```

### 2. Build e Start

```bash
# Build da imagem Docker
docker-compose -f docker-compose.supabase.yml build

# Iniciar todos os containers
docker-compose -f docker-compose.supabase.yml up -d

# Ver logs
docker-compose -f docker-compose.supabase.yml logs -f app
```

### 3. Acessar Aplicação

- **App:** http://localhost
- **API:** http://localhost/api
- **Health Check:** http://localhost/health

### 4. Parar Containers

```bash
docker-compose -f docker-compose.supabase.yml down
```

---

## 🚀 Deploy em VPS (Produção)

### Opção 1: VPS Simples (Hetzner, DigitalOcean, etc)

#### 1. Conectar na VPS

```bash
ssh root@SEU_IP_VPS
```

#### 2. Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt-get install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

#### 3. Clonar Repositório

```bash
# Clonar seu código
git clone https://github.com/seu-usuario/myinventory.git
cd myinventory/WEB
```

#### 4. Configurar Variáveis

```bash
# Copiar env
cp .env.production .env

# Editar com suas credenciais reais
nano .env
```

**Configure:**
- `DATABASE_URL` - URL do Supabase PostgreSQL
- `FIREBASE_PRIVATE_KEY` - Chave privada do Firebase Admin
- `JWT_SECRET` - Secret forte (gere um novo!)
- `REDIS_PASSWORD` - Senha forte para Redis

#### 5. Deploy

```bash
# Build
docker compose -f docker-compose.supabase.yml build

# Start
docker compose -f docker-compose.supabase.yml up -d

# Verificar status
docker compose ps
```

#### 6. Configurar SSL (Certbot)

```bash
# Instalar Certbot
apt-get install certbot python3-certbot-nginx -y

# Obter certificado SSL
certbot --nginx -d seudominio.com

# Auto-renovação (cron)
crontab -e
# Adicionar: 0 3 * * * certbot renew --quiet
```

#### 7. Monitorar

```bash
# Ver logs
docker compose logs -f

# Ver uso de recursos
docker stats

# Restart se necessário
docker compose restart app
```

---

### Opção 2: AWS ECS/Fargate

#### 1. Criar ECR Repository

```bash
aws ecr create-repository --repository-name myinventory
```

#### 2. Build e Push

```bash
# Login no ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin SEU_ECR_URL

# Build
docker build -t myinventory:latest .

# Tag
docker tag myinventory:latest SEU_ECR_URL/myinventory:latest

# Push
docker push SEU_ECR_URL/myinventory:latest
```

#### 3. Criar Task Definition

Veja arquivo `ecs-task-definition.json` (criar separadamente)

#### 4. Deploy via ECS

```bash
aws ecs update-service --cluster myinventory --service app --force-new-deployment
```

---

### Opção 3: Google Cloud Run

#### 1. Build com Cloud Build

```bash
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/myinventory
```

#### 2. Deploy

```bash
gcloud run deploy myinventory \
  --image gcr.io/SEU_PROJECT_ID/myinventory \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="$(cat .env | xargs)"
```

---

## 📊 Estimativa de Custos

### VPS (Hetzner CPX31)
- **Specs:** 4 vCPU, 8GB RAM, 160GB SSD
- **Custo:** €11.90/mês (~R$70)
- **Suporta:** 2.000-5.000 usuários simultâneos

### Supabase Pro
- **Database:** 8GB PostgreSQL
- **Storage:** 100GB
- **Bandwidth:** 250GB/mês
- **Custo:** $25/mês

### Firebase (apenas Auth)
- **Autenticação:** Grátis até 50k MAU
- **Custo:** $0-10/mês

**TOTAL:** R$70 + $25 + $5 = **~R$200/mês**

Comparado com Firebase full: **R$500-1.500/mês**
**Economia:** R$300-1.300/mês 🎉

---

## 🔧 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker compose logs app

# Entrar no container
docker exec -it myinventory-app sh

# Verificar variáveis
env | grep DATABASE_URL
```

### Erro de conexão com Supabase

```bash
# Testar conexão do container
docker exec -it myinventory-app sh
ping db.eetduqcmjucslzedsotg.supabase.co

# Verificar se URL está correta
echo $DATABASE_URL
```

### App lento

```bash
# Ver uso de recursos
docker stats

# Escalar horizontalmente (múltiplas instâncias)
docker compose up -d --scale app=3
```

### Rebuild após mudanças

```bash
# Rebuild e restart
docker compose build app
docker compose up -d app
```

---

## 📈 Monitoramento

### Logs

```bash
# Logs em tempo real
docker compose logs -f

# Últimas 100 linhas
docker compose logs --tail=100 app

# Logs de um período
docker compose logs --since 30m app
```

### Metrics

```bash
# Uso de CPU/RAM
docker stats

# Ver todos os containers
docker ps -a

# Inspecionar container
docker inspect myinventory-app
```

### Healthcheck

```bash
# Via curl
curl http://localhost/health

# Via docker
docker inspect --format='{{json .State.Health}}' myinventory-app
```

---

## 🔄 CI/CD (GitHub Actions)

Exemplo de workflow:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /root/myinventory/WEB
            git pull
            docker compose -f docker-compose.supabase.yml build
            docker compose -f docker-compose.supabase.yml up -d
```

---

## ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] Senha do Supabase correta
- [ ] Firebase service account key presente
- [ ] Docker instalado na VPS
- [ ] Portas 80 e 443 abertas no firewall
- [ ] DNS apontando para VPS
- [ ] SSL configurado (Certbot)
- [ ] Backup configurado
- [ ] Monitoramento ativo (logs)
- [ ] Health checks respondendo
- [ ] Aplicação acessível via domínio

---

**Pronto para deploy!** 🚀

Execute:
```bash
docker compose -f docker-compose.supabase.yml up -d
```
