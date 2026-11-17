// Editar (nome, e-mail, papel, ativo, nova senha) e excluir usuário. Só o papel "admin".
// O admin não pode tirar o próprio acesso: assim sempre sobra pelo menos um admin ativo.
import { hashSenha, soAdmin } from '../../../../lib/auth.js';
import { agora, executar, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { limpar, PAPEIS, validarEmail, validarNome, validarSenha } from '../../../../lib/validacao.js';

async function carregar({ env, data, params }) {
  const negado = soAdmin(data.usuario);
  if (negado) return { resposta: negado };
  const id = Number(params.id);
  const alvo = Number.isInteger(id) ? await um(env.DB, 'SELECT * FROM usuarios WHERE id = ?', id) : null;
  if (!alvo) return { resposta: erro('Usuário não encontrado.', 404) };
  return { alvo, ehVoce: alvo.id === data.usuario.id };
}

export async function onRequestPut(context) {
  const { resposta, alvo, ehVoce } = await carregar(context);
  if (resposta) return resposta;
  const { env, request } = context;
  const b = (await lerJson(request)) || {};

  const novo = {
    nome: b.nome !== undefined ? limpar(b.nome) : alvo.nome,
    email: b.email !== undefined ? limpar(b.email).toLowerCase() : alvo.email,
    papel: b.papel !== undefined ? b.papel : alvo.papel,
    ativo: b.ativo !== undefined ? (b.ativo ? 1 : 0) : alvo.ativo,
  };
  const falha = [
    ['nome', validarNome(novo.nome)],
    ['email', validarEmail(novo.email)],
    ['papel', PAPEIS.includes(novo.papel) ? undefined : 'Papel inválido.'],
    ['senha', b.senha !== undefined ? validarSenha(b.senha) : undefined],
  ].find(([, msg]) => msg);
  if (falha) return erro(falha[1], 400, falha[0]);
  if (ehVoce && (novo.papel !== 'admin' || !novo.ativo)) {
    return erro('Você não pode remover o seu próprio acesso de administrador.', 409);
  }

  const senhaHash = b.senha !== undefined ? await hashSenha(b.senha) : alvo.senha_hash;
  const comandos = [
    env.DB.prepare('UPDATE usuarios SET nome = ?, email = ?, papel = ?, ativo = ?, senha_hash = ?, atualizado_em = ? WHERE id = ?')
      .bind(novo.nome, novo.email, novo.papel, novo.ativo, senhaHash, agora(), alvo.id),
  ];
  // Desativado ou com senha redefinida: derruba as sessões abertas dele.
  if (!novo.ativo || b.senha !== undefined) {
    comandos.push(env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?').bind(alvo.id));
  }
  try {
    await env.DB.batch(comandos);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return erro('Já existe um usuário com este e-mail.', 409, 'email');
    throw e;
  }
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { resposta, alvo, ehVoce } = await carregar(context);
  if (resposta) return resposta;
  if (ehVoce) return erro('Você não pode excluir a sua própria conta.', 409);
  try {
    await executar(context.env.DB, 'DELETE FROM usuarios WHERE id = ?', alvo.id);
  } catch (e) {
    // Imóveis e posts guardam quem os criou: nesse caso, desativar em vez de excluir.
    if (String(e.message).includes('FOREIGN KEY')) {
      return erro('Este usuário tem imóveis ou posts registrados. Desative-o em vez de excluir.', 409);
    }
    throw e;
  }
  return json({ ok: true });
}
