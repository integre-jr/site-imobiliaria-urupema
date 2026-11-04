# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Site institucional da **Urupema Negócios Imobiliários** — imobiliária de Urupema/SC (Serra Catarinense). Site estático de marketing, multi-página, em **pt-BR**. Estética "Clean & Premium".

**Stack:** HTML + CSS + JavaScript puro (vanilla). **Não há** build system, framework, bundler, `package.json`, dependências npm nem testes. Nada para compilar ou instalar.

## Como rodar / visualizar

- **Abrir direto:** basta abrir qualquer `.html` no navegador (`file://`). Funciona sem servidor — tudo foi projetado para isso (por isso não há includes de servidor; ver abaixo).
- **Servir estático (opcional):** `python -m http.server` na raiz e acessar `http://localhost:8000`.
- **Screenshot / conferência visual** (Chrome headless, Windows PowerShell):
  ```powershell
  & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,4600 --user-data-dir="<pasta-temp>" "--screenshot=<saida>.png" "file:///c:/Users/guiha/Desktop/Site%20Imobili%C3%A1ria%20Urupema/index.html"
  ```
  - `--user-data-dir` é necessário, senão o screenshot falha silenciosamente.
  - Mobile: use `--window-size=390,7600`. A altura precisa ser ≥ altura da página (senão corta).
  - **Cuidado (PowerShell):** montar URL com backtick — `"$base`financie.html"` — quebra, pois `` `f `` vira form-feed. Use concatenação: `$base + "financie.html"`.

## Arquitetura

```
index.html  sobre.html  financie.html  negocie.html  contato.html   ← as 5 páginas
css/styles.css   ← TODO o estilo (design system + componentes), um arquivo só
js/main.js       ← TODO o comportamento, um IIFE só
imagens/         ← logos + favicon
```

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
- **Placeholder (a substituir quando houver dado real):** todos os **imóveis** da vitrine (fotos, preços, códigos `UR-XXXX`) são fictícios; o **e-mail** `contato@urupemaimoveis.com.br` é fictício; Instagram/Facebook apontam para as home genéricas; os **formulários não enviam nada** (mock).

## Assets de imagem (`imagens/`)

- `logo_site_urupema.png` — logo original (1920×1080, fundo transparente). **Fonte da verdade da marca — não sobrescrever.**
- `logo_urupema_icon.png` — só o ícone (montanha/sol/araucárias), usado no header (`.brand__icon`).
- `logo_urupema_trim.png` — logo completa recortada, usada no rodapé e na página Sobre.
- `favicon.svg` — favicon com o motivo da marca.

Os recortes `_icon`/`_trim` foram gerados a partir do original via script PowerShell `System.Drawing` (auto-crop das bordas transparentes). Se precisar regenerar, recorte a partir de `logo_site_urupema.png`, não das versões já cortadas.

**Fotos de imóveis/serra:** URLs do Unsplash (`images.unsplash.com/photo-...`) — dependem de internet, mas o fallback da marca cobre falhas. Ao trocar por fotos reais, coloque-as em `imagens/` e atualize o `src`.

## Ao modificar — checklist rápido

- Mudou header/footer/menu/contato/sprite? → replicar nas **5 páginas**.
- Novo ícone numa página? → garantir o `<symbol>` no sprite **daquela** página.
- Cor/espaçamento/sombra? → usar variável de `:root`, não valor cru.
- Novo card de imóvel? → incluir `data-type`, `.card-media__fallback`, `.card-fav[data-ref]` único.
- Novo bloco visual? → considerar `.reveal` (+ `data-delay`) para manter o padrão de animação.
- Conferir sempre em **desktop e mobile** (o layout muda bastante em 620px).

## Tipo de projeto
- Tipo: Landing page / institucional — registrado em 11/09/2026
- Arquivos de código: 7 (medido em 11/09/2026)
- Usar: agent-browser (conferir desktop e mobile); grill-me só se chegar pedido novo e vago
- Não usar: code-review-graph (projeto pequeno), ponytail (já é HTML/CSS/JS puro e o visual é o produto), Spec Kit (o escopo sai do layout), Scrapling (nenhum dado externo)
