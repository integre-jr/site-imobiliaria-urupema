// Interface única do Instagram (spec 9.1). O modo (mock | real) e o app da Meta saem de
// carregarApp(): primeiro o que o administrador salvou no painel (gaveta Instagram > "Conta real"),
// depois os segredos do servidor (IG_APP_ID / IG_APP_SECRET com INSTAGRAM_MODO=real).
// O resto do código não sabe qual provedor está ativo.
import { cifrar, decifrar } from '../cripto.js';
import { agora, executar, um } from '../db.js';
import * as mock from './mock.js';
import * as real from './real.js';

const DIA = 86400000;
export const VERSAO_PADRAO = 'v27.0';   // conferida na documentação da Meta em 18/11/2026

const provedor = (app) => (app.modo === 'real' ? real : mock);
export const redirectUri = (origem) => `${origem}/api/instagram/callback`;

// → { modo, appId, appSecret, versao, origem: 'painel' | 'servidor' | null }
export async function carregarApp(env) {
  const versao = env.IG_API_VERSION || VERSAO_PADRAO;
  const linha = await um(env.DB, "SELECT dados_cripto FROM integracoes WHERE nome = 'instagram_app'");
  if (linha) {
    const d = await decifrar(env, linha.dados_cripto);
    return { modo: 'real', appId: d.appId, appSecret: d.appSecret, versao, origem: 'painel' };
  }
  if (env.INSTAGRAM_MODO === 'real') {
    const ok = !!(env.IG_APP_ID && env.IG_APP_SECRET);
    return { modo: 'real', appId: env.IG_APP_ID, appSecret: env.IG_APP_SECRET, versao, origem: ok ? 'servidor' : null };
  }
  return { modo: 'mock', versao, origem: null };
}

export const appConfigurado = (app) => app.modo === 'mock' || !!(app.appId && app.appSecret);

// Credenciais do app da Meta digitadas no painel. Trocar de app (ou de modo) derruba a conexão.
export async function salvarApp(env, { appId, appSecret }) {
  await executar(
    env.DB,
    `INSERT INTO integracoes (nome, dados_cripto, conta_exibicao, expira_em, atualizado_em) VALUES ('instagram_app', ?, ?, NULL, ?)
     ON CONFLICT(nome) DO UPDATE SET dados_cripto = excluded.dados_cripto, conta_exibicao = excluded.conta_exibicao, atualizado_em = excluded.atualizado_em`,
    await cifrar(env, { appId, appSecret }), appId, agora(),
  );
  await desconectar(env);
}

export async function apagarApp(env) {
  await executar(env.DB, "DELETE FROM integracoes WHERE nome = 'instagram_app'");
  await desconectar(env);
}

export const conectarUrl = (app, state, origem) => provedor(app).conectarUrl(app, state, redirectUri(origem));

// Conexão salva → { token, userId, conta, expiraEm, obtidoEm, modo } ou null.
// Uma conexão feita em outro modo (ex.: a simulada, depois de ligar o modo real) não vale.
export async function lerConexao(env, app) {
  const linha = await um(env.DB, "SELECT * FROM integracoes WHERE nome = 'instagram'");
  if (!linha) return null;
  const dados = await decifrar(env, linha.dados_cripto);
  const modo = dados.modo || (String(dados.token).startsWith('mock_') ? 'mock' : 'real');
  if (app && modo !== app.modo) return null;
  return { token: dados.token, userId: dados.userId, conta: linha.conta_exibicao, expiraEm: linha.expira_em, obtidoEm: linha.atualizado_em, modo };
}

async function salvar(env, app, { token, userId, username, expiraEm }) {
  await executar(
    env.DB,
    `INSERT INTO integracoes (nome, dados_cripto, conta_exibicao, expira_em, atualizado_em) VALUES ('instagram', ?, ?, ?, ?)
     ON CONFLICT(nome) DO UPDATE SET dados_cripto = excluded.dados_cripto, conta_exibicao = excluded.conta_exibicao,
       expira_em = excluded.expira_em, atualizado_em = excluded.atualizado_em`,
    await cifrar(env, { token, userId, modo: app.modo }), username ? '@' + username.replace(/^@/, '') : null, expiraEm, agora(),
  );
}

export async function conectar(env, app, code, origem) {
  await salvar(env, app, await provedor(app).trocarCodigo(app, code, redirectUri(origem)));
}

export const desconectar = (env) => executar(env.DB, "DELETE FROM integracoes WHERE nome = 'instagram'");

// Renovação "preguiçosa" (sem cron, spec 9.4): faltando menos de 30 dias e com o token tendo
// mais de 24 h, pede um novo. Falha de renovação não derruba o painel; tenta de novo depois.
export async function renovarSeNecessario(env, app) {
  const c = await lerConexao(env, app);
  if (!c) return null;
  const resta = Date.parse(c.expiraEm) - Date.now();
  const idade = Date.now() - Date.parse(c.obtidoEm);
  if (resta <= 0 || resta >= 30 * DIA || idade < DIA) return c;
  try {
    const r = await provedor(app).renovar(app, c.token);
    await salvar(env, app, { token: r.token, userId: c.userId, username: c.conta, expiraEm: r.expiraEm });
    return await lerConexao(env, app);
  } catch (e) {
    console.error(e);
    return c;
  }
}

// ---------- Publicação (spec 9.2), em duas etapas ----------

// 1ª etapa: cria o post na Meta (contêiner) a partir das URLs públicas das imagens → { container }.
export const criarPost = (env, app, conexao, dados) => provedor(app).criarPost(env, app, conexao, dados);

// 2ª etapa: publica se o contêiner já estiver pronto → { pronto: false } | { pronto: true, mediaId, permalink }.
export const concluirPost = (env, app, conexao, container, extras) => provedor(app).concluirPost(env, app, conexao, container, extras);

// Posts usados nas últimas 24 h → { usados, limite }.
export const limiteUso = (env, app, conexao) => provedor(app).limiteUso(env, app, conexao);

// Imagens 4:5 geradas para os posts ficam no D1 por no máximo 24 h (spec 6).
export const limparMidiasTemp = (env) =>
  executar(env.DB, 'DELETE FROM instagram_midias_temp WHERE criado_em < ?', new Date(Date.now() - DIA).toISOString());
