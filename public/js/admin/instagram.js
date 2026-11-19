// Gaveta "Instagram": conexão da conta (só admin conecta/desconecta), app da Meta para a conta real
// (só admin; liga o modo real sem mexer no servidor), modelo da legenda e histórico de posts.
// Postar e repostar: botão "Instagram" nos anúncios (postar.js).
import { api, enviar, toast } from './api.js';
import { abrirGaveta } from './gaveta.js';
import { abrirPostInstagram } from './postar.js';

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
  if (st.limite) card.append(el('p', 'hint', `${st.limite.usados} de ${st.limite.limite} posts usados nas últimas 24 h (limite do Instagram).`));

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
    card.append(el('p', 'form-erro', 'Falta o app da Meta: preencha "Conta real do Instagram" abaixo.'));
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

// App da Meta (ID + chave secreta). Salvar liga o modo real; "Voltar ao modo demonstração" apaga.
function secaoApp(st, recarregar) {
  const box = el('details', 'ig-app');
  box.open = st.modo === 'real' && !st.app_configurado;
  box.append(el('summary', '', st.modo === 'real' ? 'Conta real do Instagram: app da Meta' : 'Conta real do Instagram (sair do modo demonstração)'));

  const intro = el('p', 'hint');
  if (st.app_origem === 'painel') intro.textContent = `Modo real ligado com o app ${st.app_id}. Para trocar de app, preencha de novo.`;
  else if (st.app_origem === 'servidor') intro.textContent = `Modo real ligado pelos segredos do servidor (app ${st.app_id}). Preencher aqui substitui esse app.`;
  else intro.textContent = 'Para publicar na conta de verdade, a INTEGRE cria um app na Meta (passo a passo em docs/INSTAGRAM.md) e cola aqui o ID e a chave secreta. Isso liga o modo real na hora, sem mexer no servidor.';
  box.append(intro);

  // Endereço de retorno: precisa estar cadastrado no app da Meta exatamente assim.
  const campoUri = el('div', 'form-field');
  const lblUri = el('label', '', 'Endereço de retorno (cadastre no app da Meta, em "Business login settings")');
  lblUri.htmlFor = 'ig-uri';
  const linhaUri = el('div', 'copiar');
  const uri = el('input', 'input');
  uri.id = 'ig-uri';
  uri.readOnly = true;
  uri.value = st.redirect_uri;
  const copiar = el('button', 'btn btn--outline btn--sm', 'Copiar');
  copiar.type = 'button';
  copiar.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(uri.value); toast('Endereço copiado.'); } catch { uri.select(); }
  });
  linhaUri.append(uri, copiar);
  campoUri.append(lblUri, linhaUri);
  if (location.protocol !== 'https:') campoUri.append(el('span', 'hint is-alerta', 'A Meta só aceita endereços https: conecte a conta real pelo site publicado, não pelo computador local.'));

  const form = el('form', 'adm-form');
  form.noValidate = true;
  form.innerHTML = `<div class="form-erro" role="alert" hidden></div>
    <div class="grid-fields">
      <div class="form-field"><label for="ig-app-id">ID do app do Instagram</label><input class="input" id="ig-app-id" name="app_id" inputmode="numeric" autocomplete="off" placeholder="Ex.: 1234567890123456"></div>
      <div class="form-field"><label for="ig-app-secret">Chave secreta do app</label><input class="input" id="ig-app-secret" name="app_secret" type="password" autocomplete="off" placeholder="32 letras e números"></div>
    </div>
    <span class="hint">No painel da Meta: Instagram &gt; "API setup with Instagram login". São o "Instagram app ID" e o "Instagram app secret" (não os do Facebook). A chave fica guardada criptografada e não aparece mais aqui.</span>
    <div class="adm-form__acoes"><button class="btn btn--primary btn--sm" type="submit">Salvar e usar a conta real</button></div>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (st.conectado && !confirm('Salvar o app desconecta a conta atual. Depois é só clicar em "Conectar Instagram". Continuar?')) return;
    const r = await enviar(form, '/api/admin/instagram/app', { metodo: 'PUT' });
    if (r) {
      toast('App salvo. Agora conecte a conta do Instagram.');
      recarregar();
    }
  });
  box.append(campoUri, form);

  if (st.app_origem === 'painel') {
    const voltar = el('button', 'btn btn--ghost btn--sm', 'Voltar ao modo demonstração');
    voltar.type = 'button';
    voltar.addEventListener('click', async () => {
      if (!confirm('Voltar ao modo demonstração? O app é apagado e a conta real é desconectada.')) return;
      try {
        await api('/api/admin/instagram/app', { metodo: 'DELETE' });
        toast('Modo demonstração ligado.');
        recarregar();
      } catch { /* o api() já avisou */ }
    });
    box.append(voltar);
  }
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

const STATUS_POST = { publicado: ['Publicado', 'tag--ok'], publicando: ['Publicando', 'tag--admin'], erro: ['Não publicado', 'tag--off'] };

async function historico() {
  const box = el('section', 'ig-historico');
  box.append(el('h3', '', 'Posts feitos pelo site'));
  let r;
  try {
    r = await api('/api/admin/instagram/posts');
  } catch {
    box.append(el('p', 'form-erro', 'Não foi possível carregar o histórico.'));
    return box;
  }
  if (!r.itens.length) {
    box.append(el('p', 'hint', 'Nenhum post ainda. Para postar, abra "Anúncios" e use o botão "Instagram" de um anúncio publicado.'));
    return box;
  }
  const lista = el('ul', 'adm-lista');
  for (const p of r.itens) {
    const li = el('li', 'adm-item');
    const info = el('div', 'adm-item__info');
    const [rot, cls] = STATUS_POST[p.status] || [p.status, ''];
    const linha = el('strong', '', p.ref ? `${p.ref} · ${p.titulo}` : 'Anúncio excluído');
    const tags = el('div', 'anuncio-tags');
    tags.append(el('span', `tag ${cls}`, rot), el('span', 'tag', p.tipo === 'repost' ? 'Repost' : 'Post novo'));
    if (p.modo === 'mock') tags.append(el('span', 'tag', 'Simulado'));
    info.append(linha, tags, el('small', '', `${dataHora(p.criado_em)}${p.autor ? ' · ' + p.autor : ''}`));
    if (p.status === 'erro' && p.erro) info.append(el('small', 'hint is-alerta', p.erro));
    const acoes = el('div', 'adm-item__acoes');
    if (p.permalink && p.status === 'publicado') {
      const a = el('a', 'btn btn--ghost btn--sm', p.modo === 'mock' ? 'Ver imóvel' : 'Ver post');
      a.href = p.permalink;
      a.target = '_blank';
      a.rel = 'noopener';
      acoes.append(a);
    }
    if (p.imovel_id) {
      const b = el('button', 'btn btn--outline btn--sm', p.status === 'erro' ? 'Tentar de novo' : 'Repostar');
      b.type = 'button';
      b.addEventListener('click', () => abrirPostInstagram(p.imovel_id));
      acoes.append(b);
    }
    li.append(info, acoes);
    lista.append(li);
  }
  box.append(lista);
  return box;
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
    partes.push(await historico());
    if (usuario.papel === 'admin' && estado) partes.push(el('hr', 'gaveta__divisao'), formLegenda(estado, aoSalvarConfig));
    if (st.pode_gerenciar) partes.push(el('hr', 'gaveta__divisao'), secaoApp(st, carregar));
    corpo.replaceChildren(...partes);
  };
  document.addEventListener('urupema:instagram-postado', () => { if (corpo.isConnected) carregar(); });
  await carregar();
}
