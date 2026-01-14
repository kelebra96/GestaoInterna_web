# Integração IA - Documentação do MVP e próximos passos

**Resumo:**

- **Objetivo:** adicionar um assistente IA que recebe chamados de usuários, gera insights e propostas de visualização/código e permite que desenvolvedores aprovem as propostas para transformá-las em mudanças reais (PRs) posteriormente.
- **Visão geral do status atual:** MVP implementado com criação/listagem de chamados, integração com OpenAI (respostas estruturadas) e fluxo básico de aprovação por desenvolvedor. A automação de PRs foi planejada e está em progresso.

**O que foi implementado (MVP)**

- API de chamados
  - `app/api/chamados/route.ts` - endpoints `GET` (lista ou ?id=) e `POST` (criar chamado).
- API IA
  - `app/api/ai/route.ts` - chama OpenAI pedindo resposta estruturada (JSON) com chaves sugeridas: `insights`, `visualizations`, `codePatches` (opcional). Salva resultado em `proposal.structured` do documento do chamado.
- Endpoint de aprovação
  - `app/api/chamados/approve/route.ts` - endpoint `POST` que marca um chamado como `approved`, salva `approvedBy`/`approvedAt` e agora valida server-side se o `approverId` tem `role === 'developer'` na coleção `users`.
- Endpoint de PR automático (opção A)
  - `app/api/chamados/pr/route.ts` - endpoint `POST` que, para chamados aprovados, lê `proposal.structured.codePatches`, cria branch `ia/chamado-<id>`, aplica os patches via GitHub API, faz commit e abre PR em `GITHUB_REPO` usando `GITHUB_TOKEN`. Falha se os envs não estiverem configurados, se não houver `codePatches` ou se a branch já existir.
- Frontend (Next.js)
  - `components/SupportRequestForm.tsx` - formulário cliente para criação de chamados.
  - `components/SupportRequestsList.tsx` - listagem de chamados, botão para pedir geração IA, exibição de proposta estruturada (insights e visualizações) e botão de aprovação visível para usuários com `role === 'developer'`.
  - `app/chamados/page.tsx` - página que agrega formulário e lista.

**Arquivos alterados / adicionados**

- Adicionados:
  - `app/api/chamados/route.ts`
  - `app/api/chamados/approve/route.ts`
  - `app/api/ai/route.ts`
  - `components/SupportRequestForm.tsx`
  - `components/SupportRequestsList.tsx`
  - `app/chamados/page.tsx`
  - `INTEGRAÇÃO_IA.md` (este arquivo)

**Como funciona (fluxo resumido)**

1. Usuário abre um chamado via UI (`/chamados`) - gravado na coleção `chamados` do Firestore.
2. Usuário (ou um desenvolvedor) solicita que a IA gere uma proposta chamando `POST /api/ai` com `chamadoId`.
3. Backend solicita à OpenAI um JSON estruturado contendo insights e especificações de visualização; resultado é salvo em `chamados/{id}.proposal.structured`.
4. Desenvolvedor com role `developer` pode revisar a proposta na UI e clicar em **Aprovar proposta** (`POST /api/chamados/approve`). O servidor grava `status: 'approved'`, `approvedBy` e `approvedAt`.
5. Próximo passo planejado: usar `proposal.structured.codePatches` (quando houver) para criar branch + commit + PR automaticamente via GitHub API (futuro endpoint `/api/chamados/pr`).

**Variáveis de ambiente necessárias**

- `OPENAI_API_KEY` - chave da OpenAI (já adicionada em seu `.env.local`).
- Para Firebase Admin (ambiente local):
  - `serviceAccountKey.json` na raiz do projeto (ou configurar): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- Para automação de PRs (opção A):
  - `GITHUB_TOKEN` - token com permissões `repo` (ou `public_repo` para repositórios públicos).
  - `GITHUB_REPO` - string `owner/repo` onde criar branches/PRs.

**Como testar localmente**

1. Verifique que `OPENAI_API_KEY` está em `.env.local`.
2. Garanta que o Firebase Admin tenha credenciais (arquivo `serviceAccountKey.json` ou variáveis de ambiente adequadas).
3. Inicie a aplicação Next.js:

```
npm install
npm run dev
```

4. Acesse `http://localhost:3000/chamados` (usuário precisa estar autenticado). Crie um chamado, clique em **Gerar proposta IA** e aguarde a resposta.

**Decisões de design e segurança tomadas**

- Respostas da IA solicitadas como JSON estruturado para facilitar parsing e evitar interpretações ambíguas.
- Não há automatismo de merge: nenhuma mudança de código é aplicada automaticamente. Isso evita riscos de produção. A aprovação apenas marca o chamado como `approved`.
- Botão de aprovação no frontend só aparece para usuários com `role === 'developer'` (checagem client-side) **e** o endpoint `approve` faz validação server-side da role na coleção `users`.

**Próximos passos recomendados (prioridade)**

1. Melhorar o prompt/controle de qualidade para IA: validar e sanitizar `visualizations.spec` (ex.: validar JSON Vega-Lite) e testar código sugerido em um sandbox.
2. Adicionar CI que rode lint/test/preview build automaticamente para cada PR gerado (GitHub Actions + Vercel Preview).
3. Implementar trilha de auditoria completa (quem gerou, quem aprovou, custo da chamada IA, logs do LLM).

**Notas finais**

- Arquivos e endpoints adicionados foram pensados para ser um MVP seguro e observável. As próximas etapas focam em automação controlada e segurança (server-side checks, CI, preview deploys).

Fim do documento
