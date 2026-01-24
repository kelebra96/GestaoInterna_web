# ⚡ Guia de Início Rápido

Comece a usar o Sistema de Controle de Saída NF-e em minutos!

---

## 🎯 Pré-requisitos

- ✅ Node.js 18+ instalado
- ✅ PostgreSQL rodando OU conta Supabase
- ✅ Certificado Digital A1 (.pfx)

---

## 🚀 Instalação em 5 Passos

### 1️⃣ Clone/Baixe o Projeto

```bash
# Se você ainda não tem o código
cd c:\ControleSaída
```

### 2️⃣ Configure o Backend

```bash
cd backend

# Instalar dependências
npm install

# Copiar arquivo de configuração
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/controle_saida"
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_KEY="eyJxxx..."
JWT_SECRET="sua-chave-secreta-aqui"
CERT_PATH="./certificates/certificado.pfx"
CERT_PASSWORD="senha-do-certificado"
SEFAZ_AMBIENTE="homologacao"
SEFAZ_UF="SP"
```

### 3️⃣ Configure o Banco de Dados

```bash
# Gerar Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate dev --name init

# Abrir Prisma Studio para criar usuário
npx prisma studio
```

No Prisma Studio:
1. Abra a tabela `usuarios`
2. Clique em "Add record"
3. Preencha:
   - nome: `Administrador`
   - email: `admin@empresa.com`
   - senha_hash: Use o hash gerado abaixo
   - ativo: `true`

Para gerar hash da senha:
```bash
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"
```

### 4️⃣ Adicione o Certificado Digital

```bash
# Copiar seu certificado .pfx para a pasta certificates
# Exemplo:
cp ~/Downloads/certificado.pfx ./certificates/

# Verificar permissões (Linux/Mac)
chmod 600 ./certificates/certificado.pfx
```

### 5️⃣ Inicie o Backend

```bash
# Modo desenvolvimento
npm run dev
```

O servidor iniciará em `http://localhost:3000`

✅ Teste: `curl http://localhost:3000/health`

---

## 📱 Configure o Mobile (Opcional)

```bash
cd ../mobile

# Instalar dependências
npm install

# Configurar URL da API
# Edite: src/utils/constants.ts
# Altere API_BASE_URL para: 'http://SEU-IP:3000/api'

# Iniciar app
npm start
```

Escolha:
- `a` - Android
- `i` - iOS
- `w` - Web

---

## 🧪 Teste o Sistema

### 1. Teste o Health Check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{"status":"ok","timestamp":"...","environment":"development"}
```

### 2. Faça Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","senha":"admin123"}'
```

Copie o `token` da resposta.

### 3. Cadastre um Motorista

```bash
curl -X POST http://localhost:3000/api/motoristas \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João da Silva",
    "cpf": "12345678901",
    "cnh": "12345678901",
    "telefone": "11999999999"
  }'
```

### 4. Teste no App Mobile

1. Abra o app
2. Faça login com `admin@empresa.com` / `admin123`
3. Clique em "Nova Saída"
4. Preencha os dados
5. Capture uma foto
6. Confirme a saída

---

## 🎉 Pronto!

Seu sistema está funcionando! Agora você pode:

- ✅ Registrar saídas de NF-e
- ✅ Consultar SEFAZ
- ✅ Capturar fotos de placas
- ✅ Gerenciar motoristas

---

## 📚 Próximos Passos

1. **Produção**: Siga o [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Segurança**: Leia [SEGURANCA.md](SEGURANCA.md)
3. **API**: Consulte [API_EXAMPLES.md](API_EXAMPLES.md)
4. **Arquitetura**: Veja [ARQUITETURA.md](ARQUITETURA.md)

---

## 🚨 Problemas Comuns

### Backend não inicia

**Erro**: `Certificado digital não encontrado`

**Solução**:
1. Verifique se o arquivo `.pfx` está em `backend/certificates/`
2. Confirme o caminho no `.env`
3. Teste a senha do certificado

---

### Erro de conexão com banco

**Erro**: `Can't reach database server`

**Solução**:
1. Verifique se PostgreSQL está rodando: `pg_isready`
2. Confirme a `DATABASE_URL` no `.env`
3. Teste conexão: `psql $DATABASE_URL -c "SELECT 1;"`

---

### App mobile não conecta

**Erro**: `Network Error` ou `ECONNREFUSED`

**Solução**:
1. Use o IP da máquina, não `localhost` (Android)
2. Verifique se backend está rodando: `curl http://localhost:3000/health`
3. Desative firewall temporariamente
4. Confirme que está na mesma rede Wi-Fi

---

### Erro ao consultar SEFAZ

**Erro**: `Erro ao consultar NF-e`

**Solução**:
1. Verifique se está usando ambiente correto (homologação/produção)
2. Confirme URL do Web Service no `.env`
3. Teste certificado: `curl https://api.seudominio.com/api/info`
4. Verifique conectividade de rede com SEFAZ

---

## 📞 Ajuda

- **Documentação Completa**: [README.md](README.md)
- **Exemplos de API**: [API_EXAMPLES.md](API_EXAMPLES.md)
- **Deploy**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## ✅ Checklist de Validação

Marque conforme for completando:

- [ ] Node.js instalado e funcionando
- [ ] PostgreSQL/Supabase configurado
- [ ] Backend rodando sem erros
- [ ] Health check respondendo OK
- [ ] Usuário administrador criado
- [ ] Login funcionando
- [ ] Certificado digital carregado
- [ ] Consulta SEFAZ funcionando (teste em homologação)
- [ ] Mobile instalado (opcional)
- [ ] Motorista cadastrado
- [ ] Saída de NF-e registrada com sucesso

---

**Parabéns! Seu sistema está pronto para uso! 🎉**
