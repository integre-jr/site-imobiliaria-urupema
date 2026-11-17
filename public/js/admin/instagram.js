// Gaveta "Instagram": conexão da conta (só admin conecta/desconecta) e modelo da legenda dos posts.
// Publicar e repostar imóveis entram no marco M6, junto com o cadastro de imóveis.
import { api, enviar, toast } from './api.js';
import { abrirGaveta } from './gaveta.js';

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const AJUDA_LEGENDA = 'Use {titulo}, {finalidade_rotulo}, {preco}, {bairro}, {cidade}, {uf}, {specs}, {ref}, {telefone_1} e {hashtags}. Cada um é trocado pelos dados do imóvel na hora do post; linhas que ficarem vazias somem.';

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function cartaoStatus(st, recarregar) {
  const card = el('section', 'ig-status' + (st.conectado ? ' is-ok' : ''));
  const titulo = el('strong');
  const texto = el('p');
  if (st.conectado) {
    titulo.textContent = `Conectado como ${st.conta || 'conta do Instagram'}`;
    texto.textContent = `O acesso vale até ${dataBR(st.expira_em)} e é renovado sozinho sempre que alguém usa o painel.`;
  } else if (st.expirado) {
    titulo.textContent = 'A conexão expirou';
    texto.textContent = 'O painel ficou mais de 60 dias sem uso e o Instagram encerrou o acesso. Conecte de novo.';
  } else {
    titulo.textContent = 'Nenhuma conta conectada';
    texto.textContent = 'Conecte a conta da imobiliária para publicar e repostar imóveis com um clique.';
  }
  card.append(titulo, texto);

  if (!st.pode_gerenciar) {
    card.append(el('p', 'hint', 'Só o administrador conecta ou desconecta a conta.'));
    return card;
  }
  const acoes = el('div', 'adm-form__acoes');
  if (st.conectado) {
    const b = el('button', 'btn btn--perigo btn--sm', 'Desconectar');
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (!confirm('Desconectar o Instagram? Os posts deixam de ser publicados até conectar de novo.')) return;
      try {
        await api('/api/admin/instagram/desconectar', { metodo: 'POST' });
        toast('Instagram desconectado.');
        recarregar();
      } catch { /* o api() já avisou */ }
    });
    acoes.append(b);
  } else if (st.app_configurado) {
    const a = el('a', 'btn btn--primary btn--sm', st.expirado ? 'Conectar de novo' : 'Conectar Instagram');
    a.href = '/api/admin/instagram/conectar';     // navegação: vai ao login do Instagram e volta
    acoes.append(a);
  } else {
    card.append(el('p', 'form-erro', 'Falta configurar o app da Meta deste site (docs/INSTAGRAM.md). Fale com a INTEGRE.'));
  }
  card.append(acoes);
  return card;
}

function primeiraVez(st) {
  const box = el('section', 'ig-passos');
  box.append(el('h3', '', 'Antes de conectar (só na primeira vez)'));
  const ol = el('ol');
  [
    'A conta do Instagram precisa ser profissional (Comercial ou Criador de conteúdo). No app: Configurações > Tipo de conta e ferramentas > Mudar para conta profissional. É grátis.',
    'Aceite o convite de testador do app do site: no navegador, entre em instagram.com/accounts/manage_access, abra a aba "Convites de testador" e clique em Aceitar. A INTEGRE envia o convite antes.',
    'Volte aqui, clique em "Conectar Instagram" e entre com a conta da imobiliária. Pronto: não precisa repetir.',
  ].forEach((t) => ol.append(el('li', '', t)));
  box.append(ol);
  if (st.modo === 'mock') box.append(el('p', 'hint', 'No modo demonstração esses passos não são necessários: a conexão é simulada.'));
  return box;
}

function formLegenda(estado, aoSalvarConfig) {
  const form = el('form', 'adm-form ig-legenda');
  form.innerHTML = `<h3>Legenda dos posts</h3>
    <div class="form-erro" role="alert" hidden></div>
    <div class="form-field">
      <label for="ig-modelo">Modelo</label>
      <textarea class="textarea" id="ig-modelo" name="instagram.modelo_legenda" maxlength="2200" rows="11" required></textarea>
      <span class="hint" data-ajuda></span>
    </div>
    <div class="form-field">
      <label for="ig-hashtags">Hashtags</label>
      <input class="input" id="ig-hashtags" name="instagram.hashtags" maxlength="500">
      <span class="hint" data-contagem></span>
    </div>
    <div class="adm-form__acoes"><button class="btn btn--primary btn--sm" type="submit">Salvar legenda</button></div>`;
  form.querySelector('[data-ajuda]').textContent = AJUDA_LEGENDA;
  const modelo = form.elements['instagram.modelo_legenda'];
  const tags = form.elements['instagram.hashtags'];
  modelo.value = estado.valores['instagram.modelo_legenda'] || '';
  tags.value = estado.valores['instagram.hashtags'] || '';

  const contagem = form.querySelector('[data-contagem]');
  const contar = () => {
    const n = (tags.value.match(/#[^\s#]+/g) || []).length;
    contagem.textContent = n > 30 ? `${n} hashtags: o Instagram aceita no máximo 30 por post.` : `${n} de 30 hashtags permitidas pelo Instagram.`;
    contagem.classList.toggle('is-alerta', n > 30);
  };
  tags.addEventListener('input', contar);
  contar();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = { valores: { 'instagram.modelo_legenda': modelo.value, 'instagram.hashtags': tags.value } };
    const novo = await enviar(form, '/api/admin/config', { metodo: 'PUT', dados });
    if (novo) {
      aoSalvarConfig(novo);
      toast('Legenda salva.');
    }
  });
  return form;
}

export async function abrirInstagram(usuario, estado, aoSalvarConfig) {
  const corpo = abrirGaveta('Instagram');
  if (!corpo) return;   // havia um anúncio com alterações não salvas e a pessoa quis continuar nele
  const carregar = async () => {
    corpo.replaceChildren(el('p', 'gaveta__intro', 'Carregando…'));
    let st;
    try {
      st = await api('/api/admin/instagram/status');
    } catch {
      corpo.replaceChildren(el('p', 'form-erro', 'Não foi possível carregar a situação do Instagram.'));
      return;
    }
    const partes = [];
    if (st.modo === 'mock') {
      const aviso = el('p', 'ig-demo');
      aviso.append(el('span', 'tag tag--admin', 'Modo demonstração'), ' A conexão e os posts são simulados: nada vai para o Instagram de verdade.');
      partes.push(aviso);
    }
    partes.push(cartaoStatus(st, carregar));
    if (!st.conectado && st.pode_gerenciar) partes.push(primeiraVez(st));
    if (usuario.papel === 'admin' && estado) partes.push(el('hr', 'gaveta__divisao'), formLegenda(estado, aoSalvarConfig));
    partes.push(el('p', 'hint', 'Publicar e repostar imóveis aparece aqui e nos cards dos imóveis assim que o cadastro de imóveis estiver pronto.'));
    corpo.replaceChildren(...partes);
  };
  await carregar();
}
