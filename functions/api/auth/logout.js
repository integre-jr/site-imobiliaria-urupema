// Sair. Com { todos: true }, encerra as sessões do usuário em todos os dispositivos.
import { cookieApagado, lerSessao } from '../../../lib/auth.js';
import { executar } from '../../../lib/db.js';
import { json, lerJson } from '../../../lib/http.js';

export async function onRequestPost({ request, env }) {
  const s = await lerSessao(env, request);
  if (s) {
    const b = (await lerJson(request)) || {};
    if (b.todos === true) await executar(env.DB, 'DELETE FROM sessoes WHERE usuario_id = ?', s.usuario.id);
    else await executar(env.DB, 'DELETE FROM sessoes WHERE id_hash = ?', s.idHash);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieApagado() });
}
