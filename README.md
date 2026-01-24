# 🚛 Sistema de Controle de Saída de NF-e

Sistema completo para controle de saída de Notas Fiscais Eletrônicas (NF-e) de Centro de Distribuição, com validação oficial na SEFAZ e registro fotográfico de placas de veículos.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-blue.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

---

## 📋 Visão Geral

Este sistema permite que porteiros ou operadores de um Centro de Distribuição registrem a saída de caminhões portando NF-e, realizando:

✅ **Validação oficial** da NF-e na SEFAZ via SOAP
✅ **Registro fotográfico** da placa do veículo
✅ **Associação** com motorista
✅ **Rastreabilidade completa** da operação
✅ **Armazenamento seguro** de XML e imagens

---

## 🎯 Funcionalidades Principais

### Backend (API REST)
- 🔐 Autenticação JWT
- 📡 Integração SEFAZ via SOAP com certificado digital A1
- 📄 Parse e validação de XML de NF-e
- 📸 Upload de imagens para Supabase Storage
- 🗄️ Persistência PostgreSQL via Prisma ORM
- 📊 Logs de auditoria completos
- ⚡ Rate limiting e segurança

### Mobile (React Native)
- 📱 Interface otimizada para tablets/smartphones
- 📷 Captura de foto via câmera nativa
- ✅ Validação de dados em tempo real
- 📡 Comunicação HTTPS com API
- 🔒 Armazenamento seguro de token (SecureStore)
- 📋 Histórico de saídas

### Fluxo Operacional
1. Porteiro informa **chave de acesso** da NF-e (44 dígitos)
2. Digita **placa do veículo**
3. Seleciona **motorista** responsável
4. Captura **foto da placa** via câmera
5. Sistema consulta NF-e na **SEFAZ**
6. Valida situação (autorizada/cancelada)
7. Armazena **XML** + **foto** + **dados** no banco
8. Confirma liberação do veículo

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│  Mobile App     │  React Native + Expo
│  (React Native) │  - Login
└────────┬────────┘  - Nova Saída
         │           - Histórico
         │ HTTPS/JWT
         ↓
┌─────────────────┐
│   Backend API   │  Node.js + Express + TypeScript
│   (Node.js)     │  - Autenticação
└────┬────┬───┬───┘  - CRUD Saídas/Motoristas
     │    │   │      - Integração SEFAZ
     │    │   │
     │    │   └─────→ SEFAZ (SOAP + Certificado A1)
     │    │
     │    └─────────→ Supabase Storage (XML + Fotos)
     │
     └──────────────→ PostgreSQL/Supabase (Dados)
```

---

## 🚀 Tecnologias

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Linguagem**: TypeScript
- **ORM**: Prisma
- **Banco**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **SOAP**: node-soap
- **Certificado**: node-forge
- **Validação**: Joi
- **Logs**: Winston

### Frontend Mobile
- **Framework**: React Native (Expo)
- **Linguagem**: TypeScript
- **Navegação**: React Navigation
- **Câmera**: expo-camera
- **HTTP**: Axios
- **Validação**: Yup
- **State**: Context API

### Infraestrutura
- **Banco**: PostgreSQL 15+ (Supabase Cloud)
- **Storage**: S3-compatible (Supabase)
- **SSL/TLS**: Let's Encrypt
- **Proxy**: Nginx
- **Process Manager**: PM2

---

## 📂 Estrutura do Projeto

```
ControleSaida/
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── config/          # Configurações (DB, Supabase, Certificado)
│   │   ├── controllers/     # Controladores (Auth, Saída, Motorista)
│   │   ├── services/        # Serviços (SEFAZ, Storage, XML Parser)
│   │   ├── middleware/      # Middlewares (Auth, Upload, Error)
│   │   ├── routes/          # Rotas da API
│   │   ├── utils/           # Utilitários (Logger, Validators, Errors)
│   │   └── server.ts        # Servidor Express
│   ├── prisma/              # Schema e Migrations
│   ├── certificates/        # Certificado Digital A1 (.pfx)
│   └── package.json
│
├── mobile/                  # App React Native
│   ├── src/
│   │   ├── screens/         # Telas (Login, Home, Nova Saída, Histórico)
│   │   ├── navigation/      # Navegação
│   │   ├── contexts/        # Contexts (Auth)
│   │   ├── services/        # Serviços (API)
│   │   ├── utils/           # Utilitários (Constants, Validators)
│   │   └── types/           # Tipos TypeScript
│   ├── App.tsx
│   └── package.json
│
├── docs/
│   ├── ARQUITETURA.md       # Arquitetura técnica completa
│   ├── SEGURANCA.md         # Guia de segurança
│   └── DEPLOYMENT.md        # Guia de implantação
│
├── Base_Desenvolvimento.md  # Especificação original
└── README.md                # Este arquivo
```

---

## 🔧 Instalação e Uso

### Pré-requisitos

- Node.js 18+
- PostgreSQL ou conta Supabase
- Certificado Digital A1 (.pfx)
- Expo CLI (para mobile)

### Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais

# Executar migrations
npx prisma migrate dev

# Iniciar servidor
npm run dev
```

Servidor rodará em `http://localhost:3000`

Ver [backend/README.md](backend/README.md) para detalhes.

### Mobile

```bash
cd mobile

# Instalar dependências
npm install

# Configurar URL da API em src/utils/constants.ts

# Iniciar app
npm start
```

Ver [mobile/README.md](mobile/README.md) para detalhes.

---

## 📚 Documentação

- **[ARQUITETURA.md](ARQUITETURA.md)** - Arquitetura técnica completa
  - Stack tecnológica
  - Modelo de dados
  - Endpoints da API
  - Fluxo de dados
  - Estrutura de pastas

- **[SEGURANCA.md](SEGURANCA.md)** - Guia de segurança
  - Proteção do certificado digital
  - Autenticação JWT
  - Validação de entrada
  - Proteção contra ataques
  - Logs e auditoria

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Guia de implantação
  - Passo a passo completo
  - Configuração de servidor
  - Deploy backend e mobile
  - Monitoramento
  - Troubleshooting

---

## 🔐 Segurança

### Certificado Digital A1

⚠️ **CRÍTICO**: O certificado digital A1 é o ativo mais sensível do sistema.

- ❌ **NUNCA** versione no Git
- ❌ **NUNCA** exponha via API
- ✅ Armazene com permissões restritas
- ✅ Senha em variável de ambiente
- ✅ Renove antes do vencimento

### Boas Práticas Implementadas

- HTTPS/TLS obrigatório em produção
- JWT com expiração de 8 horas
- Rate limiting (100 req/15min)
- Validação rigorosa de entrada
- Logs de auditoria completos
- Upload sanitizado (max 10MB)
- Certificado nunca exposto

Ver [SEGURANCA.md](SEGURANCA.md) para detalhes completos.

---

## 🗄️ Banco de Dados

### Schema Principal

```sql
usuarios
  ├── id (UUID)
  ├── nome
  ├── email (unique)
  ├── senha_hash
  └── ativo

motoristas
  ├── id (UUID)
  ├── nome
  ├── cpf (unique)
  ├── cnh
  └── ativo

saidas_nfe
  ├── id (UUID)
  ├── chave_acesso (unique, 44 dígitos)
  ├── numero_nfe
  ├── valor_total
  ├── emitente
  ├── destinatario
  ├── situacao_nfe
  ├── placa_veiculo
  ├── motorista_id (FK)
  ├── usuario_id (FK)
  ├── xml_url (Supabase Storage)
  ├── foto_placa_url (Supabase Storage)
  └── data_hora_liberacao

logs_tentativas
  ├── id (UUID)
  ├── chave_acesso
  ├── usuario_id (FK)
  ├── status (sucesso/erro/bloqueado)
  ├── mensagem_erro
  └── ip_origem
```

---

## 🌐 API Endpoints

### Autenticação
```
POST   /api/auth/login      - Login
POST   /api/auth/refresh    - Renovar token
POST   /api/auth/logout     - Logout
```

### Saídas de NF-e
```
POST   /api/saidas          - Registrar saída (multipart)
GET    /api/saidas          - Listar saídas (paginado)
GET    /api/saidas/:id      - Detalhes de saída
GET    /api/saidas/chave/:chave - Buscar por chave
```

### Motoristas
```
POST   /api/motoristas      - Cadastrar motorista
GET    /api/motoristas      - Listar motoristas
GET    /api/motoristas/:id  - Detalhes do motorista
PATCH  /api/motoristas/:id  - Atualizar motorista
DELETE /api/motoristas/:id  - Inativar motorista
```

### Sistema
```
GET    /health              - Health check
GET    /api/info            - Info do sistema + certificado
```

---

## ⚠️ Limitações e Considerações

1. **SEFAZ não possui API REST** - Integração via SOAP obrigatória
2. **Certificado A1 expira anualmente** - Renovação necessária
3. **Ambientes SEFAZ separados** - Homologação e Produção
4. **OCR não implementado** - Foto é evidência, não reconhecimento
5. **Offline não suportado** - Requer conexão para consulta SEFAZ
6. **Limite de consultas SEFAZ** - Evitar uso excessivo

---

## 🧪 Testando o Sistema

### 1. Criar Usuário de Teste

```bash
cd backend
npx prisma studio

# Criar usuário com senha hasheada
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"
```

### 2. Testar Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","senha":"admin123"}'
```

### 3. Cadastrar Motorista

```bash
curl -X POST http://localhost:3000/api/motoristas \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João da Silva",
    "cpf": "12345678901",
    "cnh": "12345678901",
    "telefone": "11999999999"
  }'
```

### 4. Registrar Saída (via App Mobile)

Use o aplicativo mobile para testar o fluxo completo de registro de saída com foto.

---

## 🚀 Deploy em Produção

Ver guia completo em [DEPLOYMENT.md](DEPLOYMENT.md).

### Checklist Rápido

- [ ] Servidor Linux configurado
- [ ] Node.js 18+ instalado
- [ ] PostgreSQL/Supabase configurado
- [ ] Certificado digital A1 instalado
- [ ] Variáveis de ambiente configuradas
- [ ] HTTPS/SSL habilitado (Let's Encrypt)
- [ ] Nginx configurado como proxy reverso
- [ ] PM2 configurado para auto-restart
- [ ] Backups automáticos configurados
- [ ] Logs e monitoramento ativos

---

## 📊 Monitoramento

Monitore estas métricas:

- ✅ Uptime da API
- ✅ Tempo de resposta SEFAZ
- ✅ Taxa de sucesso/falha de consultas
- ✅ Uso de disco (XMLs e fotos)
- ✅ Erros 500
- ⚠️ Certificado vencendo (<30 dias)

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'Adiciona minha feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📞 Suporte

- **Documentação**: Ver arquivos na pasta `/docs`
- **Issues**: Abra uma issue no repositório
- **SEFAZ**: [Portal NF-e](http://www.nfe.fazenda.gov.br/)

---

## 📄 Licença

Este projeto está sob a licença MIT. Ver [LICENSE](LICENSE) para detalhes.

---

## ✅ Checklist de Funcionalidades

### Backend
- [x] Autenticação JWT
- [x] CRUD de usuários e motoristas
- [x] Integração SEFAZ via SOAP
- [x] Validação de certificado digital A1
- [x] Parse de XML de NF-e
- [x] Upload para Supabase Storage
- [x] Validação de entrada (Joi)
- [x] Rate limiting
- [x] Logs de auditoria
- [x] Tratamento de erros

### Mobile
- [x] Tela de login
- [x] Tela principal (home)
- [x] Tela de nova saída
- [x] Captura de foto via câmera
- [x] Validação de formulários
- [x] Listagem de histórico
- [x] Autenticação persistente
- [x] Tratamento de erros

### Documentação
- [x] README principal
- [x] Arquitetura técnica
- [x] Guia de segurança
- [x] Guia de implantação
- [x] README do backend
- [x] README do mobile

---

## 🎉 Resultado Final

Sistema fiscal completo:
- ✅ **Seguro** - Certificado protegido, HTTPS, JWT
- ✅ **Auditável** - Logs completos de todas operações
- ✅ **Operacional** - Validação SEFAZ em tempo real
- ✅ **Rastreável** - Evidência visual de cada saída
- ✅ **Escalável** - Arquitetura moderna e modular
- ✅ **Documentado** - Guias completos de uso e deploy

---

**Desenvolvido com base nas especificações técnicas da SEFAZ e boas práticas de desenvolvimento seguro.**
