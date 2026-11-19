// Legenda do post a partir do modelo editável (instagram.modelo_legenda, spec 9.3).
// Linhas cujos marcadores ficaram todos vazios somem; nunca sobram mais de uma linha em branco seguida.
import { FINALIDADES } from '../imoveis.js';

export const MAX_LEGENDA = 2200;
export const MAX_HASHTAGS = 30;

const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const reais = (n) => 'R$ ' + milhar(n);
const m2 = (n) => String(Math.round(n * 100) / 100).replace('.', ',') + ' m²';

function preco(im) {
  const p = [];
  if (im.finalidade !== 'aluguel' && im.preco_venda) p.push(reais(im.preco_venda));
  if (im.finalidade !== 'venda' && im.preco_aluguel) p.push(reais(im.preco_aluguel) + '/mês');
  return p.join(' ou ');
}

function specs(im) {
  const s = [];
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  if (im.quartos) s.push('🛏 ' + plural(im.quartos, 'quarto', 'quartos'));
  if (im.suites) s.push(plural(im.suites, 'suíte', 'suítes'));
  if (im.banheiros) s.push('🚿 ' + plural(im.banheiros, 'banheiro', 'banheiros'));
  if (im.vagas) s.push('🚗 ' + plural(im.vagas, 'vaga', 'vagas'));
  const area = im.area_util || im.area_total;
  if (area) s.push('📐 ' + m2(area));
  return s.join(' · ');
}

export function gerarLegenda(im, cfg) {
  const valores = {
    titulo: im.titulo,
    finalidade_rotulo: FINALIDADES[im.finalidade]?.rotulo || '',
    preco: preco(im),
    bairro: im.bairro || '',
    cidade: im.cidade || '',
    uf: im.uf || '',
    specs: specs(im),
    ref: im.ref,
    telefone_1: cfg['contato.telefone_1'] || '',
    hashtags: cfg['instagram.hashtags'] || '',
  };
  const modelo = cfg['instagram.modelo_legenda'] || '{titulo}\n\n{preco}\n\n{hashtags}';
  const linhas = [];
  for (const linha of modelo.replace(/\r/g, '').split('\n')) {
    const marcas = [...linha.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in valores);
    if (marcas.length && marcas.every((k) => !String(valores[k] ?? '').trim())) continue;
    linhas.push(linha.replace(/\{(\w+)\}/g, (t, k) => (k in valores ? String(valores[k] ?? '') : t)).replace(/\s+$/, ''));
  }
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_LEGENDA);
}

export const contarHashtags = (texto) => (String(texto).match(/#[^\s#]+/g) || []).length;
