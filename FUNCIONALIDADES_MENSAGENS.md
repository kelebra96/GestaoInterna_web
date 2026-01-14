# Funcionalidades do Sistema de Mensagens

## ✅ Botões Implementados

### 1. 📎 **Botão de Anexo (Paperclip)**

**Funcionalidade:**
- Abre seletor de arquivos do sistema
- Aceita qualquer tipo de arquivo
- Mostra preview do arquivo selecionado

**Como funciona:**
```typescript
// Ao clicar, abre o input file invisível
<input ref={fileInputRef} type="file" accept="*/*" />
```

**Estado atual:**
- ✅ Seleção de arquivo funcional
- ⚠️ Upload real será implementado em breve
- Mostra alerta com nome do arquivo selecionado

**Próximos passos:**
- Implementar upload para Firebase Storage
- Enviar URL do arquivo na mensagem
- Preview de diferentes tipos de arquivo

---

### 2. 🖼️ **Botão de Imagem (Image)**

**Funcionalidade:**
- Abre seletor de imagens do sistema
- Aceita apenas arquivos de imagem (jpg, png, gif, etc.)
- Mostra preview da imagem selecionada

**Como funciona:**
```typescript
// Filtro para apenas imagens
<input ref={imageInputRef} type="file" accept="image/*" />
```

**Estado atual:**
- ✅ Seleção de imagem funcional
- ⚠️ Upload real será implementado em breve
- Mostra alerta com nome da imagem selecionada

**Próximos passos:**
- Upload para Firebase Storage
- Preview da imagem antes de enviar
- Redimensionamento automático
- Compressão de imagem

---

### 3. 😊 **Botão de Emoji (Smile)**

**Funcionalidade:**
- Abre menu popup com seleção de emojis
- Insere emoji no campo de texto
- Fecha automaticamente ao selecionar ou clicar fora

**Emojis disponíveis:**
```javascript
😀 😂 😍 🥰 😊 😎 🤔 😢 😭 😡
👍 👎 ❤️ 🎉 🔥 ✨ 💪 🙏 👏 🎊
```

**Estado atual:**
- ✅ Menu de emojis totalmente funcional
- ✅ Inserção no texto funcional
- ✅ Fecha ao clicar fora
- ✅ Animação de abertura suave

**Características:**
- Menu posicionado acima do botão
- Grid 5x4 com 20 emojis
- Botão de fechar (X) no canto superior direito
- Highlight visual quando aberto

---

## 🎨 Design e UX

### Estados Visuais

**Botões:**
- Normal: Cinza claro com hover
- Hover: Fundo cinza mais escuro
- Ativo: Fundo cinza (para emoji picker aberto)
- Desabilitado: Opacidade reduzida (quando enviando)

**Menu de Emojis:**
- Animação de fade-in e slide-in
- Shadow elevada (z-50)
- Borda arredondada
- Grid responsivo

### Acessibilidade

- ✅ Títulos descritivos em todos os botões
- ✅ Estados disabled apropriados
- ✅ Feedback visual ao hover
- ✅ Tecla Esc para fechar emoji picker (a implementar)

---

## 🔧 Implementação Técnica

### Estados React

```typescript
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
const imageInputRef = useRef<HTMLInputElement>(null);
```

### Funções Principais

1. **handleFileClick()** - Abre seletor de arquivo
2. **handleImageClick()** - Abre seletor de imagem
3. **handleFileChange()** - Processa arquivo selecionado
4. **handleImageChange()** - Processa imagem selecionada
5. **handleEmojiClick()** - Insere emoji no texto

### Detecção de Clique Fora

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
      setShowEmojiPicker(false);
    }
  };

  if (showEmojiPicker) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showEmojiPicker]);
```

---

## 📋 Roadmap - Funcionalidades Futuras

### Upload de Arquivos e Imagens

**Fase 1: Backend**
- [ ] Configurar Firebase Storage
- [ ] Criar regras de segurança
- [ ] API para upload de arquivos
- [ ] API para gerar URLs assinadas

**Fase 2: Frontend**
- [ ] Preview de imagens antes de enviar
- [ ] Barra de progresso de upload
- [ ] Suporte para múltiplos arquivos
- [ ] Drag & drop de arquivos

**Fase 3: Mensagens com Anexos**
- [ ] Salvar URL do arquivo no Firestore
- [ ] Renderizar imagens inline nas mensagens
- [ ] Renderizar ícones de arquivo com download
- [ ] Thumbnails para vídeos

### Melhorias no Emoji Picker

- [ ] Mais categorias de emojis
- [ ] Busca de emojis por nome
- [ ] Emojis recentemente usados
- [ ] Skin tones para emojis
- [ ] Integrar biblioteca como emoji-picker-react

### Outras Funcionalidades

- [ ] Gravação de áudio
- [ ] Compartilhamento de localização
- [ ] GIFs animados (Giphy integration)
- [ ] Stickers personalizados
- [ ] Reações rápidas nas mensagens

---

## 🐛 Bugs Conhecidos

Nenhum bug conhecido no momento.

---

## 📝 Notas de Desenvolvimento

### Estrutura de Dados Proposta para Mensagens com Anexos

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  createdAt: string;
  read: boolean;
  // Novos campos para anexos
  attachments?: Array<{
    type: 'image' | 'file' | 'audio' | 'video';
    url: string;
    name: string;
    size: number;
    mimeType: string;
    thumbnail?: string; // Para vídeos e PDFs
  }>;
}
```

### Firebase Storage - Estrutura de Pastas

```
storage/
└── messages/
    └── {conversationId}/
        └── {messageId}/
            ├── image_001.jpg
            ├── document_002.pdf
            └── ...
```

### Regras de Segurança Firebase Storage (Proposta)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /messages/{conversationId}/{messageId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024; // Max 10MB
    }
  }
}
```

---

## ✅ Checklist de Teste

- [x] Botão de anexo abre seletor de arquivo
- [x] Botão de imagem abre seletor de imagem (apenas imagens)
- [x] Botão de emoji abre menu
- [x] Clicar em emoji insere no texto
- [x] Clicar fora do menu fecha o emoji picker
- [x] Botões ficam desabilitados durante envio
- [x] Visual responsivo em mobile
- [ ] Upload de arquivo completo
- [ ] Upload de imagem completo
- [ ] Mensagens com anexos renderizam corretamente
