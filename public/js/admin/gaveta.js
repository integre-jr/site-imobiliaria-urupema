// Painel lateral (gaveta) por cima do site, para o que não se edita "no lugar":
// anúncios, usuários, minha conta, dados do site, Instagram (e, nos próximos marcos, leads e portais).

let aberta = null;
let antesDeFechar = null;

// forcar: fecha sem perguntar (ex.: depois de salvar).
export function fecharGaveta({ forcar = false } = {}) {
  if (!aberta) return true;
  if (!forcar && antesDeFechar && antesDeFechar() === false) return false;
  aberta.remove();
  aberta = null;
  antesDeFechar = null;
  document.documentElement.classList.remove('gaveta-aberta');
  document.removeEventListener('keydown', aoTeclar);
  return true;
}

function aoTeclar(e) {
  // Esc fecha a gaveta, a menos que haja um diálogo aberto por cima dela
  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) fecharGaveta();
}

// Abre a gaveta e devolve o elemento onde o conteúdo deve ser colocado.
// larga: para formulários grandes (anúncio). aoFechar: devolve false para impedir o fechamento.
export function abrirGaveta(titulo, { larga = false, aoFechar = null } = {}) {
  if (!fecharGaveta()) return null;
  const raiz = document.createElement('div');
  raiz.className = 'gaveta' + (larga ? ' gaveta--larga' : '');
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
  raiz.querySelectorAll('[data-fechar-gaveta]').forEach((b) => b.addEventListener('click', () => fecharGaveta()));
  document.body.append(raiz);
  document.documentElement.classList.add('gaveta-aberta');
  document.addEventListener('keydown', aoTeclar);
  aberta = raiz;
  antesDeFechar = aoFechar;
  raiz.querySelector('.gaveta__fechar').focus();
  return raiz.querySelector('.gaveta__corpo');
}

export const tituloGaveta = (texto) => { if (aberta) aberta.querySelector('#gaveta-titulo').textContent = texto; };
