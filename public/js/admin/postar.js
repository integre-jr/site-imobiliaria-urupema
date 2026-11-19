// Modal "Postar no Instagram" (spec 9.2): escolher até 10 fotos, revisar a legenda e publicar.
// O navegador gera cada imagem em 1080×1350 (4:5, o formato vertical do feed), envia para
// /api/admin/instagram/midias, cria o post (/publicar) e acompanha até sair (/concluir).
// Usado pela lista de anúncios, pelo formulário do anúncio e pela página do imóvel.
import { api, ErroApi, irParaLogin, toast } from './api.js';

const W = 1080;
const H = 1350;
const MAX_FOTOS = 10;
const MAX_BYTES = 950 * 1024;   // o servidor aceita até 1 MB por imagem

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const contarHashtags = (t) => (t.match(/#[^\s#]+/g) || []).length;

// Foto do anúncio → JPEG 1080×1350. Proporção entre 4:5 e 1,91:1: preenche (corta as bordas e centraliza);
// fora disso, ou com "foto inteira" marcado: encaixa a foto toda com faixas na cor da marca.
async function gerar45(url, inteira) {
  let res;
  try {
    res = await fetch(url, { credentials: 'same-origin' });
  } catch {
    throw new Error('Não consegui abrir uma das fotos. Confira a internet e tente de novo.');
  }
  if (!res.ok) throw new Error('Não consegui abrir uma das fotos do anúncio.');
  const bmp = await createImageBitmap(await res.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--forest').trim() || '#1E3A2B';
    ctx.fillRect(0, 0, W, H);
    const r = bmp.width / bmp.height;
    const preencher = !inteira && r >= 0.8 && r <= 1.91;
    const escala = preencher ? Math.max(W / bmp.width, H / bmp.height) : Math.min(W / bmp.width, H / bmp.height);
    const w = bmp.width * escala;
    const h = bmp.height * escala;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    for (const q of [0.88, 0.78, 0.66]) {
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', q));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new Error('Uma das fotos ficou grande demais para o Instagram.');
  } finally {
    bmp.close?.();
  }
}

async function enviarMidias(blobs) {
  const dados = new FormData();
  blobs.forEach((b, i) => dados.append('f', b, `post-${i + 1}.jpg`));
  let r;
  try {
    r = await fetch('/api/admin/instagram/midias', { method: 'POST', headers: { 'X-Urupema': '1' }, body: dados, credentials: 'same-origin' });
  } catch {
    throw new ErroApi('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 401) irParaLogin();
  if (!r.ok) throw new ErroApi(corpo.erro || 'Não foi possível enviar as fotos.', r.status);
  return corpo.ids;
}

export async function abrirPostInstagram(idOuRef) {
  const dlg = el('dialog', 'adm-dialog ig-post');
  dlg.setAttribute('aria-labelledby', 'ig-post-titulo');
  const titulo = el('h2', '', 'Postar no Instagram');
  titulo.id = 'ig-post-titulo';
  const corpo = el('div', 'ig-post__corpo');
  corpo.append(el('p', 'gaveta__intro', 'Carregando…'));
  dlg.append(titulo, corpo);
  document.body.append(dlg);
  let ocupado = false;
  dlg.addEventListener('cancel', (e) => { if (ocupado) e.preventDefault(); });   // não fecha no meio da publicação
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();

  let pv;
  try {
    pv = await api(`/api/admin/instagram/previa?imovel=${encodeURIComponent(idOuRef)}`);
  } catch {
    dlg.close();
    return;
  }
  titulo.textContent = `Postar ${pv.imovel.ref} no Instagram`;

  const fechar = el('button', 'btn btn--outline btn--sm', 'Fechar');
  fechar.type = 'button';
  fechar.addEventListener('click', () => dlg.close());
  const rodapeSimples = () => { const d = el('div', 'adm-form__acoes'); d.append(fechar); return d; };

  const demo = () => {
    const p = el('p', 'ig-demo');
    p.append(el('span', 'tag tag--admin', 'Modo demonstração'), ' O post é simulado: nada vai para o Instagram de verdade.');
    return p;
  };

  // ---------- Impedimentos ----------
  const avisos = [];
  if (!pv.conectado) {
    avisos.push(pv.pode_gerenciar
      ? 'Nenhuma conta do Instagram conectada. Conecte a conta da imobiliária na gaveta Instagram e tente de novo.'
      : 'Nenhuma conta do Instagram conectada. Peça ao administrador para conectar a conta na gaveta Instagram.');
  }
  if (!['ativo', 'reservado'].includes(pv.imovel.status)) avisos.push('Publique o anúncio no site antes de postar: o post leva as pessoas para a página dele.');
  if (!pv.fotos.length) avisos.push('Este anúncio ainda não tem fotos. Adicione pelo menos uma.');
  if (avisos.length) {
    corpo.replaceChildren(...(pv.modo === 'mock' ? [demo()] : []), ...avisos.map((a) => el('p', 'form-erro', a)));
    corpo.querySelectorAll('.form-erro').forEach((e) => { e.hidden = false; });
    if (!pv.conectado && pv.pode_gerenciar) {
      const ir = el('button', 'btn btn--primary btn--sm', 'Abrir gaveta Instagram');
      ir.type = 'button';
      ir.addEventListener('click', () => { dlg.close(); document.dispatchEvent(new CustomEvent('urupema:abrir-instagram')); });
      const acoes = rodapeSimples();
      acoes.prepend(ir);
      corpo.append(acoes);
    } else {
      corpo.append(rodapeSimples());
    }
    return;
  }

  // ---------- Formulário ----------
  const form = el('form', 'adm-form');
  form.noValidate = true;
  const erroBox = el('div', 'form-erro');
  erroBox.setAttribute('role', 'alert');
  erroBox.hidden = true;

  const info = el('p', 'gaveta__intro');
  info.textContent = `Conta ${pv.conta || 'conectada'}` + (pv.limite ? ` · ${pv.limite.usados} de ${pv.limite.limite} posts usados nas últimas 24 h` : '');
  if (pv.anterior) {
    info.append(el('br'), `Este imóvel já foi postado em ${dataBR(pv.anterior.criado_em)}. Vai sair um post novo (repost).`);
  }

  // Fotos: as 10 primeiras já marcadas; a ordem do post é a do anúncio (a capa primeiro).
  const grupoFotos = el('fieldset', 'ig-post__fotos');
  grupoFotos.append(el('legend', '', `Fotos do post (até ${MAX_FOTOS})`));
  const grade = el('ul', 'ig-fotos');
  const contFotos = el('span', 'hint');
  pv.fotos.forEach((f, i) => {
    const li = el('li', 'ig-foto');
    const lbl = el('label');
    const c = el('input');
    c.type = 'checkbox';
    c.value = String(i);
    c.checked = i < MAX_FOTOS;
    c.setAttribute('aria-label', `Foto ${i + 1}`);
    const img = el('img');
    img.src = f.p;
    img.alt = '';
    img.loading = 'lazy';
    lbl.append(c, img, el('span', 'ig-foto__n'));
    li.append(lbl);
    grade.append(li);
  });
  const marcadas = () => [...grade.querySelectorAll('input:checked')].map((c) => pv.fotos[Number(c.value)]);
  const numerar = () => {
    let n = 0;
    grade.querySelectorAll('input').forEach((c) => {
      c.closest('li').querySelector('.ig-foto__n').textContent = c.checked ? String(++n) : '';
      c.closest('li').classList.toggle('is-marcada', c.checked);
    });
    contFotos.textContent = n === 1 ? '1 foto: post simples.' : `${n} fotos: carrossel (arraste para o lado no Instagram).`;
  };
  grade.addEventListener('change', (e) => {
    if (e.target.checked && marcadas().length > MAX_FOTOS) {
      e.target.checked = false;
      toast(`O Instagram aceita até ${MAX_FOTOS} fotos por post.`, 'erro');
    }
    numerar();
  });
  numerar();
  const inteira = el('label', 'check');
  const cInteira = el('input');
  cInteira.type = 'checkbox';
  inteira.append(cInteira, ' Mostrar as fotos inteiras (com faixas verdes em cima e embaixo)');
  grupoFotos.append(grade, contFotos, inteira,
    el('span', 'hint', 'O Instagram usa fotos verticais (4:5). Sem a opção acima, as fotos deitadas são cortadas nas laterais, mantendo o centro.'));

  const campoLegenda = el('div', 'form-field');
  const lblLeg = el('label', '', 'Legenda');
  lblLeg.htmlFor = 'ig-post-legenda';
  const legenda = el('textarea', 'textarea');
  legenda.id = 'ig-post-legenda';
  legenda.name = 'legenda';
  legenda.rows = 10;
  legenda.maxLength = pv.max_legenda;
  legenda.value = pv.legenda;
  const contLeg = el('span', 'hint');
  const contar = () => {
    const n = contarHashtags(legenda.value);
    contLeg.textContent = `${legenda.value.length} de ${pv.max_legenda} caracteres · ${n} de ${pv.max_hashtags} hashtags`;
    contLeg.classList.toggle('is-alerta', n > pv.max_hashtags);
  };
  legenda.addEventListener('input', contar);
  contar();
  campoLegenda.append(lblLeg, legenda, contLeg);

  const progresso = el('p', 'ig-post__progresso');
  progresso.setAttribute('aria-live', 'polite');
  const acoes = el('div', 'adm-form__acoes');
  const publicar = el('button', 'btn btn--primary btn--sm', 'Publicar no Instagram');
  publicar.type = 'submit';
  acoes.append(fechar, publicar);

  form.append(erroBox, info, grupoFotos, campoLegenda, progresso, acoes);
  corpo.replaceChildren(...(pv.modo === 'mock' ? [demo()] : []), form);

  // Reaproveita as imagens já enviadas se a pessoa tentar de novo com as mesmas fotos.
  let cache = { chave: '', ids: null };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroBox.hidden = true;
    const fotos = marcadas();
    if (!fotos.length) { mostrar('Escolha pelo menos uma foto.'); return; }
    if (!legenda.value.trim()) { mostrar('Escreva a legenda do post.'); return; }
    if (contarHashtags(legenda.value) > pv.max_hashtags) { mostrar(`Use no máximo ${pv.max_hashtags} hashtags.`); return; }

    ocupado = true;
    form.querySelectorAll('button, input, textarea').forEach((b) => { b.disabled = true; });
    try {
      const chave = fotos.map((f) => f.id).join(',') + (cInteira.checked ? ':inteira' : '');
      if (cache.chave !== chave) {
        const blobs = [];
        for (const [i, f] of fotos.entries()) {
          progresso.textContent = `Preparando a foto ${i + 1} de ${fotos.length}…`;
          blobs.push(await gerar45(f.g, cInteira.checked));
        }
        progresso.textContent = 'Enviando as fotos…';
        cache = { chave, ids: await enviarMidias(blobs) };
      }
      progresso.textContent = 'Enviando o post ao Instagram…';
      const p = await api('/api/admin/instagram/publicar', {
        metodo: 'POST', semToast: true,
        dados: { imovel_id: pv.imovel.id, legenda: legenda.value, midias: cache.ids },
      });
      progresso.textContent = 'O Instagram está processando as fotos…';
      let r = { status: 'publicando' };
      for (let i = 0; i < 100 && r.status === 'publicando'; i++) {
        if (i) await esperar(3000);
        r = await api('/api/admin/instagram/concluir', { metodo: 'POST', semToast: true, dados: { post_id: p.post_id } });
      }
      if (r.status !== 'publicado') throw new Error('O Instagram ainda não terminou. Confira o histórico na gaveta Instagram daqui a pouco.');
      sucesso(r.permalink);
    } catch (err) {
      if (!(err instanceof ErroApi && err.status === 401)) mostrar(err.message);
      progresso.textContent = '';
      publicar.textContent = 'Tentar de novo';
    } finally {
      ocupado = false;
      form.querySelectorAll('button, input, textarea').forEach((b) => { b.disabled = false; });
    }
  });

  function mostrar(msg) {
    erroBox.textContent = msg;
    erroBox.hidden = false;
    erroBox.scrollIntoView({ block: 'nearest' });
  }

  function sucesso(link) {
    const ok = el('div', 'ig-post__ok');
    ok.append(el('strong', '', pv.modo === 'mock' ? 'Post simulado com sucesso!' : 'Publicado no Instagram!'));
    ok.append(el('p', '', pv.modo === 'mock'
      ? 'No modo demonstração nada vai para o Instagram. O post entrou no histórico da gaveta Instagram.'
      : 'O post já aparece no perfil da imobiliária.'));
    const d = el('div', 'adm-form__acoes');
    if (link) {
      const a = el('a', 'btn btn--primary btn--sm', pv.modo === 'mock' ? 'Ver a página do imóvel' : 'Ver o post');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener';
      d.append(a);
    }
    d.append(fechar);
    corpo.replaceChildren(ok, d);
    toast(pv.modo === 'mock' ? 'Post simulado publicado.' : 'Post publicado no Instagram.');
    document.dispatchEvent(new CustomEvent('urupema:instagram-postado'));
  }
}
