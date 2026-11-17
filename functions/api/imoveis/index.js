// GET /api/imoveis — lista pública (spec 11): filtros finalidade, tipo, bairro, min, max, quartos,
// ref, refs, destaque, ordem, pagina, limite (≤ 24) → { itens, total, bairros }.
import { json } from '../../../lib/http.js';
import { filtroPublico, paraCard, SQL_CAPA, SQL_PUBLICO } from '../../../lib/imoveis.js';

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const { where, params, ordem } = filtroPublico(q);
  const limite = Math.min(Math.max(parseInt(q.get('limite'), 10) || 12, 1), 24);
  const pagina = Math.max(parseInt(q.get('pagina'), 10) || 1, 1);

  const [lista, total, bairros] = await env.DB.batch([
    env.DB.prepare(`SELECT i.*, ${SQL_CAPA} FROM imoveis i WHERE ${where} ORDER BY ${ordem} LIMIT ? OFFSET ?`)
      .bind(...params, limite, (pagina - 1) * limite),
    env.DB.prepare(`SELECT count(*) AS n FROM imoveis i WHERE ${where}`).bind(...params),
    env.DB.prepare(`SELECT DISTINCT i.bairro FROM imoveis i WHERE ${SQL_PUBLICO} AND i.bairro IS NOT NULL ORDER BY i.bairro`),
  ]);

  return json(
    { itens: lista.results.map(paraCard), total: total.results[0].n, bairros: bairros.results.map((b) => b.bairro) },
    200,
    { 'Cache-Control': 'public, max-age=60' },
  );
}
