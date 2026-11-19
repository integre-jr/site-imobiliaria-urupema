// "Conectar Instagram" (só admin). É uma navegação do navegador, não um fetch: cria o state
// anti-falsificação num cookie de 10 min e manda o dono para o login do Instagram (no modo
// demonstração, direto para o callback). O endereço de retorno usa o domínio atual do site.
import { soAdmin } from '../../../../lib/auth.js';
import { aleatorio } from '../../../../lib/cripto.js';
import { conectarUrl } from '../../../../lib/instagram/index.js';

const COOKIE_STATE = '__Host-urupema_ig_state';

export function onRequestGet({ request, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const state = aleatorio(24);
  let destino;
  try {
    destino = conectarUrl(data.igApp, state, new URL(request.url).origin);
  } catch (e) {
    console.error(e);
    destino = new URL('/admin/?instagram=erro', request.url).href;
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      'Set-Cookie': `${COOKIE_STATE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
