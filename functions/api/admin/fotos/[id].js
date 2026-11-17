// DELETE /api/admin/fotos/:id — apaga a foto do KV e do D1; as outras sobem na ordem.
import { agora, um } from '../../../../lib/db.js';
import { erro, json } from '../../../../lib/http.js';

export async function onRequestDelete({ env, params }) {
  const f = await um(env.DB, 'SELECT * FROM fotos WHERE id = ?', Number(params.id) || 0);
  if (!f) return erro('Foto não encontrada.', 404);
  if (f.kv_chave) await Promise.all([env.FOTOS.delete(`${f.kv_chave}/g.jpg`), env.FOTOS.delete(`${f.kv_chave}/p.jpg`)]);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fotos WHERE id = ?').bind(f.id),
    env.DB.prepare('UPDATE fotos SET ordem = ordem - 1 WHERE imovel_id = ? AND ordem > ?').bind(f.imovel_id, f.ordem),
    env.DB.prepare('UPDATE imoveis SET atualizado_em = ? WHERE id = ?').bind(agora(), f.imovel_id),
  ]);
  return json({ ok: true });
}
