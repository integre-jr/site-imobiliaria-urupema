// Gaveta "Portais" (só admin, spec 8.2/10): link do feed para colar no Canal Pro (OLX, ZAP, Viva Real),
// passo a passo, o que vai e o que falta em cada anúncio, últimas leituras do portal e a importação
// dos anúncios do feed do site antigo (spec 10.4: o navegador lê o XML; o servidor só busca).
import { abrirEditorAnuncio } from './anuncios.js';
import { api, ErroApi, toast } from './api.js';
import { abrirGaveta } from './gaveta.js';
import { enviarFoto, prepararFoto } from './imagens.js';

const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

const quem = (ua) => (/olx|zap|vivareal|grupozap/i.test(ua || '') ? 'Grupo OLX' : (ua || 'desconhecido').split(/[\s/]/)[0]);

function secaoLink(r, recarregar) {
  const box = el('section', 'ig-status' + (r.acessos.length ? ' is-ok' : ''));
  box.append(el('strong', '', 'Link do feed (OLX, ZAP Imóveis e Viva Real)'));
  const linha = el('div', 'copiar');
  const input = el('input', 'input');
  input.readOnly = true;
  input.value = r.url;
  input.setAttribute('aria-label', 'Link do feed');
  linha.append(input, botao('Copiar', async () => {
    try { await navigator.clipboard.writeText(r.url); toast('Link copiado.'); } catch { input.select(); }
  }, 'btn--primary'));
  box.append(linha);

  const n = r.no_feed;
  box.append(el('p', '', n ? `${n} ${n === 1 ? 'anúncio vai' : 'anúncios vão'} para os portais agora.` : 'Nenhum anúncio está pronto para os portais ainda (veja as pendências abaixo).'));
  if (r.acessos.length) {
    const a = r.acessos[0];
    box.append(el('p', 'hint', `Última leitura: ${dataHora(a.quando)} por ${quem(a.user_agent)} (${a.itens} ${a.itens === 1 ? 'anúncio' : 'anúncios'}).`));
  } else {
    box.append(el('p', 'hint', 'O Canal Pro ainda não leu este link. Depois de colado lá, a leitura costuma acontecer em algumas horas.'));
  }
  const acoes = el('div', 'adm-form__acoes');
  const abrir = el('a', 'btn btn--ghost btn--sm', 'Abrir o feed');
  abrir.href = r.url;
  abrir.target = '_blank';
  abrir.rel = 'noopener';
  acoes.append(abrir, botao('Gerar link novo', async () => {
    if (!confirm('Gerar um link novo? O link atual para de funcionar na hora, e você vai precisar colar o novo no Canal Pro. Use só se o link vazou.')) return;
    try {
      await api('/api/admin/portais', { metodo: 'POST', dados: { acao: 'novo_endereco' } });
      toast('Link novo gerado. Atualize no Canal Pro.');
      recarregar();
    } catch { /* o api() já avisou */ }
  }, 'btn--ghost'));
  box.append(acoes);
  return box;
}

function passoAPasso() {
  const box = el('section', 'ig-passos');
  box.append(el('h3', '', 'Como ligar no Canal Pro (uma vez só)'));
  const ol = el('ol');
  [
    'Entre no Canal Pro (canalpro.grupozap.com) com o login da imobiliária.',
    'No menu, abra a área de integração (Configurações > Integração ou "Integração XML"; o nome muda às vezes) e escolha integrar por XML/feed.',
    'Cole o link acima, no formato VRSync, e salve. Se já houver um link do fornecedor antigo, troque pelo nosso (antes, importe os anúncios dele aqui embaixo).',
    'Pronto: o Canal Pro lê o link sozinho de tempos em tempos e publica na OLX, no ZAP e no Viva Real. Anúncio novo, alterado ou arquivado aqui é atualizado na próxima leitura.',
    'Erros de cada anúncio aparecem no Relatório de Integração do Canal Pro. O tipo de destaque (Padrão, Destaque…) precisa caber no plano contratado.',
  ].forEach((t) => ol.append(el('li', '', t)));
  box.append(ol, el('p', 'hint', 'Outro portal pede "XML no padrão ZAP/Viva Real (VRSync)"? Pode usar este mesmo link.'));
  return box;
}

function listaAnuncios(r) {
  const box = el('section');
  box.append(el('h3', '', 'Anúncios marcados para os portais'));
  if (r.demonstracao) box.append(el('p', 'hint', `Os ${r.demonstracao} anúncios de demonstração nunca vão para os portais (são fictícios).`));
  if (!r.imoveis.length) {
    box.append(el('p', 'hint', 'Nenhum anúncio marcado. No formulário do anúncio, em "Onde aparece", marque "Enviar para OLX, ZAP e Viva Real".'));
    return box;
  }
  const lista = el('ul', 'adm-lista');
  for (const im of r.imoveis) {
    const li = el('li', 'adm-item' + (im.no_feed ? '' : ' is-inativo'));
    const info = el('div', 'adm-item__info');
    const tags = el('div', 'anuncio-tags');
    if (im.no_feed) tags.append(el('span', 'tag tag--ok', 'Vai para os portais'));
    else if (im.status !== 'ativo') tags.append(el('span', 'tag tag--off', 'Não está publicado'));
    else tags.append(el('span', 'tag tag--off', 'Falta completar'));
    info.append(el('strong', '', `${im.ref} · ${im.titulo}`), tags);
    if (im.pendencias.length) {
      const ul = el('ul', 'portais-pendencias');
      im.pendencias.forEach((p) => ul.append(el('li', '', p)));
      info.append(ul);
    }
    const acoes = el('div', 'adm-item__acoes');
    acoes.append(botao(im.pendencias.length ? 'Completar' : 'Editar', () => abrirEditorAnuncio(im.id), im.pendencias.length ? 'btn--primary' : 'btn--outline'));
    li.append(info, acoes);
    lista.append(li);
  }
  box.append(lista);
  return box;
}

/* ============================================================
   IMPORTAÇÃO DO FEED ANTIGO (VRSync)
   ============================================================ */
const TIPOS_EXTRAS = {   // PropertyType do VRSync sem equivalente direto → tipo mais próximo do site
  'Residential / Condo': 'casa', 'Residential / Village House': 'casa', 'Residential / Penthouse': 'apartamento',
  'Residential / Flat': 'apartamento', 'Residential / Kitnet': 'apartamento', 'Residential / Studio': 'apartamento',
  'Residential / Loft': 'apartamento', 'Residential / Agricultural': 'chacara', 'Commercial / Land Lot': 'terreno',
  'Commercial / Business': 'comercial', 'Commercial / Edificio Comercial': 'comercial', 'Commercial / Edificio Residencial': 'comercial',
  'Commercial / Consultorio': 'sala', 'Commercial / Corporate Floor': 'sala', 'Commercial / Hotel': 'comercial', 'Commercial / Garage': 'galpao',
};
const FINALIDADES = { 'For Sale': 'venda', 'For Rent': 'aluguel', 'Sale/Rent': 'venda_aluguel' };
const EXIBIR = { All: 'completo', Street: 'rua', Neighborhood: 'bairro' };

// Lê um <Listing> do VRSync → { dados (para POST /api/admin/imoveis), fotos: [url], avisos: [] }
function lerListing(l, opcoes) {
  const filho = (pai, nome) => (pai ? pai.getElementsByTagNameNS('*', nome)[0] || null : null);
  const txt = (pai, nome) => (filho(pai, nome)?.textContent || '').trim();
  const num = (pai, nome) => { const t = txt(pai, nome).replace(',', '.'); return t === '' || Number.isNaN(Number(t)) ? '' : Number(t); };
  const det = filho(l, 'Details');
  const loc = filho(l, 'Location');
  const avisos = [];

  const pt = txt(det, 'PropertyType');
  let tipo = opcoes.vrsync.tipos[pt] || TIPOS_EXTRAS[pt];
  if (!tipo) { tipo = 'casa'; avisos.push(`Tipo "${pt || 'vazio'}" virou Casa`); }
  const finalidade = FINALIDADES[txt(l, 'TransactionType')] || 'venda';
  const iptuEl = filho(det, 'Iptu') || filho(det, 'YearlyTax');
  let iptu = iptuEl ? Number(iptuEl.textContent.trim()) || '' : '';
  if (iptu && iptuEl.getAttribute('period') === 'Monthly') iptu *= 12;
  const caracteristicas = [...(det?.getElementsByTagNameNS('*', 'Feature') || [])]
    .map((f) => opcoes.vrsync.caracteristicas[f.textContent.trim()]).filter(Boolean);
  const uf = (filho(loc, 'State')?.getAttribute('abbreviation') || txt(loc, 'State')).toUpperCase().slice(0, 2);

  const itens = [...(filho(l, 'Media')?.getElementsByTagNameNS('*', 'Item') || [])]
    .filter((i) => (i.getAttribute('medium') || 'image') === 'image' && /^https?:\/\//.test(i.textContent.trim()));
  itens.sort((a, b) => (b.getAttribute('primary') === 'true') - (a.getAttribute('primary') === 'true'));
  const fotos = itens.map((i) => i.textContent.trim()).slice(0, opcoes.max_fotos);
  if (itens.length > opcoes.max_fotos) avisos.push(`só as ${opcoes.max_fotos} primeiras fotos`);

  const pub = txt(l, 'PublicationType');
  return {
    ref: txt(l, 'ListingID'),
    fotos,
    avisos,
    dados: {
      finalidade, tipo,
      titulo: txt(l, 'Title').slice(0, 120),
      descricao: txt(det, 'Description').slice(0, 5000),
      preco_venda: finalidade !== 'aluguel' ? num(det, 'ListPrice') : '',
      preco_aluguel: finalidade !== 'venda' ? num(det, 'RentalPrice') : '',
      condominio: num(det, 'PropertyAdministrationFee'),
      iptu_anual: iptu,
      area_util: num(det, 'LivingArea'),
      area_total: num(det, 'LotArea'),
      quartos: num(det, 'Bedrooms'), suites: num(det, 'Suites'), banheiros: num(det, 'Bathrooms'), vagas: num(det, 'Garage'),
      caracteristicas,
      cep: txt(loc, 'PostalCode'), uf: /^[A-Z]{2}$/.test(uf) ? uf : 'SC', cidade: txt(loc, 'City').slice(0, 60),
      bairro: txt(loc, 'Neighborhood').slice(0, 60), logradouro: txt(loc, 'Address').slice(0, 120),
      numero: txt(loc, 'StreetNumber').slice(0, 20), complemento: txt(loc, 'Complement').slice(0, 60),
      latitude: num(loc, 'Latitude'), longitude: num(loc, 'Longitude'),
      exibir_endereco: EXIBIR[loc?.getAttribute('displayAddress')] || 'bairro',
      no_site: true, no_grupo_olx: true,
      tipo_publicacao_olx: opcoes.publicacao_olx[pub] ? pub : 'STANDARD',
    },
  };
}

async function importarFoto(imovelId, url) {
  const r = await fetch('/api/admin/importar/foto?url=' + encodeURIComponent(url), { credentials: 'same-origin' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Foto indisponível.');
  const arquivo = new File([await r.blob()], 'foto.jpg');
  return enviarFoto(imovelId, await prepararFoto(arquivo));
}

function secaoImportar(recarregar) {
  const box = el('details', 'ig-app');
  box.append(el('summary', '', 'Importar os anúncios do site antigo'));
  box.append(el('p', 'hint', 'Cole o link do XML que o fornecedor antigo usa para mandar os anúncios ao Canal Pro (aparece na área de integração do Canal Pro). Os anúncios e as fotos são copiados para cá; nada muda no site antigo.'));
  const form = el('form', 'adm-form');
  form.noValidate = true;
  form.innerHTML = `<div class="form-erro" role="alert" hidden></div>
    <div class="form-field"><label for="imp-url">Link do XML</label>
      <div class="copiar"><input class="input" id="imp-url" name="url" type="url" placeholder="https://…/feed.xml" required><button class="btn btn--primary btn--sm" type="submit">Buscar</button></div>
    </div>`;
  const previa = el('div', 'importar-previa');
  box.append(form, previa);
  const erroBox = form.querySelector('.form-erro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroBox.hidden = true;
    previa.replaceChildren(el('p', 'hint', 'Buscando o XML…'));
    let opcoes;
    let doc;
    try {
      const [r, o] = await Promise.all([
        api('/api/admin/importar/buscar?url=' + encodeURIComponent(form.elements.url.value.trim()), { semToast: true }),
        api('/api/imoveis/opcoes'),
      ]);
      opcoes = o;
      doc = new DOMParser().parseFromString(r.xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new ErroApi('O arquivo não é um XML válido.');
    } catch (err) {
      previa.replaceChildren();
      erroBox.textContent = err.message;
      erroBox.hidden = false;
      return;
    }
    const listings = [...doc.getElementsByTagNameNS('*', 'Listing')].map((l) => lerListing(l, opcoes));
    if (!listings.length) {
      previa.replaceChildren(el('p', 'form-erro', 'Nenhum anúncio encontrado. O link precisa ser de um XML no formato VRSync (ZAP/Viva Real).'));
      previa.firstChild.hidden = false;
      return;
    }
    mostrarPrevia(listings);
  });

  function mostrarPrevia(listings) {
    const totalFotos = listings.reduce((s, l) => s + l.fotos.length, 0);
    const topo = el('p', '', `${listings.length} anúncios encontrados, com ${totalFotos} fotos. Escolha quais importar:`);
    const lista = el('ul', 'adm-lista importar-lista');
    listings.forEach((l, i) => {
      const li = el('li', 'adm-item');
      const lbl = el('label', 'check');
      const c = el('input');
      c.type = 'checkbox';
      c.checked = true;
      c.value = String(i);
      const preco = l.dados.preco_venda || l.dados.preco_aluguel;
      const texto = el('span');
      texto.append(el('strong', '', `${l.ref || 'sem código'} · ${l.dados.titulo || 'sem título'}`),
        el('small', '', `${preco ? 'R$ ' + Number(preco).toLocaleString('pt-BR') : 'sem preço'} · ${l.fotos.length} fotos${l.avisos.length ? ' · ' + l.avisos.join('; ') : ''}`));
      lbl.append(c, texto);
      li.append(lbl);
      lista.append(li);
    });
    const situacao = el('select', 'select');
    situacao.append(new Option('Importar já publicados no site', 'ativo'), new Option('Importar como rascunho (reviso antes)', 'rascunho'));
    situacao.setAttribute('aria-label', 'Situação dos anúncios importados');
    const status = el('p', 'hint');
    status.setAttribute('aria-live', 'polite');
    const importar = botao('Importar selecionados', async () => {
      const escolhidos = [...lista.querySelectorAll('input:checked')].map((c) => listings[Number(c.value)]);
      if (!escolhidos.length) return;
      const fotos = escolhidos.reduce((s, l) => s + l.fotos.length, 0);
      if (fotos > 450 && !confirm(`São ${fotos} fotos. O plano grátis grava até ~500 fotos por dia; o que passar disso falha e pode ser repetido amanhã. Continuar?`)) return;
      importar.disabled = true;
      let ok = 0;
      const falhas = [];
      for (const [k, l] of escolhidos.entries()) {
        status.textContent = `Importando ${k + 1} de ${escolhidos.length}: ${l.ref}…`;
        let novo;
        const corpo = { ...l.dados, status: situacao.value, importacao: { id_externo: l.ref, ref: l.ref } };
        try {
          novo = await api('/api/admin/imoveis', { metodo: 'POST', semToast: true, dados: corpo });
        } catch (err) {
          // Publicado sem preço/bairro é recusado: entra como rascunho para completar depois.
          if (err.status === 400 && corpo.status === 'ativo') {
            try { novo = await api('/api/admin/imoveis', { metodo: 'POST', semToast: true, dados: { ...corpo, status: 'rascunho' } }); } catch (e2) { falhas.push(`${l.ref}: ${e2.message}`); continue; }
          } else {
            falhas.push(`${l.ref}: ${err.message}`);
            continue;
          }
        }
        for (const [j, url] of l.fotos.entries()) {
          status.textContent = `Importando ${k + 1} de ${escolhidos.length}: ${l.ref}, foto ${j + 1} de ${l.fotos.length}…`;
          try { await importarFoto(novo.id, url); } catch (err) { falhas.push(`${l.ref}, foto ${j + 1}: ${err.message}`); }
        }
        ok += 1;
      }
      status.textContent = `${ok} de ${escolhidos.length} anúncios importados.`;
      if (falhas.length) {
        const ul = el('ul', 'portais-pendencias');
        falhas.slice(0, 30).forEach((f) => ul.append(el('li', '', f)));
        status.after(ul);
      }
      toast(`${ok} anúncios importados.`);
      window.Urupema?.recarregarImoveis?.();
      importar.disabled = false;
      if (ok) recarregar({ manterImportacao: true });
    }, 'btn--primary');
    const acoes = el('div', 'adm-form__acoes');
    acoes.append(situacao, importar);
    previa.replaceChildren(topo, lista, acoes, status);
  }
  return box;
}

export async function abrirPortais() {
  const corpo = abrirGaveta('Portais', { larga: true });
  if (!corpo) return;
  const intro = el('p', 'gaveta__intro', 'Os anúncios marcados para OLX, ZAP e Viva Real saem daqui para o Canal Pro do Grupo OLX por um link (feed). Não precisa de login nem senha: basta colar o link no Canal Pro uma vez.');
  const conteudo = el('div', 'portais-conteudo');
  const importar = secaoImportar(() => carregar());
  corpo.append(intro, conteudo, el('hr', 'gaveta__divisao'), importar);

  async function carregar() {
    let r;
    try {
      r = await api('/api/admin/portais');
    } catch {
      conteudo.replaceChildren(el('p', 'form-erro', 'Não foi possível carregar os portais.'));
      return;
    }
    const partes = r.avisos.map((a) => { const p = el('p', 'form-erro', a); p.hidden = false; return p; });
    partes.push(secaoLink(r, carregar), passoAPasso(), listaAnuncios(r));
    conteudo.replaceChildren(...partes);
  }
  conteudo.append(el('p', 'gaveta__intro', 'Carregando…'));
  await carregar();
}
