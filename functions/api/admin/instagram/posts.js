// GET /api/admin/instagram/posts[?imovel=<id>] — histórico de posts (os 50 mais recentes).
import { todos } from '../../../../lib/db.js';
import { json } from '../../../../lib/http.js';

export async function onRequestGet({ request, env }) {
  const imovel = Number(new URL(request.url).searchParams.get('imovel')) || 0;
  const itens = await todos(env.DB, `
    SELECT p.id, p.tipo, p.status, p.permalink, p.erro, p.modo, p.criado_em, i.id AS imovel_id, i.ref, i.titulo, u.nome AS autor
      FROM instagram_posts p
      LEFT JOIN imoveis i ON i.id = p.imovel_id
      LEFT JOIN usuarios u ON u.id = p.criado_por
     WHERE (? = 0 OR p.imovel_id = ?)
     ORDER BY p.id DESC LIMIT 50`, imovel, imovel);
  return json({ itens });
}
