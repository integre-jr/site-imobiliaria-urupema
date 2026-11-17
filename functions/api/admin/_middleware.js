// /api/admin/*: exige sessão (401 em JSON) e o header anti-CSRF; expõe context.data.usuario.
import { comHeaders, csrfOk, lerSessao } from '../../../lib/auth.js';
import { erro } from '../../../lib/http.js';

export async function onRequest(context) {
  if (!csrfOk(context.request)) return erro('Requisição inválida.', 403);
  const s = await lerSessao(context.env, context.request);
  if (!s) return erro('Sua sessão expirou. Entre de novo.', 401);
  context.data.usuario = s.usuario;
  const res = await context.next();
  return s.setCookie ? comHeaders(res, s.setCookie) : res;
}
