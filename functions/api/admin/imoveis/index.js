// Anúncios no painel (admin e corretor): listar todos (inclusive rascunhos) e criar.
import { COLUNAS } from '../../../../lib/anuncios.js';
import { agora, proximo, todos, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { fotoUrls, normalizarRef, SQL_CAPA, STATUS, validarImovel } from '../../../../lib/imoveis.js';

const LIMITE_KV = 1_000_000_000;   // 1 GB do plano grátis (spec 3)

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const where = ['1'];
  const params = [];
  if (STATUS[q.get('status')]) { where.push('i.status = ?'); params.push(q.get('status')); }
  const busca = (q.get('busca') || '').trim().slice(0, 60);
  if (busca) {
    where.push('(i.ref = ? OR i.titulo LIKE ? OR i.bairro LIKE ?)');
    params.push(normalizarRef(busca) || busca, `%${busca}%`, `%${busca}%`);
  }
  const linhas = await todos(env.DB, `
    SELECT i.id, i.ref, i.titulo, i.status, i.finalidade, i.tipo, i.preco_venda, i.preco_aluguel, i.bairro,
           i.destaque, i.no_site, i.no_grupo_olx, i.atualizado_em,
           (SELECT count(*) FROM fotos f WHERE f.imovel_id = i.id) AS n_fotos, ${SQL_CAPA}
      FROM imoveis i WHERE ${where.join(' AND ')}
     ORDER BY CASE i.status WHEN 'rascunho' THEN 0 WHEN 'ativo' THEN 1 WHEN 'reservado' THEN 2 ELSE 3 END, i.atualizado_em DESC`, ...params);
  const uso = await um(env.DB, 'SELECT COALESCE(SUM(bytes), 0) AS bytes FROM fotos');
  return json({
    itens: linhas.map(({ capa_kv, capa_url, ...r }) => ({ ...r, destaque: !!r.destaque, capa: fotoUrls({ kv_chave: capa_kv, url_externa: capa_url }) })),
    uso: { bytes: uso.bytes, limite: LIMITE_KV },
  });
}


export async function onRequestPost({ request, env, data }) {
  const v = validarImovel((await lerJson(request)) || {});
  if (v.erro) return erro(v.erro, 400, v.campo);
  const t = agora();
  const publicado = ['ativo', 'reservado'].includes(v.dados.status) ? t : null;

  // A referência vem do contador; se já existir (ex.: importada), tenta a próxima.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const ref = 'UR-' + (await proximo(env.DB, 'ref_imovel'));
    try {
      const r = await env.DB.prepare(`INSERT INTO imoveis (ref, ${COLUNAS.join(', ')}, origem, criado_por, criado_em, atualizado_em, publicado_em)
        VALUES (?, ${COLUNAS.map(() => '?').join(', ')}, 'manual', ?, ?, ?, ?)`)
        .bind(ref, ...COLUNAS.map((c) => v.dados[c]), data.usuario.id, t, t, publicado).run();
      return json({ id: r.meta.last_row_id, ref }, 201);
    } catch (e) {
      if (!String(e.message).includes('UNIQUE')) throw e;
    }
  }
  return erro('Não foi possível gerar o código do imóvel. Tente de novo.', 500);
}
