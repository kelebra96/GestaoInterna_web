# 🚀 Como Testar AR no iPhone - Guia Rápido

## Opção 1: Ngrok (Mais Fácil) ⭐ RECOMENDADO

### Passo 1: Instalar ngrok
```bash
# Windows (usando npm)
npm install -g ngrok

# Ou baixe direto de: https://ngrok.com/download
```

### Passo 2: Criar conta gratuita (opcional mas recomendado)
1. Acesse: https://dashboard.ngrok.com/signup
2. Copie seu authtoken
3. Configure: `ngrok config add-authtoken SEU_TOKEN_AQUI`

### Passo 3: Iniciar servidor Next.js
```bash
# Terminal 1
npm run dev
```

### Passo 4: Criar túnel HTTPS
```bash
# Terminal 2
npx ngrok http 3000
```

Você verá algo assim:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### Passo 5: Acessar no iPhone
1. Abra o Safari no iPhone
2. Digite a URL HTTPS que o ngrok mostrou
3. Adicione `/ar-measurement` no final
4. Exemplo: `https://abc123.ngrok-free.app/ar-measurement`

---

## Opção 2: Deploy no Firebase (Para Produção)

### Passo 1: Build da aplicação
```bash
npm run build
```

### Passo 2: Deploy dos índices Firestore
```bash
firebase deploy --only firestore:indexes
```

### Passo 3: Deploy da aplicação
```bash
firebase deploy
```

### Passo 4: Acessar no iPhone
Acesse: `https://seu-projeto.web.app/ar-measurement`

---

## Opção 3: Deploy no Vercel (Mais Rápido)

### Passo 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

### Passo 2: Deploy
```bash
vercel --prod
```

### Passo 3: Acessar no iPhone
O Vercel vai gerar uma URL HTTPS automaticamente.
Acesse: `https://seu-projeto.vercel.app/ar-measurement`

---

## 📱 Checklist de Teste no iPhone

Antes de começar, certifique-se:
- [ ] iPhone com iOS 15 ou superior
- [ ] Safari navegador (não Chrome ou Firefox)
- [ ] Boa iluminação no ambiente
- [ ] Superfície plana disponível (mesa, chão, parede)
- [ ] Conexão HTTPS funcionando

---

## 🎯 Passo a Passo do Teste

### 1. Acessar a Página
- Abra Safari no iPhone
- Digite a URL HTTPS + `/ar-measurement`
- Aguarde carregar

### 2. Permitir Câmera
- Toque em "Permitir Acesso à Câmera"
- No popup do iOS, selecione "Permitir"

### 3. Iniciar AR
- Toque no botão "Iniciar AR"
- Aponte a câmera para uma superfície plana
- Mova o iPhone devagar para ajudar na detecção

### 4. Aguardar Retículo
- Um círculo verde deve aparecer na tela
- Ele vai seguir a superfície detectada
- Se não aparecer, mova o iPhone lentamente

### 5. Marcar Pontos
- Toque na tela **4 vezes**
- Cada toque marca um ponto do volume
- Esferas azuis aparecerão nos pontos marcados

### 6. Ver Resultados
Após marcar 4 pontos, você verá:
- Comprimento (cm)
- Largura (cm)
- Altura (cm)
- Volume (cm³ e m³)

### 7. Salvar
- Toque em "Salvar"
- A medição será salva no Firebase
- Você verá uma mensagem de sucesso

---

## 🐛 Problemas Comuns

### "AR Não Suportado"
**Causa**: Navegador ou dispositivo incompatível
**Solução**:
- Use Safari (não Chrome)
- Verifique se é iOS 15+
- Confirme que está em HTTPS

### "Permissão Negada"
**Causa**: Câmera bloqueada nas configurações
**Solução**:
1. Abra Configurações do iPhone
2. Role até "Safari"
3. Toque em "Câmera"
4. Selecione "Permitir"
5. Recarregue a página

### Retículo Verde Não Aparece
**Causa**: Superfície não detectada
**Solução**:
- Melhore a iluminação
- Aponte para superfície com textura
- Evite superfícies muito brilhantes/escuras
- Mova o iPhone lentamente

### Medições Imprecisas
**Causa**: Sensor não calibrado ou movimento rápido
**Solução**:
- Faça múltiplas medições
- Marque pontos com cuidado
- Mantenha iPhone estável
- Use boa iluminação

### "Verificando suporte AR..." Infinito
**Causa**: Não está em HTTPS
**Solução**:
- Use ngrok, Firebase ou Vercel
- Não acesse via HTTP ou IP sem certificado

---

## 💡 Dicas para Melhores Resultados

1. **Iluminação**: Use ambiente bem iluminado (luz natural é melhor)
2. **Superfície**: Prefira superfícies com textura visível
3. **Movimento**: Mova o iPhone devagar e suavemente
4. **Calibração**: Faça 2-3 medições e use a média
5. **Distância**: Fique a 30cm-2m do objeto
6. **Estabilidade**: Mantenha mãos firmes ao marcar pontos

---

## 📊 Dados Salvos

Todas as medições são salvas em:
- **Firebase Firestore**: Collection `ar_measurements`
- **LocalStorage**: Backup local (cache)

Estrutura dos dados:
```json
{
  "userId": "abc123",
  "length": 25.5,
  "width": 18.3,
  "height": 12.7,
  "volume": 5920.35,
  "volumeM3": 0.005920,
  "pointsCount": 4,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 🔗 Próximos Passos

Após testar com sucesso:

1. **Integrar com Planogramas**
   - Adicionar botão "Medir com AR" nas páginas de produtos
   - Passar `productId` via URL

2. **Ver Medições Salvas**
   - Criar página para listar medições
   - Mostrar histórico por produto

3. **Exportar Dados**
   - Gerar relatórios PDF
   - Exportar para Excel

---

## ❓ Precisa de Ajuda?

Se encontrar problemas:
1. Verifique o console do Safari (Inspect Element)
2. Confirme que está em HTTPS
3. Teste em ambiente bem iluminado
4. Consulte a documentação completa em `AR_MEASUREMENT_README.md`
