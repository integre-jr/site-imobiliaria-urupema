// Gestão de anúncios no modo edição (spec 8.2, marco M3):
// - abrirAnuncios(): gaveta com TODOS os anúncios (inclusive rascunhos), busca, filtro e ações rápidas;
// - abrirEditorAnuncio(idOuRef): formulário completo, com fotos, endereço (ViaCEP) e publicação.
import { api, ErroApi, limparErro, mostrarErro, toast } from './api.js';
import { abrirGaveta, fecharGaveta, tituloGaveta } from './gaveta.js';
import { enviarFoto, prepararFoto } from './imagens.js';
import { abrirPostInstagram } from './postar.js';

let opcoes = null;
const carregarOpcoes = async () => (opcoes ??= await api('/api/imoveis/opcoes'));

const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const reais = (n) => 'R$ ' + milhar(n);
const PUBLICOS = ['ativo', 'reservado'];

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(texto, aoClicar, classe = 'btn--outline') {
  const b = el('button', `btn ${classe} btn--sm`, texto);
  b.type = 'button';
  b.addEventListener('click', aoClicar);
  return b;
}

function precoResumo(im) {
  const p = [];
  if (im.finalidade !== 'aluguel' && im.preco_venda) p.push(reais(im.preco_venda));
  if (im.finalidade !== 'venda' && im.preco_aluguel) p.push(reais(im.preco_aluguel) + '/mês');
  return p.join(' ou ') || 'sem preço';
}

// Depois de qualquer mudança: atualiza os cards da página e, na página do próprio imóvel, recarrega.
function avisarPagina(ref) {
  const main = document.querySelector('main[data-imovel-ref]');
  if (main && ref && main.dataset.imovelRef === ref) { location.reload(); return; }
  window.Urupema?.recarregarImoveis?.();
}

/* ============================================================
   LISTA DE ANÚNCIOS
   ============================================================ */
export async function abrirAnuncios() {
  await carregarOpcoes();
  const corpo = abrirGaveta('Anúncios', { larga: true });
  if (!corpo) return;

  const topo = el('div', 'anuncios-topo');
  const novo = botao('+ Novo anúncio', () => abrirEditorAnuncio(null, { voltarParaLista: true }), 'btn--primary');
  const busca = el('input', 'input');
  busca.type = 'search';
  busca.placeholder = 'Buscar por código, título ou bairro';
  busca.setAttribute('aria-label', 'Buscar anúncios');
  const status = el('select', 'select');
  status.setAttribute('aria-label', 'Filtrar por situação');
  status.append(new Option('Todas as situações', ''), ...Object.entries(opcoes.status).map(([k, v]) => new Option(v, k)));
  topo.append(novo, busca, status);

  const uso = el('p', 'anuncios-uso');
  const lista = el('ul', 'adm-lista anuncios-lista');
  lista.setAttribute('aria-live', 'polite');
  corpo.append(el('p', 'gaveta__intro', 'Tudo o que está anunciado (ou em rascunho). Só os anúncios "Publicado" e "Reservado" aparecem no site.'), topo, uso, lista);

  async function acaoRapida(im, dados, mensagem) {
    try {
      await api(`/api/admin/imoveis/${im.id}`, { metodo: 'PUT', dados });
      toast(mensagem);
      carregar();
      avisarPagina(im.ref);
    } catch (e) {
      // ex.: publicar sem preço → abre o formulário para completar
      if (e instanceof ErroApi && e.status === 400) abrirEditorAnuncio(im.id, { voltarParaLista: true });
    }
  }

  function item(im) {
    const li = el('li', 'adm-item anuncio-item' + (PUBLICOS.includes(im.status) ? '' : ' is-inativo'));
    const capa = el('div', 'anuncio-capa');
    if (im.capa) {
      const img = el('img');
      img.src = im.capa.p;
      img.alt = '';
      img.loading = 'lazy';
      capa.append(img);
    }
    const info = el('div', 'adm-item__info');
    const titulo = el('strong', '', im.titulo);
    const tags = el('div', 'anuncio-tags');
    const classeStatus = im.status === 'ativo' ? 'tag--ok' : im.status === 'rascunho' || im.status === 'arquivado' ? 'tag--off' : '';
    tags.append(el('span', `tag ${classeStatus}`, opcoes.status[im.status]));
    if (im.destaque) tags.append(el('span', 'tag tag--admin', '★ Destaque'));
    if (PUBLICOS.includes(im.status) && !im.no_site) tags.append(el('span', 'tag', 'Fora do site'));
    info.append(titulo, tags, el('small', '', `${im.ref} · ${opcoes.finalidades[im.finalidade]} · ${precoResumo(im)}${im.bairro ? ' · ' + im.bairro : ''} · ${im.n_fotos} ${im.n_fotos === 1 ? 'foto' : 'fotos'}`));

    const acoes = el('div', 'adm-item__acoes');
    acoes.append(botao('Editar', () => abrirEditorAnuncio(im.id, { voltarParaLista: true }), 'btn--primary'));
    if (im.status === 'rascunho' || im.status === 'arquivado') {
      acoes.append(botao('Publicar', () => acaoRapida(im, { status: 'ativo', no_site: true }, 'Publicado. Já aparece no site.')));
    } else if (im.status === 'ativo') {
      acoes.append(botao('Tirar do site', () => acaoRapida(im, { status: 'rascunho' }, 'Anúncio voltou para rascunho e saiu do site.')));
    }
    acoes.append(botao(im.destaque ? 'Tirar destaque' : '★ Destacar', () =>
      acaoRapida(im, { destaque: !im.destaque }, im.destaque ? 'Saiu da página inicial.' : 'Vai aparecer na página inicial.')));
    if (PUBLICOS.includes(im.status)) acoes.append(botao('Instagram', () => abrirPostInstagram(im.id)));
    if (PUBLICOS.includes(im.status) && im.no_site) {
      const ver = el('a', 'btn btn--ghost btn--sm', 'Ver no site');
      ver.href = `/imovel/${im.ref}`;
      ver.target = '_blank';
      ver.rel = 'noopener';
      acoes.append(ver);
    }
    if (im.status === 'rascunho' || im.status === 'arquivado') {
      acoes.append(botao('Excluir', async () => {
        if (!confirm(`Excluir o anúncio ${im.ref} e as fotos dele? Isso não pode ser desfeito.`)) return;
        try {
          await api(`/api/admin/imoveis/${im.id}`, { metodo: 'DELETE' });
          toast('Anúncio excluído.');
          carregar();
          avisarPagina(null);
        } catch { /* o api() já avisou */ }
      }, 'btn--perigo'));
    } else {
      acoes.append(botao('Arquivar', () => {
        if (confirm(`Arquivar ${im.ref}? Ele sai do site e dos portais, mas fica guardado aqui.`)) acaoRapida(im, { status: 'arquivado' }, 'Anúncio arquivado.');
      }, 'btn--ghost'));
    }
    li.append(capa, info, acoes);
    return li;
  }

  async function carregar() {
    const q = new URLSearchParams();
    if (busca.value.trim()) q.set('busca', busca.value.trim());
    if (status.value) q.set('status', status.value);
    try {
      const r = await api('/api/admin/imoveis?' + q);
      lista.replaceChildren(...(r.itens.length ? r.itens.map(item) : [el('li', 'adm-item', 'Nenhum anúncio encontrado.')]));
      const pct = (r.uso.bytes / r.uso.limite) * 100;
      uso.textContent = `Espaço de fotos usado: ${(r.uso.bytes / 1048576).toFixed(1)} MB de 1 GB (${pct.toFixed(1)}%).`;
      uso.classList.toggle('is-alerta', pct >= 80);
    } catch { /* o api() já avisou */ }
  }

  let espera;
  busca.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(carregar, 300); });
  status.addEventListener('change', carregar);
  carregar();
}

/* ============================================================
   FORMULÁRIO DO ANÚNCIO
   ============================================================ */
const HTML_FORM = `
<div class="form-erro" role="alert" hidden></div>

<fieldset class="adm-grupo">
  <legend>O imóvel</legend>
  <div class="form-field">
    <span class="rotulo">Finalidade</span>
    <div class="radio-pills" data-finalidades></div>
  </div>
  <div class="grid-fields">
    <div class="form-field"><label for="a-tipo">Tipo</label><select class="select" id="a-tipo" name="tipo" required></select></div>
    <div class="form-field"><label for="a-status">Situação</label><select class="select" id="a-status" name="status"></select></div>
  </div>
  <div class="form-field">
    <label for="a-titulo">Título do anúncio</label>
    <input class="input" id="a-titulo" name="titulo" maxlength="120" required placeholder="Ex.: Casa de campo com lareira no Centro">
    <span class="hint" data-contador="titulo"></span>
  </div>
  <div class="form-field">
    <label for="a-descricao">Descrição</label>
    <textarea class="textarea" id="a-descricao" name="descricao" maxlength="5000" rows="7" placeholder="Conte o que o imóvel tem de melhor: ambientes, acabamento, vista, entorno…"></textarea>
    <span class="hint" data-contador="descricao"></span>
  </div>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Valores</legend>
  <div class="grid-fields">
    <div class="form-field" data-so="venda"><label for="a-pv">Preço de venda (R$)</label><input class="input" id="a-pv" name="preco_venda" inputmode="numeric" placeholder="Ex.: 850.000"></div>
    <div class="form-field" data-so="aluguel"><label for="a-pa">Aluguel por mês (R$)</label><input class="input" id="a-pa" name="preco_aluguel" inputmode="numeric" placeholder="Ex.: 2.800"></div>
    <div class="form-field"><label for="a-cond">Condomínio por mês (R$)</label><input class="input" id="a-cond" name="condominio" inputmode="numeric" placeholder="Se houver"></div>
    <div class="form-field"><label for="a-iptu">IPTU por ano (R$)</label><input class="input" id="a-iptu" name="iptu_anual" inputmode="numeric" placeholder="Se souber"></div>
  </div>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Fotos</legend>
  <div data-fotos></div>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Endereço</legend>
  <div class="grid-fields">
    <div class="form-field"><label for="a-cep">CEP</label><input class="input" id="a-cep" name="cep" inputmode="numeric" maxlength="9" placeholder="88625-000"><span class="hint" data-cep-status>Digite o CEP para preencher a rua, o bairro e a cidade.</span></div>
    <div class="form-field"><label for="a-bairro">Bairro ou localidade</label><input class="input" id="a-bairro" name="bairro" maxlength="60" list="a-bairros"><datalist id="a-bairros"></datalist></div>
    <div class="form-field col-span-full"><label for="a-rua">Rua</label><input class="input" id="a-rua" name="logradouro" maxlength="120"></div>
    <div class="form-field"><label for="a-num">Número</label><input class="input" id="a-num" name="numero" maxlength="20"></div>
    <div class="form-field"><label for="a-comp">Complemento</label><input class="input" id="a-comp" name="complemento" maxlength="60"></div>
    <div class="form-field"><label for="a-cidade">Cidade</label><input class="input" id="a-cidade" name="cidade" maxlength="60"></div>
    <div class="form-field"><label for="a-uf">UF</label><input class="input" id="a-uf" name="uf" maxlength="2"></div>
  </div>
  <div class="form-field">
    <label for="a-exibir">O que mostrar no site</label>
    <select class="select" id="a-exibir" name="exibir_endereco"></select>
    <span class="hint">Por segurança, o padrão é mostrar só o bairro.</span>
  </div>
  <details class="anuncio-mapa">
    <summary>Posição exata no mapa (opcional)</summary>
    <p class="hint">No Google Maps, toque e segure no local e copie os dois números que aparecem. Só é usado com "Endereço completo".</p>
    <div class="grid-fields">
      <div class="form-field"><label for="a-lat">Latitude</label><input class="input" id="a-lat" name="latitude" inputmode="decimal" placeholder="-28.0"></div>
      <div class="form-field"><label for="a-lng">Longitude</label><input class="input" id="a-lng" name="longitude" inputmode="decimal" placeholder="-49.9"></div>
    </div>
  </details>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Medidas e cômodos</legend>
  <div class="grid-fields grid-fields--3">
    <div class="form-field"><label for="a-au">Área útil (m²)</label><input class="input" id="a-au" name="area_util" inputmode="decimal"></div>
    <div class="form-field"><label for="a-at">Área do terreno (m²)</label><input class="input" id="a-at" name="area_total" inputmode="decimal"></div>
    <div class="form-field"><label for="a-q">Quartos</label><input class="input" id="a-q" name="quartos" type="number" min="0" max="99"></div>
    <div class="form-field"><label for="a-s">Suítes</label><input class="input" id="a-s" name="suites" type="number" min="0" max="99"></div>
    <div class="form-field"><label for="a-b">Banheiros</label><input class="input" id="a-b" name="banheiros" type="number" min="0" max="99"></div>
    <div class="form-field"><label for="a-v">Vagas</label><input class="input" id="a-v" name="vagas" type="number" min="0" max="99"></div>
  </div>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Características</legend>
  <div class="anuncio-caracteristicas" data-caracteristicas></div>
</fieldset>

<fieldset class="adm-grupo">
  <legend>Onde aparece</legend>
  <label class="check"><input type="checkbox" name="no_site"> Mostrar no site</label>
  <label class="check"><input type="checkbox" name="destaque"> Destaque na página inicial</label>
  <label class="check"><input type="checkbox" name="no_grupo_olx"> Enviar para OLX, ZAP e Viva Real</label>
  <div class="form-field" data-so-olx>
    <label for="a-olx">Tipo de anúncio nos portais</label>
    <select class="select" id="a-olx" name="tipo_publicacao_olx"></select>
    <span class="hint">Precisa caber no plano contratado no Canal Pro. O link do feed fica na gaveta "Portais".</span>
  </div>
  <div class="anuncio-portais" data-portais aria-live="polite"></div>
  <label class="check"><input type="checkbox" name="postar_instagram"> Postar no Instagram ao salvar</label>
</fieldset>

<div class="anuncio-acoes">
  <span class="anuncio-acoes__info" data-info></span>
  <button class="btn btn--outline btn--sm" type="button" data-cancelar>Fechar</button>
  <button class="btn btn--outline btn--sm" type="submit" data-salvar>Salvar</button>
  <button class="btn btn--gold btn--sm" type="button" data-publicar>Publicar no site</button>
</div>`;

const NUMEROS = ['preco_venda', 'preco_aluguel', 'condominio', 'iptu_anual'];
const fmtCampo = (v) => (v === null || v === undefined ? '' : String(v));
const fmtDinheiro = (v) => (v ? milhar(v) : '');

// opcoes.voltarParaLista: ao fechar, reabre a lista de anúncios.
// inicial: valores para um anúncio NOVO (ex.: vindo de um lead do "Negocie"); fotos_lead = URLs das fotos do lead.
export async function abrirEditorAnuncio(idOuRef = null, { voltarParaLista = false, inicial = null } = {}) {
  await carregarOpcoes();
  let im = null;
  if (idOuRef) {
    try { im = await api(`/api/admin/imoveis/${encodeURIComponent(idOuRef)}`); } catch { return; }
  }
  let sujo = false;
  const corpo = abrirGaveta(im ? `Editar ${im.ref}` : 'Novo anúncio', {
    larga: true,
    aoFechar: () => {
      if (sujo && !confirm('Há alterações não salvas neste anúncio. Fechar mesmo assim?')) return false;
      if (voltarParaLista) setTimeout(abrirAnuncios, 0);
      return true;
    },
  });
  if (!corpo) return;

  const form = el('form', 'adm-form anuncio-form');
  form.noValidate = true;
  form.innerHTML = HTML_FORM;
  corpo.append(form);
  const f = form.elements;

  // Opções vindas do servidor (os rótulos são texto puro: entram com textContent/Option)
  const pills = form.querySelector('[data-finalidades]');
  for (const [k, v] of Object.entries(opcoes.finalidades)) {
    const lbl = el('label', 'radio-pill');
    const r = el('input');
    r.type = 'radio';
    r.name = 'finalidade';
    r.value = k;
    lbl.append(r, el('span', '', v));
    pills.append(lbl);
  }
  f.tipo.append(...Object.entries(opcoes.tipos).map(([k, v]) => new Option(v, k)));
  f.status.append(...Object.entries(opcoes.status).map(([k, v]) => new Option(v, k)));
  f.exibir_endereco.append(...Object.entries(opcoes.exibir_endereco).map(([k, v]) => new Option(v, k)));
  f.tipo_publicacao_olx.append(...Object.entries(opcoes.publicacao_olx).map(([k, v]) => new Option(v, k)));
  form.querySelector('#a-bairros').append(...opcoes.bairros_sugeridos.map((b) => new Option(b)));
  const cars = form.querySelector('[data-caracteristicas]');
  for (const [k, v] of Object.entries(opcoes.caracteristicas)) {
    const lbl = el('label', 'check');
    const c = el('input');
    c.type = 'checkbox';
    c.name = 'caracteristicas';
    c.value = k;
    lbl.append(c, ' ' + v);
    cars.append(lbl);
  }

  function preencher(d) {
    const v = d || { finalidade: 'venda', tipo: 'casa', status: 'rascunho', cidade: 'Urupema', uf: 'SC', exibir_endereco: 'bairro', no_site: true, no_grupo_olx: true, destaque: false, tipo_publicacao_olx: 'STANDARD', caracteristicas: [] };
    form.querySelector(`input[name=finalidade][value="${v.finalidade}"]`).checked = true;
    for (const nome of ['tipo', 'status', 'titulo', 'descricao', 'cep', 'bairro', 'logradouro', 'numero', 'complemento', 'cidade', 'uf',
      'exibir_endereco', 'latitude', 'longitude', 'area_util', 'area_total', 'quartos', 'suites', 'banheiros', 'vagas', 'tipo_publicacao_olx']) {
      f[nome].value = fmtCampo(v[nome]);
    }
    for (const nome of NUMEROS) f[nome].value = fmtDinheiro(v[nome]);
    for (const nome of ['no_site', 'destaque', 'no_grupo_olx']) f[nome].checked = !!v[nome];
    f.postar_instagram.checked = false;
    mostrarPortais();
    form.querySelectorAll('input[name=caracteristicas]').forEach((c) => { c.checked = (v.caracteristicas || []).includes(c.value); });
    atualizarVisibilidade();
    contar();
    atualizarRodape();
  }

  function lerDados() {
    const d = {};
    for (const el2 of f) {
      if (!el2.name || el2.name === 'caracteristicas' || el2.name === 'finalidade') continue;
      d[el2.name] = el2.type === 'checkbox' ? el2.checked : el2.value;
    }
    d.finalidade = form.querySelector('input[name=finalidade]:checked')?.value;
    d.caracteristicas = [...form.querySelectorAll('input[name=caracteristicas]:checked')].map((c) => c.value);
    return d;
  }

  function atualizarVisibilidade() {
    const fin = form.querySelector('input[name=finalidade]:checked')?.value;
    form.querySelector('[data-so="venda"]').hidden = fin === 'aluguel';
    form.querySelector('[data-so="aluguel"]').hidden = fin === 'venda';
    form.querySelector('[data-so-olx]').hidden = !f.no_grupo_olx.checked;
  }

  // O que falta para o anúncio ir para OLX/ZAP/Viva Real (calculado pelo servidor ao carregar/salvar).
  function mostrarPortais() {
    const caixa = form.querySelector('[data-portais]');
    caixa.replaceChildren();
    caixa.className = 'anuncio-portais';
    if (!im || !f.no_grupo_olx.checked) return;
    if (im.origem === 'seed') { caixa.textContent = 'Anúncio de demonstração (fictício): nunca vai para os portais.'; return; }
    const p = im.pendencias_portais || [];
    if (!p.length) {
      caixa.classList.add('is-ok');
      caixa.textContent = im.status === 'ativo'
        ? 'Pronto para os portais: entra na próxima leitura do Canal Pro.'
        : 'Pronto para os portais: entra quando estiver "Publicado".';
      return;
    }
    caixa.append(el('strong', '', 'Ainda não vai para os portais. Falta:'));
    const ul = el('ul');
    p.forEach((x) => ul.append(el('li', '', x)));
    caixa.append(ul);
  }

  // Depois de mexer nas fotos: pede ao servidor as pendências de novo (o mínimo de fotos muda).
  async function atualizarPendencias() {
    try {
      const atual = await api(`/api/admin/imoveis/${im.id}`, { semToast: true });
      im.pendencias_portais = atual.pendencias_portais;
      mostrarPortais();
    } catch { /* fica o aviso anterior */ }
  }

  function contar() {
    form.querySelector('[data-contador="titulo"]').textContent = `${f.titulo.value.length} de 120 caracteres`;
    form.querySelector('[data-contador="descricao"]').textContent = `${f.descricao.value.length} de 5.000 caracteres`;
  }

  function atualizarRodape() {
    const publico = im && PUBLICOS.includes(im.status) && im.no_site;
    form.querySelector('[data-publicar]').hidden = !!publico;
    form.querySelector('[data-salvar]').textContent = im ? 'Salvar alterações' : 'Salvar rascunho';
    const info = form.querySelector('[data-info]');
    info.replaceChildren();
    if (im) {
      info.append(`${im.ref} · ${opcoes.status[im.status]}`);
      if (publico) {
        const a = el('a', '', 'ver no site');
        a.href = `/imovel/${im.ref}`;
        a.target = '_blank';
        a.rel = 'noopener';
        info.append(' · ', a);
      }
    } else {
      info.textContent = 'Ainda não salvo';
    }
  }

  async function salvar({ status } = {}) {
    limparErro(form);
    const dados = lerDados();
    const postar = dados.postar_instagram;
    delete dados.postar_instagram;
    if (status) dados.status = status;
    if (status === 'ativo') dados.no_site = true;
    const botoes = form.querySelectorAll('.anuncio-acoes button');
    botoes.forEach((b) => { b.disabled = true; });
    try {
      if (im) {
        im = await api(`/api/admin/imoveis/${im.id}`, { metodo: 'PUT', dados, semToast: true });
      } else {
        const r = await api('/api/admin/imoveis', { metodo: 'POST', dados, semToast: true });
        im = await api(`/api/admin/imoveis/${r.id}`);
        tituloGaveta(`Editar ${im.ref}`);
      }
      sujo = false;
      preencher(im);
      fotos.render();
      avisarPagina(im.ref);
      if (postar) {
        if (PUBLICOS.includes(im.status)) setTimeout(() => abrirPostInstagram(im.id), 0);
        else toast('O post no Instagram fica para quando o anúncio estiver publicado no site.', 'erro');
      }
      return true;
    } catch (e) {
      if (e.status !== 401) {
        mostrarErro(form, e);
        form.querySelector('.form-erro').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    } finally {
      botoes.forEach((b) => { b.disabled = false; });
    }
  }

  /* ---------- Fotos ---------- */
  const fotos = (() => {
    const caixa = form.querySelector('[data-fotos]');
    caixa.innerHTML = `<div class="fotos-zona" tabindex="0" role="button" aria-label="Adicionar fotos">
        <strong>+ Adicionar fotos</strong>
        <span>Toque para tirar ou escolher fotos, ou arraste para cá. A primeira é a capa.</span>
        <input type="file" accept="image/*" multiple hidden>
      </div>
      <p class="hint" data-fotos-status aria-live="polite"></p>
      <ul class="fotos-grade"></ul>`;
    const zona = caixa.querySelector('.fotos-zona');
    const input = caixa.querySelector('input[type=file]');
    const statusEl = caixa.querySelector('[data-fotos-status]');
    const grade = caixa.querySelector('.fotos-grade');
    const previas = new Map();   // id da foto → URL local (o KV pode levar alguns segundos para servir)

    zona.addEventListener('click', () => input.click());
    zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('is-sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('is-sobre'));
    zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('is-sobre'); adicionar([...e.dataTransfer.files]); });
    input.addEventListener('change', () => { adicionar([...input.files]); input.value = ''; });

    async function adicionar(arquivos) {
      arquivos = arquivos.filter((a) => a.type.startsWith('image/') || /\.(heic|heif)$/i.test(a.name));
      if (!arquivos.length) return;
      if (!im) {
        statusEl.textContent = 'Salvando o anúncio como rascunho para guardar as fotos…';
        if (!(await salvar({ status: 'rascunho' }))) { statusEl.textContent = 'Corrija o aviso acima e tente adicionar as fotos de novo.'; return; }
      }
      const livres = opcoes.max_fotos - im.fotos.length;
      if (arquivos.length > livres) toast(`Cada anúncio pode ter até ${opcoes.max_fotos} fotos. Vou enviar só ${Math.max(livres, 0)}.`, 'erro');
      arquivos = arquivos.slice(0, Math.max(livres, 0));
      let ok = 0;
      for (const [k, arq] of arquivos.entries()) {
        statusEl.textContent = `Preparando e enviando foto ${k + 1} de ${arquivos.length}…`;
        try {
          const pronta = await prepararFoto(arq);
          const salva = await enviarFoto(im.id, pronta);
          previas.set(salva.id, URL.createObjectURL(pronta.p));
          im.fotos.push(salva);
          ok += 1;
          render();
        } catch (e) {
          toast(e.message, 'erro');
        }
      }
      statusEl.textContent = ok ? `${ok} ${ok === 1 ? 'foto enviada' : 'fotos enviadas'}.` : '';
      if (ok) { avisarPagina(im.ref); atualizarPendencias(); }
    }

    async function salvarOrdem(lista) {
      try {
        const r = await api(`/api/admin/imoveis/${im.id}/fotos-ordem`, { metodo: 'PUT', dados: { ids: lista.map((x) => x.id) } });
        im.fotos = r.fotos;
        render();
        avisarPagina(im.ref);
      } catch { /* o api() já avisou */ }
    }

    function render() {
      zona.hidden = false;
      if (!im) {
        grade.replaceChildren();
        if (!statusEl.textContent) statusEl.textContent = 'O anúncio é salvo como rascunho quando você adiciona a primeira foto.';
        return;
      }
      zona.hidden = im.fotos.length >= opcoes.max_fotos;
      grade.replaceChildren(...im.fotos.map((foto, k) => {
        const li = el('li', 'foto-item');
        const img = el('img');
        img.src = previas.get(foto.id) || foto.p;
        img.alt = `Foto ${k + 1}`;
        li.append(img);
        if (k === 0) li.append(el('span', 'foto-capa', 'Capa'));
        const acoes = el('div', 'foto-acoes');
        const mover = (dir) => {
          const lista = [...im.fotos];
          const [x] = lista.splice(k, 1);
          lista.splice(k + dir, 0, x);
          salvarOrdem(lista);
        };
        const b = (rotulo, texto, fn, desab) => {
          const btn = el('button', 'foto-btn', texto);
          btn.type = 'button';
          btn.title = rotulo;
          btn.setAttribute('aria-label', rotulo);
          btn.disabled = !!desab;
          btn.addEventListener('click', fn);
          return btn;
        };
        acoes.append(
          b('Mover para antes', '←', () => mover(-1), k === 0),
          b('Usar como capa', '★', () => { const lista = [...im.fotos]; lista.unshift(...lista.splice(k, 1)); salvarOrdem(lista); }, k === 0),
          b('Mover para depois', '→', () => mover(1), k === im.fotos.length - 1),
          b('Excluir foto', '✕', async () => {
            if (!confirm('Excluir esta foto?')) return;
            try {
              await api(`/api/admin/fotos/${foto.id}`, { metodo: 'DELETE' });
              im.fotos.splice(k, 1);
              render();
              avisarPagina(im.ref);
              atualizarPendencias();
            } catch { /* o api() já avisou */ }
          }),
        );
        li.append(acoes);
        return li;
      }));
      if (im.fotos.length && !statusEl.textContent) statusEl.textContent = `${im.fotos.length} de ${opcoes.max_fotos} fotos. Use ★ para escolher a capa e as setas para mudar a ordem.`;
    }
    return { render, adicionar };
  })();

  /* ---------- CEP → ViaCEP ---------- */
  const cepStatus = form.querySelector('[data-cep-status]');
  f.cep.addEventListener('input', async () => {
    const cep = f.cep.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    cepStatus.textContent = 'Buscando o endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) throw new Error();
      if (d.logradouro) f.logradouro.value = d.logradouro;
      if (d.bairro) f.bairro.value = d.bairro;
      if (d.localidade) f.cidade.value = d.localidade;
      if (d.uf) f.uf.value = d.uf;
      f.cep.value = `${cep.slice(0, 5)}-${cep.slice(5)}`;
      cepStatus.textContent = 'Endereço preenchido. Confira e complete o número.';
      sujo = true;
    } catch {
      cepStatus.textContent = 'Não encontrei esse CEP. Preencha o endereço à mão.';
    }
  });

  /* ---------- Eventos ---------- */
  form.addEventListener('input', (e) => {
    sujo = true;
    if (e.target.name === 'titulo' || e.target.name === 'descricao') contar();
  });
  form.addEventListener('change', (e) => {
    sujo = true;
    if (e.target.name === 'finalidade' || e.target.name === 'no_grupo_olx') atualizarVisibilidade();
    if (e.target.name === 'no_grupo_olx') mostrarPortais();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await salvar()) toast('Anúncio salvo.');
  });
  form.querySelector('[data-publicar]').addEventListener('click', async () => {
    if (await salvar({ status: 'ativo' })) {
      toast('Publicado! O anúncio já aparece no site.');
      fecharGaveta({ forcar: true });
      if (voltarParaLista) abrirAnuncios();
    }
  });
  form.querySelector('[data-cancelar]').addEventListener('click', () => fecharGaveta());

  preencher(im || (inicial && { ...inicial }));
  fotos.render();
  if (!im && inicial) {
    sujo = true;
    toast('Anúncio preenchido com os dados do lead. Confira, complete e salve.');
    // Fotos enviadas pelo proprietário: um clique traz para o anúncio (salva o rascunho antes).
    if (inicial.fotos_lead?.length) {
      const b = botao(`Trazer as ${inicial.fotos_lead.length} fotos enviadas pelo proprietário`, async () => {
        b.disabled = true;
        try {
          const arquivos = await Promise.all(inicial.fotos_lead.map(async (u, k) => {
            const r = await fetch(u, { credentials: 'same-origin' });
            if (!r.ok) throw new Error();
            return new File([await r.blob()], `lead-${k + 1}.jpg`, { type: 'image/jpeg' });
          }));
          await fotos.adicionar(arquivos);
          b.remove();
        } catch {
          toast('Não consegui trazer as fotos do lead. Tente de novo.', 'erro');
          b.disabled = false;
        }
      }, 'btn--gold');
      form.querySelector('[data-fotos]').prepend(b);
    }
  }
  f.titulo.focus();
}
