# Especificação — Plataforma Urupema (site + admin + portais + Instagram)

> Documento-fonte para implementar a plataforma. Escrito em 16/11/2026, a partir das decisões
> tomadas com o Tomaz (INTEGRE Jr). Quem for implementar: **leia tudo antes de começar** e siga a
> ordem dos marcos da seção 13. Itens marcados **[CONFERIR]** são detalhes externos que precisam ser
> confirmados na documentação oficial durante a implementação. Não são decisões em aberto.

---

## 1. Objetivo e contexto

O cliente (Urupema Negócios Imobiliários) quer:

1. Cadastrar um imóvel **uma vez**, num painel admin do próprio site.
2. Esse imóvel aparecer **no site**, nos **portais** (OLX, ZAP Imóveis e Viva Real, todos do Grupo OLX via Canal Pro; outros depois) e, se ele quiser, num **post no Instagram**.
3. Poder **repostar no Instagram** qualquer imóvel antigo com um botão.
4. Receber os **contatos (leads)** dos formulários do site no admin.
5. Editar dados básicos do site (telefones, endereço, redes) sem programador.

Motivação: hoje ele paga ~R$ 1.000/ano por um site com isso, mais a OLX. O novo site tem que custar
**só o domínio** (~R$ 40/ano no registro.br). A OLX (Canal Pro) ele continua pagando à parte.

**Prazo:** entrega em dezembro/2026. Primeiro uma **versão de demonstração** com tudo funcionando
(Instagram e portais em modo simulado, ver seção 9), depois a virada para produção.

---

## 2. Decisões já tomadas: NÃO rediscutir

| Decisão | Motivo |
|---|---|
| Sistema próprio, **sem CRM pago** (Jetimob, Kenlo etc.) | CRM custa mensalidade, mais caro que o site atual |
| **Cloudflare, plano grátis, SEM cartão de crédito** | Vercel Hobby proíbe uso comercial; Supabase grátis pausa após 7 dias sem uso |
| **Cloudflare Pages + Pages Functions** (pasta `functions/`) | Site estático + API no mesmo projeto, URL `*.pages.dev` |
| **D1** (SQLite) para dados | Grátis, sem cartão |
| **KV** para fotos | Grátis (1 GB), sem cartão. **R2 está proibido**: exige cartão cadastrado |
| **Login próprio** (usuário + senha, sessão em cookie) | **Cloudflare Access/Zero Trust está proibido**: exige cartão |
| **Sem Cron Triggers** | Pages não tem cron. A renovação do token do Instagram é "preguiçosa" (seção 9.4) |
| **Deploy pelo `wrangler`**, sem integração Git no painel da Cloudflare | A conta vai mudar de dono; não amarrar a org `integre-jr` a ela |
| **Vanilla HTML/CSS/JS**, sem framework, sem bundler | Mantém o padrão do site atual. Única dependência: `wrangler` como devDependency |
| Sem bibliotecas no servidor | Hash de senha, criptografia, XML e HTML com Web APIs nativas (WebCrypto, HTMLRewriter, template strings com escape) |
| Instagram e portais com **modo simulado** (`mock`) e modo real atrás da mesma interface | Ainda não há acesso à conta do Instagram nem ao Canal Pro do cliente |
| **O painel é o próprio site, editável** (decidido em 17/11/2026, seção 8.0) | O cliente edita onde as coisas aparecem, sem aprender um sistema à parte. Só em `/admin`, depois do login; o endereço público nunca mostra edição |
| **Contas conectadas pelo próprio cliente no painel** | Instagram: botão "Conectar" + login dele (OAuth). Portais: o painel mostra a URL do feed e o passo a passo para colar no Canal Pro uma vez (o Grupo OLX não tem "conectar com OLX") |

**Conta Cloudflare:** `Urupema Negócios Imobiliários`, ID `52ffddfe5261caf722e5dd9467baa041`, login
da INTEGRE (e-mail de projeto, fora do repositório). O `wrangler` desta máquina já está autenticado nela (conferir
com `npx wrangler whoami` antes de qualquer comando remoto). Na entrega, o cliente entra como Super
Administrator e a INTEGRE sai da conta.

---

## 3. Limites do plano grátis (dimensionar e mostrar no admin)

| Recurso | Limite grátis | Impacto |
|---|---|---|
| Requisições a Functions | ~100 mil/dia | Assets estáticos não contam se `_routes.json` excluir css/js/imagens |
| D1 | 500 MB por banco, 5 GB por conta **[CONFERIR]**; 5 milhões de leituras e 100 mil escritas de linhas por dia | Dados textuais: sobra muito |
| KV | 1 GB armazenado, 100 mil leituras/dia, **1.000 escritas/dia**, valor ≤ 25 MiB | Fotos. ~300 KB por foto (2 versões) ≈ 3 mil fotos |
| PBKDF2 no Workers | máx. 100.000 iterações | Usar exatamente 100000 |

O admin mostra **uso do armazenamento de fotos** (soma de `fotos.bytes`) com alerta a partir de 80% de 1 GB.
Limite de **20 fotos por imóvel**. Na entrega, o cliente será avisado de que passar dos limites exige cartão dele.

---

## 4. Estrutura de pastas (alvo)

```
/
├── public/                         ← pages_build_output_dir (tudo que é servido estático)
│   ├── index.html sobre.html financie.html negocie.html contato.html
│   ├── imoveis.html                ← NOVA: listagem com filtros
│   ├── imovel.html                 ← NOVO: TEMPLATE do detalhe (preenchido pela Function, seção 7.3)
│   ├── privacidade.html            ← NOVA: política de privacidade (LGPD)
│   ├── 404.html                    ← NOVA
│   ├── robots.txt
│   ├── _routes.json                ← limita quais caminhos invocam Functions
│   ├── css/styles.css  css/admin.css
│   ├── js/main.js                  ← refatorado (seção 7.1)
│   ├── js/imoveis.js               ← listagem/vitrine (renderiza cards)
│   ├── js/admin/                   ← editor.js (barra + edição no lugar), gaveta.js, api.js, imagens.js,
│   │                                  um módulo por gaveta (usuarios, conta, dados, leads, instagram, portais)
│   ├── imagens/
│   └── admin/
│       └── login.html  setup.html  ← as ÚNICAS páginas próprias do painel; o resto é o site (seção 8.0)
├── functions/                      ← Pages Functions (roteamento por arquivo)
│   ├── _middleware.js              ← injeta config do site no HTML (seção 7.4)
│   ├── admin/_middleware.js        ← exige sessão; serve o site em modo edição (seção 8.0)
│   ├── api/
│   │   ├── imoveis/index.js        GET lista pública
│   │   ├── imoveis/[ref].js        GET um imóvel público
│   │   ├── leads.js                POST
│   │   ├── auth/login.js logout.js me.js setup.js senha.js
│   │   ├── instagram/callback.js   OAuth do Instagram
│   │   └── admin/_middleware.js    exige sessão (401 JSON) + checagem CSRF
│   │       ├── imoveis/index.js  imoveis/[id].js  imoveis/[id]/fotos.js  imoveis/[id]/fotos-ordem.js
│   │       ├── fotos/[id].js
│   │       ├── leads/index.js  leads/[id].js  leads/exportar.js
│   │       ├── instagram/status.js conectar.js desconectar.js midias.js publicar.js posts.js
│   │       ├── portais.js  importar/buscar.js  importar/foto.js
│   │       ├── config.js  usuarios/index.js usuarios/[id].js  resumo.js
│   ├── imovel/[ref].js             ← página de detalhe com HTML montado no servidor
│   ├── fotos/[[path]].js           ← serve fotos do KV
│   ├── feeds/[arquivo].js          ← /feeds/grupo-olx-<FEED_TOKEN>.xml
│   └── sitemap.xml.js              ← se o nome com ponto não rotear, usar functions/[arquivo].js [CONFERIR]
├── lib/                            ← módulos importados pelas Functions (fora de public/)
│   ├── db.js  auth.js  cripto.js  http.js  validacao.js  html.js
│   ├── imoveis.js  vrsync.js  instagram/{index,mock,real}.js  config.js
├── migrations/0001_inicial.sql  0002_seed_demo.sql
├── docs/ESPECIFICACAO-PLATAFORMA.md
├── wrangler.toml  package.json  .dev.vars (gitignored)  .gitignore
└── CLAUDE.md
```

**Migração do site atual:** mover os 5 `.html`, `css/`, `js/` e `imagens/` para `public/` com `git mv`
(preserva histórico). Atualizar o `CLAUDE.md` (a seção "Como rodar" muda: agora é `wrangler pages dev`;
abrir por `file://` só serve para olhar o visual estático).

---

## 5. Configuração

### wrangler.toml
```toml
name = "urupema-imoveis"
pages_build_output_dir = "./public"
compatibility_date = "2026-11-01"

[[d1_databases]]
binding = "DB"
database_name = "urupema"
database_id = "<preencher após wrangler d1 create urupema>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "FOTOS"
id = "<preencher após wrangler kv namespace create FOTOS>"

[vars]
SITE_URL = "https://urupema-imoveis.pages.dev"
INSTAGRAM_MODO = "mock"        # mock | real
EMAIL_MODO = "mock"            # mock | real (real só depois que o domínio estiver na Cloudflare)
IG_API_VERSION = "v23.0"       # [CONFERIR] a versão atual da Graph API do Instagram
```
**Proteção contra conta errada:** tentar `account_id = "52ffddfe5261caf722e5dd9467baa041"` no
toml. Se o wrangler recusar essa chave em projetos Pages **[CONFERIR]**, usar
`CLOUDFLARE_ACCOUNT_ID` num `.env` local ignorado pelo Git. Antes de todo comando `--remote` ou
`deploy`, conferir `npx wrangler whoami`.

### Segredos (`wrangler pages secret put NOME --project-name urupema-imoveis`; local em `.dev.vars`)
| Nome | Uso |
|---|---|
| `SETUP_TOKEN` | Libera a criação do 1º admin (seção 6.2) |
| `TOKEN_KEY` | Chave AES-GCM (32 bytes em base64) para criptografar o token do Instagram no D1 |
| `SESSION_PEPPER` | Segredo misturado ao hash do ID de sessão |
| `FEED_TOKEN` | Trecho aleatório na URL do feed (o feed tem endereço completo dos imóveis) |
| `IG_APP_ID` / `IG_APP_SECRET` | App da Meta (só modo real) |

### package.json
Só `devDependencies: { "wrangler": "^4" }` e scripts:
`dev` (`wrangler pages dev`), `db:local` (`wrangler d1 migrations apply urupema --local`),
`db:remoto` (`... --remote`), `deploy` (`wrangler pages deploy`).

### .gitignore (acrescentar)
`node_modules/`, `.wrangler/`, `.dev.vars`, `.env`

### _routes.json
```json
{ "version": 1, "include": ["/*"], "exclude": ["/css/*", "/js/*", "/imagens/*", "/favicon.svg"] }
```
O middleware raiz roda em todo HTML. Isso não pode incluir CSS, JS e imagens, para não gastar a cota de requisições.

---

## 6. Banco de dados (D1): `migrations/0001_inicial.sql`

Valores em **reais inteiros** (sem centavos). Datas em ISO 8601 UTC (`TEXT`). Booleanos `INTEGER 0/1`.

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,          -- "pbkdf2$100000$<salt b64>$<hash b64>"
  papel TEXT NOT NULL CHECK (papel IN ('admin','corretor')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);

CREATE TABLE sessoes (
  id_hash TEXT PRIMARY KEY,          -- SHA-256(token + SESSION_PEPPER); o token cru só vive no cookie
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL, criado_em TEXT NOT NULL, ip TEXT, user_agent TEXT
);

CREATE TABLE tentativas_login (ip TEXT NOT NULL, email TEXT, quando TEXT NOT NULL);
CREATE INDEX idx_tent_ip ON tentativas_login(ip, quando);

CREATE TABLE contadores (nome TEXT PRIMARY KEY, valor INTEGER NOT NULL);
INSERT INTO contadores VALUES ('ref_imovel', 1100);   -- refs novas: UR-1101, UR-1102...

CREATE TABLE imoveis (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                                   -- "UR-1024"
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','ativo','reservado','vendido','alugado','arquivado')),
  finalidade TEXT NOT NULL CHECK (finalidade IN ('venda','aluguel','venda_aluguel')),
  tipo TEXT NOT NULL CHECK (tipo IN ('casa','apartamento','chacara','terreno','comercial','sobrado','cabana','sala','galpao')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_venda INTEGER, preco_aluguel INTEGER, condominio INTEGER, iptu_anual INTEGER,
  cep TEXT, uf TEXT NOT NULL DEFAULT 'SC', cidade TEXT NOT NULL DEFAULT 'Urupema',
  bairro TEXT, logradouro TEXT, numero TEXT, complemento TEXT,
  latitude REAL, longitude REAL,
  exibir_endereco TEXT NOT NULL DEFAULT 'bairro' CHECK (exibir_endereco IN ('completo','rua','bairro')),
  area_util REAL, area_total REAL,
  quartos INTEGER, suites INTEGER, banheiros INTEGER, vagas INTEGER,
  caracteristicas TEXT NOT NULL DEFAULT '[]',                 -- JSON array de chaves (seção 6.1)
  destaque INTEGER NOT NULL DEFAULT 0,                        -- aparece na home
  no_site INTEGER NOT NULL DEFAULT 1,
  no_grupo_olx INTEGER NOT NULL DEFAULT 1,                    -- entra no feed VRSync
  tipo_publicacao_olx TEXT NOT NULL DEFAULT 'STANDARD',       -- STANDARD|PREMIUM|SUPER_PREMIUM... [CONFERIR]
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','importado','seed')),
  id_externo TEXT,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, publicado_em TEXT
);
CREATE INDEX idx_imoveis_pub ON imoveis(status, no_site, finalidade, tipo);

CREATE TABLE fotos (
  id INTEGER PRIMARY KEY,
  imovel_id INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,                 -- 0 = capa
  kv_chave TEXT,                                    -- "imovel/<id>/<uuid>"; versões: <chave>/g.jpg e <chave>/p.jpg
  url_externa TEXT,                                 -- só para seed/demo (Unsplash)
  largura INTEGER, altura INTEGER, bytes INTEGER NOT NULL DEFAULT 0,
  legenda TEXT, criado_em TEXT NOT NULL
);
CREATE INDEX idx_fotos_imovel ON fotos(imovel_id, ordem);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  origem TEXT NOT NULL CHECK (origem IN ('contato','negocie','financie','interesse_imovel')),
  nome TEXT NOT NULL, email TEXT, telefone TEXT,
  imovel_ref TEXT,                                  -- quando veio da página de um imóvel
  dados TEXT NOT NULL DEFAULT '{}',                 -- JSON com os demais campos do formulário
  consentimento_em TEXT NOT NULL,                   -- LGPD: quando aceitou
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_atendimento','concluido','descartado')),
  notas TEXT, ip TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_leads_status ON leads(status, criado_em);

CREATE TABLE lead_fotos (               -- fotos enviadas no formulário "Negocie" (máx. 5)
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kv_chave TEXT NOT NULL, bytes INTEGER NOT NULL
);

CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE integracoes (              -- uma linha por integração ('instagram')
  nome TEXT PRIMARY KEY,
  dados_cripto TEXT NOT NULL,           -- JSON criptografado com AES-GCM (TOKEN_KEY)
  conta_exibicao TEXT,                  -- ex.: "@urupemaimoveis" (não sensível, para a UI)
  expira_em TEXT, atualizado_em TEXT NOT NULL
);

CREATE TABLE instagram_midias_temp (    -- JPEGs 4:5 gerados no navegador para um post; apagados após 24h
  id TEXT PRIMARY KEY,                  -- uuid; servido em /fotos/ig/<id>.jpg
  conteudo BLOB NOT NULL,               -- ≤ 1 MB (limite de linha do D1 ~2 MB)
  criado_em TEXT NOT NULL
);

CREATE TABLE instagram_posts (
  id INTEGER PRIMARY KEY,
  imovel_id INTEGER REFERENCES imoveis(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo','repost')),
  status TEXT NOT NULL CHECK (status IN ('publicando','publicado','erro')),
  ig_media_id TEXT, permalink TEXT, legenda TEXT NOT NULL, erro TEXT, modo TEXT NOT NULL,  -- mock|real
  criado_por INTEGER REFERENCES usuarios(id), criado_em TEXT NOT NULL
);

CREATE TABLE feed_acessos (             -- última leitura de cada feed pelos portais
  feed TEXT NOT NULL, user_agent TEXT, ip TEXT, itens INTEGER, quando TEXT NOT NULL
);
```

**Por que as imagens do Instagram ficam no D1, e não no KV:** o KV leva até 60 segundos para
propagar entre regiões. A Meta baixa a imagem logo depois de criarmos o post e poderia receber 404.
O D1 é consistente, e essas imagens são temporárias. Limpeza: toda chamada a
`/api/admin/instagram/*` apaga linhas com mais de 24h.

### 6.1 Vocabulários fixos (em `lib/imoveis.js`, usados no site, no admin e no feed)

- **tipo** → rótulo PT e `PropertyType` VRSync [CONFERIR os valores exatos]:
  casa→"Residential / Home", sobrado→"Residential / Sobrado", cabana→"Residential / Home",
  apartamento→"Residential / Apartment", chacara→"Residential / Farm Ranch",
  terreno→"Residential / Land Lot", comercial→"Commercial / Building",
  sala→"Commercial / Office", galpao→"Commercial / Industrial".
- **finalidade** → `TransactionType`: venda→"For Sale", aluguel→"For Rent", venda_aluguel→"Sale/Rent".
- **caracteristicas** (chave → rótulo PT → `Feature` VRSync [CONFERIR]): lareira→Lareira→"Fireplace",
  aquecimento→Aquecimento central→"Heating", churrasqueira→Churrasqueira→"BBQ",
  vista_montanha→Vista para a serra→"View", piscina→Piscina→"Pool", jardim→Jardim→"Garden",
  mobiliado→Mobiliado→"Furnished", aceita_pet→Aceita pet→"Pets Allowed",
  area_servico→Área de serviço→"Laundry", varanda→Varanda→"Balcony",
  energia_solar→Energia solar→"Solar Panels", poco_artesiano→Poço artesiano→"Well",
  galpao→Galpão→"Shed", pomar→Pomar→"Orchard". Sem equivalente conhecido → só aparece no site.
- **Bairros/localidades** sugeridos (datalist no admin, opções do filtro): Centro, Rio dos Bugres,
  Santo Antônio, Interior. O filtro público usa os bairros distintos dos imóveis ativos.

### 6.2 `configuracoes`: chaves e valores iniciais (seed)
`contato.telefone_1` "(49) 99160-3030" · `contato.telefone_2` "(49) 99107-5332" ·
`contato.whatsapp` "5549991603030" · `contato.email` "contato@urupemaimoveis.com.br" (fictício) ·
`contato.endereco_1` "Rua Artur Pagani, 08 — Sala 01" · `contato.endereco_2` "Centro, Urupema/SC · 88625-000"
(duas chaves porque o site mostra o endereço em duas linhas; migração 0004) ·
`redes.instagram` "https://instagram.com" · `redes.facebook` "https://facebook.com" ·
`home.stat_1_n` "+15" / `home.stat_1_l` "Anos de tradição" · `home.stat_2_n` "+320" /
`home.stat_2_l` "Imóveis negociados" · `home.stat_3_n` "100%" / `home.stat_3_l` "Atendimento local" ·
`instagram.modelo_legenda` (seção 9.3) · `instagram.hashtags` "#urupema #serracatarinense #imoveis
#imoveisserragaucha #casanaserra #imobiliaria" · `leads.email_aviso` "" (e-mail do dono para avisos).

### 6.3 `migrations/0002_seed_demo.sql`
Os 6 imóveis fictícios da vitrine atual (UR-1024, UR-1031, UR-1042, UR-2007, UR-1050, UR-2015, com
os mesmos títulos, preços, bairros, specs e fotos Unsplash via `url_externa`), `status='ativo'`,
`destaque=1`, `origem='seed'`. Junto, as `configuracoes` da 6.2. **Não** cria usuário: o primeiro
admin vem do fluxo de setup.

---

## 7. Site público

### 7.1 Refatorar `public/js/main.js`
Manter **todos** os comportamentos atuais (ver `CLAUDE.md`) e mudar:
- **Filtro por chips** e **favoritos** passam a usar **delegação de eventos** (`document.addEventListener('click', …)`
  com `closest('.chip[data-filter]')` / `closest('.card-fav[data-ref]')`), porque os cards agora são
  inseridos via JS. Expor `window.Urupema = { syncFavs, observeReveal(el) }` para o `imoveis.js`
  chamar depois de renderizar (marcar favoritos e animar os novos `.reveal`).
- **Fallback de imagem**: usar `addEventListener('error', …, true)` (captura) no `document`, para valer
  em imagens inseridas depois.
- **Busca por referência** (`.ref-search`, `.mobile-nav__ref`): ir para `/imovel/<REF>` (normalizar:
  maiúsculas, aceitar "1024" → "UR-1024"). Se não existir, a página de detalhe mostra o 404 com
  link para `imoveis.html?ref=…`.
- **Formulários**: trocar `data-mock` por `data-lead="contato|negocie|financie"` e o wizard por
  `data-lead="financie"`. O envio real está na seção 7.5. Manter as validações visuais atuais.

### 7.2 Vitrine (index) e listagem (`imoveis.html`)
- `public/js/imoveis.js` renderiza cards **idênticos ao markup atual** do `index.html`
  (`article.property-card[data-type]`, `.card-media` com `img` + `.card-media__fallback`,
  `.badge--sale`/`.badge--rent`, `.card-fav[data-ref]`, `.card-ref`, `.card-price` (aluguel com
  `<span class="per">/mês</span>`), `.card-title`, `.card-loc`, `.card-specs`, link **"Ver detalhes" →
  `/imovel/<ref>`**). `data-type` = `venda` ou `aluguel` (venda_aluguel → `venda`, e o card mostra os dois preços).
- **Home:** `.property-grid` busca `GET /api/imoveis?destaque=1&limite=6`. Os 6 cards estáticos atuais (trocados em 19/11/2026 por um aviso com link para a listagem, porque eram fictícios)
  ficam no HTML como conteúdo **sem JS**; com JS, são substituídos pela resposta da API. Se a API
  falhar, ficam os estáticos.
- **Searchbar da home:** "Pesquisar Imóveis" monta `imoveis.html?finalidade=venda|aluguel&tipo=…&bairro=…&min=…&max=…&ref=…`
  (a aba Comprar/Alugar define a finalidade). `#f-local` passa a ser preenchido pelos bairros da API.
- **`imoveis.html`** (copiar todos os blocos compartilhados, ver `CLAUDE.md`): page-hero curto +
  barra de filtros (finalidade, tipo, bairro, preço mín./máx., quartos mín., ordenação: recentes,
  menor preço, maior preço) + grid + "Carregar mais" (página de 12). Lê e grava os filtros na
  querystring. `?favoritos=1` lista os refs do `localStorage` `urupema:favs` (via `refs=`). O
  contador `.fav-count` do header vira link para `imoveis.html?favoritos=1`.
- Nav: acrescentar **"Imóveis"** em `.nav` e `.mobile-nav__links` nas **5 + novas páginas**.

### 7.3 Página do imóvel: `GET /imovel/:ref` (`functions/imovel/[ref].js`)
- Busca o imóvel (`status IN ('ativo','reservado')` e `no_site=1`). Se não achar, 404 com `public/404.html`.
- Busca o template `public/imovel.html` via `env.ASSETS.fetch` e preenche com **HTMLRewriter**
  (elementos com `data-campo="titulo|preco|ref|descricao|..."`): `<title>`, meta description,
  **Open Graph** (`og:title`, `og:description`, `og:image` = capa, `og:url`) para o link ficar bonito
  no WhatsApp; JSON-LD `RealEstateListing`; galeria (capa grande + miniaturas, lightbox simples em
  JS); preço(s); specs; características; endereço conforme `exibir_endereco`; mapa só com lat/long
  (link para o Google Maps, sem embed pago); badge de status ("Reservado").
- **CTAs:** WhatsApp `https://wa.me/<contato.whatsapp>?text=Olá! Tenho interesse no imóvel <REF> — <SITE_URL>/imovel/<REF>`;
  formulário "Tenho interesse" (nome, telefone, e-mail, mensagem, consentimento) → lead `interesse_imovel` com `imovel_ref`;
  botão favoritar; "Simular financiamento" → `financie.html`.
- Bloco "Outros imóveis" (3 do mesmo tipo ou finalidade).
- `Cache-Control: public, max-age=60`.

### 7.4 Conteúdo editável: `functions/_middleware.js`
Para respostas `text/html`, aplica HTMLRewriter com os valores de `configuracoes` (lidos 1 vez por
requisição; cache em memória do isolate por 60 s):
- `[data-cfg="chave"]` → substitui o texto.
- `[data-cfg-href="chave"]` → substitui o `href`. Formatos especiais: `tel:` a partir do telefone,
  `https://wa.me/<n>` a partir do whatsapp, `mailto:`.
- Marcar no HTML das páginas todos os telefones, e-mail, endereço, links de WhatsApp/Instagram/Facebook
  (header, drawer, footer, `.wa-float`, contato.html) e os 3 `hero__stat` da home.
- O HTML estático continua com os valores atuais (funciona sem a Function). O middleware só sobrescreve.
- Não aplicar em `/admin/*` nem em `/api/*` (o `/admin` aplica as mesmas trocas por conta própria, seção 8.0).
- Remove o `ETag` e ignora `If-None-Match`, senão o navegador recebe 304 e mostra um dado antigo.
- `[data-cfg-mapa]` (o `<iframe>` do mapa em `contato.html`) recebe a URL do Google Maps gerada do endereço.
- **Implementado junto com o modo edição em 17/11/2026** (antes do M3): `lib/config.js` (chaves
  editáveis, validação, links), `functions/_middleware.js` e `GET|PUT /api/admin/config` (só admin).

### 7.5 Formulários → leads (`POST /api/leads`)
- Acrescentar `name` em **todos** os campos dos 3 formulários. Hoje **nenhum campo tem `name`**.
  Nomes em snake_case PT: `nome, cpf, telefone, email, negocio, tipo, valor, cep, cidade, bairro, rua,
  numero, complemento, area, quartos, banheiros, vagas, diferenciais, descricao, assunto, mensagem,
  nascimento, estado_civil, possui_imovel, renda, entrada, fgts, prazo, tipo_imovel, horario, ...`
  (o wizard da `financie.html` tem 3 painéis: ler os `name` de todos).
- Envio por `fetch` JSON (negocie: `multipart/form-data` por causa das fotos) com:
  `origem`, campos, `consentimento: true`, `website` (honeypot, deve vir vazio) e `t` (timestamp
  de quando a página abriu; rejeitar envios em menos de 3 s).
- **LGPD:** checkbox obrigatório em todos os formulários: "Concordo com a [Política de Privacidade](privacidade.html)
  e autorizo o contato da Urupema". Criar `privacidade.html` (quais dados, finalidade, retenção de 2
  anos, contato para exclusão).
- Servidor: valida (nome obrigatório; telefone ou e-mail obrigatório; tamanho máximo dos campos),
  grava no `leads` (o resto em `dados` JSON), fotos do negocie (máx. 5, ≤ 2 MB cada, redimensionadas
  no navegador para 1600 px) no KV `lead/<id>/<n>.jpg`. Resposta `{ ok: true }` → mostra o
  `.form-success` atual. Erro → mensagem no form com link do WhatsApp.
- Limite: 10 leads por IP por hora (consulta em `leads.ip`).
- **Aviso por e-mail:** se `EMAIL_MODO=real` e `leads.email_aviso` preenchido, envia pelo binding
  `send_email` da Cloudflare (Email Routing). **Isso só funciona depois que o domínio estiver na
  Cloudflare** e o e-mail de destino verificado. Em `mock`, só `console.log`. O admin mostra o
  contador de leads novos em qualquer caso.

### 7.6 Outros
- `GET /sitemap.xml`: páginas fixas + `/imovel/<ref>` dos ativos. `robots.txt` aponta para ele e
  bloqueia `/admin` e `/api`.
- `GET /fotos/<chave>` (`functions/fotos/[[path]].js`): lê do KV (`FOTOS.get(chave, 'stream')`),
  `Content-Type: image/jpeg`, `Cache-Control: public, max-age=31536000, immutable` (chaves nunca
  são reaproveitadas). `GET /fotos/ig/<uuid>.jpg` lê de `instagram_midias_temp`. Fotos de
  `lead/*` **não** são públicas (exigem sessão).

---

## 8. Admin

### 8.0 Modelo do painel: o próprio site, editável (decisão de 17/11/2026)
O painel **não** é um sistema separado: é o site, com os pontos de edição ligados.
- **Endereço público** (`/`, `/sobre`…): só o site. Nunca mostra barra, contornos, gavetas nem opções de
  conta, mesmo para quem estiver logado. O código de edição nem é baixado.
- **Endereço do painel** (`/admin`): pede login (`/admin/login`). Logado, `/admin/<página>` devolve a
  página pública `<página>` com: os dados atuais (7.4), os links reescritos para continuar dentro de
  `/admin` (assets relativos viram absolutos), `<html data-admin>`, `admin.css` e `js/admin/editor.js`.
  Página que não existe no site → 404. Só `login.html` e `setup.html` são páginas próprias do painel.
- **O que é editável é só o que esta especificação prevê** (imóveis, dados do site da 6.2, leads,
  usuários, Instagram, portais). Layout não é editável. Textos institucionais e fotos fixas, só os marcados em `lib/config.js` (gaveta `pagina`, 17/11/2026: foto do topo da home, faixas de números, "Nossa história" e "Nossos valores" do Sobre).
- A segurança é do servidor: toda alteração passa por `/api/admin/*` (sessão + CSRF + papel). A barra
  só esconde o que o papel não pode fazer.

### 8.1 Autenticação (`lib/auth.js`)
- **Senha:** PBKDF2-SHA256, **100000** iterações, salt de 16 bytes, hash de 32 bytes (WebCrypto).
  Comparação em tempo constante. Mínimo de 12 caracteres e recusa de senhas óbvias (nome da imobiliária, "senha", "admin", sequências, nome ou e-mail da pessoa), `lib/validacao.js` (endurecido em 19/11/2026).
- **Sessão:** token aleatório de 32 bytes (base64url) no cookie `__Host-urupema_sessao`
  (`HttpOnly; Secure; SameSite=Lax; Path=/`). No D1 fica só `SHA-256(token + SESSION_PEPPER)`.
  Validade de 7 dias, ou 30 com "manter conectado". Renova `expira_em` se faltar menos da metade.
  Logout apaga a linha. Trocar a senha apaga as outras sessões do usuário.
- **Força bruta:** 5 falhas por IP em 15 min → bloqueio com 429 até a janela passar.
  Apagar `tentativas_login` com mais de 1 dia a cada login.
- **CSRF:** `SameSite=Lax` + toda rota `/api/admin/*` com método ≠ GET exige o header
  `X-Urupema: 1` (o `fetch` do admin sempre manda; formulários de outros sites não conseguem mandar).
- **Middlewares:**
  - `functions/admin/_middleware.js`: sem sessão válida → `302 /admin/login?volta=<url>`.
    Exceções: `login` e `setup`. Com sessão, serve o site em modo edição (seção 8.0).
  - `functions/api/admin/_middleware.js`: sem sessão → `401 {erro}`. Coloca
    `context.data.usuario` à disposição das rotas.
- **Papéis:** `admin` (dono) faz tudo. `corretor` mexe em imóveis, fotos, leads e Instagram (publicar
  e repostar), mas **não** em usuários, conteúdo, conexão do Instagram nem portais.
- **Primeiro acesso (setup):** `admin/setup.html` só funciona se `usuarios` estiver vazia. Pede
  `SETUP_TOKEN` + nome, e-mail e senha → cria o admin → já entra logado. Com usuários existentes, 404.
- **Esqueci a senha:** sem e-mail transacional no plano grátis antes do domínio. O admin redefine a
  senha de outros usuários em "Usuários". Para o próprio dono, documentar um comando no `docs/`:
  `wrangler d1 execute urupema --remote --command "UPDATE usuarios SET senha_hash=..."`,
  com um script `scripts/hash-senha.mjs` (Node, WebCrypto) que gera o hash.

### 8.2 Como cada coisa é editada
Mesma identidade do site (`styles.css` + `admin.css`, tokens de `:root`, sem cor solta).
**Mobile-first**: o dono vai cadastrar imóvel pelo celular, com fotos da câmera.

**Três formas de editar:**
1. **No lugar:** dados com `data-cfg`/`data-cfg-href` ganham contorno pontilhado dourado. Clicar abre
   um balão junto do texto (no celular, uma folha fixa embaixo) com o campo, a validação e "Salvar".
   No modo edição, clicar num dado editável edita em vez de seguir o link.
2. **Barra de edição** (fixa embaixo, verde-floresta): selo "Modo edição", nome e papel, e botões.
   No celular vira ícones com legenda. Esconde o botão flutuante do WhatsApp.
3. **Gavetas** (painel lateral por cima do site; tela cheia no celular) para o que não existe no site
   público. `js/admin/gaveta.js`; diálogos de confirmação em `<dialog>` por cima da gaveta.

| O quê | Onde se edita | Papel | Marco |
|---|---|---|---|
| **Dados do site** (6.2: contato, redes, números da home) | no lugar + gaveta **"Dados do site"** (formulário com todos, útil para ícones e para o número do WhatsApp) | admin | feito (17/11) |
| **Textos e fotos do site** (marcados, gaveta `pagina` em `lib/config.js`) | só no lugar: texto/parágrafo no balão; foto com o botão **"Trocar foto"** (navegador reduz para 1920 px JPEG → `POST /api/admin/imagens` → KV `site/<uuid>.jpg`, a antiga é apagada). Sem valor no banco vale o texto do HTML | admin | feito (17/11) |
| **Usuários** | gaveta "Usuários": criar, editar papel, ativar/desativar, redefinir senha, excluir | admin | feito (17/11) |
| **Minha conta** | gaveta "Minha conta": trocar a própria senha, sair de todos os aparelhos | todos | feito (17/11) |
| **Imóveis** | botão **"+ Novo imóvel"** na barra; nos cards da home e de `imoveis.html`: botões Editar, ★ destaque (alterna na hora), status e **Repostar no Instagram**. A página `/admin/imovel/<ref>` é a própria página do imóvel editável: título, preços e descrição no lugar; galeria com adicionar/reordenar/excluir fotos (8.3); o resto (finalidade, tipo, endereço com ViaCEP, medidas, características 6.1, publicação: status, destaque, site, OLX/ZAP/Viva Real + tipo de publicação, **☐ Publicar no Instagram ao salvar**) numa gaveta "Detalhes do imóvel". Avisa ao sair com alterações não salvas. Rascunhos e arquivados aparecem só no painel, com etiqueta | admin e corretor | M3 |
| **Leads** | gaveta "Leads" com contador de novos na barra: lista, filtros, detalhe, notas, status, WhatsApp, exportar CSV, "Criar imóvel a partir deste lead" (traz também as fotos do Negocie), e-mail de aviso, excluir a pedido do titular (só admin) | admin e corretor | feito (19/11) |
| **Portais** | gaveta "Portais": URL do feed com botão Copiar + passo a passo do Canal Pro, nº de imóveis no feed, última leitura, pendências por imóvel (10.3), importar feed (10.4) | admin | M5 |
| **Instagram** | gaveta "Instagram": **Conectar** (o dono faz login no Instagram dele; 9.4), status, modelo de legenda e hashtags, histórico, limite de 24 h | admin (corretor só publica/reposta) | M6 |
| **Resumo e alertas** (antigo "Painel") | ao entrar em `/admin`, um aviso discreto acima da barra com os alertas da 8.2 antiga: Instagram desconectado/expirando, armazenamento > 80%, feed nunca lido, leads novos (e, antes da entrega, e-mail e anúncios de demonstração) | admin (corretor: só leads) | feito (19/11) |

`public/js/admin/api.js`: wrapper de `fetch` (manda `X-Urupema: 1`, JSON, trata 401 → login,
mostra toasts de erro). Sem framework: módulos ES; `editor.js` é a entrada e carrega o resto.

### 8.3 Fotos no admin (`public/js/admin/imagens.js`)
- `<input type="file" accept="image/*" multiple>` + arrastar e soltar. No celular, abre câmera ou galeria.
- Para cada arquivo, no navegador: `createImageBitmap(file)` (respeita a orientação EXIF) → canvas →
  **g.jpg** (lado maior 1600 px, JPEG 0,82) e **p.jpg** (lado maior 640 px, JPEG 0,78).
  Se falhar (ex.: HEIC no Chrome), mostrar "Formato não suportado, envie JPG ou PNG".
- Upload `POST /api/admin/imoveis/:id/fotos` (multipart `g`, `p`, `largura`, `altura`), um por vez com
  barra de progresso. O servidor valida (JPEG, g ≤ 1,5 MB, p ≤ 300 KB, ≤ 20 fotos por imóvel), grava
  as 2 chaves no KV e a linha em `fotos` (bytes = soma).
- Imóvel novo: salvar como rascunho **antes** do upload (precisa do `id`). Fazer isso automaticamente
  ao adicionar a 1ª foto.
- Reordenar arrastando (no celular, botões ↑↓). A 1ª é a capa. `PUT /fotos-ordem` com a lista de IDs.
- Excluir foto: apaga do KV e do D1. Excluir imóvel: só se for rascunho ou arquivado; apaga as fotos
  do KV (`FOTOS.delete` de cada chave).
- Atenção: o KV grátis aceita **1.000 escritas por dia**. Cada foto = 2 escritas, então ~500 fotos/dia (sobra).

---

## 9. Instagram

### 9.1 Interface única (`lib/instagram/index.js`)
```
conectarUrl(state) → string
trocarCodigo(code) → { token, userId, username, expiraEm }
renovarSeNecessario(env) → void
publicar(env, { imagensUrls: string[], legenda }) → { mediaId, permalink }
limiteUso(env) → { usados, limite }
```
`INSTAGRAM_MODO=mock` → `mock.js`; `real` → `real.js`. O resto do código não sabe qual está ativo.

**mock.js:** "conectar" redireciona direto para o callback com `code=mock`. A conta é
`@urupema_demo`, com expiração em 60 dias. `publicar` espera 1,5 s, confere que as URLs das
imagens respondem 200 (testa a mesma coisa que a Meta testaria), devolve
`mediaId="mock_<timestamp>"` e `permalink="<SITE_URL>/imovel/<ref>"`. O limite é contado por
`instagram_posts` nas últimas 24 h, com máximo de 100. O admin mostra a etiqueta **"Modo
demonstração"** em toda a tela do Instagram.

### 9.2 Fluxo de publicação (igual em mock e real)
1. O usuário marca "Publicar no Instagram" ao salvar, ou clica em **"Repostar no Instagram"** na lista.
2. Abre um modal de **pré-visualização**: escolher até **10** fotos (padrão: as 10 primeiras, a capa
   primeiro), legenda gerada pelo modelo (editável, contador de 2.200 caracteres, aviso se > 30 hashtags).
3. Ao confirmar, o navegador gera para cada foto escolhida um **JPEG 1080×1350 (4:5)**: corta e
   centraliza se a proporção estiver entre 4:5 e 1,91:1; senão, encaixa a foto inteira com
   faixas na cor `--forest`. Envia para `POST /api/admin/instagram/midias` (multipart) → `[uuid]`.
4. `POST /api/admin/instagram/publicar { imovel_id, tipo: 'novo'|'repost', legenda, midias: [uuid] }`:
   cria `instagram_posts` com status `publicando`, chama `publicar` com as URLs
   `<SITE_URL>/fotos/ig/<uuid>.jpg`, atualiza para `publicado` (com `ig_media_id` e `permalink`) ou `erro`.
5. O modal mostra o sucesso com o link do post, ou o erro com "Tentar de novo".
- Repost = **um post novo** com as mesmas fotos e legenda (a API não "republica" um post antigo).
- Se o imóvel for salvo mas o Instagram falhar, o imóvel continua salvo: o erro é só do post.

### 9.3 Modelo de legenda (`instagram.modelo_legenda`, editável)
```
{titulo}

{finalidade_rotulo}: {preco}
📍 {bairro} · {cidade}/{uf}
{specs}

Cód. {ref} — mais fotos e detalhes no link da bio.
📲 WhatsApp: {telefone_1}

{hashtags}
```
`{preco}`: "R$ 850.000" ou "R$ 2.800/mês" (os dois se for venda_aluguel). `{specs}`: só o que existir,
por exemplo "🛏 3 quartos · 🚿 2 banheiros · 🚗 2 vagas · 📐 180 m²". Linhas que ficarem vazias somem.

**Implementado em 17/11/2026 (antes do M3): a parte de conexão.** `lib/cripto.js`, `lib/instagram/{index,mock,real}.js`
(`conectarUrl`, `trocarCodigo`, `renovar`), `GET /api/admin/instagram/status|conectar`,
`POST /api/admin/instagram/desconectar`, `GET /api/instagram/callback`, a gaveta "Instagram" (conexão + modelo
de legenda e hashtags) e o passo a passo em `docs/INSTAGRAM.md`. Falta no M6: `publicar`, `limiteUso`, mídias
temporárias, modal de pré-visualização, publicar ao salvar, repostar e histórico (dependem dos imóveis).

**Implementado em 18/11/2026 (M6, e o código do M9): a publicação.** `criarPost`/`concluirPost`/`limiteUso` em
`mock.js` e `real.js` (endpoints conferidos na doc da Meta em 18/11/2026, versão v27.0); rotas `previa`, `midias`,
`publicar`, `concluir`, `posts` e `app` em `functions/api/admin/instagram/`; modal `public/js/admin/postar.js`
(lista de anúncios, formulário com "Postar no Instagram ao salvar", página do imóvel e histórico).
Decisões tomadas na implementação:
- **Publicação em duas etapas** (o "[CONFERIR] limite de duração" da 9.4): `/publicar` cria o contêiner e
  `/concluir` é chamado pelo navegador a cada 3 s até o status `FINISHED`; desiste após 5 min.
- **App da Meta pelo painel:** o admin cola ID e chave secreta do app na gaveta Instagram
  (`integracoes(instagram_app)`, criptografado). Isso liga o modo real sem deploy; os segredos
  `IG_APP_ID`/`IG_APP_SECRET` + `INSTAGRAM_MODO=real` continuam valendo como alternativa.
- **Endereços pelo domínio da requisição** (não `SITE_URL`): redirect URI do OAuth e URLs das imagens
  seguem o domínio por onde o painel é aberto, então a troca de domínio no M10 não exige mudar variável.
- Só se posta anúncio Publicado/Reservado (o post leva para a página dele). Opção "fotos inteiras" no modal
  (faixas verdes) além da regra de corte da 9.2.

**Decisão de 17/11/2026: convite de testador, sem análise da Meta.** O app fica em modo de desenvolvimento e a
conta da imobiliária entra como Instagram Tester (acesso padrão basta para contas adicionadas ao app). Reavaliar
a análise perto do M9, se quiserem tirar do cliente o passo de aceitar o convite.

### 9.4 real.js: Instagram API com login do Instagram (sem página do Facebook) [endpoints conferidos em 17/11/2026]
- **Pré-requisitos (no dia da conexão real):** conta do Instagram **profissional** (Comercial ou
  Criador de conteúdo); app na Meta (portfólio da INTEGRE) com o produto "Instagram API with
  Instagram Login"; permissões `instagram_business_basic` e `instagram_business_content_publish`;
  redirect URI `<SITE_URL>/api/instagram/callback` (exige HTTPS, então não dá para testar o modo real
  em localhost). Com o app em modo de desenvolvimento, a conta do cliente precisa ser adicionada como
  **testadora** e aceitar o convite (isso evita a análise da Meta, porque só publicamos na conta dele).
- **Autorização:** `https://www.instagram.com/oauth/authorize?client_id=<IG_APP_ID>&redirect_uri=<...>&response_type=code&scope=instagram_business_basic,instagram_business_content_publish&state=<state>`.
  O `state` é aleatório e fica num cookie `HttpOnly` de 10 min, conferido no callback.
- **Troca do código:** `POST https://api.instagram.com/oauth/access_token` (form: client_id, client_secret,
  grant_type=authorization_code, redirect_uri, code) → token curto + user_id. Depois,
  `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…`
  → **token longo (60 dias)**. `GET https://graph.instagram.com/<ver>/me?fields=user_id,username`.
- **Armazenar:** `integracoes('instagram')` com `{token, userId}` criptografado com AES-GCM
  (`TOKEN_KEY`, IV aleatório de 12 bytes, guardado junto), `conta_exibicao='@username'`, `expira_em`.
- **Renovação preguiçosa** (sem cron): em toda chamada `/api/admin/*` do Instagram e ao abrir o
  Painel, se faltarem < 30 dias e o token tiver > 24 h,
  `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…`.
  Se expirar mesmo assim (dono sem abrir o admin por 60 dias), o Painel mostra **"Reconectar Instagram"**.
- **Publicar:**
  - 1 imagem: `POST /<ver>/<userId>/media` (`image_url`, `caption`) → `creation_id`.
  - Carrossel (2–10): para cada imagem, `POST /media` (`image_url`, `is_carousel_item=true`); depois
    `POST /media` (`media_type=CAROUSEL`, `children=<ids separados por vírgula>`, `caption`).
  - Consultar `GET /<container>?fields=status_code` até `FINISHED` (máx. 10 tentativas, 2 s de
    intervalo). `ERROR` → falha com a mensagem.
  - `POST /<ver>/<userId>/media_publish` (`creation_id`) → `media_id`.
    `GET /<media_id>?fields=permalink`.
  - Antes de publicar: `GET /<userId>/content_publishing_limit` (limite de 100 posts/24 h; o carrossel conta 1).
  - Só JPEG. Legenda ≤ 2.200 caracteres.
- **Atenção ao tempo de execução:** Functions do plano grátis têm limite de CPU (~10 ms), mas espera
  de rede não conta. O polling com `await` dentro de uma requisição funciona.
  **[CONFERIR]** o limite de duração da requisição. Se estourar, dividir: o `publicar` cria os
  contêineres e devolve os IDs, e o navegador chama `/publicar/concluir` depois.

---

## 10. Portais: feed VRSync (Grupo OLX: OLX, ZAP, Viva Real)

**Implementado em 18/11/2026 (M5).** `lib/vrsync.js` (gerador + `pendencias`), `lib/portais.js`,
`functions/feeds/[arquivo].js`, `GET|POST /api/admin/portais`, importação (`lib/importar.js`,
`/api/admin/importar/buscar|foto`) e a gaveta `public/js/admin/portais.js`. Testes: `scripts/testa-integracoes.sh`.
Formato **conferido em developers.grupozap.com/feeds/vrsync em 18/11/2026**, o que corrigiu esta seção:
`Iptu currency="BRL" period="Yearly"` (o `YearlyTax` saiu de uso); `Garage` sem atributo `type`; áreas inteiras;
`State` com o nome por extenso; `PublicationType` aceita também `PREMIERE_1`, `PREMIERE_2` (Zap+) e `TRIPLE`;
Features: `Mountain View`, `Garden Area`, `Solar Energy`, `Artesian Well`, `Warehouse`, `Pomar`. Exigências
oficiais viraram pendências (10.3): título 10–100, descrição 50–3.000, **mínimo de 5 fotos**, **CEP obrigatório**.
Decisões: o trecho secreto da URL fica no banco (`configuracoes` `portais.feed_token`, criado sozinho e
trocável pelo painel; `FEED_TOKEN` só serve de valor inicial); **anúncios de demonstração (`origem=seed`)
nunca entram no feed**; leituras feitas com sessão do painel não contam como leitura do portal.

### 10.1 Rota
`GET /feeds/grupo-olx-<FEED_TOKEN>.xml` (`functions/feeds/[arquivo].js`). Token errado → 404.
Responde `application/xml; charset=utf-8` com `Cache-Control: max-age=300`. Grava em `feed_acessos`
(user-agent, ip, quantidade de itens; manter só os últimos 200 registros).
Conteúdo: imóveis com `status='ativo'` e `no_grupo_olx=1` que **passem na validação da 10.3**.

### 10.2 Estrutura (gerar com template string + `escapeXml`, texto livre em `CDATA` com `]]>` escapado) [CONFERIR na doc VRSync em developers.grupozap.com]
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>Urupema Negócios Imobiliários</Provider>
    <Email>{contato.email}</Email>
    <ContactName>Urupema Negócios Imobiliários</ContactName>
    <PublishDate>{agora ISO}</PublishDate>
    <Telephone>{contato.telefone_1}</Telephone>
  </Header>
  <Listings>
    <Listing>
      <ListingID>UR-1024</ListingID>
      <Title><![CDATA[Casa de Campo com Lareira]]></Title>
      <TransactionType>For Sale</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      <DetailViewUrl>{SITE_URL}/imovel/UR-1024</DetailViewUrl>
      <Media>
        <Item medium="image" caption="" primary="true">{SITE_URL}/fotos/imovel/…/g.jpg</Item>
      </Media>
      <Details>
        <UsageType>Residential</UsageType>
        <PropertyType>Residential / Home</PropertyType>
        <Description><![CDATA[…]]></Description>
        <ListPrice currency="BRL">850000</ListPrice>
        <RentalPrice currency="BRL" period="Monthly">2800</RentalPrice>
        <PropertyAdministrationFee currency="BRL">0</PropertyAdministrationFee>
        <YearlyTax currency="BRL">0</YearlyTax>
        <LivingArea unit="square metres">180</LivingArea>
        <LotArea unit="square metres">600</LotArea>
        <Bedrooms>3</Bedrooms><Bathrooms>2</Bathrooms><Suites>1</Suites><Garage type="Parking Space">2</Garage>
        <Features><Feature>Fireplace</Feature></Features>
      </Details>
      <Location displayAddress="Neighborhood">  <!-- All | Street | Neighborhood -->
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="SC">Santa Catarina</State>
        <City>Urupema</City><Neighborhood>Centro</Neighborhood>
        <Address>Rua …</Address><StreetNumber>…</StreetNumber><Complement>…</Complement>
        <PostalCode>88625000</PostalCode>
        <Latitude>…</Latitude><Longitude>…</Longitude>
      </Location>
      <ContactInfo>
        <Name>Urupema Negócios Imobiliários</Name><Email>…</Email>
        <Website>{SITE_URL}</Website><Telephone>…</Telephone>
      </ContactInfo>
    </Listing>
  </Listings>
</ListingDataFeed>
```
Omitir tags opcionais sem valor. Preço só da finalidade correspondente. `displayAddress`:
completo→All, rua→Street, bairro→Neighborhood. Imagens **sempre** com URL absoluta pública
(`url_externa` vale para o seed).

### 10.3 Validação (`lib/vrsync.js` → `pendencias(imovel, fotos)`)
Regras mínimas [CONFERIR as exigências atuais do Canal Pro]: título ≥ 10 caracteres; descrição
≥ 50; preço da finalidade > 0; ≥ 1 foto (recomendado ≥ 5); bairro, cidade, UF e CEP preenchidos;
área informada (útil, ou total para terreno/chácara); tipo mapeado. A tela `portais.html` lista as
pendências por imóvel, e o form do imóvel mostra um aviso "Não vai para os portais: …".

### 10.4 Importar imóveis do site antigo
O fornecedor atual quase certamente gera um feed VRSync (é assim que publica na OLX hoje). A URL
está no Canal Pro do cliente.
- `GET /api/admin/importar/buscar?url=` (só admin; http/https; máx. 10 MB; timeout) → devolve o XML em texto.
- O **navegador** faz o parse com `DOMParser` (o Workers não tem parser de XML), mostra uma prévia
  (ref, título, preço, nº de fotos), o usuário escolhe quais importar.
- Para cada um: cria o imóvel (`origem='importado'`, `id_externo=ListingID`; mantém o `ref` se
  seguir o padrão `UR-\d+` e não existir, senão gera um novo) e, para cada foto,
  `GET /api/admin/importar/foto?url=` (proxy de bytes) → redimensiona no navegador (fluxo 8.3) → upload.
- Mapear de volta PropertyType, TransactionType e Features pelas tabelas da 6.1. O que não mapear,
  avisar na prévia.

### 10.5 Outros portais (depois da demo)
A arquitetura permite novos feeds em `/feeds/<portal>-<token>.xml` com um gerador por portal
(`lib/feeds/<portal>.js`) e uma coluna `no_<portal>` em `imoveis` (nova migração). Imovelweb,
Chaves na Mão etc. só depois de confirmar o formato de cada um com o cliente e o portal.

---

## 11. API: resumo das rotas

Públicas: `GET /api/imoveis` (filtros: `finalidade, tipo, bairro, min, max, quartos, ref, refs, destaque,
ordem, pagina, limite≤24` → `{itens, total, bairros}`) · `GET /api/imoveis/:ref` · `POST /api/leads` ·
`GET /imovel/:ref` · `GET /fotos/*` · `GET /feeds/*` · `GET /sitemap.xml` · `GET /api/instagram/callback`.

Auth: `POST /api/auth/setup` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/senha`.

Admin (sessão; ≠GET exige `X-Urupema: 1`): `GET|POST /api/admin/imoveis` · `GET|PUT|DELETE /api/admin/imoveis/:id` ·
`POST /api/admin/imoveis/:id/fotos` · `PUT /api/admin/imoveis/:id/fotos-ordem` · `DELETE /api/admin/fotos/:id` ·
`GET /api/admin/leads` · `GET|PUT /api/admin/leads/:id` · `GET /api/admin/leads/exportar` (CSV, UTF-8 com BOM, separador `;`) ·
`GET /api/admin/instagram/status` · `GET /api/admin/instagram/conectar` · `POST /api/admin/instagram/desconectar` ·
`POST /api/admin/instagram/midias` · `POST /api/admin/instagram/publicar` · `GET /api/admin/instagram/posts` ·
`GET /api/admin/portais` · `GET /api/admin/importar/buscar` · `GET /api/admin/importar/foto` ·
`GET|PUT /api/admin/config` · `GET|POST /api/admin/usuarios` · `PUT|DELETE /api/admin/usuarios/:id` · `GET /api/admin/resumo`.

Padrão de resposta: sucesso `{...dados}`; erro `{ erro: "mensagem em PT para o usuário", campo?: "nome" }` com
status 400/401/403/404/409/429/500. Erros 500 logam o detalhe (`console.error`) e devolvem mensagem genérica.
Toda SQL com `prepare().bind()`, nunca concatenando valores. Toda saída HTML do servidor passa por `escapeHtml`.
No admin, conteúdo dinâmico entra no DOM com `textContent`, nunca `innerHTML` com dados.

---

## 12. Como rodar e publicar

**Local (sem internet para o Instagram, tudo em mock):**
```bash
npm install
npx wrangler d1 migrations apply urupema --local
npx wrangler pages dev           # http://localhost:8788  (lê wrangler.toml e .dev.vars)
# abrir http://localhost:8788/admin/setup.html e criar o 1º admin com o SETUP_TOKEN do .dev.vars
```
`.dev.vars` (exemplo): `SETUP_TOKEN=dev-setup`, `TOKEN_KEY=<base64 32 bytes>`, `SESSION_PEPPER=dev`,
`FEED_TOKEN=dev`, `SITE_URL=http://localhost:8788`.

**Primeira publicação (conta Urupema, conferir `wrangler whoami` antes):**
```bash
npx wrangler d1 create urupema                       # copiar o database_id para o wrangler.toml
npx wrangler kv namespace create FOTOS               # copiar o id para o wrangler.toml
npx wrangler pages project create urupema-imoveis --production-branch main
npx wrangler d1 migrations apply urupema --remote
npx wrangler pages secret put SETUP_TOKEN --project-name urupema-imoveis   # repetir para cada segredo
npx wrangler pages deploy
```
Depois: `npm run deploy` a cada versão. Conferir com o agent-browser em desktop (1440) e celular (390):
site, listagem, detalhe, formulários e o fluxo completo do admin.

---

## 13. Marcos de implementação (nesta ordem)

| # | Marco | Pronto quando |
|---|---|---|
| M1 | **Estrutura**: `git mv` para `public/`, wrangler.toml, package.json, .gitignore, `_routes.json`, migrações, seed, `lib/` base (db, http, escape) | `wrangler pages dev` serve o site atual idêntico; D1 local com o seed; 1º deploy em `urupema-imoveis.pages.dev` |
| M2 | **Auth**: setup, login, logout, sessão, middlewares, troca de senha, usuários | Admin protegido; login/logout ok; corretor sem acesso a usuários |
| M2b | **Modo edição** (8.0, feito em 17/11/2026): `/admin` serve o site editável, barra de edição, gavetas Usuários/Minha conta/Dados do site, e o conteúdo editável do antigo M7 | Trocar telefone no painel muda todas as páginas; o endereço público não mostra edição |
| M3 | **Imóveis** (feito em 17/11/2026): API pública, gestão de anúncios no modo edição, fotos (KV), vitrine da home, `imoveis.html`, `/imovel/:ref` (e `/admin/imovel/:ref`), `404.html`, refatoração do main.js. **Ajuste pedido pelo Tomaz:** no painel, cada dado editável tem um botão "Editar" visível; a vitrine e a listagem têm "Editar anúncios" e "Novo anúncio"; cada card e a página do imóvel têm "Editar". A edição do anúncio é um formulário numa gaveta larga (não "no lugar"), com fotos, CEP, características e publicação | Cadastrar pelo celular com fotos → aparece na home, na listagem e no detalhe; filtros e favoritos funcionam |
| M4 | **Leads + LGPD** (feito em 19/11/2026; aviso por e-mail fica para o M10): names nos forms, `/api/leads`, gaveta de leads, CSV, privacidade.html, "criar imóvel a partir do lead" | Os 3 formulários + "tenho interesse" chegam ao admin |
| M5 | **Portais** (feito em 18/11/2026): feed VRSync, validação/pendências, gaveta Portais, importação de feed | Feed abre no navegador com XML válido; pendências aparecem; importação funciona com um XML de exemplo |
| M6 | **Instagram (mock)** (feito em 18/11/2026): ~~interface, conexão, gaveta Instagram~~ (17/11) + midias temp, modal, publicar ao salvar, repostar, histórico. O código do M9 (`real.js` publicando) foi junto; falta só o app da Meta e a conta do cliente | Demo completa: cadastrar → "publicar no Instagram" → post simulado no histórico; repostar imóvel antigo |
| M7 | ~~Conteúdo editável~~: **adiantado para o M2b** | (feito) |
| M8 | **Polimento** (feito em 19/11/2026; o 404 já funcionava desde o M3): Painel com alertas, sitemap/robots, 404, revisão mobile, atualizar `CLAUDE.md` | **Versão de demonstração para o cliente** |
| M9 | **Instagram real** (`real.js`), quando houver a conta do cliente | Post real publicado na conta conectada |
| M10 | **Virada**: domínio do cliente → Cloudflare (DNS no registro.br), `SITE_URL` final, feed no Canal Pro, `EMAIL_MODO=real`, importar os imóveis reais, transferir a conta | Site no domínio do cliente; fornecedor antigo cancelado |

Para o prazo, M1–M8 são a prioridade. O M9 e o M10 dependem do cliente e acontecem juntos na
reunião de entrega.

---

## 14. Reunião de entrega: checklist (depende do cliente)

1. Conta do Instagram dele **profissional**. Aceitar o convite de testador do app e clicar em
   "Conectar Instagram" no admin.
2. No Canal Pro: pegar a URL do feed do fornecedor antigo (para importar) e trocar pela nossa
   (`/feeds/grupo-olx-<token>.xml`). Perguntar se a troca mantém os anúncios e o histórico.
3. registro.br: apontar o domínio para a Cloudflare (DNS). Depois, ativar o Email Routing e verificar
   o e-mail de aviso de leads.
4. Criar o usuário admin do dono, com senha dele.
5. Cloudflare: convidar o e-mail do cliente como **Super Administrator**; ajudar a ativar a
   verificação em duas etapas **no login dele**; a INTEGRE sai da conta (Members → Leave) e roda
   `wrangler logout` nesta máquina.
6. **Avisar sobre os limites do plano grátis** (seção 3). Se passar deles, cadastrar cartão e pagar
   (Workers Paid ~US$ 5/mês, ou R2 para fotos) é responsabilidade dele.
7. Vídeo curto de treinamento: cadastrar imóvel pelo celular, publicar e repostar no Instagram, ver leads.
