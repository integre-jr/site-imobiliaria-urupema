// Gaveta "Minha conta": trocar a própria senha e sair de todos os aparelhos.
import { api, enviar, senhasConferem, toast } from './api.js';
import { abrirGaveta } from './gaveta.js';

const HTML = `
  <p class="gaveta__intro" data-quem></p>
  <h3>Trocar senha</h3>
  <form class="adm-form">
    <div class="form-erro" role="alert" hidden></div>
    <input type="text" name="usuario" autocomplete="username" hidden>
    <div class="form-field"><label for="c-atual">Senha atual</label><input class="input" id="c-atual" name="atual" type="password" autocomplete="current-password" required></div>
    <div class="form-field">
      <label for="c-nova">Nova senha</label>
      <input class="input" id="c-nova" name="nova" type="password" autocomplete="new-password" minlength="12" required>
      <span class="hint">Pelo menos 12 caracteres, sem o nome da imobiliária, sequências (123456) ou o seu nome. Uma frase de 3 ou 4 palavras é forte e fácil de lembrar. Os outros aparelhos conectados serão desconectados.</span>
    </div>
    <div class="form-field"><label for="c-confirmar">Confirme a nova senha</label><input class="input" id="c-confirmar" name="confirmar" type="password" autocomplete="new-password" minlength="12" required></div>
    <div class="adm-form__acoes"><button class="btn btn--primary btn--sm" type="submit">Trocar senha</button></div>
  </form>
  <hr class="gaveta__divisao">
  <h3>Aparelhos conectados</h3>
  <p class="gaveta__intro">Perdeu o celular ou entrou num computador de outra pessoa? Encerre todas as sessões, inclusive esta.</p>
  <button class="btn btn--perigo btn--sm" type="button" data-sair-todos>Sair de todos os aparelhos</button>`;

export function abrirConta(usuario) {
  const corpo = abrirGaveta('Minha conta');
  if (!corpo) return;   // havia um anúncio com alterações não salvas e a pessoa quis continuar nele
  corpo.innerHTML = HTML;    // markup fixo; dados do usuário entram abaixo com textContent
  corpo.querySelector('[data-quem]').textContent =
    `${usuario.nome} · ${usuario.email} · ${usuario.papel === 'admin' ? 'Administrador' : 'Corretor'}`;

  const form = corpo.querySelector('form');
  form.elements.usuario.value = usuario.email;   // ajuda o gerenciador de senhas do navegador
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!senhasConferem(form, 'nova', 'confirmar')) return;
    const dados = { atual: form.elements.atual.value, nova: form.elements.nova.value };
    if (await enviar(form, '/api/auth/senha', { dados })) {
      form.reset();
      form.elements.usuario.value = usuario.email;
      toast('Senha alterada. Os outros aparelhos foram desconectados.');
    }
  });

  corpo.querySelector('[data-sair-todos]').addEventListener('click', async () => {
    if (!confirm('Encerrar a sessão em todos os aparelhos, inclusive neste?')) return;
    await api('/api/auth/logout', { metodo: 'POST', dados: { todos: true } }).catch(() => {});
    location.href = '/admin/login';
  });
}
