// Feed VRSync do Grupo OLX (OLX, ZAP Imóveis, Viva Real), spec 10. O Canal Pro lê este XML de tempos
// em tempos; não há "envio" nem login: basta colar a URL do feed no Canal Pro uma vez.
// Formato conferido em developers.grupozap.com/feeds/vrsync em 18/11/2026 (Listing, Details, Header).
import { escapeXml as x, cdata } from './html.js';
import { CARACTERISTICAS, FINALIDADES, fotoUrls, PUBLICACAO_OLX, TIPOS } from './imoveis.js';

export const MIN_FOTOS = 5;            // "Mínimo de 5 imagens por anúncio"
const TITULO = [10, 100];
const DESCRICAO = [50, 3000];
// Tipos em que o portal exige quartos e banheiros
const RESIDENCIAL_COM_COMODOS = ['casa', 'apartamento', 'sobrado', 'cabana'];
const EMAIL_DEMO = 'contato@urupemaimoveis.com.br';

// O que impede o anúncio de ir para os portais. Lista vazia = vai no feed.
export function pendencias(im, nFotos) {
  const p = [];
  const t = (im.titulo || '').trim().length;
  if (t < TITULO[0] || t > TITULO[1]) p.push(`Título com ${TITULO[0]} a ${TITULO[1]} caracteres (hoje tem ${t}).`);
  const d = (im.descricao || '').trim().length;
  if (d < DESCRICAO[0]) p.push(`Descrição com pelo menos ${DESCRICAO[0]} caracteres (hoje tem ${d}).`);
  if (d > DESCRICAO[1]) p.push(`Descrição com no máximo ${DESCRICAO[1]} caracteres nos portais (hoje tem ${d}).`);
  if (im.finalidade !== 'aluguel' && !(im.preco_venda > 0)) p.push('Preço de venda.');
  if (im.finalidade !== 'venda' && !(im.preco_aluguel > 0)) p.push('Valor do aluguel.');
  if (nFotos < MIN_FOTOS) p.push(`Pelo menos ${MIN_FOTOS} fotos (hoje tem ${nFotos}).`);
  if (!im.bairro) p.push('Bairro ou localidade.');
  if (!im.cidade || !im.uf) p.push('Cidade e UF.');
  if (!im.cep) p.push('CEP.');
  if (!(im.area_util > 0) && !(im.area_total > 0)) p.push('Área útil ou área do terreno.');
  if (RESIDENCIAL_COM_COMODOS.includes(im.tipo) && (im.quartos == null || im.banheiros == null)) p.push('Número de quartos e de banheiros.');
  if (!TIPOS[im.tipo]?.vrsync) p.push('Tipo de imóvel sem equivalente nos portais.');
  return p;
}

// Avisos gerais (não bloqueiam, mas o Canal Pro pode recusar o arquivo inteiro).
export function avisosGerais(cfg) {
  const a = [];
  const email = cfg['contato.email'] || '';
  if (!email) a.push('Preencha o e-mail de contato em "Dados do site": os portais exigem um e-mail no feed.');
  else if (email === EMAIL_DEMO) a.push(`O e-mail de contato ainda é o de demonstração (${EMAIL_DEMO}). Troque em "Dados do site" pelo e-mail real da imobiliária antes de ligar o feed no Canal Pro.`);
  return a;
}

const tag = (nome, valor, attrs = '') => (valor === null || valor === undefined || valor === '' ? '' : `<${nome}${attrs}>${valor}</${nome}>`);
const inteiro = (n) => (n === null || n === undefined || n === '' ? null : Math.round(Number(n)));
const cepNumeros = (c) => String(c || '').replace(/\D/g, '');
const DISPLAY = { completo: 'All', rua: 'Street', bairro: 'Neighborhood' };
const ESTADOS = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

// Código do anúncio para o portal. O importado do site antigo mantém o código que o fornecedor anterior
// enviava (id_externo): na troca de feed no Canal Pro, o Grupo OLX reconhece o mesmo anúncio em vez de
// tratá-lo como novo. A importação já recusa id_externo repetido, então o código continua único.
export const codigoPortal = (im) => (im.origem === 'importado' && im.id_externo ? im.id_externo : im.ref);

function listing(im, fotos, cfg, origem) {
  const tipo = TIPOS[im.tipo];
  const usage = tipo.vrsync.startsWith('Commercial') ? 'Commercial' : 'Residential';
  let cars = [];
  try { cars = JSON.parse(im.caracteristicas || '[]'); } catch { /* vazio */ }
  const features = cars.map((c) => CARACTERISTICAS[c]?.vrsync).filter(Boolean);

  const absoluta = (u) => (/^https?:\/\//.test(u) ? u : origem + u);
  const media = fotos.map((f, i) => `<Item medium="image" caption="${x(`foto ${i + 1}`)}"${i === 0 ? ' primary="true"' : ''}>${x(absoluta(fotoUrls(f).g))}</Item>`).join('');

  const venda = im.finalidade !== 'aluguel';
  const aluguel = im.finalidade !== 'venda';
  const details = [
    tag('UsageType', usage),
    tag('PropertyType', x(tipo.vrsync)),
    tag('Description', cdata(im.descricao.trim())),
    venda ? tag('ListPrice', inteiro(im.preco_venda), ' currency="BRL"') : '',
    aluguel ? tag('RentalPrice', inteiro(im.preco_aluguel), ' currency="BRL" period="Monthly"') : '',
    tag('PropertyAdministrationFee', inteiro(im.condominio), ' currency="BRL"'),
    tag('Iptu', inteiro(im.iptu_anual), ' currency="BRL" period="Yearly"'),
    im.area_util > 0 ? tag('LivingArea', inteiro(im.area_util), ' unit="square metres"') : '',
    im.area_total > 0 ? tag('LotArea', inteiro(im.area_total), ' unit="square metres"') : '',
    tag('Bedrooms', inteiro(im.quartos)),
    tag('Bathrooms', inteiro(im.banheiros)),
    tag('Suites', inteiro(im.suites)),
    tag('Garage', inteiro(im.vagas)),
    features.length ? `<Features>${features.map((f) => `<Feature>${x(f)}</Feature>`).join('')}</Features>` : '',
  ].join('');

  // A documentação recomenda mandar o endereço completo; o que o portal MOSTRA é o displayAddress.
  const location = [
    '<Country abbreviation="BR">Brasil</Country>',
    `<State abbreviation="${x(im.uf)}">${x(ESTADOS[im.uf] || im.uf)}</State>`,
    tag('City', cdata(im.cidade)),
    tag('Neighborhood', cdata(im.bairro)),
    tag('Address', im.logradouro && cdata(im.logradouro)),
    tag('StreetNumber', im.numero && cdata(im.numero)),
    tag('Complement', im.complemento && cdata(im.complemento)),
    tag('PostalCode', cepNumeros(im.cep)),
    tag('Latitude', im.latitude),
    tag('Longitude', im.longitude),
  ].join('');

  const contato = [
    tag('Name', cdata('Urupema Negócios Imobiliários')),
    tag('Email', x(cfg['contato.email'] || '')),
    tag('Website', x(origem)),
    tag('Logo', x(`${origem}/imagens/logo_urupema_trim.png`)),
    tag('Telephone', x(cfg['contato.telefone_1'] || '')),
  ].join('');

  return `<Listing>
<ListingID>${x(codigoPortal(im))}</ListingID>
<Title>${cdata(im.titulo.trim())}</Title>
<TransactionType>${x(FINALIDADES[im.finalidade].vrsync)}</TransactionType>
<PublicationType>${x(PUBLICACAO_OLX[im.tipo_publicacao_olx] ? im.tipo_publicacao_olx : 'STANDARD')}</PublicationType>
<DetailViewUrl>${x(`${origem}/imovel/${im.ref}`)}</DetailViewUrl>
<Media>${media}</Media>
<Details>${details}</Details>
<Location displayAddress="${DISPLAY[im.exibir_endereco] || 'Neighborhood'}">${location}</Location>
<ContactInfo>${contato}</ContactInfo>
</Listing>`;
}

// itens: [{ imovel, fotos }] já validados. origem: "https://dominio" (URLs absolutas).
export function gerarFeed(itens, cfg, origem) {
  const header = [
    tag('Provider', cdata('Urupema Negócios Imobiliários')),
    tag('Email', x(cfg['contato.email'] || '')),
    tag('ContactName', cdata('Urupema Negócios Imobiliários')),
    tag('PublishDate', new Date().toISOString().slice(0, 19)),
    tag('Telephone', x(cfg['contato.telefone_1'] || '')),
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
<Header>${header}</Header>
<Listings>
${itens.map((i) => listing(i.imovel, i.fotos, cfg, origem)).join('\n')}
</Listings>
</ListingDataFeed>
`;
}
