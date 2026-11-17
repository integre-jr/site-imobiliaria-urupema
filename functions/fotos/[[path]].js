// GET /fotos/<chave> — fotos de imóveis guardadas no KV (spec 7.6).
// As chaves nunca são reaproveitadas, então o cache pode ser eterno.
// Fotos de leads (lead/…) não são públicas; as do Instagram (ig/…) chegam no M6.
export async function onRequestGet({ env, params }) {
  const chave = (params.path || []).join('/');
  if (!/^imovel\/\d+\/[0-9a-f-]{36}\/[gp]\.jpg$/.test(chave)) return new Response('Não encontrado.', { status: 404 });
  const corpo = await env.FOTOS.get(chave, 'stream');
  if (!corpo) return new Response('Não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(corpo, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
