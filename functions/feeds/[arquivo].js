// GET /feeds/grupo-olx-<token>.xml — feed VRSync lido pelo Canal Pro (OLX, ZAP, Viva Real), spec 10.1.
// Token errado → 404 (o feed traz o endereço completo dos imóveis). Cada leitura fica registrada em
// feed_acessos (os últimos 200), para o painel mostrar quando o portal leu pela última vez.
import { textosIguais } from '../../lib/auth.js';
import { lerConfig } from '../../lib/config.js';
import { executar } from '../../lib/db.js';
import { candidatos, FEED_GRUPO_OLX, tokenFeed } from '../../lib/portais.js';
import { gerarFeed } from '../../lib/vrsync.js';

const naoEncontrado = () => new Response('Não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env, params, waitUntil }) {
  const m = /^grupo-olx-([A-Za-z0-9_-]{8,64})\.xml$/.exec(params.arquivo || '');
  if (!m || !(await textosIguais(m[1], await tokenFeed(env)))) return naoEncontrado();

  const itens = (await candidatos(env)).filter((c) => !c.pendencias.length);
  const xml = gerarFeed(itens, await lerConfig(env), new URL(request.url).origin);

  // Quem abre o feed pelo painel (com sessão) não conta como leitura do portal.
  const doPainel = (request.headers.get('Cookie') || '').includes('urupema_sessao=');
  if (!doPainel) waitUntil((async () => {
    try {
      await executar(env.DB, 'INSERT INTO feed_acessos (feed, user_agent, ip, itens, quando) VALUES (?, ?, ?, ?, ?)',
        FEED_GRUPO_OLX, (request.headers.get('User-Agent') || '').slice(0, 300), request.headers.get('CF-Connecting-IP') || '', itens.length, new Date().toISOString());
      await executar(env.DB, `DELETE FROM feed_acessos WHERE rowid NOT IN (SELECT rowid FROM feed_acessos ORDER BY quando DESC LIMIT 200)`);
    } catch (e) {
      console.error(e);
    }
  })());

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'max-age=300', 'X-Robots-Tag': 'noindex' },
  });
}
