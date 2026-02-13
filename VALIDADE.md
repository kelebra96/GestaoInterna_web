# MISSÃO (Você é um Arquiteto de Dados + Engenheiro de Analytics + UI/UX Designer)
Você vai implementar um módulo NOVO na versão WEB (já existente) do sistema, focado em **análise gerencial e tomada de decisão** sobre o processo de “itens próximos do vencimento”.
Stack obrigatória:
- **Next.js (web)**
- **Supabase Cloud** (Postgres + Auth + RLS + Storage + Views/Materialized Views + Edge Functions/Cron)
O sistema MOBILE já registra ocorrências (barcode, validade, foto, quantidade, store_id inferido). A WEB deve consumir esses dados e produzir **KPIs, gráficos e insights dinâmicos**.
Você DEVE seguir a paleta/tema do app web existente (tokens já definidos). Não inventar cores.

---

# REGRAS NÃO NEGOCIÁVEIS
1) **Sem breaking changes**: esta é uma feature nova, modular e plugável na aplicação web existente.
2) **UI/UX premium**: dashboard “executivo” e “operacional” com filtros, drill-down e estados vazios.
3) **Performance**: não faça queries gigantes no client. Use Views e/ou Materialized Views para agregados.
4) **Segurança (RLS)**:
   - Usuário comum: vê somente dados da loja dele (detalhado).
   - Perfis de gestão (admin/prevenção/compras): podem ver rede inteira (detalhado) conforme role.
   - O feed público (rede) expõe apenas os campos permitidos (barcode, foto, validade). A WEB analytics pode ser detalhada por role.
5) **Timezone/formatos BR**: America/Sao_Paulo, datas dd/mm/aaaa, pt-BR.
6) **Entrega deve vir com**: SQL (schema/views/policies), código (Next.js), serviços de consulta, e roteiro de testes.

---

# CONTEXTO DO NEGÓCIO (o que medir)
O painel deve responder 3 perguntas:
1) Qual é o risco agora? (itens vencendo hoje/amanhã/semana, concentração por loja/SKU)
2) Estamos resolvendo antes de vencer? (eficácia e SLA)
3) Onde está o gargalo e qual ação tomar? (priorização por loja/SKU/tempo)

---

# DADOS DISPONÍVEIS (assuma e confirme no schema)
Você deve inspecionar o banco existente. Espera-se (ajuste se os nomes forem diferentes):
- stores (lojas)
- profiles (user_id, store_id, role)
- products (barcode, descrição, categoria, preço/custo se existir)
- expiry_reports (ou expiry_batches): store_id, product_id/barcode, quantity, expiry_date, photo_path, status, created_by, created_at
- user_report_actions: user_id, report_id, action (watch/confirmed/ignored), created_at
- notifications_log (se existir)

IMPORTANTE:
- A VIEW pública da rede deve expor SOMENTE: barcode, foto, data de vencimento (e created_at ou id técnico).
- Os dados detalhados ficam disponíveis somente por permissões e RLS.

---

# OBJETIVO (ENTREGÁVEL DO MÓDULO WEB)
Criar um módulo “Analytics Vencimentos” com:
1) **Dashboard Geral (rede)**: KPIs executivos + tendência + rankings + pareto
2) **Dashboard por Loja**: scorecard, tendência, backlog e SLA
3) **Funil de Ação (processo)**: Reportado → Marcado → Confirmado → Resolvido
4) **Qualidade/Auditoria**: sem foto, duplicados, validade incoerente, edições suspeitas (se houver histórico)
5) **Insights automáticos**: gerados por regras determinísticas (sem alucinação)

Tudo com filtros:
- período (7/14/30/90 dias e custom)
- loja (se role permitir)
- status (open/resolved/canceled)
- janela de vencimento (D0, D1, D3, D7, vencidos)
- categoria/marca (se existir)

---

# KPIs OBRIGATÓRIOS (com fórmulas)
Você deve implementar pelo menos estes KPIs:

## Risco & Backlog
- Itens D0 (vence hoje): count(expiry_date = today AND status='open')
- Itens D1: count(expiry_date = today+1 AND status='open')
- Itens D7: count(expiry_date <= today+7 AND status='open')
- Vencidos abertos: count(expiry_date < today AND status='open')

## Eficácia
- % resolvido antes do vencimento:
  resolved_before = count(status='resolved' AND resolved_at::date <= expiry_date)
  resolved_total  = count(status='resolved')
  KPI = resolved_before / nullif(resolved_total,0)

- Overdue rate:
  overdue_open = count(status='open' AND expiry_date < today)
  open_total   = count(status='open')
  KPI = overdue_open / nullif(open_total,0)

## SLA
- Tempo mediano de resolução (P50) e P90:
  percentile_cont(0.5/0.9) of (resolved_at - created_at) para status='resolved'
- Tempo até 1ª ação:
  first_action_at - created_at (min action por report)

## Recorrência
- Top SKUs por recorrência (últimos 30 dias):
  count(*) group by barcode/product_id order by desc

## Engajamento da Rede
- Watch rate: count(actions='watch') / count(reports no período)
- Confirm rate: count(actions='confirmed') / count(reports no período)
- Tempo até confirmação: confirmed_at - report_created_at (mediana)

## (Opcional se existir preço/custo)
- R$ em risco:
  sum(quantity * unit_price) para status='open' e expiry_date <= today+7
- R$ recuperado:
  sum(quantity * unit_price) para status='resolved' antes do vencimento

---

# ARQUITETURA DE CONSULTA (performance)
Você DEVE criar:
1) Views para consultas “diretas”
2) Materialized Views (MV) para agregados e rankings
3) Um job (cron) para refresh das MVs (diário ou a cada 1h conforme volume)

Sugestão de MVs (ajuste nomes):
- mv_expiry_daily (dia, loja, status, counts, overdue, d0/d1/d7)
- mv_store_scorecard (loja, KPIs principais, P50/P90)
- mv_top_skus_30d (sku, ocorrencias, lojas afetadas)
- mv_funnel_metrics (reportado, watch, confirmed, resolved)

---

# RLS / PERMISSÕES (obrigatório)
Você deve implementar RLS garantindo:
- User comum: vê detalhado apenas da sua store_id.
- Admin/Prevenção/Compras: pode ver rede inteira detalhada.
- View pública da rede: qualquer authenticated lê, mas só colunas permitidas.
- Policies devem ser testadas com 2 usuários de lojas diferentes.

---

# UI/UX (padrão executivo)
Você deve seguir o design system existente:
- Identificar tokens de cor, spacing, radius, shadows, typography.
- Usar componentes já adotados (ex.: shadcn/ui, tailwind, etc.)

Componentes obrigatórios:
- KPI Cards (com variação vs período anterior)
- Line/Area chart (tendência)
- Bar chart (rankings)
- Pareto chart (Top SKUs)
- Funnel chart (processo)
- DataTable com filtros e drill-down
- Export CSV
- Empty states e Skeletons

---

# ENTREGÁVEIS (formato de resposta)
Responda produzindo:

## 1) Plano de implementação (etapas)
- etapas curtas, ordem correta, riscos e cuidados

## 2) SQL completo
- criação/ajuste de tabelas necessárias (se faltar resolved_at etc.)
- views e materialized views
- índices
- RLS policies
- funções/trigger se necessário

## 3) Backend/Services (Next.js + Supabase)
- funções de consulta com paginação e filtros
- camada “repository” para queries
- validação de role no server (server actions/API routes)

## 4) Frontend (Next.js)
- rotas/páginas do módulo analytics
- componentes reutilizáveis
- filtros globais e estado (URL query string)
- gráficos (use a lib já existente no projeto; se não existir, sugerir Recharts)

## 5) Job de refresh e (opcional) insight generator
- Edge Function + cron para refresh MV
- rotinas de insights determinísticos (regras) e como armazenar/cachear

## 6) Testes e checklist de validação
- testes de policies RLS
- testes de queries (MV vs view)
- testes de UI (loading/empty/filtro/drilldown)
- testes de performance (tempo de resposta)

---

# IMPORTANTE
Não escreva resposta genérica. Entregue código e instruções práticas, organizadas por arquivos e por blocos SQL.
Antes de escolher nomes de tabelas/colunas, verifique o schema existente e adapte com o mínimo de mudanças.
