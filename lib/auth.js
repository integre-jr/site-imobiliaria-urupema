// Autenticação (spec, seção 8.1): senha com PBKDF2, sessão em cookie, força bruta e CSRF.
// Só Web APIs (WebCrypto), para rodar igual no Workers e no Node (scripts/hash-senha.mjs).

import { aleatorio, b64, deB64 } from './cripto.js';
import { executar, um } from './db.js';
import { erro, ipDe } from './http.js';

const ITERACOES = 100000;            // máximo aceito pelo PBKDF2 no Workers
const DIA = 86400000;
const JANELA_FALHAS = 15 * 60000;    // 5 falhas por IP em 15 min → 429
const MAX_FALHAS = 5;
export const COOKIE = '__Host-urupema_sessao';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Comparação em tempo constante de dois Uint8Array.
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

// Compara textos de tamanhos quaisquer sem vazar tamanho nem prefixo (ex.: SETUP_TOKEN).
export async function textosIguais(a, b) {
  const [ha, hb] = await Promise.all([a, b].map((t) => crypto.subtle.digest('SHA-256', enc.encode(String(t)))));
  return iguais(new Uint8Array(ha), new Uint8Array(hb));
}

async function pbkdf2(senha, salt, iteracoes) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteracoes }, chave, 256);
  return new Uint8Array(bits);
}

// Formato: "pbkdf2$100000$<salt b64>$<hash b64>"
export async function hashSenha(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERACOES}$${b64(salt)}$${b64(await pbkdf2(senha, salt, ITERACOES))}`;
}

export async function verificarSenha(senha, armazenado) {
  const [alg, iteracoes, salt, hash] = String(armazenado).split('$');
  if (alg !== 'pbkdf2' || !salt || !hash) return false;
  return iguais(await pbkdf2(senha, deB64(salt), Number(iteracoes)), deB64(hash));
}

// ---------- Sessão ----------

async function hashToken(env, token) {
  if (!env.SESSION_PEPPER) throw new Error('Segredo SESSION_PEPPER não configurado');
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(token + env.SESSION_PEPPER)));
}

// Sem "manter conectado", o cookie morre ao fechar o navegador (e o servidor limita a 7 dias).
function cookieSessao(token, maxAgeDias) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/` + (maxAgeDias ? `; Max-Age=${maxAgeDias * 86400}` : '');
}

export const cookieApagado = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

// Cria a sessão no D1 e devolve o valor do Set-Cookie.
export async function criarSessao(env, request, usuarioId, manter) {
  const token = aleatorio(32);
  const dias = manter ? 30 : 7;
  const t = Date.now();
  await executar(
    env.DB,
    'INSERT INTO sessoes (id_hash, usuario_id, expira_em, criado_em, ip, user_agent, dias) VALUES (?, ?, ?, ?, ?, ?, ?)',
    await hashToken(env, token), usuarioId, new Date(t + dias * DIA).toISOString(), new Date(t).toISOString(),
    ipDe(request), (request.headers.get('User-Agent') || '').slice(0, 300), dias,
  );
  return cookieSessao(token, manter ? dias : null);
}

function tokenDoCookie(request) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-urupema_sessao=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Sessão válida → { usuario, idHash, setCookie? }; senão null. Renova se faltar menos da metade.
export async function lerSessao(env, request) {
  const token = tokenDoCookie(request);
  if (!token) return null;
  const idHash = await hashToken(env, token);
  const s = await um(
    env.DB,
    `SELECT s.expira_em, s.dias, u.id, u.nome, u.email, u.papel
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id_hash = ? AND u.ativo = 1`,
    idHash,
  );
  if (!s) return null;
  const resta = Date.parse(s.expira_em) - Date.now();
  if (resta <= 0) {
    await executar(env.DB, 'DELETE FROM sessoes WHERE id_hash = ?', idHash);
    return null;
  }
  let setCookie;
  if (resta < (s.dias * DIA) / 2) {
    await executar(env.DB, 'UPDATE sessoes SET expira_em = ? WHERE id_hash = ?',
      new Date(Date.now() + s.dias * DIA).toISOString(), idHash);
    if (s.dias === 30) setCookie = cookieSessao(token, 30);
  }
  return { usuario: { id: s.id, nome: s.nome, email: s.email, papel: s.papel }, idHash, setCookie };
}

// Copia a resposta acrescentando o cookie renovado (se houver) e headers extras.
export function comHeaders(res, setCookie, extras = {}) {
  const nova = new Response(res.body, res);
  if (setCookie) nova.headers.append('Set-Cookie', setCookie);
  for (const [k, v] of Object.entries(extras)) nova.headers.set(k, v);
  return nova;
}

// ---------- Força bruta ----------

export async function bloqueado(env, ip) {
  const r = await um(env.DB, 'SELECT count(*) AS n FROM tentativas_login WHERE ip = ? AND quando > ?',
    ip, new Date(Date.now() - JANELA_FALHAS).toISOString());
  return r.n >= MAX_FALHAS;
}

export const registrarFalha = (env, ip, email) =>
  executar(env.DB, 'INSERT INTO tentativas_login (ip, email, quando) VALUES (?, ?, ?)',
    ip, String(email || '').slice(0, 200), new Date().toISOString());

export const erroBloqueio = () => erro('Muitas tentativas. Aguarde 15 minutos e tente de novo.', 429);

// ---------- CSRF e papéis ----------

// Métodos que alteram dados exigem o header que só o fetch do admin manda (spec 8.1).
export const csrfOk = (request) => ['GET', 'HEAD'].includes(request.method) || request.headers.get('X-Urupema') === '1';

export const soAdmin = (usuario) => (usuario.papel === 'admin' ? null : erro('Só o administrador pode fazer isso.', 403));
