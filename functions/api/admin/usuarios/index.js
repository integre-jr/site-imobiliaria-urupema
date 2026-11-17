// Usuários do admin: listar e criar. Só o papel "admin" (spec 8.1).
import { hashSenha, soAdmin } from '../../../../lib/auth.js';
import { agora, executar, todos } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { limpar, PAPEIS, validarEmail, validarNome, validarSenha } from '../../../../lib/validacao.js';

export async function onRequestGet({ env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const itens = await todos(env.DB, 'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY ativo DESC, nome');
  return json({ itens, eu: data.usuario.id });
}

export async function onRequestPost({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;

  const b = (await lerJson(request)) || {};
  const nome = limpar(b.nome);
  const email = limpar(b.email).toLowerCase();
  const papel = PAPEIS.includes(b.papel) ? b.papel : null;
  const falha = [
    ['nome', validarNome(nome)],
    ['email', validarEmail(email)],
    ['papel', papel ? undefined : 'Escolha o papel.'],
    ['senha', validarSenha(b.senha)],
  ].find(([, msg]) => msg);
  if (falha) return erro(falha[1], 400, falha[0]);

  const t = agora();
  try {
    const r = await executar(
      env.DB,
      'INSERT INTO usuarios (nome, email, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, 1, ?, ?)',
      nome, email, await hashSenha(b.senha), papel, t, t,
    );
    return json({ id: r.meta.last_row_id }, 201);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return erro('Já existe um usuário com este e-mail.', 409, 'email');
    throw e;
  }
}
