// Gaveta "Usuários" (só administrador): criar, editar papel, ativar/desativar, redefinir senha, excluir.
import { api, enviar, limparErro, senhasConferem, toast } from './api.js';
import { abrirGaveta } from './gaveta.js';

// Diálogos criados uma vez e reaproveitados (ficam por cima da gaveta).
const HTML_DIALOGOS = `
<dialog class="adm-dialog" id="dlg-usuario" aria-labelledby="dlg-usuario-titulo">
  <h2 id="dlg-usuario-titulo">Novo usuário</h2>
  <form class="adm-form" id="form-usuario">
    <div class="form-erro" role="alert" hidden></div>
    <div class="form-field"><label for="u-nome">Nome</label><input class="input" id="u-nome" name="nome" maxlength="100" required></div>
    <div class="form-field"><label for="u-email">E-mail</label><input class="input" id="u-email" name="email" type="email" autocomplete="off" required></div>
    <div class="form-field">
      <label for="u-papel">Papel</label>
      <select class="select" id="u-papel" name="papel" required>
        <option value="corretor">Corretor: imóveis, leads e Instagram</option>
        <option value="admin">Administrador: tudo, inclusive usuários e dados do site</option>
      </select>
      <span class="hint" id="u-papel-dica" hidden>Você não pode mudar o seu próprio papel.</span>
    </div>
    <div class="form-field" id="u-senha-campo">
      <label for="u-senha">Senha inicial</label>
      <input class="input" id="u-senha" name="senha" type="password" autocomplete="new-password" minlength="12" required>
      <span class="hint">Pelo menos 12 caracteres, sem o nome da imobiliária, sequências (123456) ou o nome da pessoa. Ela pode trocar depois em "Minha conta".</span>
    </div>
    <label class="check" id="u-ativo-campo"><input type="checkbox" name="ativo"> Acesso ativo</label>
    <div class="adm-form__acoes">
      <button class="btn btn--outline btn--sm" type="button" data-fechar>Cancelar</button>
      <button class="btn btn--primary btn--sm" type="submit">Salvar</button>
    </div>
  </form>
</dialog>
<dialog class="adm-dialog" id="dlg-senha" aria-labelledby="dlg-senha-titulo">
  <h2 id="dlg-senha-titulo">Redefinir senha</h2>
  <form class="adm-form" id="form-senha-usuario">
    <div class="form-erro" role="alert" hidden></div>
    <p id="senha-quem"></p>
    <div class="form-field"><label for="s-senha">Nova senha</label><input class="input" id="s-senha" name="senha" type="password" autocomplete="new-password" minlength="12" required></div>
    <div class="form-field">
      <label for="s-confirmar">Confirme a nova senha</label>
      <input class="input" id="s-confirmar" name="confirmar" type="password" autocomplete="new-password" minlength="12" required>
      <span class="hint">A pessoa será desconectada de todos os aparelhos.</span>
    </div>
    <div class="adm-form__acoes">
      <button class="btn btn--outline btn--sm" type="button" data-fechar>Cancelar</button>
      <button class="btn btn--primary btn--sm" type="submit">Redefinir</button>
    </div>
  </form>
</dialog>`;

let eu = null;
let editando = null;     // usuário em edição (null = novo)
let redefinindo = null;
let lista = null;
let dlgUsuario, formUsuario, dlgSenha, formSenha, abrirConta;

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(texto, aoClicar, classe = 'btn--outline') {
  const b = el('button', `btn ${classe} btn--sm`, texto);
  b.type = 'button';
  b.addEventListener('click', aoClicar);
  return b;
}

function item(u) {
  const li = el('li', 'adm-item' + (u.ativo ? '' : ' is-inativo'));
  const info = el('div', 'adm-item__info');
  info.append(el('strong', '', u.nome));
  info.append(el('span', 'tag' + (u.papel === 'admin' ? ' tag--admin' : ''), u.papel === 'admin' ? 'Administrador' : 'Corretor'));
  if (!u.ativo) info.append(el('span', 'tag tag--off', 'Desativado'));
  if (u.id === eu) info.append(el('span', 'tag tag--ok', 'Você'));
  info.append(el('small', '', u.email));

  const acoes = el('div', 'adm-item__acoes');
  acoes.append(botao('Editar', () => abrirUsuario(u)));
  if (u.id === eu) {
    acoes.append(botao('Trocar senha', () => abrirConta()));
  } else {
    acoes.append(botao('Redefinir senha', () => abrirSenha(u)), botao('Excluir', () => excluir(u), 'btn--perigo'));
  }
  li.append(info, acoes);
  return li;
}

async function carregar() {
  const r = await api('/api/admin/usuarios');
  eu = r.eu;
  lista.replaceChildren(...r.itens.map(item));
}

function abrirUsuario(u = null) {
  editando = u;
  formUsuario.reset();
  limparErro(formUsuario);
  const f = formUsuario.elements;
  const ehVoce = u && u.id === eu;
  document.getElementById('dlg-usuario-titulo').textContent = u ? 'Editar usuário' : 'Novo usuário';
  document.getElementById('u-senha-campo').hidden = !!u;
  f.senha.required = !u;
  document.getElementById('u-ativo-campo').hidden = !u || ehVoce;
  f.papel.disabled = ehVoce;
  document.getElementById('u-papel-dica').hidden = !ehVoce;
  if (u) {
    f.nome.value = u.nome;
    f.email.value = u.email;
    f.papel.value = u.papel;
    f.ativo.checked = !!u.ativo;
  }
  dlgUsuario.showModal();
}

function abrirSenha(u) {
  redefinindo = u;
  formSenha.reset();
  limparErro(formSenha);
  document.getElementById('senha-quem').textContent = `Nova senha para ${u.nome} (${u.email}).`;
  dlgSenha.showModal();
}

async function excluir(u) {
  if (!confirm(`Excluir o acesso de ${u.nome}? Isso não pode ser desfeito.`)) return;
  try {
    await api(`/api/admin/usuarios/${u.id}`, { metodo: 'DELETE' });
    toast('Usuário excluído.');
    carregar();
  } catch {
    // o api() já mostrou o motivo
  }
}

function prepararDialogos() {
  if (dlgUsuario) return;
  document.body.insertAdjacentHTML('beforeend', HTML_DIALOGOS);
  dlgUsuario = document.getElementById('dlg-usuario');
  formUsuario = document.getElementById('form-usuario');
  dlgSenha = document.getElementById('dlg-senha');
  formSenha = document.getElementById('form-senha-usuario');
  document.querySelectorAll('.adm-dialog [data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formUsuario.elements;
    const dados = { nome: f.nome.value, email: f.email.value, papel: f.papel.value };
    if (editando) {
      if (editando.id !== eu) dados.ativo = f.ativo.checked;
      if (await enviar(formUsuario, `/api/admin/usuarios/${editando.id}`, { metodo: 'PUT', dados })) {
        dlgUsuario.close();
        toast('Usuário atualizado.');
        carregar();
      }
    } else {
      dados.senha = f.senha.value;
      if (await enviar(formUsuario, '/api/admin/usuarios', { dados })) {
        dlgUsuario.close();
        toast('Usuário criado. Passe o e-mail e a senha inicial para a pessoa.');
        carregar();
      }
    }
  });

  formSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!senhasConferem(formSenha)) return;
    const dados = { senha: formSenha.elements.senha.value };
    if (await enviar(formSenha, `/api/admin/usuarios/${redefinindo.id}`, { metodo: 'PUT', dados })) {
      dlgSenha.close();
      toast('Senha redefinida.');
    }
  });
}

// abrirMinhaConta: para o botão "Trocar senha" do próprio usuário.
export function abrirUsuarios(abrirMinhaConta) {
  abrirConta = abrirMinhaConta;
  prepararDialogos();
  const corpo = abrirGaveta('Usuários');
  if (!corpo) return;   // havia um anúncio com alterações não salvas e a pessoa quis continuar nele
  const intro = el('p', 'gaveta__intro', 'Quem pode entrar no painel. Corretores cuidam de imóveis, leads e Instagram; só o administrador mexe em usuários e nos dados do site.');
  const novo = botao('Novo usuário', () => abrirUsuario(), 'btn--primary');
  lista = el('ul', 'adm-lista');
  lista.setAttribute('aria-live', 'polite');
  corpo.append(intro, novo, lista);
  carregar();
}
