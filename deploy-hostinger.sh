#!/bin/bash
# Script de Deploy Automático para Hostinger VPS
# Uso: ./deploy-hostinger.sh SEU_IP_VPS

set -e

VPS_IP=$1
VPS_USER="deployuser"
DEPLOY_DIR="/home/deployuser/myinventory"

if [ -z "$VPS_IP" ]; then
    echo "❌ Erro: Forneça o IP da VPS"
    echo "Uso: ./deploy-hostinger.sh SEU_IP_VPS"
    exit 1
fi

echo "🔨 Construindo aplicação localmente..."
npm run build

echo "📦 Criando pacote de deploy..."
tar -czf myinventory-deploy.tar.gz \
    .next/standalone \
    .next/static \
    public \
    docker-compose.yml \
    Dockerfile.simple \
    nginx.conf \
    serviceAccountKey.json \
    package.json

echo "📤 Enviando para VPS ($VPS_IP)..."
scp myinventory-deploy.tar.gz $VPS_USER@$VPS_IP:/tmp/

echo "🚀 Implantando na VPS..."
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
    # Criar diretório
    mkdir -p /home/deployuser/myinventory
    cd /home/deployuser/myinventory

    # Extrair arquivos
    tar -xzf /tmp/myinventory-deploy.tar.gz
    rm /tmp/myinventory-deploy.tar.gz

    # Construir imagem Docker
    docker build --no-cache -f Dockerfile.simple -t myinventory:latest .

    # Parar containers antigos
    docker-compose down 2>/dev/null || true

    # Iniciar novos containers
    docker-compose up -d

    # Verificar status
    sleep 5
    docker-compose ps

    echo "✅ Deploy concluído!"
    echo "🌐 Acesse: http://$(curl -s ifconfig.me)"
ENDSSH

echo "🎉 Deploy finalizado com sucesso!"
echo "🌐 Aplicação disponível em: http://$VPS_IP"

# Limpar arquivo local
rm myinventory-deploy.tar.gz
