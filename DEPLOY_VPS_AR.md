# 🚀 Deploy na VPS - Funcionalidade AR

## Pré-requisitos na VPS

- Node.js 18+ instalado
- PM2 ou similar para gerenciar processos
- Nginx configurado com SSL (HTTPS)
- Domínio com certificado SSL válido

---

## 📦 Passo 1: Build da Aplicação

No seu ambiente local, execute:

```bash
# 1. Instale as dependências (se ainda não fez)
npm install

# 2. Faça o build de produção
npm run build

# 3. Deploy dos índices do Firestore
firebase deploy --only firestore:indexes
```

---

## 📤 Passo 2: Enviar para VPS

### Opção A: Git (Recomendado)

```bash
# Commit as mudanças
git add .
git commit -m "feat: adiciona funcionalidade AR de medição volumétrica"
git push origin master

# Na VPS, pull as mudanças
ssh user@sua-vps.com
cd /caminho/do/projeto/WEB
git pull origin master
npm install
npm run build
pm2 restart myinventory
```

### Opção B: SCP/SFTP

```bash
# Comprimir arquivos necessários
tar -czf myinventory-ar.tar.gz \
  .next \
  node_modules \
  public \
  package.json \
  package-lock.json \
  next.config.ts \
  tsconfig.json \
  tailwind.config.ts \
  postcss.config.mjs

# Enviar para VPS
scp myinventory-ar.tar.gz user@sua-vps.com:/caminho/do/projeto/

# Na VPS, extrair e reiniciar
ssh user@sua-vps.com
cd /caminho/do/projeto
tar -xzf myinventory-ar.tar.gz
pm2 restart myinventory
```

---

## 🔧 Passo 3: Configurar Nginx (se ainda não tiver SSL)

### Verificar se SSL está configurado

```bash
# Na VPS
sudo nginx -t
curl -I https://seu-dominio.com
```

### Se precisar configurar SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Certbot vai configurar automaticamente o Nginx
# Reiniciar Nginx
sudo systemctl restart nginx
```

### Configuração Nginx para Next.js

Arquivo: `/etc/nginx/sites-available/myinventory`

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;

    # Certificados SSL (Certbot configura isso automaticamente)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy para Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache para assets estáticos
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, max-age=3600, immutable";
    }

    # Tamanho máximo de upload (para fotos AR no futuro)
    client_max_body_size 10M;
}
```

Ativar configuração:

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/myinventory /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## 🔥 Passo 4: Configurar Firebase na VPS

Certifique-se que as variáveis de ambiente do Firebase estão configuradas:

### Criar arquivo `.env.local` na VPS

```bash
# Na VPS
cd /caminho/do/projeto/WEB
nano .env.local
```

Adicione:

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Outras configs necessárias
NODE_ENV=production
```

---

## 🎯 Passo 5: Iniciar Aplicação com PM2

```bash
# Na VPS
cd /caminho/do/projeto/WEB

# Instalar dependências
npm install --production

# Build (se ainda não fez)
npm run build

# Iniciar com PM2
pm2 start npm --name "myinventory" -- start

# Ou se já existe, reiniciar
pm2 restart myinventory

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
```

### Verificar se está rodando

```bash
pm2 status
pm2 logs myinventory --lines 50
```

---

## ✅ Passo 6: Testar AR no iPhone

### 1. Verificar HTTPS

Acesse no navegador do computador:
```
https://seu-dominio.com
```

Certifique-se que:
- ✅ Não mostra erro de certificado
- ✅ Aparece o cadeado verde
- ✅ Aplicação carrega normalmente

### 2. Acessar no iPhone

1. Abra o **Safari** no iPhone (não Chrome!)
2. Digite: `https://seu-dominio.com/ar-measurement`
3. Permita acesso à câmera quando solicitado
4. Toque em "Iniciar AR"
5. Aponte para superfície plana
6. Marque 4 pontos
7. Veja os resultados
8. Salve a medição

---

## 🐛 Troubleshooting

### "AR Não Suportado" mesmo em HTTPS

**Verifique**:
```bash
# Na VPS, checar se Next.js está rodando
pm2 logs myinventory

# Verificar portas
netstat -tlnp | grep 3000

# Testar localmente na VPS
curl http://localhost:3000/ar-measurement
```

### Erro 502 Bad Gateway

**Causa**: Next.js não está rodando ou porta errada

**Solução**:
```bash
# Reiniciar aplicação
pm2 restart myinventory

# Verificar logs
pm2 logs myinventory --lines 100
```

### Certificado SSL Inválido

**Solução**:
```bash
# Renovar certificado
sudo certbot renew

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Aplicação não carrega após deploy

**Verificar**:
```bash
# Build existe?
ls -la /caminho/do/projeto/WEB/.next

# Dependências instaladas?
ls -la /caminho/do/projeto/WEB/node_modules

# Rebuild se necessário
npm run build
pm2 restart myinventory
```

---

## 📊 Monitoramento

### Verificar logs em tempo real

```bash
# Logs da aplicação
pm2 logs myinventory --lines 200

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Status do sistema
pm2 status
htop
```

### Métricas PM2

```bash
# Dashboard
pm2 monit

# Estatísticas
pm2 describe myinventory
```

---

## 🔐 Segurança

### Firewall

```bash
# Permitir apenas portas necessárias
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### Rate Limiting no Nginx (Opcional)

Adicione no bloco `server`:

```nginx
# Limitar requisições por IP
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

location / {
    limit_req zone=mylimit burst=20;
    # ... resto da config
}
```

---

## 📝 Checklist Final

Antes de testar no iPhone, confirme:

- [ ] Build executado com sucesso (`npm run build`)
- [ ] Índices Firestore deployados (`firebase deploy --only firestore:indexes`)
- [ ] Arquivos enviados para VPS
- [ ] Dependências instaladas na VPS (`npm install`)
- [ ] Variáveis de ambiente configuradas (`.env.local`)
- [ ] PM2 rodando a aplicação (`pm2 status`)
- [ ] Nginx configurado com SSL válido
- [ ] HTTPS funcionando (cadeado verde)
- [ ] Porta 3000 respondendo localmente na VPS
- [ ] Firewall configurado
- [ ] `/ar-measurement` acessível

---

## 🎉 Teste Final

1. **Computador**: Acesse `https://seu-dominio.com/ar-measurement`
   - Deve mostrar erro de AR não suportado (normal em desktop)

2. **iPhone Safari**: Acesse `https://seu-dominio.com/ar-measurement`
   - Deve pedir permissão de câmera
   - Deve permitir iniciar AR
   - Deve funcionar medição

---

## 📞 Comandos Úteis

```bash
# Reiniciar tudo
pm2 restart myinventory && sudo systemctl restart nginx

# Ver logs em tempo real
pm2 logs myinventory --lines 0

# Rebuild completo
npm run build && pm2 restart myinventory

# Verificar SSL
openssl s_client -connect seu-dominio.com:443 -servername seu-dominio.com

# Testar Nginx config
sudo nginx -t

# Status geral
pm2 status && sudo systemctl status nginx
```
