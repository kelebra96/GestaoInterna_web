# MyInventory - Painel de Gestão Web

Painel de gestão administrativo para o aplicativo MyInventory. Dashboard completo com KPIs, gráficos e estatísticas em tempo real.

## 🚀 Tecnologias

- **Next.js 16** - Framework React para produção
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **Firebase Admin SDK** - Acesso ao banco de dados Firestore
- **Recharts** - Biblioteca de gráficos
- **Lucide React** - Ícones modernos
- **date-fns** - Manipulação de datas

## 📊 Funcionalidades

### KPIs (Key Performance Indicators)
- Total de Solicitações
- Total de Usuários  
- Usuários Ativos
- Total de Lojas
- Total de Itens

### Gráficos e Visualizações
- Gráfico de linha: Solicitações nos últimos 30 dias
- Gráfico de pizza: Solicitações por status
- Estatísticas de usuários por função
- Tabela de solicitações recentes

## 🔧 Configuração

### 1. Instalar Dependências

```bash
cd web
npm install
```

### 2. Configurar Firebase Admin

O projeto já está configurado para usar o arquivo serviceAccountKey.json da raiz do projeto principal.

### 3. Executar em Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

## 📁 Estrutura do Projeto

```
web/
├── app/
│   ├── api/dashboard/route.ts    # API route para buscar dados
│   └── page.tsx                   # Página principal
├── components/                    # Componentes React
│   ├── KPICard.tsx
│   ├── SolicitacoesChart.tsx
│   ├── StatusChart.tsx
│   └── RecentSolicitacoes.tsx
└── lib/
    └── firebase-admin.ts          # Configuração Firebase Admin
```

## 🚀 Deploy

### Vercel (Recomendado)

1. Faça push do código para GitHub
2. Conecte o repositório no Vercel
3. Configure as variáveis de ambiente
4. Faça o deploy

## 📝 TODO

- [ ] Implementar autenticação de administrador
- [ ] Adicionar mais filtros e períodos personalizados
- [ ] Exportar relatórios em PDF/Excel
- [ ] Adicionar tema dark mode
