// Modo edição: carregado SÓ nas páginas servidas em /admin (o middleware injeta este script).
// Monta a barra de edição e, para o administrador, liga a edição no lugar dos dados do site
// (elementos com data-cfg / data-cfg-href). O que não fica "no site" abre em gavetas.
import { abrirAnuncios, abrirEditorAnuncio } from './anuncios.js';
import { api, ErroApi, toast, valorParaCampo } from './api.js';
import { abrirConta } from './conta.js';
import { abrirDados } from './dados.js';
import { enviarImagemSite, prepararImagem } from './imagens.js';
import { abrirInstagram } from './instagram.js';
import { abrirLeads, atualizarContador } from './leads.js';
import { abrirPortais } from './portais.js';
import { abrirPostInstagram } from './postar.js';
import { abrirUsuarios } from './usuarios.js';

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="adm-lapis" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></symbol>
<symbol id="adm-dados" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></symbol>
<symbol id="adm-usuarios" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
<symbol id="adm-conta" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
<symbol id="adm-externo" viewBox="0 0 24 24"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></symbol>
<symbol id="adm-sair" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></symbol>
<symbol id="adm-instagram" viewBox="0 0 24 24"><rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/></symbol>
<symbol id="adm-portais" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
<symbol id="adm-fechar" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></symbol>
<symbol id="adm-anuncios" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></symbol>
<symbol id="adm-mais" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></symbol>
<symbol id="adm-leads" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></symbol>
<symbol id="adm-foto" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></symbol>
</svg>`;

// Botão "Editar" visível ao lado de cada informação editável.
const LAPIS = '<svg aria-hidden="true"><use href="#adm-lapis"/></svg>';
function selo(texto, canto) {
  const s = document.createElement('span');
  s.className = 'cfg-lapis' + (canto ? ' cfg-lapis--canto' : '');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = LAPIS + (canto ? '' : `<span>${texto}</span>`);
  return s;
}

const ehSelo = (n) => n.nodeType === 1 && n.classList.contains('cfg-lapis');

// Troca o texto de um dado editável sem apagar o selo "Editar" que fica dentro dele.
// "destaque" (números da faixa verde): o símbolo final (★, %) fica dourado, como em lib/config.js.
function definirTexto(el, valor, tipo) {
  [...el.childNodes].forEach((n) => { if (!ehSelo(n)) n.remove(); });
  const m = tipo === 'destaque' && /^(.*?)([%★]+)$/.exec(valor);
  if (!m) return el.prepend(valor);
  const u = document.createElement('span');
  u.className = 'u';
  u.textContent = m[2];
  el.prepend(m[1], u);
}

// Texto que está na página, sem o selo. Vale para os textos do site ainda não editados (sem valor no banco).
const textoDe = (el) => [...el.childNodes].filter((n) => !ehSelo(n)).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();

const TIPO_INPUT = { telefone: 'tel', whatsapp: 'tel', email: 'email', url: 'url' };

let estado = null;   // { valores, hrefs, mapa, campos } (só do administrador)

// ---------- Barra de edição ----------

// curto: rótulo usado no celular, onde os botões dividem a largura da tela
function botaoBarra(icone, rotulo, aoClicar, curto = rotulo) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'barra-edicao__botao';
  b.setAttribute('aria-label', rotulo);
  b.innerHTML = `<svg aria-hidden="true"><use href="#${icone}"/></svg><span class="rotulo-longo"></span><span class="rotulo-curto"></span>`;
  b.querySelector('.rotulo-longo').textContent = rotulo;
  b.querySelector('.rotulo-curto').textContent = curto;
  b.addEventListener('click', aoClicar);
  return b;
}

function montarBarra(usuario) {
  const barra = document.createElement('nav');
  barra.className = 'barra-edicao';
  barra.setAttribute('aria-label', 'Barra de edição');
  barra.innerHTML = `<div class="barra-edicao__status">
      <span class="barra-edicao__selo"><svg aria-hidden="true"><use href="#adm-lapis"/></svg>Modo edição</span>
      <span class="barra-edicao__quem"></span>
    </div>
    <div class="barra-edicao__acoes"></div>`;
  barra.querySelector('.barra-edicao__quem').textContent =
    `${usuario.nome.split(' ')[0]} · ${usuario.papel === 'admin' ? 'Administrador' : 'Corretor'}`;

  const acoes = barra.querySelector('.barra-edicao__acoes');
  const minhaConta = () => abrirConta(usuario);
  acoes.append(botaoBarra('adm-anuncios', 'Anúncios', () => abrirAnuncios()));
  const leads = botaoBarra('adm-leads', 'Leads', () => abrirLeads(usuario, estado));
  const contador = document.createElement('span');
  contador.className = 'barra-edicao__contador';
  contador.hidden = true;
  leads.append(contador);
  document.addEventListener('urupema:leads-novos', (e) => {
    contador.textContent = e.detail > 99 ? '99+' : String(e.detail);
    contador.hidden = !e.detail;
    leads.setAttribute('aria-label', e.detail ? `Leads: ${e.detail} novos` : 'Leads');
  });
  acoes.append(leads);
  if (usuario.papel === 'admin') {
    acoes.append(botaoBarra('adm-dados', 'Dados do site', () => abrirDados(estado, atualizarPagina), 'Dados'));
  }
  acoes.append(botaoBarra('adm-instagram', 'Instagram', () => abrirInstagram(usuario, estado, atualizarPagina)));
  if (usuario.papel === 'admin') acoes.append(botaoBarra('adm-portais', 'Portais', () => abrirPortais()));
  // O modal de post pede para abrir a gaveta Instagram (ex.: conta ainda não conectada).
  document.addEventListener('urupema:abrir-instagram', () => abrirInstagram(usuario, estado, atualizarPagina));
  if (usuario.papel === 'admin') {
    acoes.append(botaoBarra('adm-usuarios', 'Usuários', () => abrirUsuarios(minhaConta)));
  }
  acoes.append(
    botaoBarra('adm-conta', 'Minha conta', minhaConta, 'Conta'),
    botaoBarra('adm-externo', 'Ver site', () => {
      window.open(location.pathname.replace(/^\/admin/, '') || '/', '_blank', 'noopener');
    }, 'Site'),
    botaoBarra('adm-sair', 'Sair', async () => {
      await api('/api/auth/logout', { metodo: 'POST' }).catch(() => {});
      location.href = '/admin/login';
    }),
  );
  document.body.append(barra);
  // Altura real da barra (1 ou 2 linhas no celular): o fim da página e o balão de edição ficam acima dela.
  new ResizeObserver(() => document.documentElement.style.setProperty('--barra-h', barra.offsetHeight + 'px')).observe(barra);
}

// ---------- Edição no lugar ----------

const chaveDe = (el) => el.dataset.cfg || el.dataset.cfgHref;

function atualizarPagina(novo) {
  estado = novo;
  document.querySelectorAll('[data-cfg]').forEach((el) => {
    const v = estado.valores[el.dataset.cfg];
    if (v) definirTexto(el, v, estado.campos[el.dataset.cfg]?.tipo);    // vazio = texto do HTML, ainda não editado
  });
  document.querySelectorAll('[data-cfg-img]').forEach((el) => {
    const v = estado.valores[el.dataset.cfgImg];
    if (v && el.getAttribute('src') !== v) el.src = v;
  });
  document.querySelectorAll('[data-cfg-href]').forEach((el) => {
    const h = estado.hrefs[el.dataset.cfgHref];
    if (h) el.href = h;
  });
  document.querySelectorAll('[data-cfg-mapa]').forEach((el) => {
    if (el.src !== estado.mapa) el.src = estado.mapa;
  });
}

let pop = null;

function fecharPop() {
  if (!pop) return;
  pop.remove();
  pop = null;
}

function abrirPop(alvo) {
  fecharPop();
  const chave = chaveDe(alvo);
  const campo = estado.campos[chave];
  if (!campo) return;

  pop = document.createElement('form');
  pop.className = 'cfg-pop adm-form';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Editar ' + campo.rotulo);
  pop.innerHTML = `<label class="cfg-pop__rotulo" for="cfg-pop-input"></label>
    <input class="input" id="cfg-pop-input" name="valor" required>
    <span class="hint" hidden></span>
    <div class="form-erro" role="alert" hidden></div>
    <div class="adm-form__acoes">
      <button class="btn btn--outline btn--sm" type="button" data-cancelar>Cancelar</button>
      <button class="btn btn--primary btn--sm" type="submit">Salvar</button>
    </div>`;
  pop.querySelector('label').textContent = campo.rotulo;
  let input = pop.querySelector('input');
  if (campo.tipo === 'paragrafo') {
    const area = document.createElement('textarea');
    area.className = 'textarea';
    area.id = input.id;
    area.name = input.name;
    area.required = true;
    area.rows = 6;
    input.replaceWith(area);
    input = area;
    pop.classList.add('cfg-pop--largo');
  } else {
    input.type = TIPO_INPUT[campo.tipo] || 'text';
  }
  if (campo.max) input.maxLength = campo.max;
  input.value = valorParaCampo(campo, estado.valores[chave]) || (alvo.dataset.cfg ? textoDe(alvo) : '');
  if (campo.ajuda) {
    const dica = pop.querySelector('.hint');
    dica.textContent = campo.ajuda;
    dica.hidden = false;
  }
  const erroBox = pop.querySelector('.form-erro');

  pop.querySelector('[data-cancelar]').addEventListener('click', () => { fecharPop(); alvo.focus(); });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fecharPop(); alvo.focus(); } });
  pop.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroBox.hidden = true;
    const botao = pop.querySelector('[type=submit]');
    botao.disabled = true;
    try {
      const novo = await api('/api/admin/config', { metodo: 'PUT', dados: { valores: { [chave]: input.value } }, semToast: true });
      atualizarPagina(novo);
      fecharPop();
      toast('Salvo. Já aparece em todas as páginas do site.');
    } catch (err) {
      if (err instanceof ErroApi && err.status === 401) return;
      erroBox.textContent = err.message;
      erroBox.hidden = false;
      input.focus();
    } finally {
      if (botao.isConnected) botao.disabled = false;
    }
  });

  document.body.append(pop);
  // No celular o CSS transforma o balão numa folha fixa embaixo; no desktop ele fica junto do texto.
  if (matchMedia('(min-width: 621px)').matches) {
    const r = alvo.getBoundingClientRect();
    const largura = pop.offsetWidth;
    const altura = pop.offsetHeight;
    const cabeAbaixo = r.bottom + 8 + altura < innerHeight - 72;
    pop.style.left = Math.max(12, Math.min(r.left, innerWidth - largura - 12)) + 'px';
    pop.style.top = (cabeAbaixo ? r.bottom + 8 : Math.max(12, r.top - altura - 8)) + 'px';
  }
  input.focus();
  if (campo.tipo !== 'paragrafo') input.select();
}

function ligarEdicaoNoLugar() {
  const editaveis = document.querySelectorAll('[data-cfg], [data-cfg-href]');
  editaveis.forEach((el) => {
    const campo = estado.campos[chaveDe(el)];
    if (!campo) return;
    el.classList.add('cfg-editavel');
    el.tabIndex = 0;
    el.title = `Editar: ${campo.rotulo}`;
    // Texto → selo "Editar" logo depois; só link/ícone (redes, botões de WhatsApp) → lápis no canto.
    const canto = !el.dataset.cfg;
    if (canto) el.classList.add('cfg-editavel--canto');
    el.append(selo('Editar', canto));
  });

  // Captura: no modo edição, clicar num dado editável edita em vez de abrir o link.
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('.cfg-editavel');
    if (alvo) {
      e.preventDefault();
      e.stopPropagation();
      abrirPop(alvo);
    } else if (pop && !pop.contains(e.target)) {
      fecharPop();
    }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('cfg-editavel')) {
      e.preventDefault();
      abrirPop(e.target);
    }
  });
}

// Fotos fixas do site ([data-cfg-img], ex.: fundo do topo da home): botão "Trocar foto" na seção.
function ligarImagens() {
  document.querySelectorAll('[data-cfg-img]').forEach((img) => {
    const chave = img.dataset.cfgImg;
    const campo = estado.campos[chave];
    if (!campo) return;
    const seletor = document.createElement('input');
    seletor.type = 'file';
    seletor.accept = 'image/*';
    seletor.hidden = true;
    const b = botaoAcao('Trocar foto', 'btn--gold trocar-foto', () => seletor.click(), 'adm-foto');
    b.title = campo.rotulo;
    seletor.addEventListener('change', async () => {
      const arquivo = seletor.files[0];
      seletor.value = '';
      if (!arquivo) return;
      b.disabled = true;
      const rotulo = b.lastChild;
      rotulo.textContent = ' Enviando…';
      try {
        atualizarPagina(await enviarImagemSite(chave, await prepararImagem(arquivo)));
        toast('Foto trocada. Já aparece no site.');
      } catch (err) {
        if (!(err instanceof ErroApi && err.status === 401)) toast(err.message, 'erro');
      } finally {
        b.disabled = false;
        rotulo.textContent = ' Trocar foto';
      }
    });
    (img.closest('section') || img.parentElement).append(b, seletor);
  });
}

// ---------- Anúncios: botões junto da vitrine, dos cards e da página do imóvel ----------

function botaoAcao(texto, classe, aoClicar, icone = 'adm-lapis') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${classe} btn--sm`;
  b.innerHTML = `<svg aria-hidden="true"><use href="#${icone}"/></svg>`;
  b.append(' ' + texto);
  b.addEventListener('click', aoClicar);
  return b;
}

function ligarAnuncios() {
  // Vitrine da home e listagem: "Editar anúncios" + "Novo anúncio"
  document.querySelectorAll('[data-admin-anuncios]').forEach((slot) => {
    slot.classList.add('admin-acoes');
    slot.append(
      botaoAcao('Editar anúncios', 'btn--gold', () => abrirAnuncios()),
      botaoAcao('Novo anúncio', 'btn--outline', () => abrirEditorAnuncio(), 'adm-mais'),
    );
  });
  // Página do imóvel: "Editar este anúncio"
  const main = document.querySelector('main[data-imovel-id]');
  const slot = document.querySelector('[data-admin-anuncio]');
  if (main && slot) {
    slot.classList.add('admin-acoes');
    slot.append(
      botaoAcao('Editar este anúncio', 'btn--gold', () => abrirEditorAnuncio(main.dataset.imovelId)),
      botaoAcao('Postar no Instagram', 'btn--outline', () => abrirPostInstagram(main.dataset.imovelId), 'adm-instagram'),
    );
  }
  decorarCards(document);
  document.addEventListener('urupema:cards', (e) => decorarCards(e.detail.grade));
}

// Cada card ganha um botão "Editar" sobre a foto.
function decorarCards(escopo) {
  escopo.querySelectorAll('.property-card').forEach((card) => {
    const ref = card.querySelector('.card-fav[data-ref]')?.dataset.ref;
    const media = card.querySelector('.card-media');
    if (!ref || !media || media.querySelector('.card-editar')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card-editar';
    b.innerHTML = LAPIS;
    b.append(' Editar');
    b.setAttribute('aria-label', `Editar o anúncio ${ref}`);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      abrirEditorAnuncio(ref);
    });
    media.append(b);
  });
}

// ---------- Início ----------

document.body.insertAdjacentHTML('afterbegin', SPRITE);
const { usuario } = await api('/api/auth/me');
if (usuario.papel === 'admin') {
  estado = await api('/api/admin/config');
  ligarEdicaoNoLugar();
  ligarImagens();
}
montarBarra(usuario);
ligarAnuncios();
atualizarContador();

// Volta do login do Instagram: /admin/?instagram=conectado|cancelado|erro
const retornoIg = new URLSearchParams(location.search).get('instagram');
if (retornoIg) {
  history.replaceState(null, '', location.pathname);
  const avisos = {
    conectado: ['Instagram conectado.', 'ok'],
    cancelado: ['Conexão com o Instagram cancelada.', 'ok'],
    erro: ['Não foi possível conectar o Instagram. Tente de novo; se continuar, fale com a INTEGRE.', 'erro'],
  };
  const [msg, tipo] = avisos[retornoIg] || avisos.erro;
  toast(msg, tipo);
  abrirInstagram(usuario, estado, atualizarPagina);
}
