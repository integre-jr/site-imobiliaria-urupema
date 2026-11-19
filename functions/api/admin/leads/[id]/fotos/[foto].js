// GET /api/admin/leads/:id/fotos/:foto — foto enviada no formulário "Negocie". Só com sessão
// (fica sob /api/admin): as fotos de leads não são públicas (spec 7.6).
import { um } from '../../../../../../lib/db.js';

export async function onRequestGet({ env, params }) {
  const f = await um(env.DB, 'SELECT kv_chave FROM lead_fotos WHERE id = ? AND lead_id = ?', Number(params.foto), Number(params.id));
  const corpo = f && (await env.FOTOS.get(f.kv_chave, 'stream'));
  if (!corpo) return new Response('Não encontrado.', { status: 404 });
  return new Response(corpo, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
}
