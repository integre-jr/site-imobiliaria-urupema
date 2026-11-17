// Base64 e criptografia simétrica (AES-GCM com o segredo TOKEN_KEY) para guardar tokens no D1.
// Só Web APIs: roda igual no Workers e no Node.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const deB64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const aleatorio = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

async function chave(env) {
  if (!env.TOKEN_KEY) throw new Error('Segredo TOKEN_KEY não configurado');
  return crypto.subtle.importKey('raw', deB64(env.TOKEN_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// objeto → "<iv b64>.<dados b64>" (IV aleatório de 12 bytes guardado junto)
export async function cifrar(env, objeto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(env), enc.encode(JSON.stringify(objeto)));
  return `${b64(iv)}.${b64(dados)}`;
}

export async function decifrar(env, texto) {
  const [iv, dados] = String(texto).split('.');
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, await chave(env), deB64(dados));
  return JSON.parse(dec.decode(claro));
}
