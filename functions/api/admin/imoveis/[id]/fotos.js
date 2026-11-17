// POST /api/admin/imoveis/:id/fotos — uma foto por vez (spec 8.3). O navegador já manda as duas
// versões redimensionadas: g (lado maior 1600 px) e p (640 px), em JPEG, mais largura/altura.
import { agora, um } from '../../../../../lib/db.js';
import { erro, json } from '../../../../../lib/http.js';
import { fotoUrls, MAX_FOTOS } from '../../../../../lib/imoveis.js';
import { carregarImovel } from '../../../../../lib/anuncios.js';

const MAX_G = 1.5 * 1024 * 1024;
const MAX_P = 300 * 1024;

async function jpeg(arquivo, max) {
  if (!arquivo || typeof arquivo.arrayBuffer !== 'function' || arquivo.size > max || arquivo.size < 100) return null;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;   // assinatura do JPEG
}

export async function onRequestPost({ request, env, params }) {
  const im = await carregarImovel(env, params.id);
  if (!im) return erro('Anúncio não encontrado.', 404);

  const { n } = await um(env.DB, 'SELECT count(*) AS n FROM fotos WHERE imovel_id = ?', im.id);
  if (n >= MAX_FOTOS) return erro(`Cada anúncio pode ter até ${MAX_FOTOS} fotos.`, 409);

  let form;
  try {
    form = await request.formData();
  } catch {
    return erro('Envio de foto inválido.');
  }
  const g = await jpeg(form.get('g'), MAX_G);
  const p = await jpeg(form.get('p'), MAX_P);
  if (!g || !p) return erro('Foto inválida ou grande demais. Envie JPG ou PNG.');
  const largura = parseInt(form.get('largura'), 10) || null;
  const altura = parseInt(form.get('altura'), 10) || null;

  const chave = `imovel/${im.id}/${crypto.randomUUID()}`;
  await Promise.all([
    env.FOTOS.put(`${chave}/g.jpg`, g),
    env.FOTOS.put(`${chave}/p.jpg`, p),
  ]);
  const t = agora();
  const r = await env.DB.batch([
    env.DB.prepare(`INSERT INTO fotos (imovel_id, ordem, kv_chave, largura, altura, bytes, criado_em)
      VALUES (?, (SELECT COALESCE(MAX(ordem) + 1, 0) FROM fotos WHERE imovel_id = ?), ?, ?, ?, ?, ?)`)
      .bind(im.id, im.id, chave, largura, altura, g.length + p.length, t),
    env.DB.prepare('UPDATE imoveis SET atualizado_em = ? WHERE id = ?').bind(t, im.id),
  ]);
  return json({ id: r[0].meta.last_row_id, largura, altura, bytes: g.length + p.length, ...fotoUrls({ kv_chave: chave }) }, 201);
}
