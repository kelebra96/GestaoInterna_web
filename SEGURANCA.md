# 🔐 GUIA DE SEGURANÇA - Sistema de Controle de Saída NF-e

## 📋 Visão Geral

Este documento descreve as práticas de segurança implementadas e recomendações para operação segura do sistema.

---

## 🎯 Princípios de Segurança

### 1. Defesa em Profundidade
- Múltiplas camadas de segurança
- Validação em cliente e servidor
- Autenticação e autorização
- Criptografia de dados sensíveis

### 2. Menor Privilégio
- Usuários possuem apenas permissões necessárias
- Certificado digital acessível apenas pelo backend
- Tokens JWT com tempo de expiração limitado

### 3. Segurança por Design
- HTTPS obrigatório em produção
- Validação rigorosa de entrada
- Tratamento seguro de erros
- Logs de auditoria

---

## 🔒 Certificado Digital A1

### ⚠️ CRÍTICO - Proteção do Certificado

O certificado digital A1 é o ativo mais crítico do sistema. Sua exposição pode comprometer toda a segurança fiscal.

### ✅ Boas Práticas OBRIGATÓRIAS

1. **Armazenamento**
   - ❌ NUNCA versione o certificado no Git
   - ❌ NUNCA compartilhe por email/mensagem
   - ❌ NUNCA exponha via API ou frontend
   - ✅ Armazene em diretório protegido no servidor
   - ✅ Permissões de leitura apenas para usuário da aplicação
   - ✅ Backup criptografado em local seguro

2. **Senha do Certificado**
   - ✅ Armazene em variável de ambiente
   - ✅ NUNCA hardcode no código
   - ✅ Use secrets manager em produção (AWS Secrets Manager, HashiCorp Vault)
   - ✅ Senha forte com mínimo 12 caracteres

3. **Rotação**
   - ✅ Monitore data de expiração
   - ✅ Renove ANTES do vencimento (30 dias de antecedência)
   - ✅ Teste novo certificado em homologação primeiro

4. **Acesso**
   - ✅ Apenas backend acessa o certificado
   - ✅ Log de todas as operações com certificado
   - ✅ Alerta em caso de falha de leitura

### Exemplo de Permissões (Linux)

```bash
# Diretório do certificado
chmod 700 /app/backend/certificates

# Arquivo .pfx
chmod 600 /app/backend/certificates/certificado.pfx

# Proprietário: usuário da aplicação
chown app:app /app/backend/certificates/certificado.pfx
```

---

## 🔑 Autenticação JWT

### Implementação

- **Algoritmo**: HS256
- **Expiração**: 8 horas (configurável)
- **Secret**: Mínimo 32 caracteres aleatórios
- **Storage**: SecureStore (mobile) / HttpOnly Cookie (web)

### Boas Práticas

1. **JWT Secret**
   ```bash
   # Gerar secret forte
   openssl rand -base64 32
   ```

2. **Renovação de Token**
   - Implementado endpoint `/api/auth/refresh`
   - Renovação automática antes da expiração

3. **Logout**
   - Remove token do client
   - Backend pode implementar blacklist (opcional)

### ❌ Nunca Faça

- Armazenar dados sensíveis no payload do JWT
- Usar secret fraco ou padrão
- Tokens sem expiração
- Compartilhar tokens entre usuários

---

## 🛡️ Validação de Entrada

### Backend (Express)

Todas as entradas são validadas com **Joi**:

```typescript
// Exemplo: Validação de saída
const saidaSchema = Joi.object({
  chaveAcesso: Joi.string().length(44).pattern(/^\d{44}$/),
  placaVeiculo: Joi.string().pattern(/^[A-Z]{3}-?\d{4}$/),
  // ...
});
```

### Mobile (React Native)

Validação com **Yup**:

```typescript
const novaSaidaSchema = Yup.object().shape({
  chaveAcesso: Yup.string().length(44).matches(/^\d+$/),
  // ...
});
```

### Regras de Validação

1. **Chave NF-e**: Exatamente 44 dígitos numéricos
2. **Placa**: Formato AAA-9999 ou AAA-9A99
3. **CPF**: 11 dígitos + validação de dígitos verificadores
4. **Imagens**: Tipo MIME, tamanho máximo, dimensões

---

## 🚫 Proteção contra Ataques

### 1. SQL Injection

**Proteção**: Uso de ORM (Prisma) com prepared statements

```typescript
// ✅ SEGURO - Prisma sanitiza automaticamente
await prisma.saidaNfe.findUnique({
  where: { chaveAcesso: userInput }
});

// ❌ INSEGURO - Nunca use queries raw diretas
await prisma.$queryRaw(`SELECT * FROM saidas WHERE chave = '${userInput}'`);
```

### 2. XSS (Cross-Site Scripting)

**Proteção**:
- Backend retorna apenas JSON
- Frontend sanitiza exibição de dados
- CSP headers em produção

### 3. CSRF (Cross-Site Request Forgery)

**Proteção**:
- API REST stateless com JWT
- SameSite cookies (se usar cookies)
- Validação de Origin header

### 4. Rate Limiting

**Implementação**:

```typescript
// Geral: 100 requisições por 15 minutos
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Login: 5 tentativas por 15 minutos
loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
```

### 5. Upload de Arquivos

**Proteção**:
- Validação de tipo MIME
- Limite de tamanho (10MB)
- Sanitização de nome de arquivo
- Armazenamento fora do webroot
- Scan de malware (opcional)

```typescript
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Tipo de arquivo não permitido'));
  }
};
```

---

## 🔐 Comunicação SEFAZ

### TLS/SSL

- **Versão**: TLS 1.2 ou superior
- **Certificado**: A1 para autenticação mútua
- **Validação**: Verificar certificado do servidor SEFAZ

### Exemplo de Configuração

```typescript
const httpsAgent = new https.Agent({
  cert: certificate.pem,
  key: certificate.key,
  rejectUnauthorized: true,  // NUNCA false em produção
  minVersion: 'TLSv1.2'
});
```

### Logs de Segurança

Registrar TODAS as interações:

```typescript
logger.info('Consulta SEFAZ', {
  chaveAcesso,
  usuario: req.user.id,
  ip: req.ip,
  timestamp: new Date()
});
```

---

## 📊 Logs e Auditoria

### O que Logar

✅ **Obrigatório**:
- Todas tentativas de login (sucesso e falha)
- Todas consultas à SEFAZ
- Todos registros de saída
- Erros de validação
- Acessos não autorizados
- Modificações de dados críticos

❌ **Nunca Logar**:
- Senhas (nem hasheadas)
- Tokens completos
- Dados do certificado digital
- Dados sensíveis de usuários

### Formato de Log

```typescript
logger.info('Evento', {
  usuario: userId,
  acao: 'registro_saida',
  chaveNfe: '44...',
  ip: req.ip,
  timestamp: new Date(),
  resultado: 'sucesso'
});
```

### Retenção

- **Desenvolvimento**: 7 dias
- **Produção**: 5 anos (conformidade fiscal)
- **Logs de segurança**: Mínimo 1 ano

---

## 🌐 Segurança de Rede

### Produção - Checklist

- [ ] HTTPS/TLS habilitado
- [ ] Certificado SSL válido
- [ ] Firewall configurado
- [ ] Portas desnecessárias fechadas
- [ ] VPN para acesso administrativo
- [ ] IP whitelisting (opcional)
- [ ] DDoS protection
- [ ] WAF (Web Application Firewall) - recomendado

### Configuração Nginx (Exemplo)

```nginx
server {
    listen 443 ssl http2;
    server_name api.seudominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000";

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🗄️ Segurança do Banco de Dados

### Supabase/PostgreSQL

1. **Credenciais**
   - ✅ Usar variáveis de ambiente
   - ✅ Senhas fortes (mínimo 16 caracteres)
   - ✅ Rotação periódica (trimestral)

2. **Conexões**
   - ✅ SSL/TLS obrigatório
   - ✅ IP whitelisting
   - ✅ Limitar conexões simultâneas

3. **Permissões**
   - ✅ Usuário da aplicação com privilégios mínimos
   - ✅ Sem acesso direto de produção a desenvolvedores
   - ✅ Read-only para relatórios

4. **Backup**
   - ✅ Backups automáticos diários
   - ✅ Criptografia de backups
   - ✅ Teste de restore mensal
   - ✅ Retenção: 30 dias

---

## 🔍 Monitoramento de Segurança

### Alertas Críticos

Configure alertas para:

1. **Múltiplas falhas de login** (>3 em 5 minutos)
2. **Erro ao carregar certificado**
3. **Certificado próximo do vencimento** (<30 dias)
4. **Picos de requisições** (possível ataque)
5. **Erros 500 em massa** (possível vulnerabilidade explorada)
6. **Acesso a endpoints não autorizados**

### Ferramentas Recomendadas

- **Logs**: Winston + CloudWatch/Datadog
- **Monitoramento**: Prometheus + Grafana
- **Segurança**: Snyk, OWASP Dependency Check
- **Uptime**: UptimeRobot, Pingdom

---

## 🚨 Resposta a Incidentes

### Plano de Ação

1. **Detecção**
   - Monitore logs e alertas
   - Investigue comportamentos anômalos

2. **Contenção**
   - Isole sistema comprometido
   - Revogue tokens suspeitos
   - Bloqueie IPs maliciosos

3. **Erradicação**
   - Identifique e corrija vulnerabilidade
   - Atualize dependências
   - Aplique patches de segurança

4. **Recuperação**
   - Restaure de backup se necessário
   - Teste funcionalidades
   - Monitore de perto

5. **Pós-Incidente**
   - Documente o ocorrido
   - Revise procedimentos
   - Atualize políticas

### Contatos de Emergência

Mantenha lista atualizada:
- Equipe de TI
- Suporte SEFAZ
- Fornecedor do certificado digital
- Provedor de hosting

---

## ✅ Checklist de Segurança - Deploy

### Antes do Deploy

- [ ] Todas variáveis de ambiente configuradas
- [ ] Certificado digital válido instalado
- [ ] HTTPS habilitado e testado
- [ ] Rate limiting configurado
- [ ] Logs de auditoria funcionando
- [ ] Backups automáticos configurados
- [ ] Senhas fortes em todos os serviços
- [ ] Dependências atualizadas
- [ ] Testes de segurança executados
- [ ] Documentação de incidentes preparada

### Pós-Deploy

- [ ] Verificar logs por erros
- [ ] Testar autenticação
- [ ] Testar consulta SEFAZ
- [ ] Verificar certificado digital
- [ ] Configurar monitoramento
- [ ] Configurar alertas
- [ ] Documentar configurações
- [ ] Treinar equipe

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Portal NF-e](http://www.nfe.fazenda.gov.br/)
- [Manual de Segurança SEFAZ](http://www.nfe.fazenda.gov.br/portal/seguranca.aspx)

---

## 📞 Suporte

Em caso de dúvidas sobre segurança, consulte a equipe de desenvolvimento ou segurança da informação.

**Lembre-se**: Segurança não é um recurso, é um processo contínuo.
