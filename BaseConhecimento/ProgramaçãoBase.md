Excelente. Vamos transformar sua base de conhecimento em um **prompt técnico, estratégico e extremamente claro**, pronto para ser entregue a uma LLM para auditoria arquitetural e possível refatoração para **Event Driven Architecture (EDA)** 🚀

Abaixo está o prompt estruturado de forma profissional.

---

# ✅ PROMPT PROFISSIONAL – AUDITORIA E IMPLEMENTAÇÃO DE ARQUITETURA ORIENTADA A EVENTOS

Você deve atuar como um **Arquiteto de Software Sênior especializado em Arquitetura Orientada a Eventos (Event Driven Architecture), Microserviços, DDD e Sistemas Distribuídos de Alta Escalabilidade**.

Sua missão é:

1. **Analisar toda a estrutura do projeto atual**
2. Identificar gargalos arquiteturais
3. Verificar se já existe adoção de programação orientada a eventos
4. Caso exista, avaliar maturidade e oportunidades de melhoria de performance
5. Caso não exista, propor uma estratégia de refatoração estruturada para EDA

Sua análise deve ser técnica, criteriosa e baseada em arquitetura distribuída moderna.

---

## 🔎 FASE 1 – DIAGNÓSTICO ARQUITETURAL COMPLETO

Analise o projeto buscando identificar sinais de:

### 1. Acoplamento Temporal

* Existem cadeias de chamadas HTTP síncronas entre serviços?
* O tempo de resposta final depende da soma de múltiplas chamadas?
* Existem endpoints que disparam chamadas sequenciais para outros serviços?

Explique:

* Onde ocorre bloqueio
* Impacto na latência
* Impacto na experiência do usuário

---

### 2. Fragilidade / Efeito Dominó

* Se um serviço secundário ficar indisponível, o sistema principal falha?
* Existem timeouts frequentes?
* Há retry automático ou circuit breaker implementado?

Descreva:

* Pontos de risco
* Nível de resiliência atual
* Possíveis falhas em cascata

---

### 3. Escalabilidade

* O sistema permite escalar apenas serviços específicos?
* Ou é necessário escalar toda a aplicação?
* Existe desacoplamento real entre domínios?

Avalie:

* Custo operacional em cenário de pico (ex: aumento de 10x no tráfego)
* Gargalos estruturais

---

## 🔄 FASE 2 – VERIFICAÇÃO DE ARQUITETURA ORIENTADA A EVENTOS

Verifique se o sistema já implementa:

* Event Broker (Kafka, RabbitMQ, EventBridge ou similar)
* Publicação de eventos de domínio
* Consumo assíncrono
* Comunicação desacoplada

Se SIM:

* Avalie se a implementação é apenas mensageria simples ou EDA bem modelada
* Analise modelagem de eventos
* Verifique idempotência
* Verifique tratamento de falhas
* Avalie performance do consumidor
* Avalie backlog e filas acumuladas
* Identifique melhorias possíveis

Se NÃO:

* Proponha uma estratégia de migração gradual
* Identifique quais fluxos devem ser convertidos primeiro
* Priorize áreas com maior gargalo

---

## 🧠 FASE 3 – MODELAGEM ORIENTADA A EVENTOS

Caso seja recomendada refatoração, siga as seguintes diretrizes:

### 1. Transformar Comandos em Eventos

Migrar de modelo imperativo:

```
Pedido → chama Estoque → chama Notificação → chama Fiscal
```

Para modelo reativo:

```
Pedido cria evento → Serviços interessados reagem
```

---

### 2. Definir claramente:

* Quais eventos de domínio devem existir
* Quais serviços são produtores
* Quais serviços são consumidores
* Quais eventos são intermediários

Exemplo de modelagem esperada:

* `PedidoCriado`
* `PagamentoConfirmado`
* `NotaFiscalEmitida`
* `PedidoFinalizado`

Cada evento deve conter:

* Nome claro
* Payload estruturado
* Identificador único
* Timestamp
* Versão do evento

---

### 3. Regras obrigatórias

* Serviço produtor não pode conhecer consumidor
* Comunicação exclusivamente via broker
* Eventos devem representar fatos do passado
* Implementar idempotência nos consumidores
* Garantir eventual consistency

---

## 📈 FASE 4 – PERFORMANCE E RESILIÊNCIA

Analise e proponha melhorias envolvendo:

* Uso de filas como buffer de carga
* Dead Letter Queue
* Retry exponencial
* Circuit Breaker
* Observabilidade (logs estruturados + tracing)
* Monitoramento de lag do consumidor
* Auto scaling baseado em fila

---

## 🧩 FASE 5 – DDD E LIMITES DE CONTEXTO

Avalie:

* Existem Bounded Contexts bem definidos?
* Há invasão de responsabilidades?
* Serviços compartilham banco de dados?

Se necessário:

* Proponha separação por domínio
* Sugira reorganização arquitetural
* Sugira Event Storming como técnica de mapeamento

---

## ✅ CHECKLIST FINAL DE VALIDAÇÃO

Responda objetivamente:

1. Se o serviço de Nota Fiscal cair, pedidos continuam funcionando?
2. É possível adicionar um novo serviço consumidor sem alterar código do produtor?
3. O broker está absorvendo picos de carga?
4. O banco de dados deixou de ser gargalo?
5. Existe desacoplamento real ou apenas divisão artificial?

---

## 📌 RESULTADO ESPERADO DA SUA RESPOSTA

Sua resposta deve conter:

1. Diagnóstico técnico detalhado
2. Pontos de melhoria claros
3. Proposta de arquitetura (se necessário)
4. Fluxo de eventos recomendado
5. Estratégia de migração (se aplicável)
6. Avaliação de impacto em performance
7. Avaliação de complexidade operacional

Se o sistema for pequeno ou não justificar EDA, explique tecnicamente por que NÃO deve ser aplicado.



# 🎯 Objetivo Estratégico

Garantir que a arquitetura seja:

* Escalável
* Resiliente
* Desacoplada
* Orientada a domínio
* Otimizada para performance
* Preparada para crescimento de times distribuídos


