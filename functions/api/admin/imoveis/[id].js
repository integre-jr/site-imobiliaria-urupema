// Um anúncio no painel. :id aceita o número interno ou a referência ("UR-1024").
// GET: tudo + fotos. PUT: atualização parcial (só os campos enviados mudam). DELETE: só rascunho/arquivado.
import { carregarImovel, COLUNAS, listarFotos } from '../../../../lib/anuncios.js';
import { agora, todos, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { validarImovel } from '../../../../lib/imoveis.js';

async function completo(env, im) {
  let caracteristicas = [];
  try { caracteristicas = JSON.parse(im.caracteristicas); } catch { /* vazio */ }
  return { ...im, caracteristicas, destaque: !!im.destaque, no_site: !!im.no_site, no_grupo_olx: !!im.no_grupo_olx, fotos: await listarFotos(env, im.id) };
}

export async function onRequestGet({ env, params }) {
  const im = await carregarImovel(env, params.id);
  return im ? json(await completo(env, im)) : erro('Anúncio não encontrado.', 404);
}

export async function onRequestPut({ request, env, params }) {
  const im = await carregarImovel(env, params.id);
  if (!im) return erro('Anúncio não encontrado.', 404);
  const v = validarImovel((await lerJson(request)) || {}, im);
  if (v.erro) return erro(v.erro, 400, v.campo);

  const t = agora();
  const publicadoEm = im.publicado_em || (['ativo', 'reservado'].includes(v.dados.status) ? t : null);
  await env.DB.prepare(`UPDATE imoveis SET ${COLUNAS.map((c) => `${c} = ?`).join(', ')}, atualizado_em = ?, publicado_em = ? WHERE id = ?`)
    .bind(...COLUNAS.map((c) => v.dados[c]), t, publicadoEm, im.id).run();
  return json(await completo(env, await um(env.DB, 'SELECT * FROM imoveis WHERE id = ?', im.id)));
}

export async function onRequestDelete({ env, params }) {
  const im = await carregarImovel(env, params.id);
  if (!im) return erro('Anúncio não encontrado.', 404);
  if (!['rascunho', 'arquivado'].includes(im.status)) {
    return erro('Só dá para excluir rascunhos e anúncios arquivados. Arquive primeiro.', 409);
  }
  const fotos = await todos(env.DB, 'SELECT kv_chave FROM fotos WHERE imovel_id = ? AND kv_chave IS NOT NULL', im.id);
  await Promise.all(fotos.flatMap((f) => [env.FOTOS.delete(`${f.kv_chave}/g.jpg`), env.FOTOS.delete(`${f.kv_chave}/p.jpg`)]));
  await env.DB.prepare('DELETE FROM imoveis WHERE id = ?').bind(im.id).run();
  return json({ ok: true });
}
