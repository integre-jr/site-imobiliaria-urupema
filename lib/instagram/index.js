// Interface única do Instagram (spec 9.1). INSTAGRAM_MODO escolhe mock.js ou real.js;
// o resto do código não sabe qual está ativo.
import { cifrar, decifrar } from '../cripto.js';
import { agora, executar, um } from '../db.js';
import * as mock from './mock.js';
import * as real from './real.js';

const DIA = 86400000;

export const modo = (env) => (env.INSTAGRAM_MODO === 'real' ? 'real' : 'mock');
const provedor = (env) => (modo(env) === 'real' ? real : mock);
export const redirectUri = (env) => `${env.SITE_URL}/api/instagram/callback`;
export const appConfigurado = (env) => modo(env) === 'mock' || real.configurado(env);

export const conectarUrl = (env, state) => provedor(env).conectarUrl(env, state, redirectUri(env));

// Conexão salva → { token, userId, conta, expiraEm, obtidoEm } ou null.
export async function lerConexao(env) {
  const linha = await um(env.DB, "SELECT * FROM integracoes WHERE nome = 'instagram'");
  if (!linha) return null;
  const dados = await decifrar(env, linha.dados_cripto);
  return { token: dados.token, userId: dados.userId, conta: linha.conta_exibicao, expiraEm: linha.expira_em, obtidoEm: linha.atualizado_em };
}

async function salvar(env, { token, userId, username, expiraEm }) {
  await executar(
    env.DB,
    `INSERT INTO integracoes (nome, dados_cripto, conta_exibicao, expira_em, atualizado_em) VALUES ('instagram', ?, ?, ?, ?)
     ON CONFLICT(nome) DO UPDATE SET dados_cripto = excluded.dados_cripto, conta_exibicao = excluded.conta_exibicao,
       expira_em = excluded.expira_em, atualizado_em = excluded.atualizado_em`,
    await cifrar(env, { token, userId }), username ? '@' + username.replace(/^@/, '') : null, expiraEm, agora(),
  );
}

export async function conectar(env, code) {
  await salvar(env, await provedor(env).trocarCodigo(env, code, redirectUri(env)));
}

export const desconectar = (env) => executar(env.DB, "DELETE FROM integracoes WHERE nome = 'instagram'");

// Renovação "preguiçosa" (sem cron, spec 9.4): faltando menos de 30 dias e com o token tendo
// mais de 24 h, pede um novo. Falha de renovação não derruba o painel; tenta de novo depois.
export async function renovarSeNecessario(env) {
  const c = await lerConexao(env);
  if (!c) return null;
  const resta = Date.parse(c.expiraEm) - Date.now();
  const idade = Date.now() - Date.parse(c.obtidoEm);
  if (resta <= 0 || resta >= 30 * DIA || idade < DIA) return c;
  try {
    const r = await provedor(env).renovar(env, c.token);
    await salvar(env, { token: r.token, userId: c.userId, username: c.conta, expiraEm: r.expiraEm });
    return await lerConexao(env);
  } catch (e) {
    console.error(e);
    return c;
  }
}

// Imagens 4:5 geradas para os posts ficam no D1 por no máximo 24 h (spec 6).
export const limparMidiasTemp = (env) =>
  executar(env.DB, 'DELETE FROM instagram_midias_temp WHERE criado_em < ?', new Date(Date.now() - DIA).toISOString());
