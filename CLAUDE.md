# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Em transformação: leia a especificação antes de mexer

Desde 16/11/2026 o site está virando **plataforma**: admin com login, cadastro de imóveis com fotos,
feed VRSync para OLX/ZAP/Viva Real, publicação no Instagram e leads, tudo na Cloudflare grátis
(Pages + Functions + D1 + KV), sem cartão. **A especificação completa, com decisões, banco, rotas,
telas e a ordem de implementação (marcos M1–M10), está em
[docs/ESPECIFICACAO-PLATAFORMA.md](docs/ESPECIFICACAO-PLATAFORMA.md).** Marco **M1 concluído em
16/11/2026** (estrutura, D1/KV, 1º deploy). **M2 (autenticação e usuários) concluído e no ar em
16/11/2026** (testes: `bash scripts/testa-auth.sh`, instruções no topo do script). **Em 17/11/2026 o
painel virou o próprio site editável** (spec 8.0/8.2, marco M2b): não existe mais "tela de admin"
separada, só login/setup + o site em `/admin` com barra de edição e gavetas. **M3 (imóveis) feito em
17/11/2026**: anúncios vêm do banco, gestão pela gaveta "Anúncios" e pelos botões "Editar" (testes:
`bash scripts/testa-imoveis.sh`). **M5 (portais: feed VRSync, gaveta Portais, importação do feed antigo) e
M6 (posts no Instagram, com o `real.js` do M9 já pronto) feitos em 18/11/2026**: o cliente só cola o link do
feed no Canal Pro e, para o Instagram real, a INTEGRE cola o ID/chave do app da Meta na gaveta Instagram e o
dono clica em "Conectar" (testes: `bash scripts/testa-integracoes.sh`; precisa de `npm run db:local` por causa
da migração 0005). As seções
abaixo descrevem o site público, que por enquanto segue igual ao estático original, agora dentro
de `public/`.

## O que é este projeto

Site institucional da **Urupema Negócios Imobiliários** — imobiliária de Urupema/SC (Serra Catarinense). Site estático de marketing, multi-página, em **pt-BR**. Estética "Clean & Premium".

**Stack:** HTML + CSS + JavaScript puro (vanilla), servido pelo **Cloudflare Pages** (projeto `urupema-imoveis`), com Pages Functions, D1 e KV. Sem framework, bundler nem testes. Única dependência: `wrangler` (devDependency).

## Como rodar / visualizar

- **Local (completo):** `npm install`, `npm run db:local` (migrações + seed no D1 local) e `npm run dev` → `http://localhost:8788`. O Pages redireciona `/sobre.html` → `/sobre` (normal).
  - O `.dev.vars` (fora do Git) traz os segredos locais; `SETUP_TOKEN=dev-setup` cria o 1º admin em `/admin/setup`.
  - **Windows:** parar o `pages dev` nem sempre mata o `workerd`. Um servidor órfão continua na porta 8788 servindo **sem as Functions** (a API devolve HTML). Antes de subir de novo, conferir com `netstat -ano | grep 8788` e encerrar os processos `wrangler pages dev`/`workerd` que sobraram.
- **Abrir direto (`file://`)** ainda funciona para olhar o visual estático de `public/*.html`, sem API.
- **Senha esquecida do administrador:** ver [docs/RECUPERAR-SENHA.md](docs/RECUPERAR-SENHA.md) (`scripts/hash-senha.mjs`).
- **Instagram:** roda em modo demonstração até alguém salvar o app da Meta na gaveta Instagram ("Conta real do Instagram"). Passo a passo (app da Meta + convite de testador) em [docs/INSTAGRAM.md](docs/INSTAGRAM.md). O modo real exige https: não dá para conectar a conta real pelo `localhost`.
- **Portais:** a gaveta Portais mostra o link do feed para colar no Canal Pro. Para o anúncio entrar, valem as exigências do VRSync (mín. 5 fotos, CEP, descrição ≥ 50 etc.); a gaveta e o formulário do anúncio listam o que falta.
- **Publicar:** conferir `npx wrangler whoami` (conta "Urupema Negócios Imobiliários") e rodar `npm run deploy` → `https://urupema-imoveis.pages.dev`. Migrações remotas: `npm run db:remoto`.
  - A conta fica fixada em `CLOUDFLARE_ACCOUNT_ID` no `.env` (ignorado pelo Git): o Pages recusa `account_id` no `wrangler.toml`. Recriar o `.env` numa máquina nova.
  - O projeto foi criado no Pages **clássico** (`pages project create --force`), porque o wrangler 4.16x tenta migrar Pages para Workers. Não passar `--force` de novo; os comandos seguintes já vão direto ao Pages.
  - O D1 não aceita `SELECT ... UNION ALL` com muitos termos nas migrações: usar `INSERT ... VALUES` linha a linha.
- **Conferência visual:** preferir o agent-browser (skill) em 1440 e 390 px.
- **Screenshot / conferência visual** (Chrome headless, Windows PowerShell):
  ```powershell
  & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,4600 --user-data-dir="<pasta-temp>" "--screenshot=<saida>.png" "file:///c:/Users/guiha/Desktop/Site%20Imobili%C3%A1ria%20Urupema/index.html"
  ```
  - `--user-data-dir` é necessário, senão o screenshot falha silenciosamente.
  - Mobile: use `--window-size=390,7600`. A altura precisa ser ≥ altura da página (senão corta).
  - **Cuidado (PowerShell):** montar URL com backtick — `"$base`financie.html"` — quebra, pois `` `f `` vira form-feed. Use concatenação: `$base + "financie.html"`.

## Arquitetura

```
public/                  ← tudo que é servido estático (pages_build_output_dir)
  index.html  sobre.html  financie.html  negocie.html  contato.html   ← as 5 páginas
  css/styles.css         ← TODO o estilo (design system + componentes), um arquivo só
  js/main.js             ← TODO o comportamento, um IIFE só
  imagens/               ← logos + favicon
  _routes.json           ← css/js/imagens não invocam Functions (economiza cota)
  imoveis.html           ← listagem com filtros (gerada a partir da index; mesmos blocos compartilhados)
  modelos/imovel.html    ← modelo da página do imóvel (o servidor preenche; /modelos/* dá 404 ao público)
  404.html               ← página de erro (links absolutos: é servida em qualquer endereço)
  js/imoveis.js          ← cards vindos da API (mesmo markup dos estáticos), busca, listagem, galeria
  admin/login.html setup.html ← as ÚNICAS páginas próprias do painel
  css/admin.css          ← modo edição (barra, contornos, balão, gavetas) + login; mesmos tokens
  js/admin/              ← editor.js (entrada: barra + edição no lugar; novos botões entram em montarBarra),
                           gaveta.js, api.js (fetch + toasts + forms), uma gaveta por módulo (usuarios, conta, dados,
                           instagram, portais), postar.js (modal "Postar no Instagram": imagens 4:5 + publicação)
functions/
  _middleware.js         ← site público: aplica os dados editáveis (data-cfg) no HTML; tira ETag
  admin/_middleware.js   ← /admin/<página> = página pública em modo edição (links reescritos, editor injetado); sem sessão → login
  api/admin/config.js    ← GET|PUT dos dados editáveis (só admin); campos, validação e links em lib/config.js
  api/admin/instagram/*  ← status, conectar (navegação → login do Instagram), desconectar, app (ID/chave do app da Meta → modo real),
                           previa, midias (D1, 24 h), publicar + concluir (2 etapas), posts; o _middleware carrega o app e renova o token
  feeds/[arquivo].js     ← /feeds/grupo-olx-<token>.xml (VRSync; token no banco; anúncios seed nunca entram)
  api/admin/portais.js   ← gaveta Portais (link, pendências, leituras); api/admin/importar/{buscar,foto}.js (feed antigo)
  api/instagram/callback.js ← volta do OAuth (sessão de admin + state em cookie) → /admin/?instagram=…
  api/imoveis/*          ← lista pública com filtros, opcoes (vocabulários), um imóvel
  api/admin/imoveis/*    ← anúncios: listar/criar, :id (número ou "UR-1024") GET/PUT parcial/DELETE, fotos, fotos-ordem; api/admin/fotos/:id
  imovel/[ref].js        ← página do imóvel (lib/pagina-imovel.js, também usada em /admin/imovel/:ref)
  fotos/[[path]].js      ← fotos do KV (imovel/<id>/<uuid>/g.jpg|p.jpg), cache eterno
  api/_middleware.js     ← erro inesperado → 500 genérico; api/[[rota]].js → 404 JSON
  api/auth/*             ← setup, login, logout ({todos:true} = todos os aparelhos), me, senha
  api/admin/_middleware.js ← sessão (401) + header X-Urupema (CSRF); context.data.usuario
  api/admin/usuarios/*   ← CRUD de usuários (só admin; ninguém tira o próprio acesso)
lib/                     ← db.js, http.js, html.js, validacao.js, auth.js (PBKDF2, sessão, força bruta, CSRF, soAdmin), config.js,
                           cripto.js (base64, AES-GCM com TOKEN_KEY), instagram/ (index = interface; mock.js | real.js por INSTAGRAM_MODO),
                           imoveis.js (vocabulários 6.1, validação, filtros, formato de saída), anuncios.js, pagina-imovel.js,
                           vrsync.js (feed + pendências), portais.js (token, candidatos), importar.js, instagram/legenda.js
migrations/              ← 0001 esquema, 0002 seed, 0003 sessoes.dias, 0004 endereço em 2 chaves (endereco_1/_2), 0005 ig_container_id
scripts/hash-senha.mjs   ← redefine a senha de um usuário direto no D1
wrangler.toml  package.json  .env/.dev.vars (fora do Git)
```

Nas seções abaixo, caminhos como `css/styles.css` e `index.html` são relativos a `public/`.

Cada página é autossuficiente: importa apenas `css/styles.css` e `js/main.js`.

### ⚠️ Convenção mais importante: blocos compartilhados são DUPLICADOS

Não existe sistema de includes (fetch de partials falha em `file://`). Por isso, os seguintes blocos são **copiados verbatim em todas as 5 páginas** e precisam ser mantidos idênticos manualmente:

- o **sprite de ícones** SVG (`<svg width="0" height="0">` com os `<symbol id="i-...">`)
- o `<header class="header">`
- o drawer mobile `<div class="mobile-nav">`
- o `<footer class="footer">`
- o botão flutuante `<a class="wa-float">`
- o `<script>document.documentElement.classList.add('js');</script>` no `<head>`

**Ao alterar header, footer, menu, dados de contato ou o sprite, replique a mudança nas 5 páginas.** É o erro mais fácil de cometer aqui.

Duas diferenças intencionais por página:
1. O link de nav da própria página recebe `class="is-active"` — tanto em `.nav` quanto em `.mobile-nav__links`.
2. O sprite de cada página contém **apenas o subconjunto de ícones que aquela página usa** (o `index.html` tem o conjunto mais completo). Ao usar um `<use href="#i-x"/>` novo numa página, confirme que aquele `<symbol id="i-x">` existe no sprite **daquela** página; se não, copie o symbol do `index.html`.

### CSS (`css/styles.css`)

- Organizado em seções numeradas por comentário (`1. DESIGN TOKENS`, `4. BUTTONS`, `8. PROPERTY GRID`, …). Mantenha esse esquema ao adicionar estilos.
- **Todos os tokens vivem em `:root`.** Sempre use as variáveis, **nunca** hardcode cor/raio/sombra.
  - Cores: `--forest` `#1E3A2B` (primária), `--moss` `#3E9E6B`, `--gold` `#C6A34E` (acento/CTA de destaque), `--bg` `#FAF9F6`, `--surface` `#FFFFFF`, `--ink` `#2B2D2F` (texto), `--muted`, `--line` (bordas).
  - Também: escala de raios (`--r`, `--r-lg`…), sombras (`--shadow-sm/md/lg`), `--container` (1200px), `--gutter`, `--header-h`.
- Tipografia: `--font-display` = Plus Jakarta Sans (títulos/UI), `--font-body` = Inter (corpo). Carregadas via `@import` do Google Fonts no topo do arquivo (requer internet; sem ela cai em system sans).
- Naming BEM-ish: `bloco__elemento`, `bloco--modificador`.
- Breakpoints (mobile-first NÃO — é desktop-first, com `max-width`): **1199px** (`.searchbar` vira 2 colunas), **1279px** (`.ref-search` do header some), **1080px** (nav vira hambúrguer), **980px**, **860px** (`.grid-fields--3` vira 2 colunas), **620px** (layout mobile, tudo em coluna), **400px**.
- O reset (seção 2) contém três regras que **não podem ser removidas**, sob pena de quebrar o layout inteiro:
  - `svg { fill: none; stroke: currentColor; ... }` — os atributos `fill`/`stroke` do `<g>` que envolve os `<symbol>` do sprite **não são herdados** pelas instâncias `<use>`. Sem essa regra todo ícone do site vira uma silhueta preta.
  - `fieldset { border: 0; min-inline-size: 0 }` — o UA aplica moldura e largura mínima em `<fieldset>` (usado no cadastro da `negocie.html`).
  - `input, select, textarea { min-width: 0 }` — sem isso os campos estouram as colunas de grid/flex.

### JavaScript (`js/main.js`)

IIFE único, sem dependências. Cada bloco é ativado pela presença dos elementos/atributos certos no HTML — para "ligar" um comportamento numa página, use as classes/ids esperados:

- **Header no scroll:** adiciona `.is-scrolled` em `.header`.
- **Drawer mobile:** botões `#openMenu` / `#closeMenu`, painel `.mobile-nav` (abre com `.is-open`).
- **Tabs da busca:** `.searchbar__tab[data-mode]` → grava em `#searchMode`.
- **Filtro de imóveis:** `.chip[data-filter]` mostra/esconde `.property-card[data-type]` (`all` | `venda` | `aluguel`).
- **Favoritos:** persistidos em `localStorage` na chave **`urupema:favs`**. Botões `.card-fav[data-ref]`; contadores `.fav-count` no header.
- **Fallback de imagem:** `img` dentro de `.card-media` / `.split__media` / `.hero__bg` que der erro faz o container ganhar `.is-fallback` (mostra o placeholder da marca em vez da imagem quebrada). Sempre inclua o `<div class="card-media__fallback">` ao criar um card.
- **Reveal on scroll:** elementos `.reveal` ganham `.is-in` via IntersectionObserver; use `data-delay="1".."5"` para escalonar. **Gate `.js`:** o CSS só esconde `.reveal` quando `<html class="js">` (setado pelo script inline no `<head>`), então **sem JS todo o conteúdo aparece normalmente** — não remova esse script inline.
- **Wizard (Financie):** `#wizard` com painéis `.wizard__panel` (um `.is-active`), indicadores `.wstep`, botões `[data-next]` / `[data-prev]`, form `#wizardForm`, sucesso `#wizardSuccess`. Valida `[required]` do painel antes de avançar.
- **Forms genéricos:** qualquer `<form data-mock>` valida os `[required]`, esconde o form e mostra o `.form-success` irmão. **São só front-end (mock), não há backend nem envio real.**
- **Dropzone:** `.dropzone` clicável abre o `input[type=file]`; conta arquivos em `.dropzone__count`.
- **Ano do rodapé:** `.js-year`.

## Fatos do negócio (conteúdo real vs. placeholder)

- **Reais:** endereço **Rua Artur Pagani, 08 — Sala 01, Centro, Urupema/SC, 88625-000**; telefones **(49) 99160-3030** e **(49) 99107-5332**; WhatsApp usa `https://wa.me/5549991603030`.
- **Placeholder (a substituir quando houver dado real):** todos os **imóveis** da vitrine (fotos, preços, códigos `UR-XXXX`) são fictícios; o **e-mail** `contato@urupemaimoveis.com.br` é fictício; Instagram/Facebook apontam para as home genéricas (o dono troca tudo isso no painel, em "Dados do site"); os **formulários não enviam nada** (mock, até o M4).

## Assets de imagem (`imagens/`)

- `logo_site_urupema.png` — logo original (1920×1080, fundo transparente). **Fonte da verdade da marca — não sobrescrever.**
- `logo_urupema_icon.png` — só o ícone (montanha/sol/araucárias), usado no header (`.brand__icon`).
- `logo_urupema_trim.png` — logo completa recortada, usada no rodapé e na página Sobre.
- `favicon.svg` — favicon com o motivo da marca.

Os recortes `_icon`/`_trim` foram gerados a partir do original via script PowerShell `System.Drawing` (auto-crop das bordas transparentes). Se precisar regenerar, recorte a partir de `logo_site_urupema.png`, não das versões já cortadas.

**Fotos de imóveis/serra:** URLs do Unsplash (`images.unsplash.com/photo-...`) — dependem de internet, mas o fallback da marca cobre falhas. Ao trocar por fotos reais, coloque-as em `imagens/` e atualize o `src`.

### Dados editáveis (`data-cfg`)

Telefones, WhatsApp, e-mail, endereço, links das redes e os 3 números da home vêm da tabela
`configuracoes`. No HTML eles estão marcados, e o valor escrito no arquivo é só o padrão (vale sem a Function):
- `data-cfg="chave"` → o servidor troca o **texto**; no modo edição, o elemento fica editável no lugar.
- `data-cfg-href="chave"` → o servidor troca o **link** (`tel:+55…`, `https://wa.me/…`, `mailto:`, URL), conforme o tipo em `lib/config.js`.
- `data-cfg-mapa` → `src` do mapa do Google gerado do endereço (só em `contato.html`).
- `data-cfg-img="chave"` → o servidor troca o `src` da foto (campo tipo `imagem`; no modo edição aparece o botão "Trocar foto").
- Textos do próprio site (faixas de números, "Nossa história", "Nossos valores") usam `data-cfg` com campos `gaveta: 'pagina'` em `lib/config.js`: editados só no lugar, sem migração (sem linha no banco vale o texto do HTML). Tipo `destaque` deixa o ★/% final dourado; `paragrafo` abre caixa de texto grande.

**Ao colocar um telefone, link de WhatsApp/rede, e-mail ou endereço novo em qualquer página, marque-o.**
Sem a marcação, ele não muda quando o dono edita. Chave nova = acrescentar em `CAMPOS` (`lib/config.js`) + migração com o valor inicial.

## Ao modificar — checklist rápido

- Mudou header/footer/menu/contato/sprite? → replicar nas **5 páginas**.
- Dado de contato/rede/endereço novo numa página? → marcar com `data-cfg`/`data-cfg-href` (ver acima).
- Novo ícone numa página? → garantir o `<symbol>` no sprite **daquela** página.
- Cor/espaçamento/sombra? → usar variável de `:root`, não valor cru.
- Novo card de imóvel? → incluir `data-type`, `.card-media__fallback`, `.card-fav[data-ref]` único.
- Novo bloco visual? → considerar `.reveal` (+ `data-delay`) para manter o padrão de animação.
- Conferir sempre em **desktop e mobile** (o layout muda bastante em 620px).

## Tipo de projeto
- Tipo: SaaS / plataforma (site público + admin com imóveis, feed para portais, Instagram e leads) — reclassificado em 16/11/2026 (antes: Landing page / institucional, 11/09/2026)
- Arquivos de código: 7 (medido em 11/09/2026)
- Usar: Spec Kit (nas funcionalidades novas: admin, feed XML, Instagram; bug e ajuste pulam); agent-browser (desktop, mobile, login do admin e formulários); ponytail só no admin e nas funções de servidor, nunca na vitrine
- Não usar: code-review-graph (projeto pequeno; reavaliar se passar de ~100 arquivos de código), Scrapling (nenhum dado externo a raspar)
