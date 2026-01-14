# Funcionalidade de Medição Volumétrica AR

## Visão Geral

Esta funcionalidade permite que usuários façam medições volumétricas (cubagem) de produtos usando Realidade Aumentada (AR) através de seus dispositivos iPhone com Safari.

## Tecnologias Utilizadas

- **Next.js 14+** com App Router
- **TypeScript** para type safety
- **Three.js** e **React Three Fiber** para renderização 3D
- **WebXR API** para funcionalidade AR
- **Zustand** para gerenciamento de estado
- **Firebase Firestore** para persistência de dados
- **Tailwind CSS** para estilização (mobile-first)

## Estrutura de Arquivos

```
├── app/
│   └── ar-measurement/
│       └── page.tsx                    # Página principal AR
├── components/
│   └── ar/
│       ├── ARMeasurement.tsx           # Componente principal AR
│       ├── ARScene.tsx                 # Cena 3D com hit testing
│       └── MeasurementOverlay.tsx      # UI overlay com controles
├── hooks/
│   └── useARPermissions.ts             # Hook para gerenciar permissões
├── lib/
│   └── ar/
│       └── measurementService.ts       # Serviço Firebase para medições
└── stores/
    └── useMeasurementStore.ts          # Store Zustand para estado AR
```

## Como Funciona

### 1. Verificação de Suporte

O sistema verifica automaticamente:
- Disponibilidade da WebXR API
- Suporte a sessões AR imersivas
- Permissões de câmera

### 2. Fluxo de Medição

1. Usuário acessa `/ar-measurement`
2. Sistema solicita permissão de câmera (se necessário)
3. Usuário inicia sessão AR
4. WebXR detecta planos (superfícies) no ambiente
5. Usuário marca 4 pontos no espaço 3D
6. Sistema calcula automaticamente:
   - Comprimento (cm)
   - Largura (cm)
   - Altura (cm)
   - Volume (cm³ e m³)
7. Usuário pode salvar a medição no Firebase

### 3. Cálculo de Volume

O sistema usa os 4 pontos marcados para criar uma **bounding box** (caixa delimitadora):

```typescript
// Encontra coordenadas mínimas e máximas
const min = new Vector3(
  Math.min(...points.map(p => p.x)),
  Math.min(...points.map(p => p.y)),
  Math.min(...points.map(p => p.z))
);

const max = new Vector3(
  Math.max(...points.map(p => p.x)),
  Math.max(...points.map(p => p.y)),
  Math.max(...points.map(p => p.z))
);

// Calcula dimensões
const length = (max.x - min.x) * 100; // metros → cm
const width = (max.z - min.z) * 100;
const height = (max.y - min.y) * 100;

// Calcula volume
const volume = length * width * height; // cm³
```

## Requisitos do Dispositivo

### iOS (Recomendado)
- iPhone com iOS 15 ou superior
- Safari como navegador
- Conexão HTTPS
- Permissão de câmera habilitada

### Android (Suporte Limitado)
- Android com ARCore
- Chrome ou Edge atualizado
- Conexão HTTPS

## Persistência de Dados

### Estrutura do Firestore

Collection: `ar_measurements`

```typescript
{
  id: string;
  userId: string;              // ID do usuário que fez a medição
  productId?: string;          // ID do produto (opcional)
  productName?: string;        // Nome do produto (opcional)
  productEan?: string;         // EAN do produto (opcional)
  storeId?: string;            // ID da loja (opcional)
  storeName?: string;          // Nome da loja (opcional)
  length: number;              // Comprimento em cm
  width: number;               // Largura em cm
  height: number;              // Altura em cm
  volume: number;              // Volume em cm³
  volumeM3: number;            // Volume em m³
  pointsCount: number;         // Número de pontos marcados (2 ou 4)
  timestamp: Timestamp;        // Data/hora da medição
  notes?: string;              // Notas adicionais (opcional)
  imageUrl?: string;           // URL da foto (opcional)
}
```

### Índices Necessários

Os seguintes índices foram criados em `firestore.indexes.json`:

1. **userId + timestamp** (para buscar medições de um usuário)
2. **productId + timestamp** (para buscar medições de um produto)

## API de Serviços

### saveMeasurement()
Salva uma medição no Firestore.

```typescript
const measurementId = await saveMeasurement(
  measurement,
  userId,
  {
    productId: 'prod-123',
    productName: 'Caixa Grande',
    pointsCount: 4
  }
);
```

### getUserMeasurements()
Busca medições de um usuário específico.

```typescript
const measurements = await getUserMeasurements(userId, 50);
```

### getProductMeasurements()
Busca medições de um produto específico.

```typescript
const measurements = await getProductMeasurements(productId, 20);
```

### getAverageMeasurements()
Calcula a média das medições de um produto (útil para planogramas).

```typescript
const avgMeasurement = await getAverageMeasurements(productId);
// Retorna: { length, width, height, volume, volumeM3 }
```

## Integração com Planogramas

Esta funcionalidade foi projetada para integração com o sistema de planogramas:

1. Ao criar/editar produtos no planograma, adicione um botão "Medir com AR"
2. O botão redireciona para `/ar-measurement?productId=XXX`
3. Após a medição, os dados são salvos com o `productId`
4. O sistema pode calcular medições médias para melhor precisão

## UI/UX

### Estados Visuais

1. **Loading**: Verificando suporte AR
2. **Permission Request**: Solicitando permissão de câmera
3. **Permission Denied**: Instruções para habilitar permissão
4. **AR Not Supported**: Mensagem de erro com requisitos
5. **AR Active**: Interface de medição ativa

### Controles

- **Resetar**: Limpa todos os pontos e recomeça
- **Desfazer**: Remove o último ponto marcado
- **Salvar**: Salva a medição no Firebase
- **Iniciar AR**: Inicia a sessão AR

### Feedback Visual

- Retículo verde que segue superfícies detectadas
- Esferas azuis nos pontos marcados
- Linhas conectando os pontos
- Bounding box verde quando 4 pontos estão marcados
- Progresso visual (4 bolinhas indicando pontos)
- Instruções contextuais baseadas no estado

## Limitações e Considerações

### Precisão
- As medições dependem da qualidade do sensor do dispositivo
- Recomendado fazer múltiplas medições e calcular média
- Não substitui equipamento profissional de medição

### Performance
- Requer bom processamento gráfico
- Consumo de bateria elevado durante uso
- Requer boa iluminação ambiente

### Compatibilidade
- Funciona melhor em iPhone com chip A12 ou superior
- Safari é o navegador recomendado no iOS
- Requer HTTPS para funcionar

## Próximos Passos (Futuras Melhorias)

1. ✅ Estrutura básica AR implementada
2. ✅ Hit testing e detecção de planos
3. ✅ Cálculo de volume
4. ✅ Persistência no Firebase
5. ✅ Gerenciamento de permissões
6. 🔲 Captura de foto junto com medição
7. 🔲 Integração direta com página de planogramas
8. 🔲 Visualização de histórico de medições
9. 🔲 Exportação de relatórios
10. 🔲 Calibração manual para maior precisão

## Deployment

### Passos para Deploy

1. **Deploy dos índices do Firestore**:
```bash
firebase deploy --only firestore:indexes
```

2. **Build da aplicação**:
```bash
npm run build
```

3. **Deploy**:
```bash
# Certifique-se que está rodando em HTTPS
npm run deploy
```

### Variáveis de Ambiente

Certifique-se que as credenciais do Firebase estão configuradas:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Testes

### Como Testar

1. Acesse a aplicação via HTTPS em um iPhone
2. Navegue para `/ar-measurement`
3. Permita acesso à câmera quando solicitado
4. Toque em "Iniciar AR"
5. Aponte a câmera para uma superfície plana
6. Aguarde o retículo verde aparecer
7. Toque na tela para marcar 4 pontos formando um volume
8. Verifique os resultados exibidos
9. Toque em "Salvar" para persistir no Firebase

### Checklist de Testes

- [ ] WebXR disponível e funcionando
- [ ] Permissões de câmera solicitadas corretamente
- [ ] Hit testing detectando superfícies
- [ ] Pontos sendo marcados corretamente
- [ ] Linhas conectando pontos
- [ ] Bounding box aparecendo com 4 pontos
- [ ] Cálculos de volume corretos
- [ ] Salvamento no Firebase funcionando
- [ ] Toasts de sucesso/erro aparecendo
- [ ] Botão Reset funcionando
- [ ] Botão Desfazer funcionando

## Troubleshooting

### "AR Não Suportado"
- Certifique-se de estar usando Safari no iOS 15+
- Verifique se está em conexão HTTPS
- Tente reiniciar o navegador

### "Permissão Negada"
- Vá em Configurações > Safari > Câmera
- Selecione "Permitir"
- Recarregue a página

### Retículo Não Aparece
- Melhore a iluminação do ambiente
- Aponte para superfícies com textura visível
- Evite superfícies muito brilhantes ou escuras

### Medições Imprecisas
- Faça múltiplas medições
- Use o cálculo de média (`getAverageMeasurements`)
- Certifique-se de boa iluminação
- Marque pontos com cuidado

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console do navegador
2. Verifique os logs do Firebase Console
3. Consulte a documentação do WebXR: https://immersiveweb.dev/
