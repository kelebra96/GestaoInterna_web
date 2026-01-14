# Índices do Firestore para Checklists

Este documento explica como criar os índices do Firestore necessários para otimizar as queries de checklist.

## Situação Atual

As rotas da API foram configuradas para funcionar **sem índices compostos**, fazendo a ordenação em memória após buscar os dados do Firestore. Isso funciona bem para volumes pequenos a médios de dados.

## Otimização com Índices (Opcional)

Para melhorar a performance em produção com grande volume de dados, você pode criar índices compostos no Firebase.

### Opção 1: Deploy Automático (Recomendado)

Execute o comando abaixo na pasta `web/`:

```bash
firebase deploy --only firestore:indexes
```

Este comando utiliza o arquivo `firestore.indexes.json` para criar automaticamente todos os índices necessários.

### Opção 2: Criação Manual via Console

Se houver erros no console informando que índices são necessários, clique nos links fornecidos ou acesse:

**Firebase Console** → **Firestore Database** → **Indexes** → **Create Index**

Crie os seguintes índices compostos:

#### Para `checklist_templates`:

1. **Filtro por active + ordenação**
   - Collection: `checklist_templates`
   - Fields:
     - `active` (Ascending)
     - `createdAt` (Descending)

2. **Filtro por companyId + active + ordenação**
   - Collection: `checklist_templates`
   - Fields:
     - `companyId` (Ascending)
     - `active` (Ascending)
     - `createdAt` (Descending)

3. **Filtro por type + active + ordenação**
   - Collection: `checklist_templates`
   - Fields:
     - `type` (Ascending)
     - `active` (Ascending)
     - `createdAt` (Descending)

4. **Filtro por companyId + type + active + ordenação**
   - Collection: `checklist_templates`
   - Fields:
     - `companyId` (Ascending)
     - `type` (Ascending)
     - `active` (Ascending)
     - `createdAt` (Descending)

#### Para `checklist_executions`:

1. **Filtro por status + ordenação**
   - Collection: `checklist_executions`
   - Fields:
     - `status` (Ascending)
     - `scheduledDate` (Descending)

2. **Filtro por companyId + status + ordenação**
   - Collection: `checklist_executions`
   - Fields:
     - `companyId` (Ascending)
     - `status` (Ascending)
     - `scheduledDate` (Descending)

3. **Filtro por userId + status + ordenação**
   - Collection: `checklist_executions`
   - Fields:
     - `userId` (Ascending)
     - `status` (Ascending)
     - `scheduledDate` (Descending)

4. **Filtro por storeId + status + ordenação**
   - Collection: `checklist_executions`
   - Fields:
     - `storeId` (Ascending)
     - `status` (Ascending)
     - `scheduledDate` (Descending)

## Quando Criar os Índices?

- ✅ **Agora**: Se você está em produção e tem mais de 1000 documentos
- ✅ **Agora**: Se você quer máxima performance nas queries
- ⏸️ **Mais tarde**: Se você está em desenvolvimento e tem poucos dados
- ⏸️ **Mais tarde**: Se a ordenação em memória está funcionando bem

## Verificar Status dos Índices

Acesse: [Firebase Console - Firestore Indexes](https://console.firebase.google.com/project/myinventoy/firestore/indexes)

Os índices levam alguns minutos para serem criados. O status será exibido como:
- 🟡 **Building**: Índice sendo criado
- 🟢 **Enabled**: Índice ativo e funcionando
- 🔴 **Error**: Erro na criação (verifique os logs)

## Benefícios da Criação de Índices

- ⚡ Queries até 10x mais rápidas
- 📉 Menor uso de recursos do servidor
- 💰 Redução de custos de leitura do Firestore
- 🚀 Melhor experiência do usuário

## Nota Importante

O sistema **já funciona sem os índices**. A criação é apenas uma otimização para melhorar a performance.
