// Gaveta "Leads" (spec 8.2, marco M4): contatos que chegaram pelos formulários do site.
// Lista com busca e filtros, detalhe com WhatsApp/telefone/e-mail, situação e notas,
// exportar CSV, "Criar anúncio a partir deste lead" (Negocie) e exclusão a pedido do titular (admin).
import { abrirEditorAnuncio } from './anuncios.js';
import { api, toast } from './api.js';
import { abrirGaveta, fecharGaveta, tituloGaveta } from './gaveta.js';

let usuario = null;
let estado = null;          // dados do site (só admin): para o e-mail de aviso
let filtros = { status: '', origem: '', busca: '', pagina: 1 };
let meta = null;            // { origens, status } vindos da API
let corpo = null;

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

function link(texto, href, classe = 'btn btn--outline btn--sm') {
  const a = el('a', classe, texto);
  a.href = href;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function whatsapp(lead) {
  let d = String(lead.telefone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (d.length < 12) return null;
  const sobre = lead.imovel_ref ? ` sobre o imóvel ${lead.imovel_ref}` : '';
  return `https://wa.me/${d}?text=${encodeURIComponent(`Olá, ${lead.nome.split(' ')[0]}! Aqui é da Urupema Negócios Imobiliários. Recebemos o seu contato pelo site${sobre}.`)}`;
}

// Contador de leads novos na barra de edição.
export async function atualizarContador() {
  try {
    const r = await api('/api/admin/leads?status=novo', { semToast: true });
    document.dispatchEvent(new CustomEvent('urupema:leads-novos', { detail: r.novos }));
  } catch { /* sem contador */ }
}

const tagStatus = (s) => el('span', 'tag' + (s === 'novo' ? ' tag--admin' : s === 'concluido' ? ' tag--ok' : s === 'descartado' ? ' tag--off' : ''), meta.status[s]);

/* ---------------- Lista ---------------- */

async function carregarLista(lista, rodape) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
  let r;
  try { r = await api('/api/admin/leads?' + q); } catch { return; }
  meta = { origens: r.origens, status: r.status };
  document.dispatchEvent(new CustomEvent('urupema:leads-novos', { detail: r.novos }));
  if (!r.itens.length) {
    lista.replaceChildren(el('li', 'adm-item adm-item--vazio', filtros.busca || filtros.status || filtros.origem
      ? 'Nenhum lead com esses filtros.'
      : 'Nenhum contato ainda. Os formulários do site (Contato, Negocie, Financie e "Tenho interesse" nos imóveis) chegam aqui.'));
  } else {
    lista.replaceChildren(...r.itens.map((l) => {
      const li = el('li', 'adm-item lead-item' + (l.status === 'novo' ? ' is-novo' : ''));
      const info = el('div', 'adm-item__info');
      info.append(el('strong', '', l.nome), el('span', 'tag', l.origem_rotulo), tagStatus(l.status));
      const contato = [l.telefone, l.email, l.imovel_ref].filter(Boolean).join(' · ');
      info.append(el('small', '', `${quando(l.criado_em)}${contato ? ' · ' + contato : ''}`));
      const acoes = el('div', 'adm-item__acoes');
      acoes.append(botao('Abrir', () => abrirLead(l.id), l.status === 'novo' ? 'btn--primary' : 'btn--outline'));
      const wa = whatsapp(l);
      if (wa) acoes.append(link('WhatsApp', wa));
      li.append(info, acoes);
      return li;
    }));
  }
  const paginas = Math.ceil(r.total / r.por_pagina);
  rodape.replaceChildren(el('span', 'hint', `${r.total} ${r.total === 1 ? 'lead' : 'leads'}${r.novos ? ` · ${r.novos} ${r.novos === 1 ? 'novo' : 'novos'}` : ''}`));
  if (paginas > 1) {
    const ant = botao('← Anteriores', () => { filtros.pagina -= 1; carregarLista(lista, rodape); });
    const prox = botao('Seguintes →', () => { filtros.pagina += 1; carregarLista(lista, rodape); });
    ant.disabled = filtros.pagina <= 1;
    prox.disabled = filtros.pagina >= paginas;
    rodape.append(ant, el('span', 'hint', `página ${filtros.pagina} de ${paginas}`), prox);
  }
}

function montarLista() {
  tituloGaveta('Leads');
  corpo.replaceChildren();
  corpo.append(el('p', 'gaveta__intro', 'Contatos enviados pelos formulários do site. Abra um lead para ver tudo, falar pelo WhatsApp e anotar o atendimento.'));

  const topo = el('div', 'leads-topo');
  const busca = el('input', 'input');
  busca.type = 'search';
  busca.placeholder = 'Buscar por nome, telefone, e-mail ou código';
  busca.setAttribute('aria-label', 'Buscar leads');
  busca.value = filtros.busca;
  const status = el('select', 'select');
  status.setAttribute('aria-label', 'Filtrar por situação');
  const origem = el('select', 'select');
  origem.setAttribute('aria-label', 'Filtrar por formulário');
  status.append(new Option('Todas as situações', ''));
  origem.append(new Option('Todos os formulários', ''));
  const exportar = link('Exportar CSV', '/api/admin/leads/exportar');
  exportar.setAttribute('download', '');
  topo.append(busca, status, origem, exportar);

  const lista = el('ul', 'adm-lista');
  lista.setAttribute('aria-live', 'polite');
  const rodape = el('div', 'leads-rodape');
  corpo.append(topo, lista, rodape);

  const preencherFiltros = () => {
    if (!meta || status.options.length > 1) return;
    status.append(...Object.entries(meta.status).map(([k, v]) => new Option(v, k)));
    origem.append(...Object.entries(meta.origens).map(([k, v]) => new Option(v, k)));
    status.value = filtros.status;
    origem.value = filtros.origem;
  };
  const recarregar = async () => { filtros.pagina = 1; await carregarLista(lista, rodape); preencherFiltros(); };
  let espera;
  busca.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { filtros.busca = busca.value.trim(); recarregar(); }, 300); });
  status.addEventListener('change', () => { filtros.status = status.value; recarregar(); });
  origem.addEventListener('change', () => { filtros.origem = origem.value; recarregar(); });
  carregarLista(lista, rodape).then(preencherFiltros);

  if (usuario.papel === 'admin' && estado) corpo.append(formAviso());
}

// E-mail que recebe o aviso de cada lead novo (só admin).
function formAviso() {
  const form = el('form', 'adm-form leads-aviso');
  const campo = estado.campos['leads.email_aviso'];
  form.innerHTML = `<div class="form-field">
      <label for="lead-aviso"></label>
      <input class="input" id="lead-aviso" type="email" name="email" placeholder="seu@email.com">
      <span class="hint"></span>
    </div>
    <div class="adm-form__acoes"><button class="btn btn--outline btn--sm" type="submit">Salvar e-mail</button></div>`;
  form.querySelector('label').textContent = campo.rotulo;
  form.querySelector('.hint').textContent = campo.ajuda;
  const input = form.querySelector('input');
  input.value = estado.valores['leads.email_aviso'] || '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const novo = await api('/api/admin/config', { metodo: 'PUT', dados: { valores: { 'leads.email_aviso': input.value } } });
      Object.assign(estado, novo);
      toast('E-mail de aviso salvo.');
    } catch { /* o api() já avisou */ }
  });
  return form;
}

/* ---------------- Detalhe ---------------- */

// Lead do "Negocie" → anúncio em rascunho já preenchido.
function anuncioDoLead(lead) {
  const d = lead.dados;
  const fin = { Vender: 'venda', Alugar: 'aluguel', 'Vender ou alugar': 'venda_aluguel' }[d.negocio] || 'venda';
  const tipo = { Casa: 'casa', Apartamento: 'apartamento', 'Chácara / Sítio': 'chacara', Terreno: 'terreno', Comercial: 'comercial' }[d.tipo] || 'casa';
  const num = (v) => String(v || '').replace(/\D/g, '') || '';
  const valor = num(String(d.valor || '').replace(/,\d{1,2}$/, ''));
  const onde = d.bairro || d.cidade || 'Urupema';
  return {
    finalidade: fin, tipo, status: 'rascunho', titulo: `${d.tipo || 'Imóvel'} em ${onde}`.slice(0, 120),
    descricao: [d.descricao, d.diferenciais ? `Diferenciais: ${d.diferenciais}` : ''].filter(Boolean).join('\n\n'),
    preco_venda: fin !== 'aluguel' ? valor : '', preco_aluguel: fin === 'aluguel' ? valor : '',
    cep: d.cep || '', cidade: d.cidade || 'Urupema', uf: 'SC', bairro: d.bairro || '', logradouro: d.rua || '', numero: d.numero || '',
    complemento: d.complemento || '', area_util: num(d.area), quartos: num(d.quartos), banheiros: num(d.banheiros), vagas: num(d.vagas),
    exibir_endereco: 'bairro', no_site: true, no_grupo_olx: true, destaque: false, tipo_publicacao_olx: 'STANDARD', caracteristicas: [],
    fotos_lead: lead.fotos.map((f) => f.url),
  };
}

async function abrirLead(id) {
  let lead;
  try { lead = await api(`/api/admin/leads/${id}`); } catch { return; }
  tituloGaveta(lead.nome);
  corpo.replaceChildren();

  const voltar = botao('← Todos os leads', () => montarLista(), 'btn--ghost');
  const cab = el('div', 'lead-cab');
  cab.append(el('span', 'tag', lead.origem_rotulo), tagStatus(lead.status), el('small', 'hint', `Recebido em ${quando(lead.criado_em)}`));

  const contato = el('div', 'lead-contato');
  const wa = whatsapp(lead);
  if (wa) contato.append(link('Responder no WhatsApp', wa, 'btn btn--gold btn--sm'));
  if (lead.telefone) contato.append(link(`Ligar: ${lead.telefone}`, 'tel:' + lead.telefone.replace(/[^\d+]/g, '')));
  if (lead.email) contato.append(link(`E-mail: ${lead.email}`, 'mailto:' + lead.email));
  if (lead.imovel_ref) contato.append(link(`Ver imóvel ${lead.imovel_ref}`, `/admin/imovel/${lead.imovel_ref}`));

  const dl = el('dl', 'lead-dados');
  const linha = (rotulo, valor) => { dl.append(el('dt', '', rotulo), el('dd', '', valor)); };
  linha('Nome', lead.nome);
  if (lead.telefone) linha('Telefone', lead.telefone);
  if (lead.email) linha('E-mail', lead.email);
  if (lead.imovel_ref) linha('Imóvel', lead.imovel_ref);
  lead.campos.forEach((c) => linha(c.rotulo, c.valor));
  linha('Consentimento (LGPD)', `aceito em ${quando(lead.consentimento_em)}`);

  corpo.append(voltar, cab, contato, dl);

  if (lead.fotos.length) {
    const g = el('div', 'lead-fotos');
    lead.fotos.forEach((f) => {
      const a = el('a');
      a.href = f.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.src = f.url;
      img.alt = `Foto ${f.n} enviada pelo proprietário`;
      img.loading = 'lazy';
      a.append(img);
      g.append(a);
    });
    corpo.append(el('h3', 'lead-sub', 'Fotos enviadas'), g);
  }

  // Situação e notas do atendimento
  const form = el('form', 'adm-form lead-form');
  form.innerHTML = `<div class="form-field"><label for="lead-status">Situação</label><select class="select" id="lead-status" name="status"></select></div>
    <div class="form-field"><label for="lead-notas">Notas do atendimento</label>
      <textarea class="textarea" id="lead-notas" name="notas" rows="4" maxlength="3000" placeholder="Ex.: liguei dia 20, visita marcada para sábado"></textarea></div>
    <div class="adm-form__acoes"><button class="btn btn--primary btn--sm" type="submit">Salvar</button></div>`;
  const sel = form.elements.status;
  sel.append(...Object.entries(meta.status).map(([k, v]) => new Option(v, k)));
  sel.value = lead.status === 'novo' ? 'em_atendimento' : lead.status;    // abrir = começar o atendimento (sugestão)
  form.elements.notas.value = lead.notas;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      lead = { ...lead, ...(await api(`/api/admin/leads/${lead.id}`, { metodo: 'PUT', dados: { status: sel.value, notas: form.elements.notas.value } })) };
      toast('Lead atualizado.');
      cab.replaceChild(tagStatus(lead.status), cab.children[1]);
      atualizarContador();
    } catch { /* o api() já avisou */ }
  });
  corpo.append(form);

  const extras = el('div', 'lead-extras');
  if (lead.origem === 'negocie') {
    extras.append(botao('Criar anúncio a partir deste lead', () => {
      if (!fecharGaveta()) return;
      abrirEditorAnuncio(null, { inicial: anuncioDoLead(lead) });
    }, 'btn--gold'));
  }
  if (usuario.papel === 'admin') {
    extras.append(botao('Excluir lead', async () => {
      if (!confirm(`Excluir os dados de ${lead.nome}? Use quando a pessoa pedir a exclusão (LGPD). Não pode ser desfeito.`)) return;
      try {
        await api(`/api/admin/leads/${lead.id}`, { metodo: 'DELETE' });
        toast('Lead excluído.');
        montarLista();
      } catch { /* o api() já avisou */ }
    }, 'btn--perigo'));
  }
  if (extras.children.length) corpo.append(extras);
}

export function abrirLeads(u, est) {
  usuario = u;
  estado = est;
  corpo = abrirGaveta('Leads', { larga: true, aoFechar: () => { atualizarContador(); return true; } });
  if (corpo) montarLista();
}
