# 📊 Monitoramento de Atrasos em Checklists

## 🎯 Objetivo

Implementar um sistema automático de detecção e monitoramento de atrasos nas execuções de checklists, baseado no `estimatedDuration` (tempo estimado) configurado em cada template.

---

## 🔧 Como Funciona

### **1. Tempo Estimado (`estimatedDuration`)**

Quando um template de checklist é criado, o administrador pode configurar:
- **Tempo Estimado de Execução**: Duração esperada em minutos (ex: 30 minutos)

Este valor é copiado automaticamente para cada execução criada a partir deste template.

### **2. Detecção Automática de Atrasos**

O sistema detecta atrasos automaticamente quando:

```
Tempo Decorrido > Tempo Estimado
```

**Cálculo:**
```typescript
const startedAt = new Date(execution.startedAt);
const now = new Date();
const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

if (elapsedMinutes > execution.estimatedDuration) {
  // Marcar como atrasado
  status = 'overdue';
}
```

### **3. Quando a Verificação Acontece**

A detecção de atrasos ocorre automaticamente em 3 momentos:

#### **A) Ao Listar Execuções (GET /api/checklist-executions)**
- Toda vez que a página de checklists é carregada
- Verifica TODAS as execuções `in_progress`
- Atualiza automaticamente as que ultrapassaram o tempo

#### **B) Ao Buscar Execução Individual (GET /api/checklist-executions/[id])**
- Ao abrir detalhes de uma execução específica
- Verifica se está atrasada e atualiza

#### **C) Ao Atualizar Execução (PATCH /api/checklist-executions/[id])**
- Quando o usuário mobile envia respostas
- Verifica antes de salvar a atualização
- Previne que uma execução atrasada seja salva como `in_progress`

---

## 📋 Estados da Execução

| Status | Descrição | Quando Ocorre |
|--------|-----------|---------------|
| `scheduled` | Agendado | Execução criada mas ainda não iniciada |
| `in_progress` | Em Andamento | Execução iniciada e dentro do prazo |
| `overdue` | Atrasado | Tempo decorrido > Tempo estimado |
| `completed` | Concluído | Execução finalizada com sucesso |
| `cancelled` | Cancelado | Execução cancelada pelo usuário |

---

## 🎨 Indicadores Visuais

### **Na Página de Listagem (/checklists)**

Para execuções `in_progress` ou `overdue`, um painel mostra:

```
┌─────────────────────────────────────────┐
│ 🕒 Tempo de Execução                    │
│                                         │
│ 45 / 30 min           [Vermelho/Laranja]│
│ ⚠️ Atrasado em 15 minutos               │
└─────────────────────────────────────────┘
```

**Cores:**
- 🟢 **Verde**: 0-80% do tempo (tudo OK)
- 🟠 **Laranja**: 80-100% do tempo (perto de atrasar)
- 🔴 **Vermelho**: >100% do tempo (atrasado)

**Exemplo:**
- Template configurado com 30 minutos
- Execução iniciada há 45 minutos
- **Resultado**: "Atrasado em 15 minutos" (vermelho pulsante)

---

## 💾 Estrutura de Dados

### **ChecklistTemplate**

```typescript
interface ChecklistTemplate {
  // ... outros campos
  estimatedDuration?: number; // Em minutos (ex: 30)
  // ... outros campos
}
```

### **ChecklistExecution**

```typescript
interface ChecklistExecution {
  // ... outros campos
  estimatedDuration?: number; // Copiado do template ao criar
  startedAt?: string;         // Timestamp de quando iniciou
  status: ExecutionStatus;    // 'scheduled' | 'in_progress' | 'overdue' | 'completed' | 'cancelled'
  // ... outros campos
}
```

---

## 🔄 Fluxo Completo

### **1. Criação do Template**
```
Admin configura:
├── Nome: "Checklist de Abertura"
├── Tipo: "opening"
└── Tempo Estimado: 30 minutos ✅
```

### **2. Criação da Execução (Mobile)**
```
POST /api/checklist-executions
{
  templateId: "template123",
  userId: "user456",
  storeId: "store789"
}

Resposta:
{
  id: "exec001",
  estimatedDuration: 30, ← Copiado do template
  status: "scheduled",
  progress: 0
}
```

### **3. Início da Execução (Mobile)**
```
PATCH /api/checklist-executions/exec001
{
  status: "in_progress"
}

Sistema automaticamente adiciona:
- startedAt: "2025-12-07T10:00:00Z" ✅
```

### **4. Monitoramento Contínuo (Web)**
```
GET /api/checklist-executions

Sistema verifica automaticamente:
├── Tempo Iniciado: 10:00
├── Tempo Atual: 10:45
├── Tempo Decorrido: 45 minutos
├── Tempo Estimado: 30 minutos
└── ❌ ATRASADO! (45 > 30)

Sistema atualiza automaticamente:
- status: "overdue" ✅
- updatedAt: "2025-12-07T10:45:00Z"
```

### **5. Dashboard Atualizado**
```
Dashboard mostra:
├── KPI "Atrasados": 1 ← Incrementado
├── Insight: "Existem 1 checklist(s) atrasado(s)"
└── Lista: Execução com badge vermelho "Atrasado"
```

---

## 📊 KPIs e Métricas

### **Insights Automáticos**

O dashboard gera insights baseados em atrasos:

1. **Checklists Atrasados**
   ```
   ⚠️ Existem 3 checklist(s) atrasado(s) que precisam de atenção imediata.
   ```

2. **Tempo Médio de Execução**
   ```
   ℹ️ Tempo médio de execução: 42 minutos (estimado: 30 min)
   Considere revisar o tempo estimado dos templates.
   ```

### **Filtros Disponíveis**

Na página `/checklists`, você pode filtrar por:
- ✅ **Todos**
- 📅 **Agendados**
- ⏱️ **Em Andamento**
- ✅ **Concluídos**
- 🚨 **Atrasados** ← Novo filtro

---

## 🔔 Notificações (Futuro)

### **Em Desenvolvimento:**

1. **Email Automático**
   - Quando execução atingir 90% do tempo
   - Quando execução ficar atrasada

2. **Push Notification (Mobile)**
   - Alerta no app mobile do responsável
   - "Seu checklist está perto de atrasar"

3. **Webhook**
   - Notificar sistemas externos quando houver atraso

---

## 🛠️ Arquivos Modificados

### **Backend (API)**

1. **`lib/types/checklist.ts`**
   - Adicionado `estimatedDuration` em `ChecklistExecution`

2. **`app/api/checklist-executions/route.ts`**
   - Função `checkAndUpdateOverdue()` - Verifica atrasos
   - Copia `estimatedDuration` do template ao criar execução
   - Verifica atrasos automaticamente no GET

3. **`app/api/checklist-executions/[id]/route.ts`**
   - Função `checkOverdueStatus()` - Verifica atrasos
   - Verifica atrasos ao buscar execução individual
   - Verifica atrasos ao atualizar execução

### **Frontend (Interface)**

4. **`app/checklists/page.tsx`**
   - Adicionado painel de "Tempo de Execução"
   - Indicador visual com cores (verde/laranja/vermelho)
   - Mensagem "Atrasado em X minutos" ou "Restam X minutos"
   - Ícone pulsante quando atrasado

---

## 📈 Testes Recomendados

### **Teste 1: Execução Normal**
1. Criar template com 5 minutos de duração
2. Iniciar execução no mobile
3. Aguardar 3 minutos
4. Abrir dashboard web
5. ✅ **Esperado**: Status "Em Andamento" (laranja), "Restam 2 minutos"

### **Teste 2: Detecção de Atraso**
1. Criar template com 5 minutos de duração
2. Iniciar execução no mobile
3. Aguardar 7 minutos
4. Abrir dashboard web
5. ✅ **Esperado**: Status "Atrasado" (vermelho), "Atrasado em 2 minutos"

### **Teste 3: Atualização Automática**
1. Ter execução em andamento há 3 minutos (tempo estimado: 5 min)
2. Abrir dashboard (mostra "Restam 2 minutos")
3. Aguardar 3 minutos SEM recarregar
4. Recarregar página
5. ✅ **Esperado**: Status mudou para "Atrasado"

### **Teste 4: KPI de Atrasados**
1. Ter 3 execuções atrasadas
2. Abrir dashboard
3. ✅ **Esperado**: Card "Atrasados" mostra "3"
4. ✅ **Esperado**: Insight "Existem 3 checklist(s) atrasado(s)..."

---

## 🚀 Benefícios

### **Para Gerentes:**
- ✅ Visibilidade em tempo real de atrasos
- ✅ KPIs automáticos para tomada de decisão
- ✅ Identificação de gargalos operacionais
- ✅ Relatórios mais precisos

### **Para Agentes:**
- ✅ Feedback visual do tempo restante
- ✅ Senso de urgência quando perto de atrasar
- ✅ Melhor gestão do próprio tempo

### **Para o Sistema:**
- ✅ Dados para otimização de processos
- ✅ Histórico de performance
- ✅ Base para melhoria contínua

---

## 📝 Logs do Sistema

O sistema gera logs informativos:

```bash
# Ao detectar atraso
✅ Execução exec001 marcada como atrasada (45 min / 30 min)

# Ao atualizar status
✅ Execução exec001 marcada como atrasada ao buscar

# Ao atualizar via PATCH
✅ Execução exec001 marcada como atrasada ao atualizar (47 min / 30 min)
```

---

## 🎯 Próximos Passos

### **Melhorias Futuras:**

1. **Dashboard de Tendências**
   - Gráfico de atrasos por dia/semana/mês
   - Análise de padrões (quais templates atrasam mais)

2. **Ajuste Automático de Duração**
   - Sistema aprende com histórico
   - Sugere novo `estimatedDuration` baseado em média real

3. **Escalonamento Automático**
   - Se atraso > 50%, notificar supervisor
   - Se atraso > 100%, notificar gerente

4. **Relatório de Eficiência**
   - Comparar tempo estimado vs tempo real
   - Identificar templates com estimativa incorreta

---

**Data de Implementação**: 2025-12-07
**Versão**: 1.0
**Status**: ✅ Implementado e Funcional
