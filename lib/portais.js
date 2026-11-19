// Portais (spec 10): endereço secreto do feed e seleção dos anúncios que vão para o Grupo OLX.
// O trecho secreto da URL fica no banco (configuracoes 'portais.feed_token'): é criado sozinho na
// primeira vez e pode ser trocado pelo painel. Não depende de segredo configurado no servidor.
import { aleatorio } from './cripto.js';
import { agora, executar, todos, um } from './db.js';
import { pendencias } from './vrsync.js';

const CHAVE = 'portais.feed_token';
export const FEED_GRUPO_OLX = 'grupo-olx';

export async function tokenFeed(env) {
  const linha = await um(env.DB, 'SELECT valor FROM configuracoes WHERE chave = ?', CHAVE);
  if (linha?.valor) return linha.valor;
  return novoToken(env, env.FEED_TOKEN && /^[A-Za-z0-9_-]{8,}$/.test(env.FEED_TOKEN) ? env.FEED_TOKEN : aleatorio(18));
}

export async function novoToken(env, token = aleatorio(18)) {
  await executar(env.DB, `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`, CHAVE, token, agora());
  return token;
}

export const urlFeed = (origem, token) => `${origem}/feeds/${FEED_GRUPO_OLX}-${token}.xml`;

// Anúncios marcados para os portais. Os de demonstração (origem 'seed', fictícios) nunca vão.
// → [{ imovel, fotos, pendencias }]; só os sem pendências entram no feed.
export async function candidatos(env, { incluirInativos = false } = {}) {
  const filtro = incluirInativos ? "i.status NOT IN ('arquivado')" : "i.status = 'ativo'";
  const imoveis = await todos(env.DB, `SELECT i.* FROM imoveis i WHERE ${filtro} AND i.no_grupo_olx = 1 AND i.origem != 'seed'
    ORDER BY COALESCE(i.publicado_em, i.criado_em) DESC, i.id DESC`);
  if (!imoveis.length) return [];
  const fotos = await todos(env.DB, `SELECT f.* FROM fotos f JOIN imoveis i ON i.id = f.imovel_id
    WHERE ${filtro} AND i.no_grupo_olx = 1 AND i.origem != 'seed' ORDER BY f.imovel_id, f.ordem, f.id`);
  const porImovel = new Map();
  for (const f of fotos) {
    if (!porImovel.has(f.imovel_id)) porImovel.set(f.imovel_id, []);
    porImovel.get(f.imovel_id).push(f);
  }
  return imoveis.map((im) => {
    const fs = porImovel.get(im.id) || [];
    return { imovel: im, fotos: fs, pendencias: pendencias(im, fs.length) };
  });
}
