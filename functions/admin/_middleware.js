// /admin/*: o painel é o PRÓPRIO SITE em modo de edição (spec 8.0).
// - /admin/login e /admin/setup são páginas próprias (o setup só existe sem usuários).
// - Sem sessão → login. Com sessão, /admin/<página> devolve a página pública <página>,
//   com os dados atuais, os links reescritos para continuar dentro de /admin e o editor injetado.
// O endereço público nunca recebe nada disso.
import { comHeaders, lerSessao } from '../../lib/auth.js';
import { aplicarConfig, lerConfig } from '../../lib/config.js';
import { um } from '../../lib/db.js';
import { paginaImovel } from '../../lib/pagina-imovel.js';

const PAGINAS_DO_SITE = new Set(['index', 'imoveis', 'sobre', 'financie', 'negocie', 'contato', 'privacidade']);
const SEM_CACHE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

const redirecionar = (url, caminho) => new Response(null, { status: 302, headers: { Location: new URL(caminho, url).href } });
const naoEncontrado = () => new Response('Página não encontrada.', { status: 404, headers: SEM_CACHE });

// Link do site → link equivalente no painel. null = deixar como está.
function linkNoPainel(valor) {
  if (!valor || /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(valor)) return null;      // externo, tel:, âncora
  if (valor.startsWith('/')) {
    return /^\/(admin|api|css|js|imagens|fotos|feeds)(\/|$)/.test(valor) ? null : '/admin' + valor;
  }
  const i = valor.search(/[?#]/);
  const base = i < 0 ? valor : valor.slice(0, i);
  const resto = i < 0 ? '' : valor.slice(i);
  const pagina = base.match(/^([a-z0-9-]+)\.html$/i);
  if (pagina) return '/admin/' + (pagina[1] === 'index' ? '' : pagina[1]) + resto;
  return '/' + valor;                                                          // css/, js/, imagens/
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  // "/admin", "/admin/", "/admin/sobre", "/admin/sobre.html" → "index", "sobre"
  const pagina = url.pathname.replace(/^\/admin\/?/, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index';

  if (pagina === 'setup') {
    const { n } = await um(env.DB, 'SELECT count(*) AS n FROM usuarios');
    return n > 0 ? naoEncontrado() : comHeaders(await next(), null, SEM_CACHE);
  }

  const s = await lerSessao(env, request);
  if (pagina === 'login') {
    return s ? redirecionar(url, '/admin/') : comHeaders(await next(), null, SEM_CACHE);
  }
  if (!s) return redirecionar(url, '/admin/login?volta=' + encodeURIComponent(url.pathname + url.search));

  // /admin/imovel/UR-1024 → página do imóvel (no painel aparece mesmo se for rascunho)
  const refImovel = pagina.match(/^imovel\/([^/]+)$/)?.[1];
  let original;
  if (refImovel) {
    original = await paginaImovel(env, request, decodeURIComponent(refImovel), { admin: true });
  } else if (PAGINAS_DO_SITE.has(pagina)) {
    original = await env.ASSETS.fetch(new URL(pagina === 'index' ? '/' : '/' + pagina, url));
  }
  if (!original?.ok) return naoEncontrado();

  const reescrever = (atributo) => ({
    element(el) {
      const novo = linkNoPainel(el.getAttribute(atributo));
      if (novo) el.setAttribute(atributo, novo);
    },
  });
  const rewriter = aplicarConfig(new HTMLRewriter(), await lerConfig(env))
    .on('a[href], link[href]', reescrever('href'))
    .on('img[src], script[src], iframe[src]', reescrever('src'))
    .on('html', { element: (el) => el.setAttribute('data-admin', '') })
    .on('head', {
      element: (el) => el.append('<meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="/css/admin.css">', { html: true }),
    })
    .on('body', {
      element: (el) => el.append('<script type="module" src="/js/admin/editor.js"></script>', { html: true }),
    });

  const res = new Response(rewriter.transform(original).body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SEM_CACHE },
  });
  return s.setCookie ? comHeaders(res, s.setCookie) : res;
}
