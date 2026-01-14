# Dockerfile para Next.js App
# Multi-stage build para otimizar tamanho da imagem

# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS deps

# Instalar dependências do sistema necessárias
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci --legacy-peer-deps

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar node_modules do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Copiar variáveis de ambiente (build time)
# ARG para passar no docker build
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG DATABASE_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV DATABASE_URL=$DATABASE_URL

# Firebase Admin (para build) - valores dummy, serão sobrescritos em runtime
ENV FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV FIREBASE_CLIENT_EMAIL="dummy@dummy.iam.gserviceaccount.com"
ENV FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nDUMMY\n-----END PRIVATE KEY-----"

# Desabilitar telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Gerar Prisma Client ANTES do build
RUN npx prisma generate

# Build da aplicação
RUN npm run build

# ==========================================
# Stage 3: Runner (Produção)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários do build
# Next.js standalone com outputFileTracingRoot cria estrutura em WEB/
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone/WEB ./
COPY --from=builder /app/.next/static ./.next/static

# Copiar service account key (se necessário)
# COPY --from=builder /app/serviceAccountKey.json ./

# Mudar ownership para o usuário nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expor porta
EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Comando para iniciar
CMD ["node", "server.js"]
