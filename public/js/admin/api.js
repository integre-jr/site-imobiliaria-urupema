// Wrapper de fetch do admin (spec 8.2): manda X-Urupema (anti-CSRF), fala JSON,
// leva ao login no 401 e mostra toast de erro. Também traz helpers de formulário.

export class ErroApi extends Error {
  constructor(mensagem, status, campo) {
    super(mensagem);
    this.status = status;
    this.campo = campo;
  }
}

export function irParaLogin() {
  location.href = '/admin/login?volta=' + encodeURIComponent(location.pathname + location.search);
}

// semToast: o chamador mostra o erro no próprio formulário.
export async function api(caminho, { metodo = 'GET', dados, semToast = false } = {}) {
  const opcoes = { method: metodo, headers: { 'X-Urupema': '1' }, credentials: 'same-origin' };
  if (dados !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(dados);
  }
  let res;
  try {
    res = await fetch(caminho, opcoes);
  } catch {
    const e = new ErroApi('Sem conexão. Confira a internet e tente de novo.', 0);
    if (!semToast) toast(e.message, 'erro');
    throw e;
  }
  const corpo = await res.json().catch(() => ({}));
  if (res.ok) return corpo;

  const e = new ErroApi(corpo.erro || 'Algo deu errado. Tente de novo.', res.status, corpo.campo);
  if (res.status === 401 && !location.pathname.startsWith('/admin/login')) {
    irParaLogin();
  } else if (!semToast) {
    toast(e.message, 'erro');
  }
  throw e;
}

export function toast(mensagem, tipo = 'ok') {
  let caixa = document.querySelector('.toasts');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'toasts';
    caixa.setAttribute('role', 'status');
    caixa.setAttribute('aria-live', 'polite');
    document.body.append(caixa);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'erro' ? ' toast--erro' : '');
  t.textContent = mensagem;
  caixa.append(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}

// Valor guardado → como mostrar no campo. O WhatsApp é guardado só com números ("5549991603030");
// na tela aparece "(49) 99160-3030" (o servidor aceita os dois formatos).
export function valorParaCampo(campo, valor) {
  const m = campo.tipo === 'whatsapp' && /^55(\d{2})(\d{4,5})(\d{4})$/.exec(valor || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (valor ?? '');
}

// ---------- Formulários ----------

// Valores do form como objeto; checkboxes viram true/false.
export function lerForm(form) {
  const dados = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    dados[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return dados;
}

// Mostra o erro no .form-erro do form e destaca o campo indicado pela API.
export function mostrarErro(form, erro) {
  limparErro(form);
  const caixa = form.querySelector('.form-erro');
  if (caixa) {
    caixa.textContent = erro.message;
    caixa.hidden = false;
  } else {
    toast(erro.message, 'erro');
  }
  const campo = erro.campo && form.elements[erro.campo];
  if (campo) {
    campo.classList.add('is-invalido');
    campo.focus();
  }
}

export function limparErro(form) {
  const caixa = form.querySelector('.form-erro');
  if (caixa) caixa.hidden = true;
  form.querySelectorAll('.is-invalido').forEach((el) => el.classList.remove('is-invalido'));
}

// Envia o form com o botão desabilitado; devolve a resposta ou null se deu erro.
export async function enviar(form, caminho, { metodo = 'POST', dados } = {}) {
  limparErro(form);
  const botao = form.querySelector('[type=submit]');
  if (botao) botao.disabled = true;
  try {
    return await api(caminho, { metodo, dados: dados ?? lerForm(form), semToast: true });
  } catch (e) {
    if (e.status !== 401 || location.pathname.startsWith('/admin/login')) mostrarErro(form, e);
    return null;
  } finally {
    if (botao) botao.disabled = false;
  }
}

// Confere "senha" e "confirmar" antes de enviar.
export function senhasConferem(form, campo = 'senha', confirmar = 'confirmar') {
  if (form.elements[campo].value === form.elements[confirmar].value) return true;
  mostrarErro(form, new ErroApi('As senhas não conferem.', 400, confirmar));
  return false;
}
