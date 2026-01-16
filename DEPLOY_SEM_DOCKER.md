# 🚀 Deploy da Aplicação Web - SEM DOCKER

## Método 1: Deploy via Git (Recomendado)

### Pré-requisitos no Servidor (VPS)
- Node.js 18+ instalado
- PM2 instalado globalmente (`npm install -g pm2`)
- Git instalado
- Nginx configurado (opcional, para proxy reverso)

### Passo a Passo

#### 1. Commit suas mudanças localmente

```bash
# No diretório WEB
cd D:\myinventory\WEB

# Adicionar arquivos modificados
git add app/api/dashboard/route.ts
git add app/api/solicitacoes/route.ts

# Commit
git commit -m "fix: filtrar solicitações draft do dashboard web"

# Push para repositório
git push origin main
```

#### 2. No servidor VPS, fazer pull das mudanças

```bash
# Conectar ao servidor
ssh usuario@seu-servidor.com

# Navegar até o diretório do projeto
cd /caminho/do/projeto/WEB

# Atualizar código
git pull origin main
```

#### 3. Instalar dependências (se necessário)

```bash
npm install
```

#### 4. Build da aplicação

```bash
npm run build
```

#### 5. Reiniciar aplicação com PM2

```bash
# Se já está rodando com PM2
pm2 restart myinventory

# OU se é primeira vez
pm2 start npm --name "myinventory" -- start
pm2 save
```

#### 6. Verificar logs

```bash
pm2 logs myinventory --lines 50
```

#### 7. Testar

```bash
# Testar API
curl http://localhost:3000/api/dashboard
curl http://localhost:3000/api/solicitacoes
```

---

## Método 2: Deploy Manual (Sem Git)

Use este método se não tiver Git configurado no servidor.

### Passo a Passo

#### 1. Build local

```bash
# No Windows, no diretório WEB
cd D:\myinventory\WEB

# Fazer build
npm run build
```

#### 2. Criar pacote dos arquivos necessários

```bash
# No PowerShell ou Git Bash
tar -czf web-deploy.tar.gz `
  .next `
  app `
  components `
  contexts `
  hooks `
  lib `
  public `
  utils `
  workers `
  stores `
  prisma `
  package.json `
  package-lock.json `
  next.config.ts `
  tsconfig.json `
  instrumentation.ts `
  sentry.client.config.ts `
  sentry.server.config.ts `
  .env.production
```

**Ou copiar estes arquivos e pastas:**
- `.next/` (pasta completa após build)
- `app/` (código fonte)
- `components/`
- `contexts/`
- `hooks/`
- `lib/`
- `public/`
- `utils/`
- `workers/`
- `stores/`
- `prisma/`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `.env.production` (ou `.env` com variáveis de produção)

#### 3. Enviar para o servidor

```bash
# Via SCP
scp web-deploy.tar.gz usuario@seu-servidor:/tmp/

# OU use FileZilla, WinSCP, ou outro cliente FTP/SFTP
```

#### 4. No servidor, extrair e instalar

```bash
# Conectar ao servidor
ssh usuario@seu-servidor.com

# Navegar até diretório da aplicação
cd /caminho/do/projeto/WEB

# Fazer backup (segurança)
cp -r .next .next.backup

# Extrair arquivos
tar -xzf /tmp/web-deploy.tar.gz

# Instalar dependências de produção
npm install --production

# OU se preferir todas as dependências
npm install
```

#### 5. Reiniciar PM2

```bash
pm2 restart myinventory

# Verificar status
pm2 status

# Ver logs
pm2 logs myinventory --lines 100
```

---

## Método 3: Script Automático (Deploy Rápido)

Crie este script para automatizar o deploy:

### Criar arquivo `deploy.sh` no diretório WEB

```bash
#!/bin/bash
# Deploy script para aplicação Next.js

# Configurações
VPS_USER="seu-usuario"
VPS_HOST="seu-servidor.com"
VPS_PATH="/caminho/do/projeto/WEB"
APP_NAME="myinventory"

echo "🔨 Building application..."
npm run build

echo "📦 Creating deployment package..."
tar -czf web-deploy.tar.gz \
  .next \
  app \
  components \
  contexts \
  hooks \
  lib \
  public \
  utils \
  workers \
  stores \
  prisma \
  package.json \
  package-lock.json \
  next.config.ts \
  tsconfig.json

echo "📤 Uploading to server..."
scp web-deploy.tar.gz $VPS_USER@$VPS_HOST:/tmp/

echo "🚀 Deploying on server..."
ssh $VPS_USER@$VPS_HOST << EOF
  cd $VPS_PATH

  # Backup
  [ -d .next ] && cp -r .next .next.backup

  # Extract
  tar -xzf /tmp/web-deploy.tar.gz

  # Install dependencies
  npm install --production

  # Restart PM2
  pm2 restart $APP_NAME || pm2 start npm --name "$APP_NAME" -- start
  pm2 save

  # Cleanup
  rm /tmp/web-deploy.tar.gz

  echo "✅ Deploy completed!"
  pm2 status
EOF

# Cleanup local
rm web-deploy.tar.gz

echo "🎉 Deploy finished!"
```

### Usar o script

```bash
# Dar permissão de execução
chmod +x deploy.sh

# Executar
./deploy.sh
```

---

## Configuração PM2 (Primeira vez)

Se esta é a primeira vez configurando PM2:

### 1. Criar arquivo ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'myinventory',
    script: 'npm',
    args: 'start',
    cwd: '/caminho/do/projeto/WEB',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 2. Iniciar com PM2

```bash
cd /caminho/do/projeto/WEB
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Configuração Nginx (Proxy Reverso)

Se você usa Nginx como proxy reverso:

### Arquivo de configuração: `/etc/nginx/sites-available/myinventory`

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Redirecionar para HTTPS (se tiver SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3000;
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

### Ativar configuração

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/myinventory /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## ✅ Checklist de Deploy

Antes de fazer deploy:
- [ ] Código commitado (se usar Git)
- [ ] Build local funcionando (`npm run build`)
- [ ] Variáveis de ambiente configuradas no servidor
- [ ] PM2 instalado no servidor
- [ ] Nginx configurado (se usar)

Durante deploy:
- [ ] Build executado
- [ ] Arquivos enviados ao servidor
- [ ] Dependências instaladas
- [ ] PM2 reiniciado

Após deploy:
- [ ] Aplicação rodando (`pm2 status`)
- [ ] Logs sem erros (`pm2 logs myinventory`)
- [ ] API acessível (`curl http://localhost:3000/api/dashboard`)
- [ ] Web dashboard funcionando

Teste do fix:
- [ ] Criar solicitação draft no mobile
- [ ] Verificar que NÃO aparece no web dashboard
- [ ] Finalizar solicitação no mobile
- [ ] Verificar que AGORA aparece no web dashboard

---

## 🔧 Comandos Úteis

### Ver logs em tempo real
```bash
pm2 logs myinventory --lines 0
```

### Reiniciar aplicação
```bash
pm2 restart myinventory
```

### Status da aplicação
```bash
pm2 status
```

### Parar aplicação
```bash
pm2 stop myinventory
```

### Deletar da lista PM2
```bash
pm2 delete myinventory
```

### Ver informações detalhadas
```bash
pm2 show myinventory
```

### Monitorar recursos
```bash
pm2 monit
```

---

## 🆘 Troubleshooting

### Build falha
```bash
# Limpar cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Aplicação não inicia
```bash
# Ver logs detalhados
pm2 logs myinventory --err --lines 100

# Verificar porta em uso
netstat -tlnp | grep 3000

# Matar processo na porta 3000
kill -9 $(lsof -t -i:3000)
```

### Erro de permissão
```bash
# Ajustar permissões
sudo chown -R $USER:$USER /caminho/do/projeto/WEB
```

### Nginx 502 Bad Gateway
```bash
# Verificar se app está rodando
pm2 status

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar serviços
pm2 restart myinventory
sudo systemctl restart nginx
```

---

## 📝 Variáveis de Ambiente

Certifique-se de ter o arquivo `.env` ou `.env.production` no servidor com:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Firebase (se usar)
NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
# ... outras variáveis Firebase

# Outros
NODE_ENV=production
PORT=3000
```

---

## 🎉 Pronto!

Sua aplicação web está rodando sem Docker!

**Acessar**: `http://seu-dominio.com` ou `http://seu-ip:3000`
