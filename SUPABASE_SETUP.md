# 🚀 Supabase Self-Hosted - Guia de Configuração

## O que é Supabase?

Supabase é uma alternativa open-source ao Firebase que oferece:
- **PostgreSQL**: Banco de dados relacional robusto
- **Autenticação**: Sistema completo de auth com JWT
- **Storage**: Armazenamento de arquivos S3-compatible
- **Real-time**: WebSocket subscriptions
- **Row Level Security**: Segurança a nível de linha no banco
- **Auto API**: REST API gerada automaticamente

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  Nginx (Porta 80/443)               │
│          (Reverse Proxy + SSL Termination)          │
└──────────────────┬──────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌────────┐   ┌──────────┐   ┌──────────┐
│ Next.js│   │  Kong    │   │ Supabase │
│  :3000 │   │  :8000   │   │  Studio  │
└────────┘   └────┬─────┘   │  :3001   │
                  │         └──────────┘
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
   ┌────────┬─────────┬──────────┐
   │ GoTrue │PostgREST│ Storage  │
   │ (Auth) │  (API)  │  (Files) │
   └────┬───┴────┬────┴─────┬────┘
        │        │          │
        └────────┼──────────┘
                 ▼
         ┌──────────────┐
         │  PostgreSQL  │
         │    :5432     │
         └──────────────┘
```

## Portas Utilizadas

- `3000`: Next.js Application
- `3001`: Supabase Studio (UI administrativa)
- `5432`: PostgreSQL
- `6379`: Redis
- `8000`: Kong API Gateway (API unificada do Supabase)
- `27017`: MongoDB (para Prisma/Planogramas)

## Configuração Local

### 1. Variáveis de Ambiente

O arquivo `.env` já está configurado com:

```env
# PostgreSQL
POSTGRES_PASSWORD=2cccf953a69d8a7e74f8e6285bc373a8

# JWT Secret
JWT_SECRET=XcjZmUhwbsNtBLxVhIerkVufFDe8cvWSprFADtoNV10=

# Supabase Keys
SUPABASE_ANON_KEY=eyJ... (chave pública)
SUPABASE_SERVICE_KEY=eyJ... (chave privada - server-side only)

# URLs
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
SUPABASE_URL=http://kong:8000
```

### 2. Iniciar Todos os Serviços

```bash
# Subir todos os containers
docker-compose up -d

# Ver logs
docker-compose logs -f

# Ver apenas logs do Supabase
docker-compose logs -f postgres auth rest storage
```

### 3. Acessar Supabase Studio

Abra no navegador: http://localhost:3001

- **URL do Projeto**: http://localhost:8000
- **Anon Key**: (a chave configurada em SUPABASE_ANON_KEY)

No Studio você pode:
- Visualizar/editar tabelas
- Gerenciar usuários
- Ver logs de autenticação
- Testar queries SQL
- Configurar Storage buckets

### 4. Executar Schema Inicial

```bash
# Conectar ao PostgreSQL
docker exec -it myinventory-postgres psql -U postgres

# Executar schema
\i /path/to/supabase/init.sql

# Ou copiar o arquivo para o container primeiro
docker cp supabase/init.sql myinventory-postgres:/tmp/
docker exec -it myinventory-postgres psql -U postgres -f /tmp/init.sql
```

Ou usando o Studio:
1. Acesse http://localhost:3001
2. Vá em "SQL Editor"
3. Cole o conteúdo de `supabase/init.sql`
4. Execute

## Uso no Código

### Frontend (Client-Side)

```typescript
import { supabase, signIn, signOut } from '@/lib/supabase-client';

// Login
const { user, session } = await signIn('user@example.com', 'password');

// Buscar dados (respeitando RLS)
const { data: stores } = await supabase
  .from('stores')
  .select('*')
  .eq('company_id', companyId);

// Logout
await signOut();
```

### Backend (Server-Side API Routes)

```typescript
import { supabaseAdmin, getAllUsers } from '@/lib/supabase-admin';

// Bypass RLS - apenas em API routes
const users = await getAllUsers();

// Criar usuário
await supabaseAdmin.from('users').insert({
  id: authUserId,
  email: 'user@example.com',
  display_name: 'John Doe',
  role: 'agent',
  company_id: companyId,
});
```

## Migração do Firebase

### Passo 1: Exportar Dados do Firestore

```typescript
// Script para exportar usuários do Firebase
const users = await db.collection('users').get();
const usersData = users.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

fs.writeFileSync('firebase-users.json', JSON.stringify(usersData));
```

### Passo 2: Importar para Supabase

```typescript
// Script para importar
import { supabaseAdmin } from '@/lib/supabase-admin';
const usersData = JSON.parse(fs.readFileSync('firebase-users.json'));

for (const user of usersData) {
  // Criar usuário no auth
  const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: 'temp-password-' + Math.random(),
    email_confirm: true,
  });

  // Inserir dados adicionais
  await supabaseAdmin.from('users').insert({
    id: authUser.user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
    company_id: user.companyId,
    store_id: user.storeId,
    active: user.active,
  });
}
```

## Deploy na VPS Hostinger

### Atualizar .env para Produção

```env
# PostgreSQL
POSTGRES_PASSWORD=SENHA_FORTE_AQUI

# URLs - ajustar para seu domínio
NEXT_PUBLIC_SUPABASE_URL=https://www.myinventory.com.br/api/supabase
SUPABASE_URL=http://kong:8000
API_EXTERNAL_URL=https://www.myinventory.com.br/api/supabase
SITE_URL=https://www.myinventory.com.br

# Email (configurar SMTP real)
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
```

### Atualizar nginx.conf

Adicionar proxy para Supabase API:

```nginx
# Proxy para Supabase Kong
location /api/supabase/ {
    proxy_pass http://kong:8000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Deploy

```bash
# Build local
npm run build

# Criar pacote
tar -czf myinventory-deploy.tar.gz \
  .next/standalone .next/static public \
  docker-compose.yml Dockerfile.simple nginx.conf \
  supabase/ package.json

# Enviar para VPS
scp myinventory-deploy.tar.gz deployuser@212.85.10.19:/tmp/

# Na VPS
ssh deployuser@212.85.10.19
cd ~/myinventory
tar -xzf /tmp/myinventory-deploy.tar.gz

# Criar .env com credenciais de produção
nano .env

# Build e deploy
docker build -f Dockerfile.simple -t myinventory:latest .
docker-compose down
docker-compose up -d

# Executar schema do banco
docker cp supabase/init.sql myinventory-postgres:/tmp/
docker exec myinventory-postgres psql -U postgres -f /tmp/init.sql
```

## Troubleshooting

### Containers não sobem

```bash
# Ver logs
docker-compose logs

# Verificar se portas estão em uso
netstat -tulpn | grep -E '3000|3001|5432|8000'

# Rebuild completo
docker-compose down -v
docker-compose up -d --build
```

### Erro de autenticação

```bash
# Verificar se JWT_SECRET está correto
docker-compose logs auth

# Resetar banco de auth
docker exec -it myinventory-postgres psql -U postgres
DROP SCHEMA auth CASCADE;
CREATE SCHEMA auth;
\q

# Reiniciar containers
docker-compose restart auth
```

### PostgreSQL não aceita conexões

```bash
# Verificar se está rodando
docker-compose ps postgres

# Ver logs
docker-compose logs postgres

# Testar conexão
docker exec -it myinventory-postgres psql -U postgres -c "SELECT version();"
```

## Recursos

- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Próximos Passos

1. ✅ Configurar Supabase local
2. ✅ Criar schema inicial
3. ⏳ Testar autenticação
4. ⏳ Migrar dados do Firebase
5. ⏳ Atualizar API routes para usar Supabase
6. ⏳ Deploy na VPS
