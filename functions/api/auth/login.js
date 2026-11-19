import { bloqueado, criarSessao, erroBloqueio, hashSenha, registrarFalha, verificarSenha } from '../../../lib/auth.js';
import { agora, executar, um } from '../../../lib/db.js';
import { erro, ipDe, json, lerJson } from '../../../lib/http.js';
import { limpar } from '../../../lib/validacao.js';

export async function onRequestPost({ request, env }) {
  const b = (await lerJson(request)) || {};
  const email = limpar(b.email).toLowerCase();
  const senha = typeof b.senha === 'string' ? b.senha : '';
  const ip = ipDe(request);

  // Faxina barata a cada login: tentativas com mais de 1 dia e sessões vencidas.
  const umDiaAtras = new Date(Date.now() - 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tentativas_login WHERE quando < ?').bind(umDiaAtras),
    env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?').bind(agora()),
  ]);

  if (await bloqueado(env, ip, email)) return erroBloqueio();

  const u = email && senha ? await um(env.DB, 'SELECT id, senha_hash, ativo FROM usuarios WHERE email = ?', email) : null;
  // Sem usuário, calcula um hash mesmo assim: o tempo de resposta não revela quais e-mails existem.
  const ok = u ? await verificarSenha(senha, u.senha_hash) : (await hashSenha(senha), false);
  if (!ok || !u.ativo) {
    await registrarFalha(env, ip, email);
    return erro('E-mail ou senha inválidos.', 401);
  }

  await executar(env.DB, 'DELETE FROM tentativas_login WHERE ip = ? OR email = ?', ip, email);
  const cookie = await criarSessao(env, request, u.id, b.manter === true);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
