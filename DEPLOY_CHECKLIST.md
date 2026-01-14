# ✅ Checklist de Deploy AR - VPS

## Antes do Deploy

### Local (Seu Computador)

- [ ] Todas as dependências instaladas
  ```bash
  npm install
  ```

- [ ] Build rodando sem erros
  ```bash
  npm run build
  ```

- [ ] Código commitado no Git (opcional mas recomendado)
  ```bash
  git add .
  git commit -m "feat: adiciona medição AR"
  git push
  ```

### VPS (Servidor)

- [ ] Node.js 18+ instalado
  ```bash
  node --version  # deve ser >= 18
  ```

- [ ] PM2 instalado
  ```bash
  pm2 --version
  # Se não instalado: npm install -g pm2
  ```

- [ ] Nginx instalado e rodando
  ```bash
  sudo systemctl status nginx
  ```

- [ ] SSL/HTTPS configurado
  ```bash
  curl -I https://seu-dominio.com  # deve retornar 200 ou 301
  ```

---

## Deploy - Método Simples (Git)

### 1. Na VPS, pull as mudanças

```bash
ssh user@sua-vps.com
cd /caminho/do/projeto/WEB
git pull origin master
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Deploy índices Firestore

```bash
firebase deploy --only firestore:indexes
```

### 5. Reiniciar PM2

```bash
pm2 restart myinventory

# Ou se for primeira vez:
pm2 start npm --name "myinventory" -- start
pm2 save
```

### 6. Verificar logs

```bash
pm2 logs myinventory --lines 50
```

---

## Deploy - Método Script Automático

### 1. Configurar script (apenas primeira vez)

Edite `deploy-ar-vps.sh`:

```bash
VPS_USER="seu-usuario"
VPS_HOST="seu-dominio.com"
VPS_PATH="/caminho/do/projeto/WEB"
APP_NAME="myinventory"
```

### 2. Dar permissão de execução

```bash
chmod +x deploy-ar-vps.sh
```

### 3. Executar deploy

```bash
./deploy-ar-vps.sh
```

---

## Pós-Deploy

### Verificações Obrigatórias

- [ ] Aplicação rodando
  ```bash
  pm2 status
  # myinventory deve estar "online"
  ```

- [ ] Logs sem erros
  ```bash
  pm2 logs myinventory --lines 100
  # Não deve ter erros em vermelho
  ```

- [ ] HTTPS acessível
  ```bash
  curl -I https://seu-dominio.com
  # Deve retornar 200 ou 301, não 502
  ```

- [ ] Rota AR acessível
  ```bash
  curl https://seu-dominio.com/ar-measurement
  # Deve retornar HTML (não erro 404)
  ```

---

## Teste no iPhone

### Pré-requisitos

- [ ] iPhone com iOS 15 ou superior
- [ ] Safari navegador
- [ ] Boa iluminação no ambiente
- [ ] Superfície plana disponível

### Passo a Passo

1. **Abrir Safari no iPhone**
   - [ ] Navegador Safari aberto (NÃO Chrome)

2. **Acessar URL**
   - [ ] Digite: `https://seu-dominio.com/ar-measurement`
   - [ ] Página carrega sem erros
   - [ ] Aparece interface AR

3. **Permitir Câmera**
   - [ ] Popup de permissão aparece
   - [ ] Clique em "Permitir Acesso à Câmera"
   - [ ] No iOS, selecione "Permitir"

4. **Iniciar AR**
   - [ ] Botão "Iniciar AR" aparece
   - [ ] Clique no botão
   - [ ] Câmera ativa

5. **Detectar Superfície**
   - [ ] Aponte para superfície plana (mesa/chão)
   - [ ] Mova iPhone devagar
   - [ ] Retículo verde aparece

6. **Marcar Pontos**
   - [ ] Toque 4 vezes na tela
   - [ ] Esferas azuis aparecem nos pontos
   - [ ] Linhas conectam os pontos
   - [ ] Bounding box verde aparece

7. **Ver Resultados**
   - [ ] Painel com dimensões aparece
   - [ ] Comprimento (cm) mostrado
   - [ ] Largura (cm) mostrado
   - [ ] Altura (cm) mostrado
   - [ ] Volume (cm³ e m³) mostrado

8. **Salvar Medição**
   - [ ] Botão "Salvar" aparece
   - [ ] Clique em "Salvar"
   - [ ] Toast "Medição salva com sucesso!" aparece
   - [ ] Tela reseta após 1.5s

9. **Verificar no Firebase**
   - [ ] Abra Firebase Console
   - [ ] Vá em Firestore Database
   - [ ] Collection `ar_measurements` existe
   - [ ] Documento com sua medição foi criado

---

## Troubleshooting Rápido

### ❌ Erro 502 Bad Gateway

```bash
# Verificar PM2
pm2 status
pm2 restart myinventory

# Verificar porta
netstat -tlnp | grep 3000
```

### ❌ "AR Não Suportado" no iPhone

- Verifique se está usando **Safari** (não Chrome)
- Confirme que está em **HTTPS** (cadeado verde)
- Verifique iOS versão: **Configurações > Geral > Sobre**

### ❌ Permissão Negada

```
iPhone: Configurações > Safari > Câmera > Permitir
Recarregue a página
```

### ❌ Retículo não aparece

- Melhore iluminação do ambiente
- Aponte para superfície com textura
- Mova iPhone mais devagar

### ❌ Build falhou

```bash
# Limpar cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

---

## Comandos Úteis

### Ver logs em tempo real
```bash
pm2 logs myinventory --lines 0
```

### Reiniciar tudo
```bash
pm2 restart myinventory && sudo systemctl restart nginx
```

### Status geral
```bash
pm2 status
sudo systemctl status nginx
```

### Rebuild e restart
```bash
npm run build && pm2 restart myinventory
```

### Verificar SSL
```bash
curl -I https://seu-dominio.com
```

---

## ✅ Deploy Completo!

Se todos os checkboxes acima estão marcados, o deploy está completo e a funcionalidade AR está pronta para uso!

**URL de Teste**: `https://seu-dominio.com/ar-measurement`

**Próximos Passos**:
1. Integrar botão "Medir com AR" nas páginas de produtos
2. Criar página de histórico de medições
3. Implementar captura de fotos junto com medições
