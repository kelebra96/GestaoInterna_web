Você é um(a) Staff Software Engineer com experiência em Next.js, Supabase (Postgres + Storage), ETL/Jobs, observabilidade, e integração com OpenAI API.
Meu sistema é um editor de planograma e eu preciso implementar um pipeline automático para preencher imagens faltantes de produtos.

⚠️ Regras anti-alucinação (obrigatório):

Não invente APIs, endpoints, campos ou tabelas. Se algo não estiver definido, proponha e peça para eu confirmar os nomes exatos.

Não implemente scraping por navegador como primeira solução. Deve seguir a sequência definida abaixo.

Não salve imagens “hotlinkadas” sem controle. Sempre registrar origem, confiança e permitir revisão humana.

Sempre retornar uma implementação que funcione no meu ambiente: Next.js em VPS + Supabase Cloud.

1) Contexto do ambiente (real)

Frontend: Next.js (App Router ou Pages Router — detectar no projeto)

Backend: Next.js API routes / Route Handlers (rodando na VPS)

Banco e Storage: Supabase Cloud (Postgres + Supabase Storage)

LLM: OpenAI API já integrada na aplicação, e existe a rota/view: /monitoramento

2) Objetivo do recurso

Implementar um pipeline de enriquecimento de catálogo que:

encontra produtos sem imagem;

busca uma imagem de forma confiável;

valida e atribui score;

salva a imagem no Supabase Storage;

atualiza o banco com metadados;

e encaminha casos incertos para revisão humana no /monitoramento.

3) Sequência obrigatória (NÃO mudar a ordem)
Etapa 1 — Open Food Facts por EAN (rápido, barato, preciso)

Para cada produto sem imagem, consultar o Open Food Facts usando o EAN/GTIN.

Se existir imagem válida, utilizar como candidato principal.

Registrar source = openfoodfacts.

Etapa 2 — OpenAI para validação/score + melhoria de query

Usar OpenAI para:

validar se a imagem candidata corresponde ao produto (match visual/textual);

gerar um confidence score (0–1);

extrair atributos do nome (marca, sabor, volume) para montar queries melhores (para etapa 3).

Se score >= limite (ex.: 0.80), aprovar automaticamente.

Etapa 3 — Busca externa via API oficial (somente depois)

Somente se OFF falhar OU confidence baixo:

usar um serviço oficial de busca (ex.: Bing Image Search API ou Google Custom Search API).

Buscar 5–10 candidatos, ranquear com OpenAI e selecionar o melhor se score >= limite.

Registrar source = search_api.

Etapa 4 — Browser headless como última camada + revisão humana

Apenas se ainda falhar:

marcar como needs_review.

(Opcional) disponibilizar modo assistido: abrir links sugeridos para o operador escolher.

Browser headless (Playwright/Puppeteer) só entra aqui, e com fallback de revisão humana.

Registrar source = browser ou manual.

4) Modelagem e governança (Supabase)

Criar ou ajustar tabelas no Postgres (Supabase), com foco em rastreabilidade.

4.1 Tabela products (ou equivalente)

Adicionar colunas (se não existirem):

image_url (url final no Storage)

image_status enum: ok | missing | fetching | needs_review | error

image_source enum: openfoodfacts | search_api | browser | manual

image_confidence numeric (0–1)

image_updated_at timestamp

image_candidate_urls jsonb (opcional, para auditoria)

ean (garantir que exista e esteja normalizado)

⚠️ Se o projeto já tem tabela, não sobrescrever; mapear para nomes reais.

4.2 Tabela image_jobs (fila simples)

Criar uma tabela para controlar jobs (para evitar concorrência e permitir retomada):

id uuid

product_id

status enum: queued | running | done | failed

attempts int

last_error text

created_at, updated_at

4.3 Supabase Storage

Criar bucket: product-images

salvar imagens com caminho padronizado: products/{product_id}/main.jpg

gerar thumbnails (opcional) thumb_256.jpg

5) Implementação no Next.js (VPS)

Implementar os componentes do pipeline:

5.1 Serviço de backfill

Criar um serviço que:

seleciona produtos com image_status in ('missing','error') e ean válido.

cria registros em image_jobs (idempotente).

processa em lote com limite e controle de concorrência (ex.: 5 simultâneos).

executa a sequência OFF → OpenAI → Search API → needs_review.

5.2 Endpoint API para disparo manual (via /monitoramento)

Criar rota:

POST /api/images/backfill?limit=50
Retorno:

quantos processados, quantos ok, quantos needs_review, quantos error.

5.3 Endpoint para revisar e aprovar manualmente

Criar rotas:

GET /api/images/review (lista pendentes)

POST /api/images/approve (aprovar URL escolhida e persistir no Storage)

POST /api/images/reject (rejeitar candidatos e marcar error/needs_review)

6) Open Food Facts (detalhes técnicos)

Usar endpoint público por EAN:
https://world.openfoodfacts.org/api/v0/product/{EAN}.json

Extrair campos:

image_front_url (preferência)

fallback: image_url / outros disponíveis

Validar:

URL não vazia

tipo de arquivo aceitável (jpg/png/webp)

7) OpenAI (detalhes técnicos)

Usar OpenAI para:

score de correspondência: dado nome, marca (se houver), EAN, e imagem candidata (baixar e enviar como base64) → retornar:

match: true/false

confidence: 0..1

reason curto

melhoria de query (quando OFF falhar): gerar 2–3 queries:

"EAN {ean} {marca} {produto}"

"{marca} {produto} {volume} embalagem"

"{produto} {sabor} {gramatura} foto produto"

⚠️ OpenAI não deve buscar na internet. Ela só gera texto e faz validação/score.

8) Busca externa (API oficial)

Escolher UM provedor (propor e deixar configurável por env):

Ex.: Bing Image Search API (Azure) OU Google Custom Search API

Retornar lista de URLs candidatas

Ranquear com OpenAI

Baixar a melhor e salvar no Storage se score >= 0.80

9) Browser headless (última camada)

Somente se necessário:

Implementar via Playwright ou Puppeteer

Rodar como job manual (não automático) por riscos e instabilidade

Operador escolhe imagem e aprova pelo painel

10) Segurança, env vars e boas práticas

.env com:

OPENAI_API_KEY

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (somente no server)

IMAGE_SEARCH_API_KEY e config do provedor

Nunca expor service role no client.

Logs estruturados e tratamento de erros.

Idempotência: se image_url já existe e status ok, não reprocessar.

11) Entregáveis obrigatórios

SQL migrations para Supabase (tabelas/colunas necessárias).

Implementação dos serviços e rotas Next.js.

Funções isoladas e testáveis:

fetchFromOpenFoodFacts(ean)

scoreImageWithOpenAI(product, imageBytes)

searchImages(provider, query)

persistImageToSupabaseStorage(productId, bytes)

UI no /monitoramento:

botão “Backfill imagens”

lista “needs_review” com ações Aprovar/Rejeitar

progresso e contadores

12) Critérios de aceite (não negociar)

Pipeline segue estritamente a ordem: OFF → OpenAI → Search API → Headless/Review

Nenhuma imagem é salva sem source, confidence, updated_at

Casos incertos vão para needs_review

O sistema é resiliente (retoma jobs, não duplica processamento)

Não existe scraping automático como primeira opção.

Perguntas finais (somente se indispensáveis)

Antes de codar, identifique no repositório:

Onde está a tabela de produtos (nome real) e quais campos existem (EAN, nome etc.)

Se o projeto usa App Router ou Pages Router
Se não conseguir identificar, me peça os nomes exatos (sem inventar).

Observações finais minhas (pra você, Rodrigo)

Esse prompt vai segurar a LLM no trilho e evitar “inventar internet”.

Você já tem /monitoramento → excelente para virar o painel de backfill/review.

Se você quiser MVP rápido, dá pra começar só com:

OFF por EAN + salvar no Storage + needs_review
E depois plugar OpenAI score e Search API.