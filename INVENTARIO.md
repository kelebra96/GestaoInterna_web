Segue um prompt completo pra você colar em outro assistente 👇

---

**PROMPT PARA GERAR APLICAÇÃO DE INVENTÁRIO WEB + MOBILE**

Quero que você atue como **arquiteto de software fullstack e desenvolvedor sênior** para criar **uma solução completa de INVENTÁRIO** com aplicação **web (gestão/dashboard)** e **mobile (coleta)**.

---

## 1. Stack obrigatória

* **Web (Gestão + Dashboard)**

  * Framework: **Next.js**
  * Linguagem: **JavaScript ou TypeScript** (preferencialmente TypeScript, se possível)
  * Banco de dados: **Firestore (Cloud Firestore)**
* **Mobile (Coleta de produtos)**

  * Framework: **React Native**
  * Linguagem: **JavaScript ou TypeScript**
  * Banco de dados: **Firestore (mesma base da aplicação web)**

Use **boas práticas** de arquitetura, organização de pastas e segurança (separação de camadas, serviços, validação, tratamento de erros, etc.).

---

## 2. Contexto do arquivo TXT (base do inventário)

A base de itens a serem contados vem de um **arquivo .txt** com layout **posicional fixo**, uma linha por produto. A leitura é sempre da esquerda para a direita, com as seguintes posições:

* **Posições 1 a 13** → **Código EAN** (13 dígitos)
* **Posições 15 a 24** → **Código interno** (10 caracteres/dígitos)
* **Posições 25 a 74** → **Descrição do produto**
* **Posições 76 a 83** → **Preço** (para medir valor da divergência em R$)
* **Posições 84 a 92** → **Quantidade de estoque virtual** (para medir divergência de quantidade em unidades)

Após ler o arquivo, deve ser gerada uma **tabela estruturada** com esses campos para que os usuários possam informar/ajustar a **quantidade contada** durante o inventário. No **fechamento do inventário**, deverá ser gerado um novo **arquivo .txt** com o **mesmo layout do arquivo de entrada**, porém com o campo de quantidade substituído pela **quantidade contada** no inventário. 

Também deve ser possível **colar o conteúdo TXT** diretamente em uma área de texto (sem upload de arquivo) e o sistema tratar da mesma forma.

---

## 3. Objetivo geral da solução

Criar **uma aplicação completa de inventário**, com:

* **Web**: gestão de endereços/lotes, usuários, dashboards, monitoramento em tempo real, relatórios e exportação.
* **Mobile**: coleta de produtos em campo (estoque físico) por endereço/lote, com controle de qual usuário está contando o quê.

---

## 4. Funcionalidades obrigatórias (alto nível)

### 4.1. Gerenciamento de Endereços / Lotes

Endereço é composto por:
**Rua, Prédio, Andar, Apartamento** (ou similar) – mas deve ser possível representar em um formato compacto, por exemplo: `A1-01-01`.

Funcionalidades:

* Criar endereços/lotes com diferentes tipos/níveis de detalhamento.
* Listar/visualizar endereços com status (por exemplo: **não iniciado**, **em contagem**, **contado**, **fechado**).
* Remover endereços (apenas se ainda não houver contagem, ou com alguma regra de segurança configurável).

**Regra de negócio importante:**

* **Um usuário só pode coletar 1 endereço por vez.**

  * Se o usuário já tiver um endereço “aberto” (em contagem), ele **não pode abrir outro** enquanto não **fechar** o endereço atual.
  * Essa regra deve ser garantida tanto na **aplicação mobile** quanto no **backend/regra de negócios** (não apenas na interface).

---

### 4.2. Gerenciamento de Usuários e Perfis

Perfis de usuário:

* **Operador**: faz a coleta de produtos (contagem) nos endereços.
* **Supervisor**: acompanha status, pode reabrir endereços, conferir discrepâncias, gerar relatórios parciais.
* **Administrador**: configura usuários, endereços, parâmetros gerais e tem acesso a todos os relatórios/dashboards.

Funcionalidades:

* Cadastro de usuários com:

  * Nome
  * E-mail / login
  * Senha (ou mecanismo de autenticação)
  * Perfil (operador, supervisor, admin)
* Tela de listagem e edição de usuários.
* Controle de acesso nas telas e ações baseado no perfil.

---

### 4.3. Coleta de Produtos (Mobile e Web)

Principalmente **via aplicativo mobile React Native**, mas com possibilidade de visualização/edição também na Web (para ajustes pontuais).

Funcionalidades:

* Selecionar um **endereço/lote** para contagem (respeitando a regra de “1 endereço aberto por usuário”).
* Listar produtos do endereço baseados na **importação do TXT**.
* Para cada produto:

  * Mostrar: **Código EAN, Código interno, Descrição, Quantidade esperada (estoque virtual), Preço**.
  * Campo para digitar ou ajustar a **quantidade contada**.
* Permitir:

  * Marcar produto como **contado**.
  * Navegar facilmente pelos produtos do endereço (por código, por descrição, por ordem da lista).
* A aplicação deve registrar:

  * **Quem contou** (usuário),
  * **Quando contou** (timestamp),
  * **Endereço**,
  * **Quantidade contada**.

---

### 4.4. Importação de Arquivo TXT

Na aplicação **web (Next.js)**:

* Tela para:

  * Fazer **upload de arquivo .txt**.
  * Ou colar o conteúdo do TXT em uma **textarea**.
* Validação:

  * Layout posicional correto por linha.
  * Tamanho esperado de cada campo (EAN, código interno, descrição, preço, estoque virtual).
* Conversão:

  * Converter cada linha em um registro estruturado e salvar no **Firestore**, associando a:

    * Endereço/lote (se já definido)
    * Data de importação
    * Usuário que importou
* Exibir um **preview** dos registros importados antes de confirmar a gravação.

---

### 4.5. Cálculo de Discrepâncias

A aplicação deve calcular automaticamente **diferenças** entre:

* **Quantidade contada vs. quantidade esperada (estoque virtual)**
* **Valor da divergência em R$**, usando o **preço do produto**

Para cada produto:

* `dif_qtd = qtd_contada - qtd_estoque_virtual`
* `valor_dif = dif_qtd * preço`

Classificar:

* **Excesso** (quando qtd_contada > qtd_estoque_virtual)
* **Falta** (quando qtd_contada < qtd_estoque_virtual)
* **OK** (quando qtd_contada == qtd_estoque_virtual)

Essas informações devem alimentar:

* Dashboards
* Relatórios
* Arquivo final exportado

---

### 4.6. Estatísticas em Tempo Real (Dashboard Web)

No painel web (Next.js), criar um **dashboard em tempo real**, consumindo dados do Firestore, com:

* **Gráficos de produtividade por usuário**:

  * Quantidade de itens contados por intervalo de tempo (dia, hora, período).
  * Quantidade de endereços concluídos por usuário.
* **Indicadores gerais do inventário**:

  * Número total de endereços cadastrados.
  * Número de endereços **contados** vs **não contados**.
  * Percentual de **total contado**:

    * **Endereços cadastrados contados** X **Endereços cadastrados não contados** (exibir como percentual e gráfico).
* Métricas de divergência:

  * Soma de diferenças positivas (excesso).
  * Soma de diferenças negativas (falta).
  * Valor total da divergência em R$.
  * Top produtos com maior divergência em valor e em quantidade.

Use gráficos adequados (barras, pizza, linha etc.) e componentes modernos.

---

### 4.7. Relatórios e Exportação

Implementar, na aplicação web:

* Tela de **relatórios**, permitindo filtros por:

  * Data
  * Usuário
  * Endereço/lote
  * Situação (contado, não contado, divergente, etc.)
* Possibilitar **download** de:

  * **Arquivo TXT final**, no mesmo layout do arquivo de entrada, porém com a **quantidade contada** substituindo a quantidade anterior.
  * (Opcional, mas desejável) CSV/Excel com as colunas: EAN, código interno, descrição, endereço, qtd esperada, qtd contada, dif_qtd, valor_dif etc.

---

### 4.8. Interface Responsiva

* A aplicação **web (Next.js)** deve ser totalmente **responsiva**, funcionando bem em:

  * Desktop
  * Tablet
  * Mobile (navegador)
* A aplicação **mobile (React Native)** deve ter:

  * Interface simples, rápida, com botões grandes.
  * Foco em produtividade de coleta (o operador precisa contar rápido).

---

## 5. Modelagem de Dados (Firestore)

Quero que você:

1. **Proponha e descreva** a modelagem de coleções do Firestore, por exemplo:

   * `users`
   * `addresses` (endereço/lote)
   * `inventory_sessions` ou `inventories`
   * `items` ou `inventory_items`
   * `counts` (se optar por registrar histórico por usuário)
2. Explique:

   * Campos principais de cada coleção.
   * Relacionamentos (IDs, subcoleções, índices necessários).
   * Como garantir a regra de “1 endereço aberto por usuário” na modelagem.

---

## 6. Fluxos principais que a aplicação deve cobrir

Quero que você descreva **e depois implemente com código** (exemplos de arquivos e trechos) os seguintes fluxos:

1. **Cadastro de usuário e login**
2. **Criação de endereços/lotes**
3. **Importação do arquivo TXT**
4. **Atribuição/abertura de um endereço para um usuário operador**
5. **Coleta de produtos no mobile**:

   * Listar itens do endereço
   * Registrar quantidades contadas
   * Salvar em tempo (quase) real no Firestore
6. **Fechamento de endereço**
7. **Geração de dashboard com estatísticas**
8. **Geração e download do arquivo TXT final com quantidades contadas**

---

## 7. Requisitos técnicos adicionais

* Use boas práticas:

  * Separação de componentes
  * Services/repositories para acesso ao Firestore
  * Tratamento de erros e feedback ao usuário
* Pode sugerir o uso de:

  * **Context API** ou **state management** (como Redux/Zustand) onde fizer sentido.
* Explique **cada parte importante do código** (arquivos principais) com comentários e/ou parágrafos explicando o que faz.

---

## 8. Formato da sua resposta

Quero que sua resposta seja **bem estruturada** e dividida em seções:

1. **Resumo da solução**
2. **Arquitetura e Modelagem (Firestore)**
3. **Estrutura de pastas (Next.js e React Native)**
4. **Principais telas e componentes (Web e Mobile)**
5. **Fluxos de negócio implementados**
6. **Exemplos de código**:

   * Importação e parsing do arquivo TXT.
   * Modelo de dados no Firestore.
   * Tela de coleta no React Native.
   * Dashboard no Next.js.
   * Geração do TXT final.
7. **Sugestões de melhorias futuras** (opcional, mas bem-vindo).

Sempre que mostrar código, indique o **caminho do arquivo** (por exemplo:
`/web/src/app/(admin)/addresses/page.tsx` ou `/mobile/src/screens/CollectScreen.tsx`) e explique o papel daquele arquivo no sistema.

Responda **em Português do Brasil**, com foco em **clareza, didática e boas práticas**, como se estivesse desenhando e explicando um sistema profissional pronto para ser evoluído e colocado em produção.
