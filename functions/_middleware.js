// Site público: aplica nas páginas HTML os dados editados no painel (spec 7.4).
// /admin e /api têm tratamento próprio. Se o banco falhar, o HTML estático segue como está.
import { aplicarConfig, lerConfig } from '../lib/config.js';

export async function onRequest({ request, env, next }) {
  const { pathname } = new URL(request.url);
  if (/^\/(admin|api)(\/|$)/.test(pathname)) return next();

  // Sem If-None-Match: o arquivo estático responderia 304 e o navegador
  // mostraria um telefone antigo guardado no cache.
  const semCondicional = new Request(request);
  semCondicional.headers.delete('If-None-Match');
  semCondicional.headers.delete('If-Modified-Since');
  const res = await next(semCondicional);
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;

  let cfg;
  try {
    cfg = await lerConfig(env);
  } catch (e) {
    console.error(e);
    return res;
  }
  const nova = new Response(aplicarConfig(new HTMLRewriter(), cfg).transform(res).body, res);
  nova.headers.delete('ETag');
  nova.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return nova;
}
