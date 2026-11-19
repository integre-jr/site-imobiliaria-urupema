// POST /api/admin/imagens — troca uma foto fixa do site (ex.: fundo do topo da home). Só o administrador.
// Multipart: chave (campo do tipo 'imagem' em lib/config.js) + foto (JPEG já reduzido no navegador).
// A foto vai para o KV em site/<uuid>.jpg; a anterior é apagada.
import { soAdmin } from '../../../lib/auth.js';
import { CAMPOS, esquecerConfig, lerConfig, paraEditor, RE_IMAGEM_SITE } from '../../../lib/config.js';
import { agora } from '../../../lib/db.js';
import { erro, json } from '../../../lib/http.js';

const MAX = 2 * 1024 * 1024;

export async function onRequestPost({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;

  let form;
  try {
    form = await request.formData();
  } catch {
    return erro('Envio de foto inválido.');
  }
  const chave = form.get('chave');
  if (CAMPOS[chave]?.tipo !== 'imagem') return erro('Campo desconhecido.');

  const arquivo = form.get('foto');
  if (!arquivo || typeof arquivo.arrayBuffer !== 'function' || arquivo.size > MAX || arquivo.size < 100) {
    return erro('Foto inválida ou grande demais. Envie JPG ou PNG.');
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return erro('Foto inválida. Envie JPG ou PNG.');

  const anterior = (await lerConfig(env))[chave];
  const valor = `/fotos/site/${crypto.randomUUID()}.jpg`;
  await env.FOTOS.put(valor.slice('/fotos/'.length), bytes);
  await env.DB.prepare(`INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`).bind(chave, valor, agora()).run();

  const antiga = RE_IMAGEM_SITE.exec(anterior || '');
  if (antiga) await env.FOTOS.delete(antiga[1]);

  esquecerConfig();
  return json(paraEditor(await lerConfig(env)));
}
