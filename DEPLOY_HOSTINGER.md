# 🚀 Guia Completo: Deploy na Hostinger VPS

## Pré-requisitos

- ✅ VPS Hostinger contratada
- ✅ Credenciais SSH (IP, usuário, senha)
- ✅ Domínio configurado (opcional)
- ✅ Build local funcionando (`npm run build`)

---

## 📋 Passo a Passo

### 1️⃣ Configurar VPS pela Primeira Vez

Acesse via SSH:

```bash
ssh root@SEU_IP_HOSTINGER
# Digite a senha quando solicitado
```

Execute a configuração inicial:

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Criar usuário para deploy
adduser deployuser
# Defina uma senha forte quando solicitado

# Adicionar usuário aos grupos necessários
usermod -aG sudo deployuser
usermod -aG docker deployuser

# Configurar firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

echo "✅ Configuração inicial concluída!"
```

### 2️⃣ Configurar Autenticação SSH (Opcional mas Recomendado)

No seu computador local (Windows):

```bash
# Gerar chave SSH (se não tiver)
ssh-keygen -t rsa -b 4096

# Copiar chave pública para VPS
type %USERPROFILE%\.ssh\id_rsa.pub | ssh deployuser@SEU_IP_HOSTINGER "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Agora você pode conectar sem senha:
```bash
ssh deployuser@SEU_IP_HOSTINGER
```

### 3️⃣ Preparar Arquivo .env

Na VPS, crie o arquivo de configuração:

```bash
ssh deployuser@SEU_IP_HOSTINGER

# Criar diretório
mkdir -p ~/myinventory
cd ~/myinventory

# Criar arquivo .env
nano .env
```

Cole o conteúdo ajustado:

```env
# Firebase (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDU2dKI9DC0rrsQ7E41WbbYMrkzUwAHVwg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=myinventoy.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=myinventoy
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=myinventoy.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=220214662897
NEXT_PUBLIC_FIREBASE_APP_ID=1:220214662897:web:app-id-aqui

# Firebase (Server)
FIREBASE_PROJECT_ID=myinventoy
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@myinventoy.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----"
FIREBASE_STORAGE_BUCKET=myinventoy.firebasestorage.app

# Senhas fortes para produção
JWT_SECRET=MUDE_ESTA_SENHA_PARA_ALGO_FORTE_E_ALEATORIO
REDIS_PASSWORD=SENHA_FORTE_REDIS_AQUI

NODE_ENV=production
```

Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4️⃣ Deploy Automático

**Opção 1 - Usando script deploy-hostinger.sh (Git Bash/WSL):**

```bash
chmod +x deploy-hostinger.sh
./deploy-hostinger.sh SEU_IP_HOSTINGER
```

**Opção 2 - Manualmente (PowerShell/CMD):**

No seu computador local:

```bash
# Build
npm run build

# Criar pacote
tar -czf myinventory-deploy.tar.gz .next/standalone .next/static public docker-compose.yml Dockerfile.simple nginx.conf serviceAccountKey.json

# Enviar
scp myinventory-deploy.tar.gz deployuser@SEU_IP_HOSTINGER:/tmp/
```

Na VPS:

```bash
cd ~/myinventory
tar -xzf /tmp/myinventory-deploy.tar.gz
docker build --no-cache -f Dockerfile.simple -t myinventory:latest .
docker-compose down
docker-compose up -d
```

### 5️⃣ Verificar Deploy

```bash
# Ver containers
docker-compose ps

# Ver logs
docker-compose logs -f app

# Testar
curl http://localhost/api/test
```

Acesse: `http://SEU_IP_HOSTINGER`

---

## 🌐 Configurar Domínio e SSL

### No Painel Hostinger

1. **Domínios** → Seu domínio → **DNS / Nameservers**
2. Adicionar registro A:
   - **Tipo:** A
   - **Nome:** @ (e www)
   - **Valor:** SEU_IP_VPS
   - **TTL:** 3600

### Configurar SSL na VPS

```bash
# Instalar Certbot
sudo apt install certbot -y

# Obter certificado
sudo certbot certonly --standalone -d seudominio.com.br -d www.seudominio.com.br

# Criar volume para certificados no docker-compose.yml
# Adicionar em nginx volumes:
# - /etc/letsencrypt:/etc/letsencrypt:ro

# Atualizar nginx.conf para SSL
docker-compose restart nginx
```

Configuração SSL no nginx.conf:

```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com.br www.seudominio.com.br;

    ssl_certificate /etc/letsencrypt/live/seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com.br/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔧 Comandos Úteis

### Atualizar Aplicação

```bash
# Local: build e enviar
npm run build
./deploy-hostinger.sh SEU_IP
```

### Logs e Monitoramento

```bash
docker-compose logs -f app
docker stats
docker-compose ps
```

### Backup MongoDB

```bash
# Criar backup
docker exec myinventory-mongodb mongodump --out /data/backup
docker cp myinventory-mongodb:/data/backup ./backup-$(date +%Y%m%d)

# Restaurar
docker cp ./backup myinventory-mongodb:/data/restore
docker exec myinventory-mongodb mongorestore /data/restore
```

### Reiniciar Serviços

```bash
docker-compose restart
docker-compose restart app
docker-compose down && docker-compose up -d
```

---

## ✅ Checklist

- [ ] VPS com Docker instalado
- [ ] Firewall configurado (22, 80, 443)
- [ ] .env com credenciais corretas
- [ ] Deploy executado
- [ ] Containers rodando
- [ ] Aplicação acessível via IP
- [ ] Domínio configurado (opcional)
- [ ] SSL ativo (opcional)

🎉 **Aplicação em produção na Hostinger!**
