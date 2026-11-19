// GET /api/admin/leads — lista dos leads (admin e corretor), com filtros por situação, origem e busca.
// Ao abrir, apaga os leads com mais de 2 anos (retenção prometida em privacidade.html).
import { todos, um } from '../../../../lib/db.js';
import { json } from '../../../../lib/http.js';
import { apagarVencidos, formatarLead, ORIGENS, STATUS_LEAD } from '../../../../lib/leads.js';

const POR_PAGINA = 30;

export async function onRequestGet({ request, env }) {
  await apagarVencidos(env);
  const q = new URL(request.url).searchParams;
  const onde = [];
  const params = [];
  if (STATUS_LEAD[q.get('status')]) { onde.push('status = ?'); params.push(q.get('status')); }
  if (ORIGENS[q.get('origem')]) { onde.push('origem = ?'); params.push(q.get('origem')); }
  const busca = (q.get('busca') || '').trim().slice(0, 100);
  if (busca) {
    onde.push("(nome LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR telefone LIKE ? ESCAPE '\\' OR imovel_ref LIKE ? ESCAPE '\\')");
    const like = '%' + busca.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    params.push(like, like, like, like);
  }
  const where = onde.length ? 'WHERE ' + onde.join(' AND ') : '';
  const pagina = Math.max(1, Number.parseInt(q.get('pagina'), 10) || 1);

  const [{ total }, { novos }, linhas] = await Promise.all([
    um(env.DB, `SELECT count(*) AS total FROM leads ${where}`, ...params),
    um(env.DB, "SELECT count(*) AS novos FROM leads WHERE status = 'novo'"),
    todos(env.DB, `SELECT * FROM leads ${where} ORDER BY criado_em DESC, id DESC LIMIT ? OFFSET ?`, ...params, POR_PAGINA, (pagina - 1) * POR_PAGINA),
  ]);
  return json({
    itens: linhas.map((l) => formatarLead(l)),
    total, novos, pagina, por_pagina: POR_PAGINA,
    origens: ORIGENS, status: STATUS_LEAD,
  });
}
