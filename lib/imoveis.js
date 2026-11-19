// Imóveis: vocabulários (spec 6.1), validação do cadastro, consultas públicas e formato de saída.
// Usado pelas rotas públicas, pelo admin, pela página do imóvel e (M5) pelo feed VRSync.

export const TIPOS = {
  casa: { rotulo: 'Casa', vrsync: 'Residential / Home', icone: 'i-home' },
  apartamento: { rotulo: 'Apartamento', vrsync: 'Residential / Apartment', icone: 'i-building' },
  chacara: { rotulo: 'Chácara / Sítio', vrsync: 'Residential / Farm Ranch', icone: 'i-trees' },
  terreno: { rotulo: 'Terreno', vrsync: 'Residential / Land Lot', icone: 'i-mountain' },
  comercial: { rotulo: 'Comercial', vrsync: 'Commercial / Building', icone: 'i-building' },
  sobrado: { rotulo: 'Sobrado', vrsync: 'Residential / Sobrado', icone: 'i-home' },
  cabana: { rotulo: 'Cabana', vrsync: 'Residential / Home', icone: 'i-home' },
  sala: { rotulo: 'Sala comercial', vrsync: 'Commercial / Office', icone: 'i-building' },
  galpao: { rotulo: 'Galpão', vrsync: 'Commercial / Industrial', icone: 'i-building' },
};

export const FINALIDADES = {
  venda: { rotulo: 'Venda', vrsync: 'For Sale' },
  aluguel: { rotulo: 'Aluguel', vrsync: 'For Rent' },
  venda_aluguel: { rotulo: 'Venda e aluguel', vrsync: 'Sale/Rent' },
};

export const STATUS = {
  rascunho: 'Rascunho',
  ativo: 'Publicado',
  reservado: 'Reservado',
  vendido: 'Vendido',
  alugado: 'Alugado',
  arquivado: 'Arquivado',
};
export const STATUS_PUBLICOS = ['ativo', 'reservado'];

// vrsync: valor da tabela de características do VRSync (conferida em developers.grupozap.com em 18/11/2026).
export const CARACTERISTICAS = {
  lareira: { rotulo: 'Lareira', vrsync: 'Fireplace' },
  aquecimento: { rotulo: 'Aquecimento central', vrsync: 'Heating' },
  churrasqueira: { rotulo: 'Churrasqueira', vrsync: 'BBQ' },
  vista_montanha: { rotulo: 'Vista para a serra', vrsync: 'Mountain View' },
  piscina: { rotulo: 'Piscina', vrsync: 'Pool' },
  jardim: { rotulo: 'Jardim', vrsync: 'Garden Area' },
  mobiliado: { rotulo: 'Mobiliado', vrsync: 'Furnished' },
  aceita_pet: { rotulo: 'Aceita pet', vrsync: 'Pets Allowed' },
  area_servico: { rotulo: 'Área de serviço', vrsync: 'Laundry' },
  varanda: { rotulo: 'Varanda', vrsync: 'Balcony' },
  energia_solar: { rotulo: 'Energia solar', vrsync: 'Solar Energy' },
  poco_artesiano: { rotulo: 'Poço artesiano', vrsync: 'Artesian Well' },
  galpao: { rotulo: 'Galpão', vrsync: 'Warehouse' },
  pomar: { rotulo: 'Pomar', vrsync: 'Pomar' },
};

export const BAIRROS_SUGERIDOS = ['Centro', 'Rio dos Bugres', 'Santo Antônio', 'Interior'];
// PublicationType do VRSync (conferido em 18/11/2026). Precisa caber no plano contratado no Canal Pro.
export const PUBLICACAO_OLX = {
  STANDARD: 'Padrão', PREMIUM: 'Destaque', SUPER_PREMIUM: 'Super destaque',
  PREMIERE_1: 'Destaque exclusivo (plano Zap+)', PREMIERE_2: 'Destaque superior (plano Zap+)', TRIPLE: 'Destaque triplo',
};
export const EXIBIR_ENDERECO = { completo: 'Endereço completo', rua: 'Só a rua (sem número)', bairro: 'Só o bairro' };
export const MAX_FOTOS = 20;

// Tudo o que o navegador precisa para montar filtros e o formulário do admin.
export const opcoes = () => ({
  tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.rotulo])),
  finalidades: Object.fromEntries(Object.entries(FINALIDADES).map(([k, v]) => [k, v.rotulo])),
  caracteristicas: Object.fromEntries(Object.entries(CARACTERISTICAS).map(([k, v]) => [k, v.rotulo])),
  status: STATUS,
  bairros_sugeridos: BAIRROS_SUGERIDOS,
  publicacao_olx: PUBLICACAO_OLX,
  exibir_endereco: EXIBIR_ENDERECO,
  max_fotos: MAX_FOTOS,
  // Para a importação de um feed VRSync (gaveta Portais): valor VRSync → chave
  vrsync: {
    tipos: Object.fromEntries(Object.entries(TIPOS).reverse().map(([k, v]) => [v.vrsync, k])),
    caracteristicas: Object.fromEntries(Object.entries(CARACTERISTICAS).map(([k, v]) => [v.vrsync, k])),
  },
});

// "1024", "ur1024", "UR-1024" → "UR-1024"; outra coisa → null
export function normalizarRef(v) {
  const m = String(v ?? '').trim().toUpperCase().match(/^(?:UR)?-?\s*(\d{1,7})$/);
  return m ? 'UR-' + m[1] : null;
}

// ---------- Validação do cadastro ----------

const texto = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

// "850.000", "R$ 850.000,00", 850000 → 850000; vazio → null; inválido → NaN
function inteiro(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NaN;
  const limpo = String(v).replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function decimal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const limpo = String(v).replace(/\s|m²/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);

const CAMPOS_TEXTO = { titulo: 120, descricao: 5000, bairro: 60, cidade: 60, logradouro: 120, numero: 20, complemento: 60 };
const CAMPOS_INTEIROS = { preco_venda: 'Preço de venda', preco_aluguel: 'Aluguel', condominio: 'Condomínio', iptu_anual: 'IPTU', quartos: 'Quartos', suites: 'Suítes', banheiros: 'Banheiros', vagas: 'Vagas' };
const CAMPOS_DECIMAIS = { area_util: 'Área útil', area_total: 'Área total', latitude: 'Latitude', longitude: 'Longitude' };

// Junta a entrada com o registro atual (atualização parcial) e valida tudo.
// Devolve { dados } (pronto para gravar) ou { erro, campo }.
export function validarImovel(entrada, atual = {}) {
  const e = { ...atual, ...entrada };
  const d = {};

  if (!FINALIDADES[e.finalidade]) return { erro: 'Escolha a finalidade (venda, aluguel ou os dois).', campo: 'finalidade' };
  if (!TIPOS[e.tipo]) return { erro: 'Escolha o tipo do imóvel.', campo: 'tipo' };
  d.finalidade = e.finalidade;
  d.tipo = e.tipo;

  for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
    const v = texto(e[campo]);
    if (v.length > max) return { erro: `Texto longo demais (máx. ${max} caracteres).`, campo };
    d[campo] = v || null;
  }
  d.descricao = d.descricao || '';
  if (!d.titulo || d.titulo.length < 3) return { erro: 'Dê um título ao anúncio (pelo menos 3 letras).', campo: 'titulo' };
  d.cidade = d.cidade || 'Urupema';

  for (const [campo, nome] of Object.entries(CAMPOS_INTEIROS)) {
    const n = inteiro(e[campo]);
    const max = campo.startsWith('preco') || campo === 'condominio' || campo === 'iptu_anual' ? 1e10 : 999;
    if (Number.isNaN(n) || (n !== null && (n < 0 || n > max))) return { erro: `${nome}: valor inválido.`, campo };
    d[campo] = n;
  }
  for (const [campo, nome] of Object.entries(CAMPOS_DECIMAIS)) {
    const n = decimal(e[campo]);
    const lim = campo === 'latitude' ? 90 : campo === 'longitude' ? 180 : 1e9;
    if (Number.isNaN(n) || (n !== null && (Math.abs(n) > lim || (campo.startsWith('area') && n < 0)))) return { erro: `${nome}: valor inválido.`, campo };
    d[campo] = n;
  }

  const uf = texto(e.uf).toUpperCase() || 'SC';
  if (!/^[A-Z]{2}$/.test(uf)) return { erro: 'UF com 2 letras, por exemplo: SC.', campo: 'uf' };
  d.uf = uf;
  const cep = texto(e.cep).replace(/\D/g, '');
  if (cep && cep.length !== 8) return { erro: 'CEP com 8 números.', campo: 'cep' };
  d.cep = cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null;
  d.exibir_endereco = EXIBIR_ENDERECO[e.exibir_endereco] ? e.exibir_endereco : 'bairro';

  let cars = e.caracteristicas;
  if (typeof cars === 'string') { try { cars = JSON.parse(cars); } catch { cars = []; } }
  d.caracteristicas = JSON.stringify([...new Set((Array.isArray(cars) ? cars : []).filter((c) => CARACTERISTICAS[c]))]);

  d.status = STATUS[e.status] ? e.status : 'rascunho';
  d.destaque = bool(e.destaque);
  d.no_site = e.no_site === undefined ? 1 : bool(e.no_site);
  d.no_grupo_olx = e.no_grupo_olx === undefined ? 1 : bool(e.no_grupo_olx);
  d.tipo_publicacao_olx = PUBLICACAO_OLX[e.tipo_publicacao_olx] ? e.tipo_publicacao_olx : 'STANDARD';

  // Para aparecer no site, o anúncio precisa do mínimo que o card mostra.
  if (STATUS_PUBLICOS.includes(d.status)) {
    if (d.finalidade !== 'aluguel' && !(d.preco_venda > 0)) return { erro: 'Para publicar, informe o preço de venda.', campo: 'preco_venda' };
    if (d.finalidade !== 'venda' && !(d.preco_aluguel > 0)) return { erro: 'Para publicar, informe o valor do aluguel.', campo: 'preco_aluguel' };
    if (!d.bairro) return { erro: 'Para publicar, informe o bairro ou a localidade.', campo: 'bairro' };
  }
  return { dados: d };
}

// ---------- Saída ----------

export function fotoUrls(f) {
  if (f?.kv_chave) return { g: `/fotos/${f.kv_chave}/g.jpg`, p: `/fotos/${f.kv_chave}/p.jpg` };
  if (f?.url_externa) return { g: f.url_externa, p: f.url_externa.replace(/([?&]w=)\d+/, '$1640') };
  return null;
}

const listaCaracteristicas = (json) => {
  let lista = [];
  try { lista = JSON.parse(json || '[]'); } catch { /* vazio */ }
  return lista.filter((c) => CARACTERISTICAS[c]).map((c) => ({ chave: c, rotulo: CARACTERISTICAS[c].rotulo }));
};

// Endereço que o público pode ver, conforme exibir_endereco.
export function enderecoPublico(im) {
  const base = { bairro: im.bairro, cidade: im.cidade, uf: im.uf };
  if (im.exibir_endereco === 'completo') {
    return { ...base, logradouro: im.logradouro, numero: im.numero, complemento: im.complemento, cep: im.cep, latitude: im.latitude, longitude: im.longitude };
  }
  if (im.exibir_endereco === 'rua') return { ...base, logradouro: im.logradouro };
  return base;
}

// Card (lista pública). A linha precisa de capa_kv e capa_url (ver SQL_CAPA).
export function paraCard(r) {
  return {
    ref: r.ref, titulo: r.titulo, finalidade: r.finalidade, tipo: r.tipo, tipo_rotulo: TIPOS[r.tipo]?.rotulo,
    status: r.status, destaque: !!r.destaque,
    preco_venda: r.preco_venda, preco_aluguel: r.preco_aluguel,
    bairro: r.bairro, cidade: r.cidade, uf: r.uf,
    quartos: r.quartos, suites: r.suites, banheiros: r.banheiros, vagas: r.vagas,
    area_util: r.area_util, area_total: r.area_total,
    caracteristicas: listaCaracteristicas(r.caracteristicas),
    capa: fotoUrls({ kv_chave: r.capa_kv, url_externa: r.capa_url }),
  };
}

export function paraDetalhePublico(im, fotos) {
  return {
    ...paraCard({ ...im, capa_kv: fotos[0]?.kv_chave, capa_url: fotos[0]?.url_externa }),
    descricao: im.descricao, condominio: im.condominio, iptu_anual: im.iptu_anual,
    endereco: enderecoPublico(im),
    fotos: fotos.map((f) => ({ ...fotoUrls(f), legenda: f.legenda })),
  };
}

// Capa = primeira foto pela ordem.
export const SQL_CAPA = `
  (SELECT f.kv_chave FROM fotos f WHERE f.imovel_id = i.id ORDER BY f.ordem, f.id LIMIT 1) AS capa_kv,
  (SELECT f.url_externa FROM fotos f WHERE f.imovel_id = i.id ORDER BY f.ordem, f.id LIMIT 1) AS capa_url`;

export const SQL_PUBLICO = `i.status IN ('ativo', 'reservado') AND i.no_site = 1`;

// Filtros da lista pública (spec 11). Só fragmentos fixos de SQL; os valores vão em bind.
export function filtroPublico(q) {
  const where = [SQL_PUBLICO];
  const params = [];
  const fin = q.get('finalidade');
  if (fin === 'venda') where.push("i.finalidade IN ('venda', 'venda_aluguel')");
  if (fin === 'aluguel') where.push("i.finalidade IN ('aluguel', 'venda_aluguel')");
  if (TIPOS[q.get('tipo')]) { where.push('i.tipo = ?'); params.push(q.get('tipo')); }
  if (q.get('bairro')) { where.push('i.bairro = ?'); params.push(q.get('bairro').slice(0, 60)); }
  const quartos = parseInt(q.get('quartos'), 10);
  if (quartos > 0) { where.push('i.quartos >= ?'); params.push(quartos); }
  if (q.get('destaque') === '1') where.push('i.destaque = 1');
  const ref = normalizarRef(q.get('ref'));
  if (q.get('ref')) { where.push('i.ref = ?'); params.push(ref || '-'); }
  if (q.has('refs')) {
    const refs = q.get('refs').split(',').map(normalizarRef).filter(Boolean).slice(0, 50);
    where.push(refs.length ? `i.ref IN (${refs.map(() => '?').join(',')})` : '0');
    params.push(...refs);
  }
  const campoPreco = fin === 'aluguel' ? 'i.preco_aluguel' : fin === 'venda' ? 'i.preco_venda' : 'COALESCE(i.preco_venda, i.preco_aluguel)';
  const min = inteiro(q.get('min'));
  const max = inteiro(q.get('max'));
  if (min > 0) { where.push(`${campoPreco} >= ?`); params.push(min); }
  if (max > 0) { where.push(`${campoPreco} <= ?`); params.push(max); }
  const ordens = {
    menor: `${campoPreco} IS NULL, ${campoPreco} ASC`,
    maior: `${campoPreco} IS NULL, ${campoPreco} DESC`,
  };
  const ordem = ordens[q.get('ordem')] || 'COALESCE(i.publicado_em, i.criado_em) DESC, i.id DESC';
  return { where: where.join(' AND '), params, ordem };
}
