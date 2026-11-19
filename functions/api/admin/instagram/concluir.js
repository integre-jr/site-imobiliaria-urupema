// POST /api/admin/instagram/concluir { post_id } — 2ª etapa: publica o contêiner quando a Meta termina de
// processar as imagens. Resposta: { status: 'publicando' } (chamar de novo em alguns segundos) ou
// { status: 'publicado', permalink }. Erro marca o post como "erro" no histórico.
import { executar, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { concluirPost } from '../../../../lib/instagram/index.js';

export async function onRequestPost({ request, env, data }) {
  const b = (await lerJson(request)) || {};
  const p = await um(env.DB, 'SELECT p.*, i.ref FROM instagram_posts p LEFT JOIN imoveis i ON i.id = p.imovel_id WHERE p.id = ?', Number(b.post_id) || 0);
  if (!p) return erro('Post não encontrado.', 404);
  if (p.status === 'publicado') return json({ status: 'publicado', permalink: p.permalink });
  if (p.status === 'erro') return erro(p.erro || 'O post não foi publicado.', 409);

  const c = data.instagram;
  if (!c || p.modo !== data.igApp.modo) return erro('O Instagram foi desconectado durante a publicação. Conecte de novo e tente outra vez.', 409);
  if (!p.ig_container_id) return erro('O post ainda não foi enviado ao Instagram. Tente de novo.', 409);

  try {
    const origem = new URL(request.url).origin;
    const r = await concluirPost(env, data.igApp, c, p.ig_container_id, { permalink: p.ref ? `${origem}/imovel/${p.ref}` : origem });
    if (!r.pronto) {
      // a Meta recomenda desistir depois de alguns minutos
      if (Date.now() - Date.parse(p.criado_em) > 5 * 60000) throw new Error('O Instagram demorou demais para processar as fotos. Tente de novo.');
      return json({ status: 'publicando' });
    }
    await executar(env.DB, "UPDATE instagram_posts SET status = 'publicado', ig_media_id = ?, permalink = ?, erro = NULL WHERE id = ?",
      r.mediaId, r.permalink, p.id);
    return json({ status: 'publicado', permalink: r.permalink });
  } catch (e) {
    console.error(e);
    await executar(env.DB, "UPDATE instagram_posts SET status = 'erro', erro = ? WHERE id = ?", String(e.message).slice(0, 500), p.id);
    return erro(String(e.message), 502);
  }
}
