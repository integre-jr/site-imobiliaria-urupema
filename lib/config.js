// Dados editáveis do site (tabela configuracoes) e como eles entram no HTML (spec 7.4 e 8.0).
// No HTML: [data-cfg="chave"] troca o texto; [data-cfg-href="chave"] troca o link
// (tel:, wa.me, mailto: ou URL, conforme o tipo); [data-cfg-img] troca a foto; [data-cfg-mapa] gera o mapa.

import { escapeHtml } from './html.js';
import { validarEmail } from './validacao.js';

// Textos e fotos do próprio site (gaveta: 'pagina'): editados só no lugar, fora de "Dados do site".
// Sem linha no banco, vale o que está escrito no HTML.
const PAGINA = { gaveta: 'pagina' };
const banda = (pagina, grupo, exemplos) => Object.fromEntries(exemplos.flatMap((ex, i) => [
  [`${pagina}.banda_${i + 1}_n`, { ...PAGINA, grupo, rotulo: `${i + 1}º número da faixa verde (ex.: ${ex})`, tipo: 'destaque', max: 12 }],
  [`${pagina}.banda_${i + 1}_l`, { ...PAGINA, grupo, rotulo: `Texto abaixo do ${i + 1}º número`, tipo: 'texto', max: 40 }],
]));
const SOBRE = { ...PAGINA, grupo: 'Página Sobre' };
const pares = (prefixo, n, nome, maxT, maxP) => Object.fromEntries(Array.from({ length: n }, (_, i) => [
  [`${prefixo}_${i + 1}_t`, { ...SOBRE, rotulo: `Título do ${i + 1}º ${nome}`, tipo: 'texto', max: maxT }],
  [`${prefixo}_${i + 1}_p`, { ...SOBRE, rotulo: `Texto do ${i + 1}º ${nome}`, tipo: 'paragrafo', max: maxP }],
]).flat());

// Só estas chaves podem ser editadas pelo painel. Novos marcos acrescentam as suas aqui.
export const CAMPOS = {
  'contato.telefone_1': { grupo: 'Contato', rotulo: 'Telefone principal', tipo: 'telefone' },
  'contato.telefone_2': { grupo: 'Contato', rotulo: 'Segundo telefone', tipo: 'telefone' },
  'contato.whatsapp': { grupo: 'Contato', rotulo: 'WhatsApp', tipo: 'whatsapp', ajuda: 'Número com DDD. Vale para todos os botões de WhatsApp do site.' },
  'contato.email': { grupo: 'Contato', rotulo: 'E-mail', tipo: 'email' },
  'contato.endereco_1': { grupo: 'Contato', rotulo: 'Endereço: rua, número e sala', tipo: 'texto', max: 80 },
  'contato.endereco_2': { grupo: 'Contato', rotulo: 'Endereço: bairro, cidade e CEP', tipo: 'texto', max: 80 },
  'redes.instagram': { grupo: 'Redes sociais', rotulo: 'Link do Instagram', tipo: 'url' },
  'redes.facebook': { grupo: 'Redes sociais', rotulo: 'Link do Facebook', tipo: 'url' },
  'home.stat_1_n': { grupo: 'Números da página inicial', rotulo: '1º número em destaque (ex.: +15)', tipo: 'texto', max: 12 },
  'home.stat_1_l': { grupo: 'Números da página inicial', rotulo: 'Texto abaixo do 1º número', tipo: 'texto', max: 40 },
  'home.stat_2_n': { grupo: 'Números da página inicial', rotulo: '2º número em destaque (ex.: +320)', tipo: 'texto', max: 12 },
  'home.stat_2_l': { grupo: 'Números da página inicial', rotulo: 'Texto abaixo do 2º número', tipo: 'texto', max: 40 },
  'home.stat_3_n': { grupo: 'Números da página inicial', rotulo: '3º número em destaque (ex.: 100%)', tipo: 'texto', max: 12 },
  'home.stat_3_l': { grupo: 'Números da página inicial', rotulo: 'Texto abaixo do 3º número', tipo: 'texto', max: 40 },
  'home.hero_imagem': { ...PAGINA, grupo: 'Página inicial', rotulo: 'Foto do fundo do topo', tipo: 'imagem' },
  'home.local_imagem': { ...PAGINA, grupo: 'Página inicial', rotulo: 'Foto de "Atendimento local"', tipo: 'imagem' },
  'sobre.historia_imagem': { ...SOBRE, rotulo: 'Foto de "Nossa história"', tipo: 'imagem' },
  ...banda('home', 'Página inicial', ['+15', '+320', '5★', '100%']),
  ...banda('sobre', 'Página Sobre', ['+15', '+320', '+180', '5★']),
  'sobre.historia_titulo': { ...SOBRE, rotulo: 'Título de "Nossa história"', tipo: 'texto', max: 80 },
  'sobre.historia_lead': { ...SOBRE, rotulo: '1º parágrafo de "Nossa história"', tipo: 'paragrafo', max: 600 },
  'sobre.historia_texto': { ...SOBRE, rotulo: '2º parágrafo de "Nossa história"', tipo: 'paragrafo', max: 600 },
  ...pares('sobre.historia_item', 2, 'destaque', 50, 200),
  'sobre.valores_titulo': { ...SOBRE, rotulo: 'Título de "Nossos valores"', tipo: 'texto', max: 60 },
  'sobre.valores_intro': { ...SOBRE, rotulo: 'Frase abaixo de "Nossos valores"', tipo: 'paragrafo', max: 200 },
  ...pares('sobre.valor', 3, 'valor', 40, 300),
  // gaveta: editado na gaveta indicada, e não em "Dados do site"
  'instagram.modelo_legenda': { grupo: 'Instagram', rotulo: 'Modelo da legenda dos posts', tipo: 'textarea', max: 2200, gaveta: 'instagram' },
  'leads.email_aviso': { grupo: 'Leads', rotulo: 'E-mail para avisos de novos contatos', tipo: 'email', opcional: true, gaveta: 'leads',
    ajuda: 'O aviso por e-mail passa a funcionar quando o domínio do site estiver na Cloudflare. Até lá, os contatos aparecem só aqui.' },
  'instagram.hashtags': { grupo: 'Instagram', rotulo: 'Hashtags', tipo: 'texto', max: 500, opcional: true, gaveta: 'instagram' },
};

const digitos = (v) => String(v).replace(/\D/g, '');

// Foto enviada pelo painel (POST /api/admin/imagens), guardada no KV e servida por /fotos/site/….
export const RE_IMAGEM_SITE = /^\/fotos\/(site\/[0-9a-f-]{36}\.jpg)$/;

// "5★" / "100%" → o símbolo final fica dourado, como no HTML original.
export const destaqueHtml = (v) => escapeHtml(v).replace(/([%★]+)$/, '<span class="u">$1</span>');

// Valida e padroniza um valor digitado. Devolve { valor } ou { erro }.
export function normalizar(chave, bruto) {
  const campo = CAMPOS[chave];
  if (!campo) return { erro: 'Campo desconhecido.' };
  const v = typeof bruto === 'string' ? bruto.trim() : '';
  if (!v) return campo.opcional ? { valor: '' } : { erro: `Preencha "${campo.rotulo}".` };

  switch (campo.tipo) {
    case 'imagem':      // só muda pelo envio da foto (POST /api/admin/imagens), que também apaga a antiga
      return { erro: 'Use o botão "Trocar foto".' };
    case 'paragrafo': {
      const texto = v.replace(/\s+/g, ' ');     // o parágrafo é uma linha só no site
      const max = campo.max || 600;
      return texto.length > max ? { erro: `"${campo.rotulo}" pode ter até ${max} caracteres.` } : { valor: texto };
    }
    case 'telefone': {
      const n = digitos(v).length;
      if (n < 10 || n > 11 || v.length > 30) return { erro: 'Telefone com DDD, por exemplo: (49) 99160-3030.' };
      return { valor: v };
    }
    case 'whatsapp': {
      let d = digitos(v);
      if (d.length === 10 || d.length === 11) d = '55' + d;
      if (!/^55\d{10,11}$/.test(d)) return { erro: 'WhatsApp com DDD, por exemplo: (49) 99160-3030.' };
      return { valor: d };
    }
    case 'email': {
      const e = v.toLowerCase();
      const msg = validarEmail(e);
      return msg ? { erro: msg } : { valor: e };
    }
    case 'url': {
      const u = /^https?:\/\//i.test(v) ? v : 'https://' + v;
      try {
        const url = new URL(u);
        if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || u.length > 300) throw 0;
        return { valor: u };    // como digitado (só com https:// na frente, se faltar)
      } catch {
        return { erro: 'Link inválido. Copie o endereço da página, por exemplo: https://instagram.com/suaconta' };
      }
    }
    default: {
      const max = campo.max || 120;
      return v.length > max ? { erro: `"${campo.rotulo}" pode ter até ${max} caracteres.` } : { valor: v };
    }
  }
}

// Link gerado a partir do valor (para [data-cfg-href]).
export function hrefDe(chave, valor) {
  switch (CAMPOS[chave]?.tipo) {
    case 'telefone': return 'tel:+55' + digitos(valor);
    case 'whatsapp': return 'https://wa.me/' + valor;
    case 'email': return 'mailto:' + valor;
    case 'url': return valor;
    default: return null;
  }
}

export function mapaDe(cfg) {
  // "Rua X, 08 — Sala 01" + "Centro, Urupema/SC · 88625-000" → "Rua X, 08, Centro, Urupema/SC, 88625-000"
  // (sala e complemento depois do travessão atrapalham a busca do Google Maps)
  const rua = (cfg['contato.endereco_1'] || '').split('—')[0];
  const endereco = `${rua}, ${cfg['contato.endereco_2'] || ''}`.replace(/·/g, ',').replace(/\s*,\s*/g, ', ').trim();
  return `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;
}

// Leitura com cache em memória do isolate por 60 s (spec 7.4).
let cache = { em: 0, valores: null };

export async function lerConfig(env) {
  if (cache.valores && Date.now() - cache.em < 60000) return cache.valores;
  const { results } = await env.DB.prepare('SELECT chave, valor FROM configuracoes').all();
  cache = { em: Date.now(), valores: Object.fromEntries(results.map((r) => [r.chave, r.valor])) };
  return cache.valores;
}

export const esquecerConfig = () => { cache = { em: 0, valores: null }; };

// Pacote para o editor: valores editáveis, links prontos e a descrição de cada campo.
export function paraEditor(cfg) {
  const valores = {};
  const hrefs = {};
  for (const chave of Object.keys(CAMPOS)) {
    valores[chave] = cfg[chave] ?? '';
    const h = hrefDe(chave, valores[chave]);
    if (h) hrefs[chave] = h;
  }
  return { valores, hrefs, mapa: mapaDe(cfg), campos: CAMPOS };
}

// Registra no HTMLRewriter as trocas de texto, link e mapa.
export function aplicarConfig(rewriter, cfg) {
  return rewriter
    .on('[data-cfg]', {
      element(el) {
        const chave = el.getAttribute('data-cfg');
        const v = cfg[chave];
        if (v === undefined) return;
        if (CAMPOS[chave]?.tipo === 'destaque') el.setInnerContent(destaqueHtml(v), { html: true });
        else el.setInnerContent(v);
      },
    })
    .on('[data-cfg-href]', {
      element(el) {
        const chave = el.getAttribute('data-cfg-href');
        const h = cfg[chave] !== undefined && hrefDe(chave, cfg[chave]);
        if (h) el.setAttribute('href', h);
      },
    })
    .on('[data-cfg-img]', {
      element(el) {
        const v = cfg[el.getAttribute('data-cfg-img')];
        if (v && RE_IMAGEM_SITE.test(v)) el.setAttribute('src', v);
      },
    })
    .on('[data-cfg-mapa]', {
      element(el) {
        // data-src: o iframe só ganha src quando o visitante clica em "Mostrar o mapa" (js/main.js).
        el.setAttribute('data-src', mapaDe(cfg));
      },
    })
    .on('[data-cfg-mapa-link]', {
      element(el) {
        el.setAttribute('href', mapaDe(cfg).replace('&output=embed', ''));
      },
    });
}
