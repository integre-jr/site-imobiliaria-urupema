// Instagram simulado (spec 9.1): "conectar" volta direto ao callback com code=mock e os posts
// não saem do site. Serve para a demonstração e para testar o painel sem conta real.
import { todos, um } from '../db.js';

const DIA = 86400000;

export function conectarUrl(app, state, redirectUri) {
  return `${redirectUri}?${new URLSearchParams({ code: 'mock', state })}`;
}

export async function trocarCodigo(app, code) {
  if (code !== 'mock') throw new Error('Código de autorização inválido (modo demonstração)');
  return {
    token: 'mock_' + crypto.randomUUID(),
    userId: '0',
    username: 'urupema_demo',
    expiraEm: new Date(Date.now() + 60 * DIA).toISOString(),
  };
}

export async function renovar(app, token) {
  return { token, expiraEm: new Date(Date.now() + 60 * DIA).toISOString() };
}

// Confere o mesmo que a Meta conferiria: cada imagem existe e é servida pelo site.
export async function criarPost(env, app, conexao, { midias }) {
  await new Promise((ok) => setTimeout(ok, 800));
  const marcas = midias.map(() => '?').join(',');
  const achadas = await todos(env.DB, `SELECT id FROM instagram_midias_temp WHERE id IN (${marcas})`, ...midias);
  if (achadas.length !== midias.length) throw new Error('Uma das imagens não está mais disponível. Gere o post de novo.');
  return { container: 'mock_c_' + Date.now() };
}

export async function concluirPost(env, app, conexao, container, { permalink }) {
  await new Promise((ok) => setTimeout(ok, 700));
  return { pronto: true, mediaId: 'mock_' + Date.now(), permalink };
}

export async function limiteUso(env) {
  const { n } = await um(env.DB, "SELECT count(*) AS n FROM instagram_posts WHERE modo = 'mock' AND status = 'publicado' AND criado_em > ?",
    new Date(Date.now() - DIA).toISOString());
  return { usados: n, limite: 100 };
}
