# Checklist de Implementação

Use este checklist para garantir que todos os passos foram completados.

## 📋 Fase 1: Preparação

### Contas e Acessos
- [ ] Conta no Supabase criada
- [ ] Projeto no Supabase criado
- [ ] Certificado Digital A1 obtido (.pfx)
- [ ] Credenciais do Supabase anotadas
- [ ] URLs dos webservices da SEFAZ identificadas

### Ambiente de Desenvolvimento
- [ ] Node.js 18+ instalado
- [ ] Git instalado
- [ ] Expo CLI instalado (`npm install -g expo-cli`)
- [ ] Android Studio ou dispositivo Android disponível
- [ ] Editor de código (VS Code recomendado)

## 📋 Fase 2: Banco de Dados

### Supabase Setup
- [ ] Script `01_schema.sql` executado
- [ ] Script `02_rls_policies.sql` executado
- [ ] Script `03_storage_setup.sql` executado
- [ ] Buckets de storage criados:
  - [ ] `evidencias-placas`
  - [ ] `arquivos-xml`
- [ ] Script `04_seed_data.sql` executado (opcional)

### Usuários
- [ ] Usuário admin criado no Supabase Auth
- [ ] Perfil do admin criado na tabela `profiles`
- [ ] Usuário porteiro criado (para testes)
- [ ] Perfil do porteiro criado

### Verificação
- [ ] Tabelas existem no Table Editor
- [ ] RLS está habilitado em todas as tabelas
- [ ] Políticas de storage estão ativas
- [ ] Usuários conseguem fazer login

## 📋 Fase 3: Backend

### Instalação
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado
- [ ] Variáveis de ambiente configuradas:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `CERTIFICATE_PATH`
  - [ ] `CERTIFICATE_PASSWORD`
  - [ ] `SEFAZ_UF`
  - [ ] URLs da SEFAZ

### Certificado Digital
- [ ] Pasta `certificates/` criada
- [ ] Certificado `.pfx` copiado para a pasta
- [ ] Senha do certificado configurada no `.env`
- [ ] Certificado adicionado ao `.gitignore`

### Testes
- [ ] Servidor inicia sem erros (`npm run dev`)
- [ ] Health check responde (`/api/health`)
- [ ] Logs estão funcionando
- [ ] Conexão com Supabase OK

## 📋 Fase 4: Frontend

### Instalação
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado
- [ ] Variáveis de ambiente configuradas:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `EXPO_PUBLIC_API_URL` (com IP correto!)

### Configuração
- [ ] IP local da máquina identificado
- [ ] `.env` atualizado com IP correto
- [ ] Expo Go instalado no dispositivo Android

### Testes
- [ ] App inicia sem erros (`npm start`)
- [ ] QR code escaneado com sucesso
- [ ] App carrega no dispositivo
- [ ] Login funciona
- [ ] Navegação funciona

## 📋 Fase 5: Integração

### Fluxo Completo
- [ ] Login no app funciona
- [ ] Tela de registro de saída abre
- [ ] Entrada de chave NF-e validada
- [ ] Entrada de placa validada
- [ ] Câmera funciona (permissões OK)
- [ ] Seleção de foto da galeria funciona
- [ ] Preview da foto aparece
- [ ] Formulário envia para o backend
- [ ] Backend valida token
- [ ] Backend faz upload da foto
- [ ] Backend consulta SEFAZ
- [ ] Backend salva registro no banco
- [ ] App recebe resposta
- [ ] Mensagem de sucesso/erro aparece

### Validações de Negócio
- [ ] NF-e autorizada (status 100) libera saída
- [ ] NF-e cancelada/denegada bloqueia saída
- [ ] Duplicidade no mesmo dia é bloqueada
- [ ] Logs de tentativas são gravados

## 📋 Fase 6: Segurança

### Backend
- [ ] `.env` está no `.gitignore`
- [ ] Certificado está no `.gitignore`
- [ ] HTTPS configurado (produção)
- [ ] CORS configurado adequadamente
- [ ] Rate limiting ativo
- [ ] Helmet configurado
- [ ] Logs não contêm dados sensíveis

### Frontend
- [ ] `.env` está no `.gitignore`
- [ ] Token armazenado com SecureStore
- [ ] Logout funciona
- [ ] Session expira corretamente

### Banco de Dados
- [ ] RLS habilitado em todas as tabelas
- [ ] Políticas de storage ativas
- [ ] Service role key segura (não exposta)
- [ ] Backups configurados

## 📋 Fase 7: Documentação

### Arquivos
- [ ] README.md criado
- [ ] QUICKSTART.md criado
- [ ] DATABASE_SETUP.md criado
- [ ] BACKEND_SETUP.md criado
- [ ] FRONTEND_SETUP.md criado
- [ ] DEPLOY.md criado
- [ ] API_DOCUMENTATION.md criado

### Credenciais
- [ ] Credenciais documentadas em local seguro
- [ ] URLs anotadas
- [ ] Senhas em gerenciador de senhas

## 📋 Fase 8: Deploy (Produção)

### Preparação
- [ ] Certificado digital de PRODUÇÃO obtido
- [ ] Servidor VPS provisionado
- [ ] Domínio configurado
- [ ] DNS apontando para servidor

### Backend
- [ ] Código enviado para servidor
- [ ] Dependências instaladas em produção
- [ ] `.env` de produção configurado
- [ ] Certificado de produção no servidor
- [ ] Build executado
- [ ] PM2 configurado
- [ ] Nginx configurado
- [ ] SSL/HTTPS habilitado
- [ ] Firewall configurado

### Frontend
- [ ] Build de produção gerado (APK/AAB)
- [ ] App testado em modo release
- [ ] Google Play Store configurado (opcional)
- [ ] App distribuído para usuários

### Monitoramento
- [ ] Health checks configurados
- [ ] Logs sendo monitorados
- [ ] Alertas configurados
- [ ] Backups testados

## 📋 Fase 9: Treinamento

### Usuários Finais
- [ ] Manual de usuário criado
- [ ] Treinamento realizado
- [ ] Credenciais entregues
- [ ] Suporte inicial fornecido

## 📋 Fase 10: Go Live

### Final
- [ ] Testes end-to-end em produção
- [ ] Backup final antes do go-live
- [ ] Comunicação enviada aos usuários
- [ ] Sistema em produção
- [ ] Monitoramento ativo
- [ ] Suporte disponível

## ✅ Status Geral

Marque quando cada fase estiver completa:

- [ ] Fase 1: Preparação
- [ ] Fase 2: Banco de Dados
- [ ] Fase 3: Backend
- [ ] Fase 4: Frontend
- [ ] Fase 5: Integração
- [ ] Fase 6: Segurança
- [ ] Fase 7: Documentação
- [ ] Fase 8: Deploy
- [ ] Fase 9: Treinamento
- [ ] Fase 10: Go Live

## 🎉 Parabéns!

Quando todas as fases estiverem completas, seu sistema estará totalmente operacional!

## 📞 Suporte

Em caso de dúvidas:
1. Consulte a documentação em `docs/`
2. Verifique os logs (`pm2 logs` no backend)
3. Revise este checklist
4. Entre em contato com a equipe de desenvolvimento
