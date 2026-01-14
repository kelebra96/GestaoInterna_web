#!/bin/bash

# Script de Deploy AR para VPS
# Uso: ./deploy-ar-vps.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy da funcionalidade AR para VPS..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variáveis (CONFIGURE AQUI)
VPS_USER="seu-usuario"
VPS_HOST="seu-dominio.com"
VPS_PATH="/caminho/do/projeto/WEB"
APP_NAME="myinventory"

echo -e "${YELLOW}📦 Passo 1: Build local...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build concluído com sucesso${NC}"
else
    echo -e "${RED}❌ Erro no build${NC}"
    exit 1
fi

echo -e "${YELLOW}🔥 Passo 2: Deploy índices Firestore...${NC}"
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Índices deployados${NC}"
else
    echo -e "${RED}⚠️  Erro ao deployar índices (continuando...)${NC}"
fi

echo -e "${YELLOW}📤 Passo 3: Enviando arquivos para VPS...${NC}"

# Criar arquivo tar com apenas arquivos necessários
tar -czf deploy-ar.tar.gz \
    .next \
    public \
    app \
    components \
    contexts \
    hooks \
    lib \
    stores \
    utils \
    package.json \
    package-lock.json \
    next.config.ts \
    tsconfig.json \
    tailwind.config.ts \
    postcss.config.mjs \
    firestore.indexes.json \
    firebase.json \
    --exclude=node_modules \
    --exclude=.git

echo -e "${GREEN}✅ Arquivo tar criado${NC}"

# Enviar para VPS
echo -e "${YELLOW}📡 Enviando para VPS...${NC}"
scp deploy-ar.tar.gz ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Arquivo enviado${NC}"
else
    echo -e "${RED}❌ Erro ao enviar arquivo${NC}"
    rm deploy-ar.tar.gz
    exit 1
fi

# Limpar arquivo local
rm deploy-ar.tar.gz

echo -e "${YELLOW}🔧 Passo 4: Extraindo e configurando na VPS...${NC}"

# SSH para VPS e executar comandos
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
set -e

# Variáveis
VPS_PATH="/caminho/do/projeto/WEB"
APP_NAME="myinventory"

cd ${VPS_PATH}

echo "📦 Extraindo arquivos..."
tar -xzf deploy-ar.tar.gz

echo "🗑️  Removendo tar..."
rm deploy-ar.tar.gz

echo "📥 Instalando dependências..."
npm install --production

echo "🔄 Reiniciando aplicação..."
pm2 restart ${APP_NAME} || pm2 start npm --name "${APP_NAME}" -- start

echo "💾 Salvando configuração PM2..."
pm2 save

echo "✅ Deploy concluído na VPS!"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Próximos passos:${NC}"
    echo "1. Acesse https://${VPS_HOST}/ar-measurement no Safari do iPhone"
    echo "2. Permita acesso à câmera"
    echo "3. Teste a funcionalidade AR"
    echo ""
    echo -e "${GREEN}🎉 Pronto para testar!${NC}"
else
    echo -e "${RED}❌ Erro durante deploy na VPS${NC}"
    exit 1
fi
