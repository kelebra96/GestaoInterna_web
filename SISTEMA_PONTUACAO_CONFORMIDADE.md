# 📊 Sistema de Pontuação e Conformidade

## 🎯 Objetivo

Implementar um sistema profissional de avaliação operacional que permite:
- **Pontuação por pergunta**: Cada pergunta pode valer pontos (ex: 10 pontos)
- **Verificação de Conformidade**: Perguntas podem ser marcadas como "Conforme" ou "Não Conforme"
- **Análise de Eficiência**: Calcular percentuais de pontuação e conformidade
- **Identificação de Deficiências**: Rastrear número de não conformidades (NC)

Este sistema torna a análise operacional mais profissional e permite identificar claramente onde estão os problemas.

---

## 🔧 Como Funciona

### **1. Configuração no Template**

Ao criar um template de checklist, para cada pergunta você pode configurar:

#### **A) Pontuação (Opcional)**
- Campo numérico de 0 a 100 pontos
- Define quanto vale aquela pergunta
- **Exemplo**: "Temperatura do freezer está adequada?" = 10 pontos

#### **B) Verificação de Conformidade (Opcional)**
- Checkbox para marcar a pergunta como verificação de conformidade
- Quando ativado, permite configurar a **resposta esperada**

#### **C) Resposta Esperada (para Conformidade)**

Varia conforme o tipo de pergunta:

**Sim/Não (yes_no):**
```
□ Sim (Conforme quando resposta = Sim)
□ Não (Conforme quando resposta = Não)
```

**Múltipla Escolha:**
```
Selecione qual opção é a resposta conforme:
- Opção A
- Opção B
- Opção C
```

**Numérica/Temperatura:**
```
Valores dentro de min/max = Conforme
Valores fora do range = Não Conforme
```

**Texto:**
```
Campo preenchido = Conforme
Campo vazio = Não Conforme
```

**Foto:**
```
Foto anexada = Conforme
Sem foto = Não Conforme
```

**Assinatura:**
```
Assinatura fornecida = Conforme
Sem assinatura = Não Conforme
```

---

## 📐 Lógica de Cálculo

### **1. Conformidade de uma Resposta**

```typescript
// Função: calculateAnswerConformity()
// Retorna: boolean (true = Conforme, false = Não Conforme)

EXEMPLO 1 - Yes/No:
Pergunta: "Piso está limpo?"
Tipo: yes_no
Resposta Esperada: "yes"
Resposta do Usuário: "yes"
→ Resultado: CONFORME ✅

EXEMPLO 2 - Temperatura:
Pergunta: "Temperatura do freezer"
Tipo: temperature
Min: -18°C | Max: -15°C
Resposta do Usuário: -16°C
→ Resultado: CONFORME ✅

Resposta do Usuário: -10°C
→ Resultado: NÃO CONFORME ❌
```

### **2. Pontos Ganhos em uma Resposta**

```typescript
// Função: calculateAnswerPoints()
// Retorna: number (pontos ganhos)

EXEMPLO 1 - Pergunta com Conformidade:
Pontos: 10
É Conformidade: true
Resposta: Conforme
→ Pontos Ganhos: 10 ✅

Resposta: Não Conforme
→ Pontos Ganhos: 0 ❌

EXEMPLO 2 - Pergunta sem Conformidade:
Pontos: 5
É Conformidade: false
Resposta: Qualquer valor
→ Pontos Ganhos: 5 ✅ (sempre ganha se respondeu)
```

### **3. Score e Conformidade da Execução**

```typescript
// Função: calculateExecutionScore()
// Retorna: { score, conformity }

EXEMPLO - Template com 4 perguntas:

Pergunta 1: 10 pontos, Conformidade = Sim (esperado: "yes")
Pergunta 2: 20 pontos, Conformidade = Sim (esperado: temperatura entre -18 e -15)
Pergunta 3: 10 pontos, SEM conformidade
Pergunta 4: 5 pontos, Conformidade = Sim (esperado: foto)

Respostas do Usuário:
Q1: "yes" → Conforme ✅ → 10 pontos
Q2: -16°C → Conforme ✅ → 20 pontos
Q3: "Respondido" → N/A → 10 pontos
Q4: (sem foto) → Não Conforme ❌ → 0 pontos

RESULTADO:
{
  score: {
    totalPoints: 45,
    pointsAwarded: 40,
    percentage: 88  // (40/45)*100
  },
  conformity: {
    totalChecks: 3,        // Q1, Q2, Q4 (Q3 não é conformidade)
    conformChecks: 2,      // Q1, Q2
    nonConformChecks: 1,   // Q4
    percentage: 66         // (2/3)*100
  }
}
```

---

## 💾 Estrutura de Dados

### **ChecklistQuestion** (lib/types/checklist.ts)

```typescript
interface ChecklistQuestion {
  // ... campos existentes

  // Novos campos para pontuação/conformidade:
  points?: number;                    // Pontos que a pergunta vale (0-100)
  isConformityCheck?: boolean;        // Se true, verifica conformidade
  conformityExpectedAnswer?: any;     // Resposta esperada para conformidade
}
```

### **QuestionAnswer** (lib/types/checklist.ts)

```typescript
interface QuestionAnswer {
  // ... campos existentes

  // Novos campos calculados:
  isConform?: boolean;       // Se a resposta está conforme
  pointsAwarded?: number;    // Pontos ganhos nesta resposta
}
```

### **ChecklistExecution** (lib/types/checklist.ts)

```typescript
interface ChecklistExecution {
  // ... campos existentes

  // Novos objetos de score e conformidade:
  score?: {
    totalPoints: number;        // Total de pontos possíveis
    pointsAwarded: number;      // Pontos obtidos
    percentage: number;         // Percentual (0-100)
  };

  conformity?: {
    totalChecks: number;        // Total de verificações de conformidade
    conformChecks: number;      // Verificações conformes
    nonConformChecks: number;   // Verificações não conformes
    percentage: number;         // Percentual de conformidade (0-100)
  };
}
```

---

## 🔄 Fluxo de Cálculo Automático

### **1. Criação do Template**
```
Admin acessa: /checklists/templates/novo
↓
Configura perguntas com pontuação e conformidade
↓
Salva template no Firestore
```

### **2. Execução pelo Mobile**
```
Usuário inicia execução
↓
Responde perguntas
↓
Envia respostas via PATCH /api/checklist-executions/[id]
```

### **3. Cálculo Automático (Backend)**
```
PATCH endpoint recebe answers
↓
Busca template para obter questions
↓
Chama calculateExecutionScore(questions, answers)
↓
Retorna { score, conformity }
↓
Salva score e conformity no Firestore
↓
Retorna execução atualizada
```

### **4. Exibição no Dashboard**
```
GET /api/checklist-executions
↓
Para cada execução SEM score:
  - Recalcula automaticamente (backward compatibility)
↓
Retorna execuções com score/conformity
↓
Dashboard exibe KPIs e métricas
```

---

## 📊 Exibição no Dashboard

### **A) KPIs Principais (Cards no Topo)**

6 cards são exibidos:

1. **Total de Execuções** (azul)
2. **Concluídos** (verde) + taxa de conclusão
3. **Em Andamento** (laranja) + progresso médio
4. **Atrasados** (vermelho)
5. **Pontuação Média** (roxo) 🆕
   - Mostra média de score% de todas execuções
   - Exibe número de avaliações
6. **Conformidade** (ciano) 🆕
   - Mostra média de conformidade%
   - Exibe número total de NC (Não Conformidades)
   - Verde se NC = 0, vermelho se NC > 0

### **B) Insights Inteligentes**

Novos insights automáticos:

**Conformidade Baixa:**
```
⚠️ Conformidade Baixa
Taxa de conformidade em 65%. Identifique e corrija as não conformidades.
```
_Condição: avgConformity < 70% e pelo menos 3 execuções com conformidade_

**Excelente Conformidade:**
```
✅ Excelente Conformidade
Taxa de conformidade em 95%. Padrão de qualidade mantido!
```
_Condição: avgConformity >= 90%_

**Não Conformidades Identificadas:**
```
⚠️ Não Conformidades Identificadas
12 não conformidade(s) detectada(s). Revise os processos operacionais.
```
_Condição: totalNonConformities > 5_

### **C) Cards de Execução Individual**

Cada execução na lista mostra:

```
┌─────────────────────────────────────────┐
│ Checklist de Abertura                   │
│                                          │
│ [Loja] [Responsável] [Data/Hora]        │
│                                          │
│ Progresso: ████████░░ 80%               │
│                                          │
│ ┌──────────────┬──────────────┐         │
│ │ 🎯 Pontuação │ ✅ Conformidade│        │
│ │   85%        │   90%         │        │
│ │ 34/40 pontos │ Sem NC        │        │
│ └──────────────┴──────────────┘         │
└─────────────────────────────────────────┘
```

**Cores da Conformidade:**
- 🟢 Verde: ≥ 80%
- 🟠 Laranja: 60-79%
- 🔴 Vermelho: < 60%

---

## 🛠️ Arquivos Modificados/Criados

### **1. lib/utils/checklistScore.ts** (CRIADO)
Funções de cálculo:
- `calculateAnswerConformity()` - Verifica conformidade de uma resposta
- `calculateAnswerPoints()` - Calcula pontos ganhos
- `calculateExecutionScore()` - Calcula score e conformidade total
- `updateExecutionWithScore()` - Atualiza execução com score

### **2. lib/types/checklist.ts** (MODIFICADO)
Adicionados campos:
- `ChecklistQuestion`: `points`, `isConformityCheck`, `conformityExpectedAnswer`
- `QuestionAnswer`: `isConform`, `pointsAwarded`
- `ChecklistExecution`: `score`, `conformity`

### **3. app/checklists/templates/novo/page.tsx** (MODIFICADO)
Linhas 617-711:
- Seção "Pontuação e Conformidade" na criação de perguntas
- Input para pontuação (0-100)
- Checkbox "Verificação de Conformidade"
- Campo dinâmico para resposta esperada baseado no tipo

### **4. app/api/checklist-executions/[id]/route.ts** (MODIFICADO)
- Import de `calculateExecutionScore` e `ChecklistQuestion`
- Função `recalculateScoreIfNeeded()` para backward compatibility
- PATCH endpoint calcula score ao receber answers
- GET endpoint recalcula score se necessário

### **5. app/api/checklist-executions/route.ts** (MODIFICADO)
- Import de `calculateExecutionScore` e `ChecklistQuestion`
- Função `recalculateScoreIfNeeded()` duplicada aqui
- GET endpoint recalcula scores de execuções antigas

### **6. app/checklists/page.tsx** (MODIFICADO)
Linhas 120-133: Cálculos de métricas
- `executionsWithScore`, `avgScore`
- `executionsWithConformity`, `avgConformity`
- `totalNonConformities`

Linhas 254-277: Novos insights
- Conformidade baixa/excelente
- Não conformidades detectadas

Linhas 330-443: Novos KPIs
- Grid alterado para 6 colunas
- Card "Pontuação Média"
- Card "Conformidade"

Linhas 967-1003: Indicadores nas execuções
- Seção "Score e Conformidade" em cada card
- Exibe pontuação e conformidade com cores dinâmicas

---

## 📈 Exemplos de Uso

### **Caso 1: Checklist de Limpeza**

**Template:**
```
Q1: "Piso foi varrido?" (yes_no, 10 pts, conforme = yes)
Q2: "Piso foi lavado?" (yes_no, 10 pts, conforme = yes)
Q3: "Foto do ambiente limpo" (photo, 5 pts, conforme = foto anexada)
Q4: "Observações" (text, 0 pts, sem conformidade)
```

**Execução 1 (Excelente):**
```
Q1: yes → Conforme ✅ → 10 pts
Q2: yes → Conforme ✅ → 10 pts
Q3: [foto.jpg] → Conforme ✅ → 5 pts
Q4: "Tudo ok" → N/A → 0 pts

Score: 25/25 = 100%
Conformidade: 3/3 = 100%
```

**Execução 2 (Problemas):**
```
Q1: yes → Conforme ✅ → 10 pts
Q2: no → Não Conforme ❌ → 0 pts
Q3: (sem foto) → Não Conforme ❌ → 0 pts
Q4: "" → N/A → 0 pts

Score: 10/25 = 40%
Conformidade: 1/3 = 33%
2 Não Conformidades
```

### **Caso 2: Checklist HACCP (Temperatura)**

**Template:**
```
Q1: "Temp. Freezer A" (temperature, 15 pts, -18 a -15°C)
Q2: "Temp. Freezer B" (temperature, 15 pts, -18 a -15°C)
Q3: "Temp. Geladeira" (temperature, 10 pts, 2 a 4°C)
Q4: "Ação corretiva?" (text, 5 pts, conforme = preenchido)
```

**Execução:**
```
Q1: -16°C → Conforme ✅ → 15 pts
Q2: -12°C → Não Conforme ❌ → 0 pts
Q3: 3°C → Conforme ✅ → 10 pts
Q4: "Freezer B em manutenção" → Conforme ✅ → 5 pts

Score: 30/45 = 66%
Conformidade: 3/4 = 75%
1 Não Conformidade (Freezer B fora do range)
```

---

## 🎨 Interface Visual

### **Cores por Tipo de Métrica:**

**Pontuação (Score):**
- Cor principal: **Roxo** (#9C27B0)
- Background: Gradient roxo claro
- Ícone: Target (🎯)

**Conformidade:**
- Cor principal: **Ciano** (#00BCD4)
- Background: Gradient ciano claro
- Ícone: CheckCircle (✅)
- Cores dinâmicas:
  - Verde: ≥ 80% (conforme)
  - Laranja: 60-79% (atenção)
  - Vermelho: < 60% (crítico)

**Não Conformidades (NC):**
- Cor: **Vermelho** (#E82129)
- Ícone: AlertTriangle (⚠️)

---

## 🚀 Benefícios

### **Para Gerentes:**
- ✅ Visão clara de performance operacional
- ✅ Identificação rápida de problemas (baixa conformidade)
- ✅ Métricas quantificáveis (% de pontos, % de conformidade)
- ✅ Rastreamento de não conformidades por loja/setor
- ✅ Base para auditorias e certificações

### **Para Auditores:**
- ✅ Sistema profissional de avaliação
- ✅ Rastreabilidade de não conformidades
- ✅ Evidências (fotos, assinaturas)
- ✅ Relatórios com métricas objetivas

### **Para o Negócio:**
- ✅ Melhoria contínua (identificar padrões de falha)
- ✅ Compliance com normas (HACCP, ISO, etc.)
- ✅ Redução de riscos operacionais
- ✅ Análise de tendências (conformidade ao longo do tempo)

---

## 🔍 Backward Compatibility

O sistema foi projetado para funcionar com execuções antigas:

**Execuções Antigas (sem score):**
- GET endpoints recalculam automaticamente se:
  - Execução tem respostas (`answers.length > 0`)
  - Execução tem `templateId`
  - Template ainda existe no banco
  - Template tem perguntas configuradas
- Score é calculado e salvo automaticamente
- Processo transparente para o usuário

**Execuções Novas:**
- Score é calculado automaticamente ao responder
- PATCH endpoint calcula na hora do envio
- Sempre atualizado em tempo real

---

## 📝 Logs do Sistema

O sistema gera logs informativos:

```bash
# Ao calcular score no PATCH
✅ Score calculado para execução exec123: 85% pontos, 90% conformidade

# Ao recalcular score automaticamente (GET)
✅ Score recalculado para execução exec123: 85% pontos, 90% conformidade

# Em caso de erro
❌ Erro ao calcular score para execução exec123: [mensagem de erro]
```

---

## 🎯 Próximos Passos

### **Melhorias Futuras:**

1. **Relatórios de Não Conformidades**
   - Página dedicada para listar todas as NC
   - Filtros por loja, setor, gravidade
   - Exportação para PDF/Excel

2. **Planos de Ação**
   - Criar ações corretivas para cada NC
   - Atribuir responsáveis
   - Acompanhar status (pendente/em andamento/resolvido)

3. **Dashboard de Tendências**
   - Gráfico de conformidade ao longo do tempo
   - Comparativo entre lojas
   - Identificação de padrões

4. **Notificações**
   - Email quando conformidade < 60%
   - Push notification para NC críticas
   - Alertas para gestores

5. **Integração Mobile**
   - Sincronizar tipos de `checklist.ts` para mobile
   - Exibir conformidade em tempo real no app
   - Alertas visuais para respostas não conformes

6. **Pesos por Pergunta**
   - Perguntas críticas valem mais pontos
   - Cálculo ponderado de conformidade

7. **Análise Preditiva**
   - Machine learning para prever não conformidades
   - Sugestões de ações preventivas

---

**Data de Implementação**: 2025-12-07
**Versão**: 1.0
**Status**: ✅ Implementado e Funcional

---

## 📚 Referências Técnicas

**Arquivos de Cálculo:**
- `lib/utils/checklistScore.ts` - Lógica de cálculo

**Tipos TypeScript:**
- `lib/types/checklist.ts` - Interfaces

**API Endpoints:**
- `GET /api/checklist-executions` - Lista com score
- `GET /api/checklist-executions/[id]` - Detalhes com score
- `PATCH /api/checklist-executions/[id]` - Atualiza e calcula score

**Dashboard:**
- `app/checklists/page.tsx` - Visualização

**Template Creator:**
- `app/checklists/templates/novo/page.tsx` - Configuração
