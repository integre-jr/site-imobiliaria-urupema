// Primeiro acesso (spec 8.1): só funciona com a tabela de usuários vazia e o SETUP_TOKEN certo.
import { criarSessao, textosIguais, hashSenha } from '../../../lib/auth.js';
import { agora, executar, um } from '../../../lib/db.js';
import { erro, json, lerJson } from '../../../lib/http.js';
import { limpar, validarEmail, validarNome, validarSenha } from '../../../lib/validacao.js';

const semUsuarios = async (env) => (await um(env.DB, 'SELECT count(*) AS n FROM usuarios')).n === 0;

export async function onRequestGet({ env }) {
  return json({ disponivel: await semUsuarios(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await semUsuarios(env))) return erro('O primeiro acesso já foi configurado.', 404);

  const b = (await lerJson(request)) || {};
  if (!env.SETUP_TOKEN || !(await textosIguais(limpar(b.token), env.SETUP_TOKEN))) {
    return erro('Código de configuração inválido.', 403, 'token');
  }
  const nome = limpar(b.nome);
  const email = limpar(b.email).toLowerCase();
  const falha = [['nome', validarNome(nome)], ['email', validarEmail(email)], ['senha', validarSenha(b.senha)]]
    .find(([, msg]) => msg);
  if (falha) return erro(falha[1], 400, falha[0]);

  // O WHERE NOT EXISTS impede dois "primeiros admins" em requisições simultâneas.
  const t = agora();
  const r = await executar(
    env.DB,
    `INSERT INTO usuarios (nome, email, senha_hash, papel, ativo, criado_em, atualizado_em)
     SELECT ?, ?, ?, 'admin', 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM usuarios)`,
    nome, email, await hashSenha(b.senha), t, t,
  );
  if (!r.meta.changes) return erro('O primeiro acesso já foi configurado.', 404);

  const cookie = await criarSessao(env, request, r.meta.last_row_id, false);
  return json({ ok: true }, 201, { 'Set-Cookie': cookie });
}
