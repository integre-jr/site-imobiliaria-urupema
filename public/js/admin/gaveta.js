// Painel lateral (gaveta) por cima do site, para o que não se edita "no lugar":
// usuários, minha conta, dados do site e, nos próximos marcos, leads, Instagram e portais.

let aberta = null;

export function fecharGaveta() {
  if (!aberta) return;
  aberta.remove();
  aberta = null;
  document.documentElement.classList.remove('gaveta-aberta');
  document.removeEventListener('keydown', aoTeclar);
}

function aoTeclar(e) {
  // Esc fecha a gaveta, a menos que haja um diálogo aberto por cima dela
  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) fecharGaveta();
}

// Abre a gaveta e devolve o elemento onde o conteúdo deve ser colocado.
export function abrirGaveta(titulo) {
  fecharGaveta();
  const raiz = document.createElement('div');
  raiz.className = 'gaveta';
  raiz.innerHTML = `
    <div class="gaveta__fundo" data-fechar-gaveta></div>
    <section class="gaveta__painel" role="dialog" aria-modal="true" aria-labelledby="gaveta-titulo">
      <header class="gaveta__topo">
        <h2 id="gaveta-titulo"></h2>
        <button type="button" class="gaveta__fechar" data-fechar-gaveta aria-label="Fechar">
          <svg aria-hidden="true"><use href="#adm-fechar"/></svg>
        </button>
      </header>
      <div class="gaveta__corpo"></div>
    </section>`;
  raiz.querySelector('h2').textContent = titulo;
  raiz.querySelectorAll('[data-fechar-gaveta]').forEach((b) => b.addEventListener('click', fecharGaveta));
  document.body.append(raiz);
  document.documentElement.classList.add('gaveta-aberta');
  document.addEventListener('keydown', aoTeclar);
  aberta = raiz;
  raiz.querySelector('.gaveta__fechar').focus();
  return raiz.querySelector('.gaveta__corpo');
}
