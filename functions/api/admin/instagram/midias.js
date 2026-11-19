// POST /api/admin/instagram/midias — imagens 1080×1350 (4:5) geradas no navegador para um post (spec 9.2).
// Multipart com 1 a 10 arquivos "f" (JPEG ≤ 1 MB cada). Ficam no D1 por 24 h e são servidas em
// /fotos/ig/<id>.jpg, de onde a Meta baixa. No D1 (e não no KV) porque o KV leva até 60 s para
// propagar e a Meta baixa logo em seguida.
import { agora } from '../../../../lib/db.js';
import { erro, json } from '../../../../lib/http.js';

const MAX = 1024 * 1024;

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return erro('Envio de imagens inválido.');
  }
  const arquivos = form.getAll('f');
  if (!arquivos.length || arquivos.length > 10) return erro('Escolha de 1 a 10 fotos para o post.');

  const prontos = [];
  for (const a of arquivos) {
    if (!a || typeof a.arrayBuffer !== 'function' || a.size < 100 || a.size > MAX) return erro('Uma das imagens do post é grande demais.');
    const buf = await a.arrayBuffer();
    const b = new Uint8Array(buf, 0, 3);
    if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return erro('O Instagram só aceita JPEG.');
    prontos.push({ id: crypto.randomUUID(), buf });
  }
  const t = agora();
  await env.DB.batch(prontos.map((p) =>
    env.DB.prepare('INSERT INTO instagram_midias_temp (id, conteudo, criado_em) VALUES (?, ?, ?)').bind(p.id, p.buf, t)));
  return json({ ids: prontos.map((p) => p.id) }, 201);
}
