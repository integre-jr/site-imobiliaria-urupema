// GET /fotos/<chave> — fotos de imóveis guardadas no KV (spec 7.6).
// As chaves nunca são reaproveitadas, então o cache pode ser eterno.
// Também as fotos fixas do site trocadas pelo painel (site/<uuid>.jpg).
// Fotos de leads (lead/…) não são públicas.
// As imagens dos posts do Instagram (ig/<uuid>.jpg) vêm do D1 (tabela instagram_midias_temp, 24 h):
// a Meta baixa daqui logo depois de o post ser criado.
async function midiaInstagram(env, id) {
  const linha = await env.DB.prepare('SELECT conteudo FROM instagram_midias_temp WHERE id = ?').bind(id).first();
  if (!linha) return new Response('Não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const c = linha.conteudo;
  const bytes = c instanceof ArrayBuffer || ArrayBuffer.isView(c) ? c : new Uint8Array(c);   // o D1 devolve BLOB como array
  return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
}

export async function onRequestGet({ env, params }) {
  const chave = (params.path || []).join('/');
  const ig = /^ig\/([0-9a-f-]{36})\.jpg$/.exec(chave);
  if (ig) return midiaInstagram(env, ig[1]);
  if (!/^(imovel\/\d+\/[0-9a-f-]{36}\/[gp]|site\/[0-9a-f-]{36})\.jpg$/.test(chave)) return new Response('Não encontrado.', { status: 404 });
  const corpo = await env.FOTOS.get(chave, 'stream');
  if (!corpo) return new Response('Não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(corpo, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
