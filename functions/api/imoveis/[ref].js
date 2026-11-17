// GET /api/imoveis/:ref — um imóvel público (só ativo/reservado e no site), com fotos e endereço permitido.
import { todos, um } from '../../../lib/db.js';
import { erro, json } from '../../../lib/http.js';
import { normalizarRef, paraDetalhePublico, SQL_PUBLICO } from '../../../lib/imoveis.js';

export async function onRequestGet({ env, params }) {
  const ref = normalizarRef(params.ref);
  const im = ref && await um(env.DB, `SELECT * FROM imoveis i WHERE i.ref = ? AND ${SQL_PUBLICO}`, ref);
  if (!im) return erro('Imóvel não encontrado.', 404);
  const fotos = await todos(env.DB, 'SELECT * FROM fotos WHERE imovel_id = ? ORDER BY ordem, id', im.id);
  return json(paraDetalhePublico(im, fotos), 200, { 'Cache-Control': 'public, max-age=60' });
}
