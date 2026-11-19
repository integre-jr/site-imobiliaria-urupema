// GET /api/admin/instagram/previa?imovel=<id ou ref> — tudo o que o modal de publicação precisa
// (spec 9.2): fotos do anúncio, legenda gerada pelo modelo, se já houve post e a situação da conta.
import { carregarImovel, listarFotos } from '../../../../lib/anuncios.js';
import { lerConfig } from '../../../../lib/config.js';
import { um } from '../../../../lib/db.js';
import { erro, json } from '../../../../lib/http.js';
import { gerarLegenda, MAX_HASHTAGS, MAX_LEGENDA } from '../../../../lib/instagram/legenda.js';
import { limiteUso } from '../../../../lib/instagram/index.js';

export async function onRequestGet({ request, env, data }) {
  const im = await carregarImovel(env, new URL(request.url).searchParams.get('imovel'));
  if (!im) return erro('Anúncio não encontrado.', 404);
  const c = data.instagram;
  const conectado = !!c && Date.parse(c.expiraEm) > Date.now();
  let limite = null;
  if (conectado) {
    try { limite = await limiteUso(env, data.igApp, c); } catch (e) { console.error(e); }
  }
  const anterior = await um(env.DB, "SELECT criado_em, permalink FROM instagram_posts WHERE imovel_id = ? AND status = 'publicado' ORDER BY id DESC LIMIT 1", im.id);
  return json({
    imovel: { id: im.id, ref: im.ref, titulo: im.titulo, status: im.status },
    fotos: await listarFotos(env, im.id),
    legenda: gerarLegenda(im, await lerConfig(env)),
    anterior,
    modo: data.igApp.modo,
    conectado,
    conta: c?.conta ?? null,
    limite,
    max_legenda: MAX_LEGENDA,
    max_hashtags: MAX_HASHTAGS,
    pode_gerenciar: data.usuario.papel === 'admin',
  });
}
