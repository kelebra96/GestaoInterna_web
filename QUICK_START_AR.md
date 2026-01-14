# 🚀 Quick Start - Deploy AR na VPS

## TL;DR - Comandos Rápidos

### No seu computador:

```bash
# 1. Build
npm run build

# 2. Deploy índices Firestore
firebase deploy --only firestore:indexes

# 3. Commit e push (se usar Git)
git add .
git commit -m "feat: AR measurement"
git push origin master
```

### Na VPS via SSH:

```bash
# 1. Conectar
ssh user@sua-vps.com

# 2. Ir para o projeto
cd /caminho/do/projeto/WEB

# 3. Pull as mudanças (se usar Git)
git pull origin master

# 4. Instalar dependências
npm install

# 5. Build
npm run build

# 6. Reiniciar PM2
pm2 restart myinventory

# 7. Verificar
pm2 logs myinventory --lines 50
```

### No iPhone Safari:

```
https://seu-dominio.com/ar-measurement
```

---

## ✅ Checklist Ultra Rápido

### Antes:
- [ ] `npm run build` - OK
- [ ] `firebase deploy --only firestore:indexes` - OK
- [ ] VPS tem SSL/HTTPS funcionando

### Deploy:
- [ ] Código na VPS (git pull ou scp)
- [ ] `npm install` na VPS
- [ ] `npm run build` na VPS
- [ ] `pm2 restart myinventory`

### Testar:
- [ ] iPhone Safari
- [ ] `https://seu-dominio.com/ar-measurement`
- [ ] Permitir câmera
- [ ] Marcar 4 pontos
- [ ] Salvar medição

---

## 📚 Documentação Completa

- **Deploy Detalhado**: [DEPLOY_VPS_AR.md](DEPLOY_VPS_AR.md)
- **Checklist Completo**: [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md)
- **Guia de Teste**: [TESTE_AR_IPHONE.md](TESTE_AR_IPHONE.md)
- **Documentação AR**: [AR_MEASUREMENT_README.md](AR_MEASUREMENT_README.md)

---

## ⚡ Método Mais Rápido (Git)

Se sua VPS já tem acesso ao repositório Git:

```bash
# Local
git add . && git commit -m "feat: AR" && git push

# VPS
ssh user@vps "cd /projeto/WEB && git pull && npm install && npm run build && pm2 restart myinventory"
```

Pronto! 🎉

---

## 🆘 Problemas?

### Erro 502
```bash
pm2 restart myinventory
```

### AR não funciona
- Use Safari (não Chrome)
- Verifique HTTPS (cadeado verde)
- iOS 15+

### Permissão negada
```
iPhone: Configurações > Safari > Câmera > Permitir
```

---

## 📱 URL de Teste

Após deploy, acesse no iPhone Safari:

```
https://seu-dominio.com/ar-measurement
```

**Lembre-se**: DEVE ser HTTPS, não HTTP!
