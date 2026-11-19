// /api/admin/leads/:id — detalhe (GET), situação e notas (PUT) e exclusão (DELETE, só admin:
// é o caminho para atender um pedido de exclusão de dados, LGPD).
import { soAdmin } from '../../../../lib/auth.js';
import { agora, executar, todos, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { apagarLead, formatarLead, STATUS_LEAD } from '../../../../lib/leads.js';

async function carregar(env, params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? um(env.DB, 'SELECT * FROM leads WHERE id = ?', id) : null;
}

async function detalhe(env, lead) {
  const fotos = await todos(env.DB, 'SELECT id FROM lead_fotos WHERE lead_id = ? ORDER BY id', lead.id);
  return formatarLead(lead, fotos);
}

export async function onRequestGet({ env, params }) {
  const lead = await carregar(env, params);
  if (!lead) return erro('Lead não encontrado.', 404);
  return json(await detalhe(env, lead));
}

export async function onRequestPut({ request, env, params }) {
  const lead = await carregar(env, params);
  if (!lead) return erro('Lead não encontrado.', 404);
  const b = (await lerJson(request)) || {};
  const status = b.status !== undefined ? b.status : lead.status;
  if (!STATUS_LEAD[status]) return erro('Situação inválida.', 400, 'status');
  const notas = b.notas !== undefined ? String(b.notas ?? '').trim() : lead.notas;
  if (notas && notas.length > 3000) return erro('As notas podem ter até 3.000 caracteres.', 400, 'notas');
  await executar(env.DB, 'UPDATE leads SET status = ?, notas = ?, atualizado_em = ? WHERE id = ?', status, notas || null, agora(), lead.id);
  return json(await detalhe(env, { ...lead, status, notas, atualizado_em: agora() }));
}

export async function onRequestDelete({ env, params, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const lead = await carregar(env, params);
  if (!lead) return erro('Lead não encontrado.', 404);
  await apagarLead(env, lead.id);
  return json({ ok: true });
}
