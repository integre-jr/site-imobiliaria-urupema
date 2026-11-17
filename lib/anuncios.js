// Apoio às rotas de anúncios do painel (/api/admin/imoveis/*).
import { todos, um } from './db.js';
import { fotoUrls, normalizarRef } from './imoveis.js';

// Colunas gravadas a partir do formulário (validarImovel devolve todas elas).
export const COLUNAS = ['status', 'finalidade', 'tipo', 'titulo', 'descricao', 'preco_venda', 'preco_aluguel', 'condominio', 'iptu_anual',
  'cep', 'uf', 'cidade', 'bairro', 'logradouro', 'numero', 'complemento', 'latitude', 'longitude', 'exibir_endereco',
  'area_util', 'area_total', 'quartos', 'suites', 'banheiros', 'vagas', 'caracteristicas', 'destaque', 'no_site',
  'no_grupo_olx', 'tipo_publicacao_olx'];

// :id aceita o número interno ou a referência ("UR-1024").
export async function carregarImovel(env, id) {
  const n = Number(id);
  if (Number.isInteger(n) && n > 0) return um(env.DB, 'SELECT * FROM imoveis WHERE id = ?', n);
  const ref = normalizarRef(id);
  return ref ? um(env.DB, 'SELECT * FROM imoveis WHERE ref = ?', ref) : null;
}

export async function listarFotos(env, imovelId) {
  const fotos = await todos(env.DB, 'SELECT * FROM fotos WHERE imovel_id = ? ORDER BY ordem, id', imovelId);
  return fotos.map((f) => ({ id: f.id, ordem: f.ordem, largura: f.largura, altura: f.altura, bytes: f.bytes, ...fotoUrls(f) }));
}
