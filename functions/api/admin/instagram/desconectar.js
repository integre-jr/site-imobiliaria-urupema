import { soAdmin } from '../../../../lib/auth.js';
import { json } from '../../../../lib/http.js';
import { desconectar } from '../../../../lib/instagram/index.js';

export async function onRequestPost({ env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  await desconectar(env);
  return json({ ok: true });
}
