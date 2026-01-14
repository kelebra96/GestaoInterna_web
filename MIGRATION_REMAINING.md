# 📋 Itens Restantes da Migração Firebase → Supabase

## ✅ O Que Já Foi Feito (Resumo)

### Infraestrutura
- ✅ Migration 001: Schema SQL (solicitacoes, conversations, fcm_queue, products)
- ✅ Migration 002: Database Triggers (cascade, notifications)
- ✅ Migration 003: Checklist Tables
- ✅ FCM Worker + FCM Admin Helper
- ✅ Sentry (WEB + MOBILE)

### WEB - API Routes Migradas
- ✅ Batch 1: Usuários (4 routes)
- ✅ Batch 2: Dashboard e Solicitações (7 routes)
- ✅ Batch 3: Inventário (16 routes)
- ✅ Batch 4: Mensagens, Notificações, Checklists (8 routes)

**Total migrado:** 35 routes + 3 migrations

---

## 🔄 O Que Falta Fazer

### 1️⃣ WEB - API Routes (Batch 5: ~31 routes)

#### **Planograms (9 routes)**
- [ ] `/api/planograms/base` (GET, POST)
- [ ] `/api/planograms/base/[id]` (GET, PATCH, DELETE)
- [ ] `/api/planograms/base/[id]/slots` (GET, POST, PATCH)
- [ ] `/api/planograms/executions/[id]` (GET, PATCH)
- [ ] `/api/planograms/store` (GET, POST)
- [ ] `/api/planograms/store/[id]` (GET, PATCH)
- [ ] `/api/planograms/store/[id]/publish` (POST)
- [ ] `/api/planograms/analytics` (GET)
- [ ] `/api/planograms/features` (GET)

#### **Compliance (5 routes)**
- [ ] `/api/compliance/tasks` (GET, POST)
- [ ] `/api/compliance/tasks/[id]/start` (POST)
- [ ] `/api/compliance/tasks/[id]/complete` (POST)
- [ ] `/api/compliance/executions` (GET, POST)
- [ ] `/api/compliance/upload` (POST)

#### **Products/Produtos (6 routes)**
- [ ] `/api/products` (GET, POST)
- [ ] `/api/products/[id]` (GET, PATCH, DELETE)
- [ ] `/api/produtos` (GET, POST)
- [ ] `/api/produtos/[id]` (GET, PATCH)
- [ ] `/api/produtos/import` (POST)
- [ ] `/api/produtos/import-csv` (POST)

#### **Analytics/Volumetria (8+ routes)**
- [ ] `/api/volumetria/products` (GET)
- [ ] `/api/volumetria/perda-receita` (GET)
- [ ] `/api/volumetria/ruptura-horario` (GET)
- [ ] `/api/volumetria/slots-criticos` (GET)
- [ ] `/api/volumetria/status-abastecimento` (GET)
- [ ] `/api/analytics/heatmap-rentabilidade-categoria-loja` (GET)
- [ ] Outras rotas de analytics...

#### **Promotions (2 routes)**
- [ ] `/api/promotions` (GET, POST)
- [ ] `/api/promotions/[id]` (GET, PATCH, DELETE)

#### **Chamados (3 routes)**
- [ ] `/api/chamados` (GET, POST)
- [ ] `/api/chamados/approve` (POST)
- [ ] `/api/chamados/pr` (POST)

#### **Outros (5+ routes)**
- [ ] `/api/usuarios/[id]/activities` (GET)
- [ ] `/api/mensagens/migrate` (POST) - Utilitário de migração
- [ ] `/api/mensagens/message/[messageId]` (GET, PATCH, DELETE)
- [ ] `/api/ai` (POST) - Se usar Firebase para IA
- [ ] `/api/database/clear` (POST) - Utilitário de limpeza

---

### 2️⃣ WEB - Serviços (4 arquivos)

- [ ] `lib/databaseService.ts` - Migrar queries Firebase → Supabase
- [ ] `lib/featureFlags.ts` - Migrar feature flags
- [ ] `lib/services/planogram.service.ts` - Service complexo de planogramas
- [ ] `lib/ar/measurementService.ts` - Service de medições AR

---

### 3️⃣ WEB - Types e Helpers

- [ ] Revisar todos os tipos para remover `Timestamp` do Firebase
- [ ] Verificar helpers que usam Firebase (se houver)

---

### 4️⃣ MOBILE - Services e Adapters

#### **Expandir Auth Service Supabase**
- [ ] Phone Auth (OTP via Twilio/Supabase)
- [ ] Google Sign-In (OAuth com @react-native-google-signin)
- [ ] Apple Sign-In (OAuth com @invertase/react-native-apple-authentication)
- [ ] FCM Token Sync (salvar em users.fcm_token)

#### **Criar Storage Service Supabase**
- [ ] `MOBILE/src/services/supabase/storage.service.ts`
  - uploadItemPhoto()
  - uploadMultiplePhotos()
  - deletePhoto()
  - deleteItemPhotos()

#### **Migrar Analytics para Sentry**
- [ ] `MOBILE/src/services/sentry/analytics.service.ts`
  - logEvent() → Sentry.addBreadcrumb()
  - logScreenView() → Breadcrumb de navegação
  - setUserId() → Sentry.setUser()
  - logError() → Sentry.captureException()

#### **Criar Adapters Supabase**
- [ ] `MOBILE/src/services/database/supabase/auth.adapter.ts`
- [ ] `MOBILE/src/services/database/supabase/user.adapter.ts`
- [ ] `MOBILE/src/services/database/supabase/storage.adapter.ts`
- [ ] `MOBILE/src/services/database/supabase/inventory.adapter.ts` (se necessário)
- [ ] `MOBILE/src/services/database/supabase/checklist.adapter.ts` (se necessário)
- [ ] `MOBILE/src/services/database/supabase/planogram.adapter.ts` (se necessário)
- [ ] `MOBILE/src/services/database/supabase/report.adapter.ts` (se necessário)

#### **Atualizar Factory**
- [ ] `MOBILE/src/config/database.config.ts` - Mudar default para Supabase
- [ ] `MOBILE/src/services/database/factory.ts` - Instanciar adapters Supabase

---

### 5️⃣ Migrations e Schema

#### **Criar Migrations Faltantes**
- [ ] Migration 004: Planograms tables (se não existir)
- [ ] Migration 005: Compliance tables (se não existir)
- [ ] Migration 006: Products tables (se não existir)
- [ ] Migration 007: Analytics/Volumetria tables (se necessário)
- [ ] Migration 008: Promotions tables (se não existir)

---

### 6️⃣ Migração de Dados

- [ ] **Export Firebase**
  - companies
  - stores
  - users
  - solicitacoes + itens
  - conversations + messages
  - notifications
  - checklist_templates
  - checklist_executions
  - planograms
  - products
  - compliance_tasks
  - promotions

- [ ] **Import Supabase**
  - Script de importação com ordem de dependências
  - Criar users em auth.users primeiro
  - Usar upsert com onConflict

- [ ] **Validação**
  - Comparar contagem de registros
  - Verificar dados de amostra

---

### 7️⃣ Cleanup (Deletar Firebase)

#### **WEB**
- [ ] Deletar `lib/firebase-admin.ts`
- [ ] Deletar `lib/firebase-client.ts` (se existir)
- [ ] Remover do package.json:
  ```json
  "firebase": "^12.6.0",
  "firebase-admin": "^13.5.0"
  ```

#### **MOBILE**
- [ ] Deletar services Firebase (exceto messaging):
  - `src/services/firebase/auth.service.ts`
  - `src/services/firebase/analytics.service.ts`
  - `src/services/firebase/storage.service.ts`
  - `src/services/firebase/user.service.ts`
  - `src/services/firebase/solicitacao.service.ts`
  - `src/services/firebase/inventory.service.ts`
  - `src/services/firebase/checklist.service.ts`
  - `src/services/firebase/planogram.service.ts`
  - `src/services/firebase/presence.service.ts`
  - `src/services/firebase/messaging-chat.service.ts`
  - `src/services/firebase/report.service.ts`
  - `src/services/database/firebase/*.adapter.ts` (todos)

- [ ] Remover do package.json (exceto messaging):
  ```json
  "@react-native-firebase/auth": "^21.7.1",
  "@react-native-firebase/analytics": "^21.7.1",
  "@react-native-firebase/crashlytics": "^21.7.1",
  "@react-native-firebase/firestore": "^21.7.1",
  "@react-native-firebase/storage": "^21.7.1"
  ```

- [ ] **MANTER** (standalone FCM):
  ```json
  "@react-native-firebase/app": "^21.7.1",
  "@react-native-firebase/messaging": "^21.7.1",
  "@notifee/react-native": "^7.8.2"
  ```

---

### 8️⃣ Testing & Deploy

- [ ] **Testes**
  - Unit tests: API routes, services
  - Integration tests: Auth, CRUD, real-time, uploads
  - Performance: Query times, upload speeds

- [ ] **Rollback Plan**
  - Feature flag para voltar ao Firebase se necessário

- [ ] **Deploy**
  - Staging: Testar migração completa
  - Production: Deploy gradual
  - Monitorar: Sentry + logs

---

## 📊 Progresso Geral

### API Routes
- ✅ **35 routes migradas** (Batches 1-4)
- 🔄 **~31 routes restantes** (Batch 5)
- **Total estimado:** ~66 routes

### Infraestrutura
- ✅ **3 migrations criadas** (001, 002, 003)
- 🔄 **~5 migrations faltando** (planograms, compliance, products, etc.)

### MOBILE
- ✅ **Auth básico já existe** (email/password)
- 🔄 **Phone/Google/Apple auth** (faltando)
- 🔄 **Storage service** (faltando)
- 🔄 **Adapters Supabase** (faltando)
- 🔄 **Analytics → Sentry** (faltando)

### Cleanup
- 🔄 **Deletar Firebase** (WEB + MOBILE)

---

## 🎯 Prioridade de Execução

### **Alta Prioridade** (Crítico para funcionamento)
1. Batch 5 - Products/Produtos (core business)
2. Batch 5 - Planograms (se usado ativamente)
3. MOBILE - Storage Service (uploads de fotos)
4. MOBILE - Auth expandido (Phone, Google, Apple)

### **Média Prioridade** (Funcionalidades importantes)
5. Batch 5 - Compliance
6. Batch 5 - Promotions
7. Batch 5 - Analytics/Volumetria
8. WEB - Serviços (databaseService, featureFlags, etc.)

### **Baixa Prioridade** (Utilitários e cleanup)
9. Batch 5 - Chamados, AI, utilities
10. Migração de dados Firebase → Supabase
11. Cleanup (deletar Firebase)
12. Testes e deploy

---

## ⏱️ Estimativa de Tempo

- **Batch 5 (31 routes):** ~6-8 horas
- **WEB Services (4 arquivos):** ~2-3 horas
- **MOBILE (Auth + Storage + Adapters):** ~4-6 horas
- **Migrations faltantes:** ~1-2 horas
- **Migração de dados:** ~2-3 horas
- **Cleanup:** ~1 hora
- **Testes:** ~2-3 horas

**Total estimado:** 18-25 horas de trabalho

---

## 🚀 Próximo Passo Recomendado

Começar com **Batch 5 - Products/Produtos** (6 routes), pois são rotas críticas para o negócio e provavelmente usadas pelo mobile também.
