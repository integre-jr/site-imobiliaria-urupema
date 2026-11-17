// Trocar a própria senha. Encerra as outras sessões do usuário (spec 8.1).
import { bloqueado, erroBloqueio, hashSenha, lerSessao, registrarFalha, verificarSenha } from '../../../lib/auth.js';
import { agora, executar, um } from '../../../lib/db.js';
import { erro, ipDe, json, lerJson } from '../../../lib/http.js';
import { validarSenha } from '../../../lib/validacao.js';

export async function onRequestPost({ request, env }) {
  const s = await lerSessao(env, request);
  if (!s) return erro('Sua sessão expirou. Entre de novo.', 401);

  const ip = ipDe(request);
  if (await bloqueado(env, ip)) return erroBloqueio();

  const b = (await lerJson(request)) || {};
  const msg = validarSenha(b.nova);
  if (msg) return erro(msg, 400, 'nova');

  const u = await um(env.DB, 'SELECT senha_hash FROM usuarios WHERE id = ?', s.usuario.id);
  if (!(await verificarSenha(String(b.atual ?? ''), u.senha_hash))) {
    await registrarFalha(env, ip, s.usuario.email);
    return erro('A senha atual está incorreta.', 400, 'atual');
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ?').bind(await hashSenha(b.nova), agora(), s.usuario.id),
    env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND id_hash <> ?').bind(s.usuario.id, s.idHash),
  ]);
  return json({ ok: true });
}
