// Volta do login do Instagram (redirect URI cadastrado no app da Meta: <domínio do site>/api/instagram/callback;
// a gaveta Instagram mostra o endereço exato). Exige sessão de admin e o mesmo state do cookie criado em
// /api/admin/instagram/conectar. Sempre termina num redirecionamento para o painel, com ?instagram=conectado|cancelado|erro.
import { lerSessao, textosIguais } from '../../../lib/auth.js';
import { carregarApp, conectar } from '../../../lib/instagram/index.js';

const COOKIE_STATE = '__Host-urupema_ig_state';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const voltar = (resultado) => new Response(null, {
    status: 302,
    headers: {
      Location: new URL(`/admin/?instagram=${resultado}`, url).href,
      'Set-Cookie': `${COOKIE_STATE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      'Cache-Control': 'no-store',
    },
  });

  const s = await lerSessao(env, request);
  if (!s || s.usuario.papel !== 'admin') return voltar('erro');

  if (url.searchParams.get('error')) return voltar('cancelado');   // o dono clicou em "Cancelar" no Instagram

  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-urupema_ig_state=([A-Za-z0-9_-]+)/);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!cookie || !state || !code || !(await textosIguais(cookie[1], state))) return voltar('erro');

  try {
    await conectar(env, await carregarApp(env), code, url.origin);
  } catch (e) {
    console.error(e);
    return voltar('erro');
  }
  return voltar('conectado');
}
