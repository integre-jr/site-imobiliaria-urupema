/* ============================================================
   URUPEMA — imoveis.js
   Cards de imóveis vindos da API (spec 7.2): vitrine da home, busca, listagem
   (imoveis.html), "outros imóveis" e galeria da página do imóvel.
   Os cards têm o MESMO markup dos cards estáticos da index.html.
   Depende de window.Urupema (main.js).
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const U = window.Urupema || {};
  const prefixo = () => (U.adminPrefix ? U.adminPrefix() : '');

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const reais = (n) => 'R$ ' + milhar(n);
  const area = (n) => String(n).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' m²';
  const ICONE_TIPO = { casa: 'i-home', sobrado: 'i-home', cabana: 'i-home', apartamento: 'i-building', comercial: 'i-building', sala: 'i-building', galpao: 'i-building', chacara: 'i-trees', terreno: 'i-mountain' };

  // No painel, sempre o dado mais novo (a lista pública tem cache de 60 s no navegador).
  async function api(caminho) {
    const cache = document.documentElement.hasAttribute('data-admin') ? 'no-store' : 'default';
    const r = await fetch(caminho, { headers: { Accept: 'application/json' }, cache });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---------- Card ---------- */
  function precoCard(im) {
    if (im.finalidade === 'aluguel') return im.preco_aluguel ? `${reais(im.preco_aluguel)} <span class="per">/mês</span>` : 'Consulte';
    if (im.finalidade === 'venda_aluguel' && im.preco_aluguel) return `${reais(im.preco_venda)} <span class="per">ou ${reais(im.preco_aluguel)}/mês</span>`;
    return im.preco_venda ? reais(im.preco_venda) : 'Consulte';
  }

  function specsCard(im) {
    const s = [];
    if (im.quartos) s.push(['i-bed', `${im.quartos} ${im.quartos === 1 ? 'quarto' : 'quartos'}`]);
    if (im.banheiros) s.push(['i-bath', `${im.banheiros} banh.`]);
    if (im.vagas) s.push(['i-car', `${im.vagas} ${im.vagas === 1 ? 'vaga' : 'vagas'}`]);
    const a = im.area_util || im.area_total;
    if (a) s.push(['i-area', area(a)]);
    for (const c of im.caracteristicas || []) {
      if (s.length >= 3) break;
      s.push(['i-check', c.rotulo]);
    }
    return s.slice(0, 4).map(([i, t]) => `<span class="spec"><svg><use href="#${i}"/></svg> ${esc(t)}</span>`).join('');
  }

  function cardHtml(im, k) {
    const tipoCard = im.finalidade === 'aluguel' ? 'aluguel' : 'venda';
    const badge = im.status === 'reservado'
      ? '<span class="badge badge--rent">Reservado</span>'
      : im.finalidade === 'aluguel' ? '<span class="badge badge--rent">Aluguel</span>'
        : im.finalidade === 'venda_aluguel' ? '<span class="badge badge--sale">Venda e aluguel</span>'
          : '<span class="badge badge--sale">Venda</span>';
    const delay = k % 3 ? ` data-delay="${k % 3}"` : '';
    const capa = im.capa && im.capa.p;
    return `<article class="property-card reveal"${delay} data-type="${tipoCard}">
          <div class="card-media${capa ? '' : ' is-fallback'}">
            ${capa ? `<img src="${esc(capa)}" alt="${esc(im.titulo)}" loading="lazy">` : ''}
            <div class="card-media__fallback"><svg><use href="#${ICONE_TIPO[im.tipo] || 'i-home'}"/></svg><span>Urupema · SC</span></div>
            ${badge}
            <button class="card-fav" data-ref="${esc(im.ref)}" aria-label="Favoritar"><svg><use href="#i-heart"/></svg></button>
            <span class="card-ref">${esc(im.ref)}</span>
          </div>
          <div class="card-body">
            <div class="card-price">${precoCard(im)}</div>
            <h3 class="card-title">${esc(im.titulo)}</h3>
            <p class="card-loc"><svg><use href="#i-pin"/></svg> ${esc([im.bairro, `${im.cidade}/${im.uf}`].filter(Boolean).join(' · '))}</p>
            <div class="card-specs">${specsCard(im)}</div>
            <div class="card-cta"><a href="${prefixo()}/imovel/${encodeURIComponent(im.ref)}" class="btn btn--outline btn--sm">Ver detalhes <svg><use href="#i-arrow-right"/></svg></a></div>
          </div>
        </article>`;
  }

  function renderizar(grade, itens, { acrescentar = false } = {}) {
    const html = itens.map((im, k) => cardHtml(im, k)).join('');
    if (acrescentar) grade.insertAdjacentHTML('beforeend', html);
    else grade.innerHTML = html;
    U.observeReveal && U.observeReveal(grade);
    U.syncFavs && U.syncFavs();
    U.applyChips && U.applyChips(grade.closest('section') || document);
    U.checkBroken && U.checkBroken(grade);
    document.dispatchEvent(new CustomEvent('urupema:cards', { detail: { grade } }));
  }

  const vazio = (grade, texto) => { grade.innerHTML = `<p class="grade-vazia">${esc(texto)}</p>`; };

  /* ---------- Home: vitrine + busca ---------- */
  async function vitrine() {
    const grade = $('[data-vitrine]');
    if (!grade) return;
    try {
      const r = await api('/api/imoveis?destaque=1&limite=6');
      if (r.itens.length) renderizar(grade, r.itens);
      else vazio(grade, 'Novos imóveis em breve. Fale com a gente para saber o que está chegando.');
      preencherBairros($('#f-local'), r.bairros);
    } catch (e) {
      /* sem API (ex.: arquivo aberto direto): ficam os cards estáticos */
    }
  }

  function preencherBairros(select, bairros) {
    if (!select || !bairros) return;
    const atual = select.value;
    const primeiro = select.options[0];
    select.replaceChildren(primeiro, ...bairros.map((b) => new Option(b, b)));
    if (bairros.includes(atual)) select.value = atual;
  }

  function busca() {
    const botao = $('#buscar');
    if (!botao) return;
    botao.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = $('#f-ref') && $('#f-ref').value.trim();
      if (ref) {
        const r = U.normalizeRef ? U.normalizeRef(ref) : null;
        location.href = r ? `${prefixo()}/imovel/${r}` : `${prefixo()}/imoveis?ref=${encodeURIComponent(ref)}`;
        return;
      }
      const q = new URLSearchParams();
      q.set('finalidade', ($('#searchMode') && $('#searchMode').value) === 'alugar' ? 'aluguel' : 'venda');
      const campos = { tipo: '#f-tipo', bairro: '#f-local', min: '#f-min', max: '#f-max' };
      for (const [nome, sel] of Object.entries(campos)) {
        let v = $(sel) ? $(sel).value.trim() : '';
        if (nome === 'min' || nome === 'max') v = v.replace(/\D/g, '');   // "R$ 300.000" → "300000"
        if (v) q.set(nome, v);
      }
      location.href = `${prefixo()}/imoveis?${q}`;
    });
  }

  /* ---------- Listagem (imoveis.html) ---------- */
  async function listagem() {
    const grade = $('#listagem');
    if (!grade) return;
    const form = $('#filtros');
    const info = $('#listagemInfo');
    const mais = $('#carregarMais');
    const params = new URLSearchParams(location.search);
    const favoritos = params.get('favoritos') === '1';
    let pagina = 1;
    let total = 0;

    // Preenche o formulário com a querystring
    for (const el of form.elements) if (el.name && params.has(el.name)) el.value = params.get(el.name);
    api('/api/imoveis/opcoes').then((o) => {
      const tipo = form.elements.tipo;
      const atual = params.get('tipo') || '';
      tipo.append(...Object.entries(o.tipos).map(([k, v]) => new Option(v, k)));
      tipo.value = atual;
    }).catch(() => {});

    if (favoritos) {
      $('#listagemTitulo').textContent = 'Seus favoritos';
      form.hidden = true;
    }

    function consulta() {
      const q = new URLSearchParams();
      if (favoritos) {
        q.set('refs', (U.getFavs ? U.getFavs() : []).join(','));
      } else {
        for (const k of ['finalidade', 'tipo', 'bairro', 'min', 'max', 'quartos', 'ordem', 'ref']) if (params.get(k)) q.set(k, params.get(k));
      }
      q.set('limite', '12');
      q.set('pagina', String(pagina));
      return q;
    }

    async function carregar(acrescentar) {
      mais.hidden = true;
      if (!acrescentar) info.textContent = 'Carregando imóveis…';
      try {
        if (favoritos && !(U.getFavs && U.getFavs().length)) {
          info.textContent = '';
          vazio(grade, 'Você ainda não favoritou nenhum imóvel. Toque no coração dos cards para guardar os que gostar.');
          return;
        }
        const r = await api('/api/imoveis?' + consulta());
        total = r.total;
        preencherBairros(form.elements.bairro, r.bairros);
        if (params.get('bairro')) form.elements.bairro.value = params.get('bairro');
        if (!r.itens.length && !acrescentar) {
          info.textContent = '';
          vazio(grade, favoritos ? 'Seus favoritos não estão mais disponíveis.' : 'Nenhum imóvel com esses filtros. Tente ampliar a busca.');
          return;
        }
        renderizar(grade, r.itens, { acrescentar });
        const mostrados = $$('.property-card', grade).length;
        info.textContent = `${total} ${total === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}`;
        mais.hidden = mostrados >= total;
      } catch (e) {
        info.textContent = 'Não foi possível carregar os imóveis agora. Tente de novo em instantes.';
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = new URLSearchParams();
      for (const el of form.elements) if (el.name && el.value.trim()) q.set(el.name, el.name === 'min' || el.name === 'max' ? el.value.replace(/\D/g, '') : el.value.trim());
      location.search = q.toString();
    });
    mais.addEventListener('click', () => { pagina += 1; carregar(true); });
    carregar(false);
  }

  /* ---------- Página do imóvel: outros imóveis ---------- */
  async function outros() {
    const grade = $('[data-outros]');
    if (!grade) return;
    const secao = grade.closest('section');
    const ref = grade.dataset.ref;
    try {
      const vistos = new Set([ref]);
      const lista = [];
      for (const q of [`tipo=${encodeURIComponent(grade.dataset.tipo)}`, `finalidade=${encodeURIComponent(grade.dataset.finalidade)}`, '']) {
        if (lista.length >= 3) break;
        const r = await api(`/api/imoveis?limite=6&${q}`);
        for (const im of r.itens) if (!vistos.has(im.ref) && lista.length < 3) { vistos.add(im.ref); lista.push(im); }
      }
      if (lista.length) renderizar(grade, lista);
      else secao.hidden = true;
    } catch (e) {
      secao.hidden = true;
    }
  }

  /* ---------- Página do imóvel: galeria + ampliação ---------- */
  function galeria() {
    const principal = $('[data-galeria-fotos]');
    if (!principal) return;
    let fotos = [];
    try { fotos = JSON.parse(principal.dataset.galeriaFotos); } catch (e) { return; }
    const img = $('[data-galeria-abrir] img', principal);
    let atual = 0;

    const mostrar = (k) => {
      atual = (k + fotos.length) % fotos.length;
      img.src = fotos[atual];
      principal.classList.remove('is-fallback');
      $$('[data-galeria-indice]').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.galeriaIndice) === atual));
      if (caixa && !caixa.hidden) $('img', caixa).src = fotos[atual];
    };
    $$('[data-galeria-indice]').forEach((b) => b.addEventListener('click', () => mostrar(Number(b.dataset.galeriaIndice))));

    let caixa = null;
    const fechar = () => { caixa.hidden = true; document.body.style.overflow = ''; };
    $('[data-galeria-abrir]', principal).addEventListener('click', () => {
      if (!caixa) {
        caixa = document.createElement('div');
        caixa.className = 'lightbox';
        caixa.setAttribute('role', 'dialog');
        caixa.setAttribute('aria-modal', 'true');
        caixa.setAttribute('aria-label', 'Fotos do imóvel');
        caixa.innerHTML = '<img alt=""><button type="button" class="lightbox__fechar" aria-label="Fechar"><svg><use href="#i-close"/></svg></button>'
          + (fotos.length > 1 ? '<button type="button" class="lightbox__nav lightbox__nav--ant" aria-label="Foto anterior"><svg><use href="#i-arrow-right"/></svg></button><button type="button" class="lightbox__nav" aria-label="Próxima foto"><svg><use href="#i-arrow-right"/></svg></button>' : '');
        document.body.append(caixa);
        $('.lightbox__fechar', caixa).addEventListener('click', fechar);
        caixa.addEventListener('click', (e) => { if (e.target === caixa) fechar(); });
        $('.lightbox__nav--ant', caixa)?.addEventListener('click', () => mostrar(atual - 1));
        $('.lightbox__nav:not(.lightbox__nav--ant)', caixa)?.addEventListener('click', () => mostrar(atual + 1));
        document.addEventListener('keydown', (e) => {
          if (caixa.hidden) return;
          if (e.key === 'Escape') fechar();
          if (e.key === 'ArrowRight') mostrar(atual + 1);
          if (e.key === 'ArrowLeft') mostrar(atual - 1);
        });
      }
      $('img', caixa).src = fotos[atual];
      caixa.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lightbox__fechar', caixa).focus();
    });
  }

  vitrine();
  busca();
  listagem();
  outros();
  galeria();

  // O painel chama isto depois de salvar um anúncio, para a página mostrar o que mudou.
  U.recarregarImoveis = () => { vitrine(); outros(); if ($('#listagem')) location.reload(); };
})();
