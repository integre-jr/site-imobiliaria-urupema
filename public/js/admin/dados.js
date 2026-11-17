// Gaveta "Dados do site": todos os campos editáveis num formulário só.
// Complementa a edição no lugar: serve para o que é difícil tocar no celular (ícones das redes)
// e para o que não aparece como texto (o número do WhatsApp).
import { enviar, toast, valorParaCampo } from './api.js';
import { abrirGaveta, fecharGaveta } from './gaveta.js';

const TIPO_INPUT = { telefone: 'tel', whatsapp: 'tel', email: 'email', url: 'url' };

export function abrirDados(estado, aoSalvar) {
  const corpo = abrirGaveta('Dados do site');
  if (!corpo) return;   // havia um anúncio com alterações não salvas e a pessoa quis continuar nele
  const intro = document.createElement('p');
  intro.className = 'gaveta__intro';
  intro.textContent = 'O que você salvar aqui aparece em todas as páginas do site. Também dá para clicar direto nos botões "Editar" espalhados pelo site.';

  const form = document.createElement('form');
  form.className = 'adm-form';
  form.innerHTML = '<div class="form-erro" role="alert" hidden></div>';

  const grupos = {};
  const meus = Object.entries(estado.campos).filter(([, campo]) => !campo.gaveta);
  for (const [chave, campo] of meus) {
    if (!grupos[campo.grupo]) {
      const fs = document.createElement('fieldset');
      fs.className = 'adm-grupo';
      const lg = document.createElement('legend');
      lg.textContent = campo.grupo;
      fs.append(lg);
      form.append(fs);
      grupos[campo.grupo] = fs;
    }
    const id = 'dados-' + chave.replace(/\W/g, '-');
    const wrap = document.createElement('div');
    wrap.className = 'form-field';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = campo.rotulo;
    const input = document.createElement('input');
    input.className = 'input';
    input.id = id;
    input.name = chave;
    input.type = TIPO_INPUT[campo.tipo] || 'text';
    if (campo.max) input.maxLength = campo.max;
    input.required = true;
    input.value = valorParaCampo(campo, estado.valores[chave]);
    wrap.append(label, input);
    if (campo.ajuda) {
      const dica = document.createElement('span');
      dica.className = 'hint';
      dica.textContent = campo.ajuda;
      wrap.append(dica);
    }
    grupos[campo.grupo].append(wrap);
  }

  const acoes = document.createElement('div');
  acoes.className = 'adm-form__acoes';
  acoes.innerHTML = '<button class="btn btn--primary btn--sm" type="submit">Salvar</button>';
  form.append(acoes);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valores = {};
    for (const [chave] of meus) valores[chave] = form.elements[chave].value;
    const novo = await enviar(form, '/api/admin/config', { metodo: 'PUT', dados: { valores } });
    if (novo) {
      aoSalvar(novo);
      fecharGaveta();
      toast('Dados salvos. Já aparecem no site.');
    }
  });

  corpo.append(intro, form);
}
