import { comHeaders, lerSessao } from '../../../lib/auth.js';
import { erro, json } from '../../../lib/http.js';

export async function onRequestGet({ request, env }) {
  const s = await lerSessao(env, request);
  if (!s) return erro('Sua sessão expirou. Entre de novo.', 401);
  return comHeaders(json({ usuario: s.usuario }), s.setCookie);
}
