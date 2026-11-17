// Dados editáveis do site (telefones, e-mail, endereço, redes, números da home). Só o administrador.
import { soAdmin } from '../../../lib/auth.js';
import { CAMPOS, esquecerConfig, lerConfig, normalizar, paraEditor } from '../../../lib/config.js';
import { agora } from '../../../lib/db.js';
import { erro, json, lerJson } from '../../../lib/http.js';

export async function onRequestGet({ env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  esquecerConfig();
  return json(paraEditor(await lerConfig(env)));
}

// Corpo: { valores: { "contato.telefone_1": "(49) 9...", ... } }. Grava tudo ou nada.
export async function onRequestPut({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;

  const b = (await lerJson(request)) || {};
  const entradas = Object.entries(b.valores || {});
  if (!entradas.length) return erro('Nada para salvar.');

  const prontos = [];
  for (const [chave, bruto] of entradas) {
    if (!CAMPOS[chave]) return erro('Campo desconhecido.', 400, chave);
    const r = normalizar(chave, bruto);
    if (r.erro) return erro(r.erro, 400, chave);
    prontos.push([chave, r.valor]);
  }

  const t = agora();
  await env.DB.batch(prontos.map(([chave, valor]) =>
    env.DB.prepare(`INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
      ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`).bind(chave, valor, t)));

  esquecerConfig();
  return json(paraEditor(await lerConfig(env)));
}
