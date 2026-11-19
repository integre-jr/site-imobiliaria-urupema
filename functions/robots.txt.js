// GET /robots.txt — buscadores ficam fora do painel e da API e recebem o sitemap (spec 7.6).
export function onRequestGet({ request }) {
  const origem = new URL(request.url).origin;
  const texto = ['User-agent: *', 'Disallow: /admin', 'Disallow: /api', 'Disallow: /feeds', 'Disallow: /modelos', '', `Sitemap: ${origem}/sitemap.xml`, ''].join('\n');
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
