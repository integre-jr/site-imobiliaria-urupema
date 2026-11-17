// PUT /api/admin/imoveis/:id/fotos-ordem { ids: [...] } — nova ordem das fotos; a primeira é a capa.
import { agora, todos } from '../../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../../lib/http.js';
import { carregarImovel, listarFotos } from '../../../../../lib/anuncios.js';

export async function onRequestPut({ request, env, params }) {
  const im = await carregarImovel(env, params.id);
  if (!im) return erro('Anúncio não encontrado.', 404);
  const ids = ((await lerJson(request)) || {}).ids;
  const atuais = (await todos(env.DB, 'SELECT id FROM fotos WHERE imovel_id = ?', im.id)).map((f) => f.id);
  const mesmoConjunto = Array.isArray(ids) && ids.length === atuais.length && atuais.every((id) => ids.includes(id));
  if (!mesmoConjunto) return erro('A lista de fotos mudou. Recarregue e tente de novo.', 409);

  await env.DB.batch([
    ...ids.map((id, ordem) => env.DB.prepare('UPDATE fotos SET ordem = ? WHERE id = ? AND imovel_id = ?').bind(ordem, id, im.id)),
    env.DB.prepare('UPDATE imoveis SET atualizado_em = ? WHERE id = ?').bind(agora(), im.id),
  ]);
  return json({ fotos: await listarFotos(env, im.id) });
}
