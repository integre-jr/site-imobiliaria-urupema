// Página de um imóvel (spec 7.3): lê public/modelos/imovel.html e preenche com HTMLRewriter.
// Usada em /imovel/:ref (público: só ativo/reservado no site) e em /admin/imovel/:ref (qualquer status).
import { lerConfig } from './config.js';
import { todos, um } from './db.js';
import { escapeHtml as esc } from './html.js';
import { CARACTERISTICAS, enderecoPublico, FINALIDADES, fotoUrls, normalizarRef, SQL_PUBLICO, STATUS, TIPOS } from './imoveis.js';

const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const reais = (n) => 'R$ ' + milhar(n);
const icone = (id) => `<svg><use href="#${id}"/></svg>`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const area = (n) => `${String(n).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m²`;

function precoHtml(im) {
  const blocos = [];
  if (im.finalidade !== 'aluguel' && im.preco_venda) blocos.push(`<div><span>Venda</span><strong>${reais(im.preco_venda)}</strong></div>`);
  if (im.finalidade !== 'venda' && im.preco_aluguel) blocos.push(`<div><span>Aluguel</span><strong>${reais(im.preco_aluguel)}<small>/mês</small></strong></div>`);
  if (!blocos.length) blocos.push('<div><span>Valor</span><strong>Consulte</strong></div>');
  const extras = [];
  if (im.condominio) extras.push(`Condomínio ${reais(im.condominio)}/mês`);
  if (im.iptu_anual) extras.push(`IPTU ${reais(im.iptu_anual)}/ano`);
  if (extras.length) blocos.push(`<p>${extras.join(' · ')}</p>`);
  return blocos.join('');
}

function specsHtml(im) {
  const s = [];
  if (im.quartos) s.push([icone('i-bed'), plural(im.quartos, 'quarto', 'quartos')]);
  if (im.suites) s.push([icone('i-bed'), plural(im.suites, 'suíte', 'suítes')]);
  if (im.banheiros) s.push([icone('i-bath'), plural(im.banheiros, 'banheiro', 'banheiros')]);
  if (im.vagas) s.push([icone('i-car'), plural(im.vagas, 'vaga', 'vagas')]);
  if (im.area_util) s.push([icone('i-area'), `${area(im.area_util)} úteis`]);
  if (im.area_total) s.push([icone('i-area'), `${area(im.area_total)} de terreno`]);
  return s.map(([i, t]) => `<span class="spec">${i} ${esc(t)}</span>`).join('');
}

function descricaoHtml(texto) {
  return String(texto || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('') || '<p>Fale com a Urupema para saber mais sobre este imóvel.</p>';
}

function enderecoTexto(im) {
  const e = enderecoPublico(im);
  const cidade = `${e.bairro ? e.bairro + ', ' : ''}${e.cidade}/${e.uf}`;
  if (im.exibir_endereco === 'completo' && e.logradouro) {
    const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ');
    return `${rua} — ${cidade}${e.cep ? ' · ' + e.cep : ''}`;
  }
  if (im.exibir_endereco === 'rua' && e.logradouro) return `${e.logradouro} — ${cidade}`;
  return cidade;
}

function mapaUrl(im) {
  if (im.exibir_endereco === 'completo' && im.latitude != null && im.longitude != null) {
    return `https://www.google.com/maps?q=${im.latitude},${im.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoTexto(im).replace(/[—·]/g, ','))}`;
}

function galeriaHtml(im, fotos) {
  if (!fotos.length) {
    return `<div class="galeria__vazia card-media is-fallback"><div class="card-media__fallback">${icone(TIPOS[im.tipo]?.icone || 'i-home')}<span>Fotos em breve</span></div></div>`;
  }
  const urls = fotos.map(fotoUrls);
  const alt = esc(im.titulo);
  const miniaturas = urls.length > 1
    ? `<div class="galeria__miniaturas">${urls.map((u, k) => `<button type="button" class="galeria__mini${k ? '' : ' is-active'}" data-galeria-indice="${k}" aria-label="Foto ${k + 1} de ${urls.length}"><img src="${esc(u.p)}" alt="" loading="lazy"></button>`).join('')}</div>`
    : '';
  return `<div class="galeria__principal card-media" data-galeria-fotos="${esc(JSON.stringify(urls.map((u) => u.g)))}">
      <button type="button" class="galeria__abrir" data-galeria-abrir aria-label="Ampliar foto"><img src="${esc(urls[0].g)}" alt="${alt}"></button>
      <div class="card-media__fallback">${icone(TIPOS[im.tipo]?.icone || 'i-home')}<span>Urupema · SC</span></div>
      <span class="galeria__contador">${urls.length} ${urls.length === 1 ? 'foto' : 'fotos'}</span>
    </div>${miniaturas}`;
}

function jsonLd(im, fotos, url, siteUrl) {
  const absoluta = (u) => (u.startsWith('/') ? siteUrl + u : u);
  const preco = im.finalidade === 'aluguel' ? im.preco_aluguel : im.preco_venda;
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: im.titulo,
    description: (im.descricao || '').slice(0, 500),
    url,
    image: fotos.map((f) => absoluta(fotoUrls(f).g)),
    datePosted: im.publicado_em || im.criado_em,
    ...(preco ? { offers: { '@type': 'Offer', price: preco, priceCurrency: 'BRL' } } : {}),
    address: { '@type': 'PostalAddress', addressLocality: im.cidade, addressRegion: im.uf, addressCountry: 'BR' },
  };
  return JSON.stringify(dados).replace(/</g, '\\u003c');   // nada de "</script>" dentro do JSON
}

// Devolve a Response da página, ou null se o imóvel não existe / não é público.
export async function paginaImovel(env, request, refBruta, { admin = false } = {}) {
  const ref = normalizarRef(refBruta);
  if (!ref) return null;
  const im = await um(env.DB, `SELECT * FROM imoveis i WHERE i.ref = ?${admin ? '' : ` AND ${SQL_PUBLICO}`}`, ref);
  if (!im) return null;
  const fotos = await todos(env.DB, 'SELECT * FROM fotos WHERE imovel_id = ? ORDER BY ordem, id', im.id);
  const cfg = await lerConfig(env);
  const siteUrl = env.SITE_URL || new URL(request.url).origin;
  const url = `${siteUrl}/imovel/${ref}`;
  const capa = fotos[0] ? fotoUrls(fotos[0]).g : '/imagens/logo_site_urupema.png';
  const capaAbs = capa.startsWith('/') ? siteUrl + capa : capa;
  const local = `${im.bairro ? im.bairro + ' · ' : ''}${im.cidade}/${im.uf}`;
  const precoCurto = im.finalidade === 'aluguel' ? `${reais(im.preco_aluguel || 0)}/mês` : reais(im.preco_venda || 0);
  const resumo = `${TIPOS[im.tipo]?.rotulo} em ${local}. ${precoCurto}. ${(im.descricao || '').replace(/\s+/g, ' ')}`.slice(0, 155);
  let cars = [];
  try { cars = JSON.parse(im.caracteristicas || '[]').filter((c) => CARACTERISTICAS[c]); } catch { /* vazio */ }
  const whatsapp = `https://wa.me/${cfg['contato.whatsapp'] || '5549991603030'}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${ref} — ${url}`)}`;

  const etiquetas = [
    `<span class="badge badge--${im.finalidade === 'aluguel' ? 'rent' : 'sale'}">${esc(FINALIDADES[im.finalidade].rotulo)}</span>`,
    `<span class="imovel-tipo">${esc(TIPOS[im.tipo]?.rotulo || '')}</span>`,
    im.status !== 'ativo' ? `<span class="imovel-status imovel-status--${im.status}">${esc(STATUS[im.status])}</span>` : '',
  ].join('');

  const texto = (valor) => ({ element: (el) => el.setInnerContent(valor) });
  const html = (valor) => ({ element: (el) => el.setInnerContent(valor, { html: true }) });
  const remover = { element: (el) => el.remove() };

  const modelo = await env.ASSETS.fetch(new URL('/modelos/imovel', request.url));
  const rw = new HTMLRewriter()
    .on('title', texto(`${im.titulo} — ${ref} | Urupema Negócios Imobiliários`))
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', resumo) })
    .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', `${im.titulo} — ${precoCurto}`) })
    .on('meta[property="og:description"]', { element: (el) => el.setAttribute('content', resumo) })
    .on('meta[property="og:image"]', { element: (el) => el.setAttribute('content', capaAbs) })
    .on('meta[property="og:url"]', { element: (el) => el.setAttribute('content', url) })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url) })
    .on('[data-campo="jsonld"]', html(jsonLd(im, fotos, url, siteUrl)))
    .on('[data-campo="ref"]', texto(ref))
    .on('[data-campo="titulo"]', texto(im.titulo))
    .on('[data-campo="local"]', texto(local))
    .on('[data-campo="etiquetas"]', html(etiquetas))
    .on('[data-campo="preco"]', html(precoHtml(im)))
    .on('[data-campo="galeria"]', html(galeriaHtml(im, fotos)))
    .on('[data-campo="specs"]', html(specsHtml(im)))
    .on('[data-campo="descricao"]', html(descricaoHtml(im.descricao)))
    .on('[data-campo="caracteristicas"]', html(cars.map((c) => `<li>${icone('i-check')} ${esc(CARACTERISTICAS[c].rotulo)}</li>`).join('')))
    .on('[data-campo="endereco"]', texto(enderecoTexto(im)))
    .on('[data-campo="mapa"]', { element: (el) => el.setAttribute('href', mapaUrl(im)) })
    .on('[data-campo="whatsapp"]', { element: (el) => el.setAttribute('href', whatsapp) })
    .on('[data-campo="favoritar"]', { element: (el) => el.setAttribute('data-fav-ref', ref) })
    .on('[data-outros]', {
      element: (el) => {
        el.setAttribute('data-ref', ref);
        el.setAttribute('data-tipo', im.tipo);
        el.setAttribute('data-finalidade', im.finalidade === 'aluguel' ? 'aluguel' : 'venda');
      },
    })
    .on('[data-campo="main"]', {
      element: (el) => {
        el.setAttribute('data-imovel-ref', ref);
        if (admin) el.setAttribute('data-imovel-id', String(im.id));
      },
    });
  if (!cars.length) rw.on('[data-campo="bloco-caracteristicas"]', remover);

  return new Response(rw.transform(modelo).body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': admin ? 'no-store' : 'public, max-age=60',
    },
  });
}

// 404 com a página public/404.html.
export async function pagina404(env, request) {
  const r = await env.ASSETS.fetch(new URL('/404', request.url));
  return new Response(r.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
