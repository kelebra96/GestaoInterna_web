# Sistema de Controle de Acesso por Perfil

## Resumo

O sistema implementa controle de acesso baseado em perfis (roles), restringindo quais páginas/rotas cada tipo de usuário pode acessar.

## Perfis de Usuário

O sistema possui 5 perfis principais:

1. **Developer** - Acesso total irrestrito ao sistema
2. **Admin** - Acesso operacional limitado (sem gestão de usuários, lojas, empresas, produtos)
3. **Buyer** (Comprador) - Acesso às funcionalidades operacionais básicas
4. **Manager** (Gerente) - Acesso limitado
5. **Agent** (Agente) - Acesso limitado

## Rotas Permitidas por Perfil

### Manager e Agent (Acesso Muito Limitado)

Estes perfis têm acesso **APENAS** às seguintes rotas:

- `/` - Dashboard
- `/perfil` - Meu Perfil
- `/checklists/relatorios` - Relatórios de Checklists
- `/relatorios` - Relatórios
- `/notificacoes` - Notificações
- `/mensagens` - Mensagens

**Total**: 6 rotas

### Buyer (Comprador - Acesso Limitado)

Este perfil tem acesso **APENAS** às seguintes rotas:

- `/` - Dashboard
- `/perfil` - Meu Perfil
- `/solicitacoes` - Solicitações
- `/checklists/relatorios` - Relatórios de Checklists
- `/relatorios` - Relatórios
- `/notificacoes` - Notificações
- `/mensagens` - Mensagens

**Total**: 7 rotas

### Admin (Administrador - Acesso Operacional)

Este perfil tem acesso às seguintes rotas:

- `/` - Dashboard
- `/perfil` - Meu Perfil
- `/solicitacoes` - Solicitações
- `/checklists` - Checklists
- `/checklists/relatorios` - Relatórios de Checklists
- `/inventario` - Inventário
- `/planogramas` - Planogramas
- `/relatorios` - Relatórios
- `/notificacoes` - Notificações
- `/mensagens` - Mensagens

**Total**: 10 rotas

**Restrições**: Não tem acesso a:
- ❌ `/usuarios` - Gestão de Usuários
- ❌ `/lojas` - Gestão de Lojas
- ❌ `/empresas` - Gestão de Empresas
- ❌ `/produtos` - Gestão de Produtos
- ❌ `/configuracoes` - Configurações do Sistema

### Developer (Desenvolvedor - Acesso Total)

Acesso **irrestrito** a todas as rotas do sistema, incluindo gestão de usuários, lojas, empresas, produtos e configurações.

## Arquivos Principais

### 1. [lib/accessControl.ts](lib/accessControl.ts)

Contém as funções e configurações de controle de acesso:

- `ALLOWED_ROUTES` - Mapeamento de perfis para rotas permitidas
- `canAccessRoute()` - Verifica se um perfil pode acessar uma rota
- `canAccessMenuItem()` - Verifica se um perfil pode ver um item do menu
- Funções auxiliares: `isAdmin()`, `isManager()`, `isAgent()`, etc.

### 2. [hooks/useRouteProtection.ts](hooks/useRouteProtection.ts)

Hook customizado para proteção de rotas em componentes:

```typescript
const { user, loading, hasAccess } = useRouteProtection();
```

### 3. [contexts/AuthContext.tsx](contexts/AuthContext.tsx)

Context de autenticação atualizado com:

- Redirecionamento automático para login se não autenticado
- Verificação de permissão de acesso em cada mudança de rota
- Redirecionamento para dashboard se o usuário tentar acessar rota não permitida

### 4. [components/Sidebar.tsx](components/Sidebar.tsx)

Sidebar atualizado com:

- Filtragem de itens do menu baseada no perfil do usuário
- Apenas itens permitidos são exibidos para cada perfil

## Como Funciona

### 1. Autenticação

Ao fazer login, o usuário é autenticado via Firebase e seus dados (incluindo o `role`) são carregados do Firestore.

### 2. Verificação de Acesso

Sempre que o usuário navega para uma nova rota:

1. O `AuthContext` verifica se o usuário está autenticado
2. Se autenticado, verifica se o perfil do usuário tem permissão para acessar a rota
3. Se não tiver permissão, redireciona automaticamente para o dashboard (`/`)

### 3. Menu Filtrado

O Sidebar automaticamente filtra os itens do menu baseado no perfil:

- Manager/Agent veem apenas 6 itens de menu
- Buyer vê mais opções operacionais
- Admin/Developer veem todas as opções

## Exemplos de Uso

### Proteger uma página específica

```typescript
'use client';

import { useRouteProtection } from '@/hooks/useRouteProtection';

export default function MinhaPage() {
  const { user, loading, hasAccess } = useRouteProtection();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!hasAccess) {
    return <div>Você não tem permissão para acessar esta página.</div>;
  }

  return <div>Conteúdo da página</div>;
}
```

### Verificar permissão programaticamente

```typescript
import { canAccessRoute } from '@/lib/accessControl';

const canAccess = canAccessRoute(user.role, '/usuarios');
if (canAccess) {
  // Mostrar botão ou link
}
```

### Verificar se é admin

```typescript
import { isAdmin } from '@/lib/accessControl';

if (isAdmin(user.role)) {
  // Mostrar funcionalidades de admin
}
```

## Adicionando Novas Rotas Restritas

Para adicionar uma nova rota ao sistema:

1. **Atualizar [lib/accessControl.ts](lib/accessControl.ts)**:

```typescript
export const ALLOWED_ROUTES: Record<UserRole, string[]> = {
  // ...
  manager: [
    '/',
    '/perfil',
    '/nova-rota', // Adicione aqui
    // ...
  ],
};
```

2. **Atualizar [components/Sidebar.tsx](components/Sidebar.tsx)**:

```typescript
const menuItems: MenuItem[] = [
  // ...
  {
    name: 'Nova Funcionalidade',
    href: '/nova-rota',
    icon: IconeComponent,
    group: 'operacional',
    allowedRoles: ['developer', 'admin', 'manager'] // Perfis permitidos
  },
];
```

## Testando o Controle de Acesso

### Teste Manual

1. Faça login com um usuário **Manager** ou **Agent**
2. Tente acessar diretamente uma rota não permitida (ex: `/usuarios`)
3. O sistema deve redirecionar automaticamente para `/`
4. Verifique que o menu lateral mostra apenas as opções permitidas

### Teste com diferentes perfis

- **Manager/Agent**: Deve ver 6 itens de menu
- **Buyer**: Deve ver ~11 itens de menu
- **Admin/Developer**: Deve ver todos os itens de menu

## Logs e Debugging

O sistema emite avisos no console quando o acesso é negado:

```
Acesso negado para manager na rota /usuarios
```

Isso ajuda no debugging e identificação de tentativas de acesso não autorizado.

## Segurança

### Proteção em Múltiplas Camadas

1. **Client-side**: Sidebar não mostra rotas não permitidas
2. **Client-side**: AuthContext redireciona automaticamente
3. **Client-side**: useRouteProtection hook adicional para páginas específicas
4. **Server-side**: APIs devem sempre validar permissões (TODO: implementar)

### Próximos Passos de Segurança

- [ ] Adicionar verificação de permissões nas APIs (server-side)
- [ ] Implementar rate limiting para tentativas de acesso não autorizado
- [ ] Adicionar logging de auditoria para acessos negados
- [ ] Criar middleware Next.js para proteção de rotas em nível de servidor

## Troubleshooting

### Problema: Usuário consegue acessar rota não permitida

**Solução**: Verificar se a rota está corretamente configurada em `ALLOWED_ROUTES` no arquivo `lib/accessControl.ts`

### Problema: Menu mostra itens que não deveriam aparecer

**Solução**: Verificar o campo `allowedRoles` do item em `components/Sidebar.tsx`

### Problema: Redirecionamento em loop

**Solução**: Verificar se a rota de destino (`/`) está na lista de rotas permitidas do perfil

## Manutenção

### Ao criar um novo perfil de usuário:

1. Adicionar o novo role em `lib/types/business.ts`:
```typescript
export type UserRole = 'developer' | 'admin' | 'buyer' | 'agent' | 'manager' | 'novo-perfil';
```

2. Adicionar as rotas permitidas em `lib/accessControl.ts`:
```typescript
export const ALLOWED_ROUTES: Record<UserRole, string[]> = {
  // ...
  'novo-perfil': [
    '/',
    '/perfil',
    // outras rotas...
  ],
};
```

3. Atualizar os itens do menu em `components/Sidebar.tsx` se necessário

---

**Última atualização**: 2024-12-25
**Versão**: 1.0
